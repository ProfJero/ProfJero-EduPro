import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ClipboardCheck, Pencil, Sparkles, XCircle } from 'lucide-react';
import { Alert, Avatar, Button, Card, CardBody, CardHeader, Checkbox, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/utils';
import { isoToLocalInput, localInputToIso, tzAbbrev } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { LIVE_SELECT, type LiveSessionRow } from '@/features/learning/queries';
import { useTeachingTargets } from '@/features/assessments/TeacherAssessments';
import { useRoomMembers } from '@/features/classroom/ClassroomPanel';
import { SessionCard } from './SessionCard';
import { liveApi, providerSlug } from './liveApi';
import { PROVIDERS, PROVIDER_CHOICES, validateMeetingLink, type ProviderId } from './providers';

export function TeacherLive() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState<LiveSessionRow | 'new' | null>(params.get('class') ? 'new' : null);
  const [attendance, setAttendance] = useState<LiveSessionRow | null>(null);
  const [cancel, setCancel] = useState<LiveSessionRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['host-all-sessions', user?.id],
    queryFn: async () => unwrap(await supabase.from('live_sessions').select(LIVE_SELECT).eq('host_id', user!.id).order('starts_at', { ascending: false }).limit(200)) as unknown as LiveSessionRow[],
  });
  const now = Date.now();
  const upcoming = (data ?? []).filter((s) => new Date(s.starts_at).getTime() + s.duration_minutes * 60_000 > now && s.status !== 'cancelled').reverse();
  const past = (data ?? []).filter((s) => !upcoming.includes(s));
  const manage = (s: LiveSessionRow) => (
    <div className="flex gap-1">
      <Button size="icon" variant="ghost" aria-label="Edit or reschedule" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" aria-label="Attendance" onClick={() => setAttendance(s)}><ClipboardCheck className="h-4 w-4" /></Button>
      {s.status !== 'cancelled' && <Button size="icon" variant="ghost" aria-label="Cancel session" onClick={() => setCancel(s)}><XCircle className="h-4 w-4" /></Button>}
    </div>
  );
  return (
    <div>
      <PageHeader title="Live classes" description="Schedule sessions on Google Meet, Zoom, Jitsi or any meeting link. Learners see them in their timetable and get reminders." actions={<Button leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setEditing('new')}>Schedule session</Button>} />
      {isLoading ? <LoadingBlock /> : (
        <Tabs tabs={[
          { value: 'up', label: 'Upcoming', count: upcoming.length, content: upcoming.length ? <div className="space-y-3">{upcoming.map((s) => <SessionCard key={s.id} s={s} manage={manage(s)} />)}</div> : <EmptyState icon={<CalendarPlus className="h-7 w-7" />} title="No upcoming sessions" action={<Button onClick={() => setEditing('new')}>Schedule one</Button>} /> },
          { value: 'past', label: 'Past & cancelled', count: past.length, content: past.length ? <div className="space-y-3">{past.map((s) => <SessionCard key={s.id} s={s} manage={manage(s)} />)}</div> : <EmptyState title="No past sessions" /> },
        ]} />
      )}
      <SessionDialog session={editing} defaultClass={params.get('class')} onClose={() => setEditing(null)} />
      <AttendanceDialog session={attendance} onClose={() => setAttendance(null)} />
      <CancelDialog session={cancel} onClose={() => setCancel(null)} />
    </div>
  );
}

function SessionDialog({ session, defaultClass, onClose }: { session: LiveSessionRow | 'new' | null; defaultClass: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const targets = useTeachingTargets();
  const isNew = session === 'new';
  const [f, setF] = useState({ title: '', description: '', agenda: '', provider: 'google_meet' as ProviderId, join_url: '', target: '', starts_at: '', duration_minutes: 60, recording_url: '', embed_in_app: false, provider_meeting_id: '' });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session === 'new') setF((x) => ({ ...x, title: '', description: '', agenda: '', join_url: '', recording_url: '', starts_at: '', embed_in_app: false, provider_meeting_id: '', target: defaultClass ? `class:${defaultClass}` : '' }));
    else if (session) setF({ title: session.title, description: session.description ?? '', agenda: '', provider: session.provider as ProviderId, join_url: session.join_url, target: session.course_id ? `course:${session.course_id}` : `class:${session.class_id}`, starts_at: isoToLocalInput(session.starts_at), duration_minutes: session.duration_minutes, recording_url: session.recording_url ?? '', embed_in_app: Boolean((session as LiveSessionRow & { embed_in_app?: boolean }).embed_in_app), provider_meeting_id: '' });
  }, [session, defaultClass]);
  const p = PROVIDERS[f.provider];
  const save = async () => {
    setErr(null);
    const linkErr = validateMeetingLink(f.provider, f.join_url);
    if (linkErr) return setErr(linkErr);
    const starts = localInputToIso(f.starts_at);
    if (!starts) return setErr('Choose a date and time');
    const [scope, id] = (f.target || targets.options[0]?.v || '').split(':');
    const row = { title: f.title.trim(), description: f.description || null, agenda: f.agenda || null, provider: f.provider, join_url: f.join_url.trim(), starts_at: starts, duration_minutes: f.duration_minutes, recording_url: f.recording_url || null, embed_in_app: f.provider === 'jitsi' && f.embed_in_app, ...(f.provider_meeting_id ? { provider_meeting_id: f.provider_meeting_id } : {}) };
    setBusy(true);
    const res = isNew
      ? await supabase.from('live_sessions').insert({ ...row, host_id: user!.id, course_id: scope === 'course' ? id : null, class_id: scope === 'class' ? id : null })
      : await supabase.from('live_sessions').update(row).eq('id', (session as LiveSessionRow).id);
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    toast.success(isNew ? 'Session scheduled — learners notified' : 'Session updated');
    void qc.invalidateQueries({ queryKey: ['host-all-sessions'] });
    void qc.invalidateQueries({ queryKey: ['live-sessions'] });
    onClose();
  };
  return (
    <Dialog open={Boolean(session)} onOpenChange={(o) => !o && onClose()} title={isNew ? 'Schedule a live class' : 'Edit live class'} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={f.title.trim().length < 2} onClick={save}>{isNew ? 'Schedule & notify learners' : 'Save changes'}</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Session title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Loops clinic" /></Field>
        {isNew && <Field label="For"><Select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>{targets.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Date & time (${tzAbbrev()})`}><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></Field>
          <Field label="Duration (minutes)"><Input type="number" min={5} max={600} value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Meeting provider"><Select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value as ProviderId })}>{PROVIDER_CHOICES.map((id) => <option key={id} value={id}>{PROVIDERS[id].name}</option>)}</Select></Field>
        <Field label="Meeting link" hint={p.help}>
          <div className="flex gap-2"><Input value={f.join_url} onChange={(e) => setF({ ...f, join_url: e.target.value })} placeholder={p.placeholder} />{p.generateLink && <Button variant="outline" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => setF({ ...f, join_url: p.generateLink!(f.title) })}>Generate</Button>}
            {(f.provider === 'zoom' || f.provider === 'google_meet') && env.apiBase && (
              <Button variant="outline" loading={creating} leftIcon={<Sparkles className="h-4 w-4" />} onClick={async () => {
                const starts = localInputToIso(f.starts_at);
                if (!starts || f.title.trim().length < 2) return setErr('Add a title, date and time first');
                setErr(null); setCreating(true);
                try {
                  const r = await liveApi<{ join_url: string; meeting_id: string }>(`/api/live/${providerSlug(f.provider)}/meetings`, { body: { title: f.title.trim(), starts_at: starts, duration_minutes: f.duration_minutes, agenda: f.agenda || f.description || '' } });
                  setF((x) => ({ ...x, join_url: r.join_url, provider_meeting_id: r.meeting_id }));
                  toast.success(`${p.name} meeting created`);
                } catch (e) { setErr(`${errorMessage(e)} Connect your account in Settings → Apps, or paste a link.`); }
                setCreating(false);
              }}>Create</Button>
            )}</div>
        </Field>
        {f.provider === 'jitsi' && <Checkbox label="Hold the class inside ProfJero Edu" description="Learners join the video right here, next to the class board and chat — no app to install." checked={f.embed_in_app} onChange={(e) => setF({ ...f, embed_in_app: e.target.checked })} />}
        <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Agenda"><Textarea rows={2} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></Field>
        {!isNew && <Field label="Recording link (after class)"><Input value={f.recording_url} onChange={(e) => setF({ ...f, recording_url: e.target.value })} placeholder="https://" /></Field>}
      </div>
    </Dialog>
  );
}

function CancelDialog({ session, onClose }: { session: LiveSessionRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  return (
    <Dialog open={Boolean(session)} onOpenChange={(o) => !o && onClose()} title="Cancel this session?" description="Learners are notified with your reason." size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Keep it</Button><Button variant="danger" onClick={async () => {
        const { error } = await supabase.from('live_sessions').update({ status: 'cancelled', cancel_reason: reason || null }).eq('id', session!.id);
        if (error) toast.error('Could not cancel', error.message); else { toast.success('Session cancelled'); void qc.invalidateQueries({ queryKey: ['host-all-sessions'] }); onClose(); }
      }}>Cancel session</Button></>}>
      <Field label="Reason (optional)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Dialog>
  );
}

function AttendanceDialog({ session, onClose }: { session: LiveSessionRow | null; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const members = useRoomMembers('session', session?.id);
  const att = useQuery({ queryKey: ['live-attendance', session?.id], enabled: Boolean(session), queryFn: async () => unwrap(await supabase.from('live_session_attendance').select('user_id, status, source, joined_at').eq('session_id', session!.id)) });
  const map = new Map((att.data ?? []).map((a) => [a.user_id, a]));
  const set = async (uid: string, status: string) => {
    const { error } = await supabase.from('live_session_attendance').upsert({ session_id: session!.id, user_id: uid, status, source: 'manual', marked_by: user!.id }, { onConflict: 'session_id,user_id' });
    if (error) toast.error('Not saved', error.message); else void att.refetch();
  };
  return (
    <Dialog open={Boolean(session)} onOpenChange={(o) => !o && onClose()} title={`Attendance — ${session?.title ?? ''}`} description="Learners who used “Join class” are recorded automatically. Adjust or mark manually." size="lg">
      <Card><CardHeader title="Register" /><CardBody>
        {members.isLoading || att.isLoading ? <LoadingBlock rows={2} /> : (
          <ul className="divide-y divide-ink-100">{(members.data ?? []).filter((m) => m.member_role === 'learner').map((m) => {
            const a = map.get(m.user_id);
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <Avatar name={m.name} size={30} /><span className="flex-1 font-medium">{m.name}{a?.source === 'join_click' && <span className="ml-2 text-xs text-growth-700">joined via app</span>}</span>
                <Select value={a?.status ?? ''} onChange={(e) => set(m.user_id, e.target.value)} className="h-9 w-36" aria-label={`Attendance for ${m.name}`}><option value="" disabled>Not marked</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></Select>
              </li>
            );
          })}</ul>
        )}
      </CardBody></Card>
    </Dialog>
  );
}

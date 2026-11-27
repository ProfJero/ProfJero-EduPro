import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Video, X } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Dialog, Field, Input, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, fromNow } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { PROVIDERS, validateMeetingLink, type ProviderId } from '@/features/live/providers';

type GroupSession = { id: string; title: string; starts_at: string; duration_minutes: number; status: string; host_id: string; agenda: string | null };

/** Live classes for a study group — only its members can see and join them. */
export function GroupLive({ groupId, groupName, canManage }: { groupId: string; groupName: string; canManage: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const sessions = useQuery({
    queryKey: ['group-live', groupId],
    queryFn: async () => unwrap(await supabase.from('live_sessions').select('id, title, starts_at, duration_minutes, status, host_id, agenda').eq('group_id', groupId)
      .gte('starts_at', new Date(Date.now() - 3 * 3_600_000).toISOString()).order('starts_at').limit(10)) as GroupSession[],
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('live_sessions').update({ status: 'cancelled', cancel_reason: 'Cancelled by the group' }).eq('id', id)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['group-live', groupId] }); toast.success('Cancelled', 'Group members were told.'); },
    onError: (e) => toast.error('Could not cancel', errorMessage(e)),
  });
  const upcoming = (sessions.data ?? []).filter((s) => s.status !== 'cancelled');
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><Video className="h-5 w-5 text-violet-600" />Group live classes</span>} description="Only members of this group can see and join."
        action={<Button size="sm" leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>Schedule</Button>} />
      <CardBody className="space-y-2">
        {upcoming.length ? upcoming.map((s) => {
          const live = Date.now() >= new Date(s.starts_at).getTime() - 10 * 60_000 && Date.now() <= new Date(s.starts_at).getTime() + s.duration_minutes * 60_000;
          return (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border border-ink-100 p-2.5">
              <div className="min-w-0 flex-1"><Link to={`/learn/live/${s.id}`} className="block truncate font-semibold hover:text-brand-700">{s.title}</Link>
                <p className="text-xs text-ink-500">{fmtDateTime(s.starts_at)} · {s.duration_minutes} min · {fromNow(s.starts_at)}</p></div>
              {live ? <Link to={`/learn/live/${s.id}`} className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Join now</Link> : <Badge>Upcoming</Badge>}
              {(s.host_id === user?.id || canManage) && <button onClick={() => cancel.mutate(s.id)} className="rounded p-1 text-ink-400 hover:text-red-600" aria-label={`Cancel ${s.title}`}><X className="h-4 w-4" /></button>}
            </div>
          );
        }) : <p className="text-sm text-ink-500">No group live class yet. Schedule one to revise together — everyone in {groupName} is notified.</p>}
      </CardBody>
      <ScheduleGroupLive open={open} onOpenChange={setOpen} groupId={groupId} groupName={groupName} onDone={() => void qc.invalidateQueries({ queryKey: ['group-live', groupId] })} />
    </Card>
  );
}

function ScheduleGroupLive({ open, onOpenChange, groupId, groupName, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; groupId: string; groupName: string; onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const soon = new Date(Date.now() + 60 * 60_000);
  soon.setMinutes(0, 0, 0);
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [f, setF] = useState({ title: `${groupName} revision`, when: local(soon), duration: 45, provider: 'jitsi' as ProviderId, link: '', agenda: '', embed: true });
  const linkError = f.provider === 'jitsi' ? null : f.link ? validateMeetingLink(f.provider, f.link) : 'Paste the meeting link';
  const save = useMutation({
    mutationFn: async () => {
      const join_url = f.provider === 'jitsi' ? PROVIDERS.jitsi.generateLink!(f.title) : f.link.trim();
      return unwrap(await supabase.from('live_sessions').insert({
        title: f.title.trim(), agenda: f.agenda.trim() || null, group_id: groupId, host_id: user!.id, provider: f.provider === 'jitsi' ? 'jitsi' : f.provider === 'google_meet' ? 'google_meet' : f.provider === 'zoom' ? 'zoom' : 'manual',
        join_url, starts_at: new Date(f.when).toISOString(), duration_minutes: f.duration, embed_in_app: f.provider === 'jitsi' && f.embed,
      }).select('id').single());
    },
    onSuccess: () => { onOpenChange(false); onDone(); toast.success('Group live class scheduled', 'Your group members have been notified.'); },
    onError: (e) => toast.error('Could not schedule', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Schedule a group live class" description={`Only members of ${groupName} will see it. Use the chat on the session page to discuss during the call.`}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={f.title.trim().length < 2 || Boolean(linkError) || !f.when} loading={save.isPending} onClick={() => save.mutate()}>Schedule</Button></>}>
      <div className="space-y-4">
        <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts" required><Input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
          <Field label="Length"><Select value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })}>{[20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select></Field>
        </div>
        <Field label="Meeting"><Select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value as ProviderId })}>
          <option value="jitsi">Jitsi Meet — free, link created for you</option><option value="google_meet">Google Meet link</option><option value="zoom">Zoom link</option><option value="manual">Another meeting link</option>
        </Select></Field>
        {f.provider === 'jitsi'
          ? <Checkbox label="Hold the call inside ProfJero Edu" description="Members join from the session page without leaving the app." checked={f.embed} onChange={(e) => setF({ ...f, embed: e.target.checked })} />
          : <Field label="Meeting link" required error={f.link ? linkError ?? undefined : undefined}><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder={PROVIDERS[f.provider].placeholder} /></Field>}
        <Field label="What will you cover? (optional)"><Textarea rows={2} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} maxLength={2000} /></Field>
      </div>
    </Dialog>
  );
}

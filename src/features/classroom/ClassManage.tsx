import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Crown, KeyRound, Mail, Plus, QrCode, RefreshCw, Trash2, UserCheck, Users, X } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Checkbox, Dialog, EmptyState, Field, Input, LoadingBlock, ProgressBar, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { CreateGroupDialog, PERMISSION_LABELS } from '@/features/connect/ConnectHub';
import { useRoomMembers } from './ClassroomPanel';
import { classColor } from './LearnerClasses';

export type ClassInfo = { id: string; name: string; stream: string | null; level: string | null; description: string | null; room_label: string | null; color: string; school_id: string | null; owner_id: string | null; subject: string | null;
  join_code: string | null; join_enabled: boolean; allow_guests: boolean; join_requires_approval: boolean; academic_year_id: string | null; school: { name: string } | null };

export function CreateClassDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', subject: '', level: '', description: '', color: 'blue', allow_guests: false, join_requires_approval: false });
  const create = useMutation({
    mutationFn: async () => unwrap(await supabase.from('school_classes').insert({ name: f.name.trim(), subject: f.subject.trim() || null, level: f.level.trim() || null, description: f.description.trim() || null, color: f.color, owner_id: user!.id, school_id: null, allow_guests: f.allow_guests, join_requires_approval: f.join_requires_approval }).select('id').single()),
    onSuccess: (c) => { onOpenChange(false); void qc.invalidateQueries({ queryKey: ['teaching-classes'] }); toast.success('Class created', 'Share the join code or link with your learners.'); nav(`/teach/classes/${c.id}?tab=join`); },
    onError: (e) => toast.error('Could not create the class', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Create your own class" description="Run a class of your own — tuition, a club, a revision group. Learners join with a code or link."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={f.name.trim().length < 2} loading={create.isPending} onClick={() => create.mutate()}>Create class</Button></>}>
      <div className="space-y-4">
        <Field label="Class name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} placeholder="JHS 3 Maths Revision" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={80} placeholder="Mathematics" /></Field>
          <Field label="Level"><Input value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} maxLength={40} placeholder="Basic 9" /></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={1000} /></Field>
        <div><p className="mb-1.5 text-sm font-semibold text-ink-700">Colour</p><div className="flex gap-2">{Object.entries(classColor).map(([k, cls]) => <button key={k} type="button" onClick={() => setF({ ...f, color: k })} aria-label={k} aria-pressed={f.color === k} className={cn('h-8 w-8 rounded-full', cls, f.color === k && 'ring-2 ring-offset-2 ring-ink-800')} />)}</div></div>
        <Checkbox label="Let people join as guests (no account)" description="Good for one-off sessions. Guests can later save their progress by adding an email." checked={f.allow_guests} onChange={(e) => setF({ ...f, allow_guests: e.target.checked })} />
        <Checkbox label="I approve each person who joins" checked={f.join_requires_approval} onChange={(e) => setF({ ...f, join_requires_approval: e.target.checked })} />
      </div>
    </Dialog>
  );
}

/** Join code, invite link, guest/approval settings, email invitations and join requests. */
export function JoinSettings({ cls }: { cls: ClassInfo }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [emails, setEmails] = useState('');
  const link = `${location.origin}/join/${cls.join_code ?? ''}`;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['class', cls.id] });
  const update = useMutation({ mutationFn: async (patch: { join_enabled?: boolean; allow_guests?: boolean; join_requires_approval?: boolean }) => unwrap(await supabase.from('school_classes').update(patch).eq('id', cls.id)), onSuccess: () => void invalidate(), onError: (e) => toast.error('Not saved', errorMessage(e)) });
  const regen = useMutation({ mutationFn: async () => unwrap(await supabase.rpc('regenerate_join_code', { p_class: cls.id })), onSuccess: () => { void invalidate(); toast.success('New code created', 'The old code and link no longer work.'); } });
  const invite = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('invite_to_class', { p_class: cls.id, p_emails: emails.split(/[\s,;]+/).filter(Boolean) })) as unknown as { invited: number },
    onSuccess: (r) => { setEmails(''); toast.success(`${r.invited} invitation${r.invited === 1 ? '' : 's'} sent`, 'People with accounts get a notification; others can accept after signing up with that email.'); void qc.invalidateQueries({ queryKey: ['class-invites', cls.id] }); },
    onError: (e) => toast.error('Could not invite', errorMessage(e)),
  });
  const invites = useQuery({ queryKey: ['class-invites', cls.id], queryFn: async () => unwrap(await supabase.from('class_invitations').select('id, email, status, created_at').eq('class_id', cls.id).order('created_at', { ascending: false }).limit(50)) });
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success('Copied'); } catch { toast.error('Copy failed'); } };
  if (cls.school_id) return <Alert tone="info">This is a school class — your school administrator manages who is in it.</Alert>;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><KeyRound className="h-5 w-5 text-brand-600" />Join code & link</span>} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="rounded-2xl bg-ink-950 px-5 py-3 font-mono text-3xl font-extrabold tracking-[0.3em] text-white">{cls.join_code}</p>
            <Button variant="secondary" size="sm" leftIcon={<Copy className="h-4 w-4" />} onClick={() => void copy(cls.join_code ?? '')}>Copy code</Button>
            <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} loading={regen.isPending} onClick={() => regen.mutate()}>New code</Button>
          </div>
          <div className="flex gap-2"><Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} /><Button variant="secondary" onClick={() => void copy(link)} aria-label="Copy link"><Copy className="h-4 w-4" /></Button></div>
          <p className="flex items-center gap-1.5 text-xs text-ink-500"><QrCode className="h-3.5 w-3.5" />Tip: write the code on the board, or share the link on WhatsApp.</p>
          <div className="space-y-3 border-t border-ink-100 pt-4">
            <Checkbox label="Joining with the code/link is on" checked={cls.join_enabled} onChange={(e) => update.mutate({ join_enabled: e.target.checked })} />
            <Checkbox label="Allow guests (no account needed)" description="Guests appear with a guest badge. They can’t take graded assessments until they add an email." checked={cls.allow_guests} onChange={(e) => update.mutate({ allow_guests: e.target.checked })} />
            <Checkbox label="Require my approval to join" checked={cls.join_requires_approval} onChange={(e) => update.mutate({ join_requires_approval: e.target.checked })} />
          </div>
        </CardBody>
      </Card>
      <div className="space-y-5">
        <JoinRequests classId={cls.id} />
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><Mail className="h-5 w-5 text-brand-600" />Invite by email</span>} />
          <CardBody className="space-y-3">
            <Textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ama@example.com, kofi@example.com" aria-label="Email addresses" />
            <Button disabled={!emails.trim()} loading={invite.isPending} onClick={() => invite.mutate()}>Send invitations</Button>
            {invites.data?.length ? <ul className="divide-y divide-ink-100 text-sm">{invites.data.map((i) => <li key={i.id} className="flex items-center gap-2 py-1.5"><span className="flex-1 truncate">{i.email}</span><Badge tone={i.status === 'accepted' ? 'green' : i.status === 'declined' ? 'red' : 'neutral'}>{i.status}</Badge><span className="text-xs text-ink-400">{fromNow(i.created_at)}</span></li>)}</ul> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function JoinRequests({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['join-requests', classId], queryFn: async () => unwrap(await supabase.rpc('class_join_requests', { p_class: classId })) });
  const review = useMutation({
    mutationFn: async (v: { user: string; approve: boolean }) => unwrap(await supabase.rpc('review_join_request', { p_class: classId, p_user: v.user, p_approve: v.approve })),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['join-requests', classId] }); void qc.invalidateQueries({ queryKey: ['room-members'] }); },
    onError: (e) => toast.error('Could not update', errorMessage(e)),
  });
  if (!q.data?.length) return null;
  return (
    <Card className="border-sun-100">
      <CardHeader title={<span className="inline-flex items-center gap-2"><UserCheck className="h-5 w-5 text-sun-700" />Waiting to join ({q.data.length})</span>} />
      <CardBody><ul className="space-y-2">{q.data.map((r) => (
        <li key={r.user_id} className="flex items-center gap-2 text-sm"><Avatar name={r.name} size={28} /><span className="flex-1 truncate font-medium">{r.name}{r.is_guest && <Badge className="ml-2">Guest</Badge>}</span><span className="text-xs text-ink-400">{fromNow(r.requested_at)}</span>
          <Button size="sm" onClick={() => review.mutate({ user: r.user_id, approve: true })} aria-label={`Approve ${r.name}`}><Check className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => review.mutate({ user: r.user_id, approve: false })} aria-label={`Decline ${r.name}`}><X className="h-4 w-4" /></Button></li>
      ))}</ul></CardBody>
    </Card>
  );
}

/** Class prefects / leaders with teacher-chosen permissions. */
export function LeadersPanel({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const members = useRoomMembers('class', classId);
  const leaders = useQuery({ queryKey: ['class-leaders', classId], queryFn: async () => unwrap(await supabase.from('class_leaders').select('user_id, title, permissions').eq('class_id', classId)) });
  const [draft, setDraft] = useState<{ user_id: string; title: string; permissions: string[] } | null>(null);
  const save = useMutation({
    mutationFn: async () => unwrap(await supabase.from('class_leaders').upsert({ class_id: classId, user_id: draft!.user_id, title: draft!.title.trim(), permissions: draft!.permissions, assigned_by: user!.id }, { onConflict: 'class_id,user_id' })),
    onSuccess: () => { setDraft(null); void qc.invalidateQueries({ queryKey: ['class-leaders', classId] }); toast.success('Leader saved'); },
    onError: (e) => toast.error('Could not save', errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: async (uid: string) => unwrap(await supabase.from('class_leaders').delete().eq('class_id', classId).eq('user_id', uid)), onSuccess: () => void qc.invalidateQueries({ queryKey: ['class-leaders', classId] }) });
  const learners = (members.data ?? []).filter((m) => m.member_role === 'learner');
  const name = (uid: string) => members.data?.find((m) => m.user_id === uid)?.name ?? 'Learner';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm text-ink-600">Give learners responsibility: class prefects, group leaders, subject reps. You decide exactly what each leader can do.</p>
        <Button leftIcon={<Plus className="h-4 w-4" />} disabled={!learners.length} onClick={() => setDraft({ user_id: '', title: 'Class prefect', permissions: ['post_board', 'take_attendance'] })}>Add a leader</Button></div>
      {leaders.isLoading ? <LoadingBlock rows={2} /> : leaders.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">{leaders.data.map((l) => (
          <Card key={l.user_id}><CardBody>
            <div className="flex items-center gap-3"><Avatar name={name(l.user_id)} size={36} /><div className="min-w-0 flex-1"><p className="font-bold">{name(l.user_id)}</p><p className="flex items-center gap-1 text-sm text-sun-700"><Crown className="h-3.5 w-3.5" />{l.title}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setDraft({ user_id: l.user_id, title: l.title, permissions: l.permissions })}>Edit</Button><Button size="sm" variant="ghost" onClick={() => remove.mutate(l.user_id)} aria-label="Remove leader"><Trash2 className="h-4 w-4" /></Button></div>
            <div className="mt-2 flex flex-wrap gap-1">{l.permissions.map((p) => <Badge key={p}>{PERMISSION_LABELS[p] ?? p}</Badge>)}</div>
          </CardBody></Card>
        ))}</div>
      ) : <EmptyState icon={<Crown className="h-7 w-7" />} title="No class leaders yet" description="Appoint a prefect to help run the class board, register and discussions." />}
      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)} title="Class leader" footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!draft?.user_id || (draft?.title.trim().length ?? 0) < 2} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
        {draft && <div className="space-y-4">
          <Field label="Learner"><Select value={draft.user_id} onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}><option value="">Choose…</option>{learners.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</Select></Field>
          <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={60} list="leader-titles" /></Field>
          <datalist id="leader-titles"><option>Class prefect</option><option>Assistant prefect</option><option>Group leader</option><option>Subject representative</option><option>Sanitation prefect</option></datalist>
          <fieldset className="space-y-2"><legend className="text-sm font-semibold text-ink-700">Permissions</legend>
            {Object.entries(PERMISSION_LABELS).map(([k, label]) => <Checkbox key={k} label={label} checked={draft.permissions.includes(k)} onChange={(e) => setDraft({ ...draft, permissions: e.target.checked ? [...draft.permissions, k] : draft.permissions.filter((x) => x !== k) })} />)}
          </fieldset>
        </div>}
      </Dialog>
    </div>
  );
}

export function ClassGroups({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const groups = useQuery({ queryKey: ['class-groups', classId], queryFn: async () => unwrap(await supabase.from('study_groups').select('id, name, topic, visibility, max_members, members:study_group_members(user_id)').eq('class_id', classId).order('created_at')) as unknown as { id: string; name: string; topic: string | null; visibility: string; max_members: number; members: { user_id: string }[] }[] });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-ink-600">Small groups for peer learning, projects and revision. Each group gets its own board, discussion and polls.</p><Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New group</Button></div>
      {groups.data?.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{groups.data.map((g) => (
        <Link key={g.id} to={`/connect/groups/${g.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300"><Users className="h-5 w-5 text-growth-600" /><span className="min-w-0 flex-1"><span className="block truncate font-bold">{g.name}</span><span className="text-xs text-ink-500">{g.members.length}/{g.max_members} members{g.topic ? ` · ${g.topic}` : ''}</span></span>{g.visibility === 'invite' && <Badge>Invite only</Badge>}</Link>
      ))}</div> : <EmptyState icon={<Users className="h-7 w-7" />} title="No study groups yet" />}
      <CreateGroupDialog open={open} onOpenChange={setOpen} defaultClass={classId} />
    </div>
  );
}

export function ClassProgress({ classId }: { classId: string }) {
  const q = useQuery({ queryKey: ['class-progress', classId], queryFn: async () => unwrap(await supabase.rpc('class_progress', { p_class: classId })) });
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data?.length) return <EmptyState title="No learners yet" />;
  return (
    <Card><CardBody className="overflow-x-auto p-0"><table className="w-full min-w-[36rem] text-sm">
      <thead className="bg-ink-50 text-left"><tr><th className="px-3 py-2">Learner</th><th className="px-3 py-2">Course progress</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2">Submissions</th><th className="px-3 py-2">Last active</th></tr></thead>
      <tbody>{q.data.map((r) => (
        <tr key={r.user_id} className="border-t border-ink-100"><td className="flex items-center gap-2 px-3 py-2 font-medium"><Avatar name={r.name} src={r.avatar_url} size={26} />{r.name}</td>
          <td className="px-3 py-2"><ProgressBar value={r.avg_progress} className="w-32" /></td>
          <td className={cn('px-3 py-2 font-semibold', r.attendance_rate == null ? 'text-ink-400' : r.attendance_rate >= 80 ? 'text-growth-700' : r.attendance_rate >= 60 ? 'text-sun-700' : 'text-red-700')}>{r.attendance_rate != null ? `${Math.round(r.attendance_rate)}%` : '—'}</td>
          <td className="px-3 py-2">{r.submissions}</td><td className="px-3 py-2 text-ink-500">{r.last_activity_at ? fromNow(r.last_activity_at) : '—'}</td></tr>
      ))}</tbody>
    </table></CardBody></Card>
  );
}

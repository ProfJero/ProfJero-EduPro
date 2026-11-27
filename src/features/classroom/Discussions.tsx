import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, Lock, LockOpen, MessageCircle, MessagesSquare, Pin, Plus, Presentation, Search, Trash2, Users } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingBlock, PageHeader, Select, Tabs, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useMyClasses, useMyCourses } from '@/features/learning/queries';
import { useTeachingRooms } from '@/features/teachers/queries';
import { ClassroomPanel, useRoomMembers } from './ClassroomPanel';
import { MentionTextarea, RichText, plainMentions, useMentionInput } from '@/components/app/Mentions';

type Space = { id: string; title: string; body: string | null; subject: string | null; visibility: 'public' | 'class' | 'group'; class_id: string | null; group_id: string | null; created_by: string;
  is_locked: boolean; is_pinned: boolean; message_count: number; last_activity_at: string; created_at: string; cls: { name: string } | null; grp: { name: string } | null; author: { full_name: string | null; display_name: string | null; avatar_url: string | null } | null };
const SELECT = 'id, title, body, subject, visibility, class_id, group_id, created_by, is_locked, is_pinned, message_count, last_activity_at, created_at, cls:school_classes(name), grp:study_groups(name), author:profiles(full_name, display_name, avatar_url)';
const SUBJECTS = ['Mathematics', 'Integrated Science', 'English Language', 'Social Studies', 'Computing / ICT', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Geography', 'History', 'Literature', 'French', 'Ghanaian Language', 'Business', 'Agriculture', 'Arts & Design', 'Careers & study tips', 'General'];

export function DiscussionsPage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const open_ = useQuery({
    queryKey: ['spaces', 'public', q, subject],
    queryFn: async () => {
      let s = supabase.from('discussion_spaces').select(SELECT).eq('visibility', 'public').order('is_pinned', { ascending: false }).order('last_activity_at', { ascending: false }).limit(60);
      const term = q.trim().replace(/[%,()*\\]/g, ' ').trim();
      if (term) s = s.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
      if (subject) s = s.eq('subject', subject);
      return unwrap(await s) as unknown as Space[];
    },
  });
  const mine = useQuery({ queryKey: ['spaces', 'scoped'], queryFn: async () => unwrap(await supabase.from('discussion_spaces').select(SELECT).neq('visibility', 'public').order('last_activity_at', { ascending: false }).limit(60)) as unknown as Space[] });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="EduConnect" title="Discussions" description="Ask, explain and debate with learners from any class or school — or keep it within your class and study groups."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Start a discussion</Button>} />
      <Tabs tabs={[
        { value: 'open', label: <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4" />Open discussions</span>, content: (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discussions…" className="pl-9" aria-label="Search discussions" /></div>
              <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="sm:w-56" aria-label="Subject"><option value="">All subjects</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select>
            </div>
            <SpaceList query={open_} empty="No open discussions yet — start the first one!" />
          </div>
        ) },
        { value: 'mine', label: <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />Classes & groups</span>, content: (
          <div className="space-y-6"><SpaceList query={mine} empty="No class or group discussions yet." /><ClassroomRooms /></div>
        ) },
      ]} />
      <NewSpaceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function SpaceList({ query, empty }: { query: { data?: Space[]; isLoading: boolean; error: unknown }; empty: string }) {
  if (query.isLoading) return <LoadingBlock rows={3} />;
  if (query.error) return <ErrorState error={query.error} />;
  if (!query.data?.length) return <EmptyState icon={<MessagesSquare className="h-7 w-7" />} title={empty} />;
  return (
    <ul className="space-y-2.5">{query.data.map((s, i) => (
      <li key={s.id} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }} className="motion-safe:animate-[fade-up_.3s_ease-out_both]">
        <Link to={`/discussions/${s.id}`} className="card group flex gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-lift)]">
          <Avatar name={s.author?.display_name || s.author?.full_name} src={s.author?.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {s.is_pinned && <Pin className="h-3.5 w-3.5 text-brand-600" />}
              <p className="font-bold text-ink-900 group-hover:text-brand-700">{s.title}</p>
              {s.is_locked && <Lock className="h-3.5 w-3.5 text-ink-400" />}
            </div>
            {s.body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-600">{plainMentions(s.body)}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              {s.visibility === 'public' ? <Badge tone="brand" icon={<Globe2 className="h-3 w-3" />}>Open</Badge> : s.visibility === 'class' ? <Badge tone="amber" icon={<Presentation className="h-3 w-3" />}>{s.cls?.name ?? 'Class'}</Badge> : <Badge tone="green" icon={<Users className="h-3 w-3" />}>{s.grp?.name ?? 'Group'}</Badge>}
              {s.subject && <Badge>{s.subject}</Badge>}
              <span>{s.author?.display_name || s.author?.full_name || 'Learner'}</span>·<span>{fromNow(s.last_activity_at)}</span>
            </div>
          </div>
          <span className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-ink-50 px-3 text-ink-600"><MessageCircle className="h-4 w-4" /><span className="text-sm font-bold">{s.message_count}</span></span>
        </Link>
      </li>
    ))}</ul>
  );
}

function ClassroomRooms() {
  const courses = useMyCourses();
  const classes = useMyClasses();
  const teaching = useTeachingRooms();
  const rooms = [
    ...(teaching.data?.courses ?? []).map((c) => ({ key: `tc-${c.id}`, to: `/teach/courses/${c.id}?tab=classroom`, title: c.title, kind: 'Course you teach' })),
    ...(teaching.data?.classes ?? []).map((c) => ({ key: `tk-${c.id}`, to: `/teach/classes/${c.id}`, title: c.name, kind: 'Class you teach' })),
    ...(courses.data ?? []).filter((c) => c.status !== 'dropped' && c.course).map((c) => ({ key: `c-${c.course_id}`, to: `/learn/courses/${c.course_id}`, title: c.course!.title, kind: 'Course classroom' })),
    ...(classes.data ?? []).filter((c) => c.cls).map((c) => ({ key: `k-${c.class_id}`, to: `/learn/classes/${c.class_id}`, title: c.cls!.name, kind: 'Class' })),
  ];
  if (!rooms.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-400">Classroom boards & Q&A</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rooms.map((r) => (
        <li key={r.key}><Link to={r.to} className="card flex items-center gap-3 p-4 hover:border-brand-300"><MessagesSquare className="h-5 w-5 text-brand-600" /><span className="min-w-0"><span className="block truncate font-semibold">{r.title}</span><span className="text-xs text-ink-500">{r.kind}</span></span></Link></li>
      ))}</ul>
    </section>
  );
}

function NewSpaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const classes = useMyClasses();
  const teaching = useTeachingRooms();
  const groups = useQuery({ queryKey: ['groups-i-lead', user?.id], enabled: Boolean(user) && open, queryFn: async () => unwrap(await supabase.from('study_group_members').select('group_id, role, grp:study_groups(name, created_by)').eq('user_id', user!.id)) as unknown as { group_id: string; role: string; grp: { name: string; created_by: string } | null }[] });
  const [f, setF] = useState({ title: '', body: '', subject: 'General', scope: 'public' });
  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    (classes.data ?? []).forEach((c) => c.cls && m.set(c.class_id, c.cls.name));
    (teaching.data?.classes ?? []).forEach((c) => m.set(c.id, c.name));
    return [...m];
  }, [classes.data, teaching.data]);
  const leadGroups = (groups.data ?? []).filter((g) => g.role === 'leader' || g.grp?.created_by === user?.id);
  const body = useMentionInput();
  const [scopeKind, scopeId] = f.scope.split(':');
  const scopeMembers = useRoomMembers(scopeKind === 'group' ? 'group' : 'class', scopeKind === 'public' ? undefined : scopeId);
  const create = useMutation({
    mutationFn: async () => {
      const [kind, id] = f.scope.split(':');
      return unwrap(await supabase.from('discussion_spaces').insert({ title: f.title.trim(), body: body.encoded().trim() || null, subject: f.subject, created_by: user!.id,
        visibility: kind === 'class' ? 'class' : kind === 'group' ? 'group' : 'public', class_id: kind === 'class' ? id : null, group_id: kind === 'group' ? id : null }).select('id').single());
    },
    onSuccess: (d) => { onOpenChange(false); body.reset(); setF({ title: '', body: '', subject: 'General', scope: 'public' }); void qc.invalidateQueries({ queryKey: ['spaces'] }); nav(`/discussions/${d.id}`); },
    onError: (e) => toast.error('Could not start the discussion', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Start a discussion" description="Be kind and respectful. Don’t share phone numbers or personal details."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={f.title.trim().length < 4} loading={create.isPending} onClick={() => create.mutate()}>Start discussion</Button></>}>
      <div className="space-y-4">
        <Field label="Who can join" required><Select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
          <option value="public">Everyone — learners from any class or school</option>
          {classOptions.length > 0 && <optgroup label="My classes">{classOptions.map(([id, n]) => <option key={id} value={`class:${id}`}>{n}</option>)}</optgroup>}
          {leadGroups.length > 0 && <optgroup label="Groups I lead">{leadGroups.map((g) => <option key={g.group_id} value={`group:${g.group_id}`}>{g.grp?.name}</option>)}</optgroup>}
        </Select></Field>
        <Field label="Topic or question" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} placeholder="How do I balance chemical equations quickly?" /></Field>
        <Field label="Details (optional)" hint={scopeKind !== 'public' ? 'Type @ to mention a classmate — they will be notified.' : undefined}>
          <MentionTextarea rows={4} value={body.value} onValueChange={body.setValue} onPick={body.onPick} members={scopeMembers.data ?? []} me={user?.id} maxLength={4000} />
        </Field>
        <Field label="Subject"><Select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
    </Dialog>
  );
}

export function SpaceRoom() {
  const { spaceId } = useParams();
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ['space', spaceId], queryFn: async () => unwrap(await supabase.from('discussion_spaces').select(SELECT).eq('id', spaceId!).maybeSingle()) as unknown as Space | null });
  const mod = useQuery({ queryKey: ['space-mod', spaceId], enabled: Boolean(q.data), queryFn: async () => {
    const s = q.data!;
    if (s.created_by === user?.id || isAdmin) return true;
    if (s.class_id) { const r = await supabase.from('class_teachers').select('class_id').eq('class_id', s.class_id).eq('user_id', user!.id).maybeSingle(); if (r.data) return true; }
    return false;
  } });
  const update = useMutation({
    mutationFn: async (patch: { is_locked?: boolean; is_pinned?: boolean }) => unwrap(await supabase.from('discussion_spaces').update(patch).eq('id', spaceId!)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['space', spaceId] }),
    onError: (e) => toast.error('Could not update', errorMessage(e)),
  });
  const del = useMutation({ mutationFn: async () => unwrap(await supabase.from('discussion_spaces').delete().eq('id', spaceId!)), onSuccess: () => { toast.success('Discussion deleted'); nav('/discussions'); } });
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <EmptyState icon={<MessagesSquare className="h-7 w-7" />} title="Discussion not found" description="It may be private to a class or group you are not in." />;
  const s = q.data;
  const canMod = Boolean(mod.data);
  return (
    <div className="space-y-5">
      <PageHeader back={{ to: '/discussions', label: 'Discussions' }} eyebrow={s.visibility === 'public' ? 'Open discussion' : s.visibility === 'class' ? `Class discussion · ${s.cls?.name ?? ''}` : `Group discussion · ${s.grp?.name ?? ''}`} title={s.title}
        description={`Started by ${s.author?.display_name || s.author?.full_name || 'a learner'} · ${fromNow(s.created_at)}${s.subject ? ` · ${s.subject}` : ''}`}
        actions={canMod ? <div className="flex gap-2">
          <Button size="sm" variant="secondary" leftIcon={s.is_locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />} onClick={() => update.mutate({ is_locked: !s.is_locked })}>{s.is_locked ? 'Unlock' : 'Lock'}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} aria-label="Delete discussion"><Trash2 className="h-4 w-4" /></Button>
        </div> : undefined} />
      {s.body && <Card><CardBody><RichText text={s.body} me={user?.id} className="text-ink-700" /></CardBody></Card>}
      {s.is_locked && <p className={cn('rounded-xl bg-ink-100 px-4 py-2 text-sm text-ink-600')}><Lock className="mr-1 inline h-4 w-4" />This discussion is locked — you can read it, but new replies are closed.</p>}
      <ClassroomPanel type="space" roomId={s.id} canModerate={canMod} canPoll={canMod} title="Summary" />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete this discussion?" description="All replies are deleted too." tone="danger" confirmLabel="Delete" loading={del.isPending} onConfirm={() => del.mutate()} />
    </div>
  );
}

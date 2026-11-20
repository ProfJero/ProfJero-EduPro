import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, MessagesSquare, Plus, ShieldCheck, Users, UsersRound } from 'lucide-react';
import { Badge, Button, Card, CardBody, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Section, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useMyClasses, useMyCourses } from '@/features/learning/queries';
import { useManagedCourses, useTeachingClasses } from '@/features/teachers/queries';

export const PERMISSION_LABELS: Record<string, string> = {
  post_board: 'Write on the class board', moderate_discussion: 'Moderate the discussion', pin_messages: 'Pin messages', take_attendance: 'Take attendance',
  create_polls: 'Create polls', manage_groups: 'Manage study groups', post_announcements: 'Post announcements', view_progress: 'View class progress', approve_join_requests: 'Approve join requests',
};

type GroupRow = { id: string; name: string; description: string | null; topic: string | null; visibility: string; max_members: number; class_id: string | null; course_id: string | null; created_by: string;
  cls: { name: string } | null; course: { title: string } | null; members: { user_id: string; role: string }[] };

export function useScopes() {
  const mc = useMyClasses(); const mco = useMyCourses(); const tc = useTeachingClasses(); const mgc = useManagedCourses();
  const classes = new Map<string, string>();
  (mc.data ?? []).forEach((c) => c.cls && classes.set(c.class_id, c.cls.name));
  (tc.data ?? []).forEach((c) => classes.set(c.id, c.name));
  const courses = new Map<string, string>();
  (mco.data ?? []).forEach((c) => c.course && courses.set(c.course_id, c.course.title));
  (mgc.data ?? []).forEach((c) => courses.set(c.id, c.title));
  return { classes, courses };
}

export function ConnectHub() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const groups = useQuery({
    queryKey: ['study-groups'],
    queryFn: async () => unwrap(await supabase.from('study_groups').select('id, name, description, topic, visibility, max_members, class_id, course_id, created_by, cls:school_classes(name), course:courses(title), members:study_group_members(user_id, role)').order('created_at', { ascending: false }).limit(100)) as unknown as GroupRow[],
  });
  const leadership = useQuery({
    queryKey: ['my-leadership', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('class_leaders').select('class_id, title, permissions, cls:school_classes(name)').eq('user_id', user!.id)) as unknown as { class_id: string; title: string; permissions: string[]; cls: { name: string } | null }[],
  });
  const join = useMutation({
    mutationFn: async (id: string) => { unwrap(await supabase.rpc('join_study_group', { p_group: id })); return id; },
    onSuccess: (id) => { void qc.invalidateQueries({ queryKey: ['study-groups'] }); nav(`/connect/groups/${id}`); },
    onError: (e) => toast.error('Could not join', errorMessage(e)),
  });
  const mine = (groups.data ?? []).filter((g) => g.members.some((m) => m.user_id === user?.id));
  const others = (groups.data ?? []).filter((g) => !g.members.some((m) => m.user_id === user?.id));
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="EduConnect" title="Study groups, leadership & peer learning" description="Learn together: join study groups, discuss with classmates, help each other and lead your class."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New study group</Button>} />
      {leadership.data && leadership.data.length > 0 && (
        <Section title="Your leadership roles">
          <div className="grid gap-4 md:grid-cols-2">{leadership.data.map((l) => (
            <Card key={l.class_id}><CardBody>
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sun-50 text-sun-700"><Crown className="h-5 w-5" /></span><div><p className="font-bold">{l.title}</p><p className="text-sm text-ink-500">{l.cls?.name}</p></div>
                <Link to={`/learn/classes/${l.class_id}`} className="ml-auto text-sm font-semibold text-brand-700">Open class →</Link></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{l.permissions.length ? l.permissions.map((p) => <Badge key={p} tone="amber" icon={<ShieldCheck className="h-3 w-3" />}>{PERMISSION_LABELS[p] ?? p}</Badge>) : <span className="text-sm text-ink-500">A recognised role with no extra permissions.</span>}</div>
            </CardBody></Card>
          ))}</div>
        </Section>
      )}
      <Section title="My study groups">
        {groups.isLoading ? <LoadingBlock rows={2} /> : mine.length ? <GroupGrid groups={mine} /> : (
          <EmptyState icon={<UsersRound className="h-7 w-7" />} title="You’re not in a study group yet" description="Join an open group below or start your own for a class or course." action={<Button onClick={() => setCreating(true)}>Start a group</Button>} />
        )}
      </Section>
      {others.length > 0 && (
        <Section title="Groups you can join">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{others.map((g) => (
            <Card key={g.id}><CardBody className="flex h-full flex-col gap-2">
              <div className="flex items-start justify-between gap-2"><p className="font-bold">{g.name}</p><Badge>{g.members.length}/{g.max_members}</Badge></div>
              <p className="text-xs text-ink-500">{g.cls?.name ?? g.course?.title}{g.topic ? ` · ${g.topic}` : ''}</p>
              {g.description && <p className="line-clamp-2 text-sm text-ink-600">{g.description}</p>}
              <div className="mt-auto pt-2">{g.visibility === 'open' ? <Button size="sm" loading={join.isPending && join.variables === g.id} disabled={g.members.length >= g.max_members} onClick={() => join.mutate(g.id)}>{g.members.length >= g.max_members ? 'Full' : 'Join group'}</Button> : <Badge>Invite only</Badge>}</div>
            </CardBody></Card>
          ))}</div>
        </Section>
      )}
      <Section title="Discussions">
        <Card><CardBody className="flex flex-wrap items-center gap-3"><MessagesSquare className="h-6 w-6 text-brand-600" /><p className="flex-1 text-sm text-ink-600">Every class and course has its own discussion room with questions, accepted answers and peer-helper recognition.</p><Link to="/discussions" className="text-sm font-semibold text-brand-700">Open discussions →</Link></CardBody></Card>
      </Section>
      <CreateGroupDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function GroupGrid({ groups }: { groups: GroupRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{groups.map((g) => (
      <Link key={g.id} to={`/connect/groups/${g.id}`} className="card flex flex-col gap-2 p-5 transition hover:shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-growth-50 text-growth-700"><Users className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-bold">{g.name}</p><p className="truncate text-xs text-ink-500">{g.cls?.name ?? g.course?.title}</p></div></div>
        {g.topic && <p className="text-sm text-ink-600">Topic: {g.topic}</p>}
        <p className="text-xs text-ink-500">{g.members.length} member{g.members.length === 1 ? '' : 's'}</p>
      </Link>
    ))}</div>
  );
}

export function CreateGroupDialog({ open, onOpenChange, defaultClass, defaultCourse }: { open: boolean; onOpenChange: (o: boolean) => void; defaultClass?: string; defaultCourse?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const { classes, courses } = useScopes();
  const [scope, setScope] = useState(defaultClass ? `class:${defaultClass}` : defaultCourse ? `course:${defaultCourse}` : '');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('open');
  const [max, setMax] = useState(8);
  const create = useMutation({
    mutationFn: async () => {
      const [kind, id] = scope.split(':');
      return unwrap(await supabase.from('study_groups').insert({ name: name.trim(), topic: topic.trim() || null, description: description.trim() || null, visibility, max_members: max, created_by: user!.id, class_id: kind === 'class' ? id : null, course_id: kind === 'course' ? id : null }).select('id').single());
    },
    onSuccess: (g) => { onOpenChange(false); void qc.invalidateQueries({ queryKey: ['study-groups'] }); nav(`/connect/groups/${g.id}`); },
    onError: (e) => toast.error('Could not create the group', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New study group" description="Groups belong to a class or course, so only classmates can find and join them."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!scope || name.trim().length < 2} loading={create.isPending} onClick={() => create.mutate()}>Create group</Button></>}>
      <div className="space-y-4">
        <Field label="For" required><Select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Choose a class or course…</option>
          {classes.size > 0 && <optgroup label="Classes">{[...classes].map(([id, n]) => <option key={id} value={`class:${id}`}>{n}</option>)}</optgroup>}
          {courses.size > 0 && <optgroup label="Courses">{[...courses].map(([id, n]) => <option key={id} value={`course:${id}`}>{n}</option>)}</optgroup>}
        </Select></Field>
        <Field label="Group name" required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Algebra Avengers" /></Field>
        <Field label="Topic"><Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Quadratic equations" /></Field>
        <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Who can join"><Select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="open">Anyone in the class</option><option value="invite">Invite only</option></Select></Field>
          <Field label="Maximum members"><Input type="number" min={2} max={100} value={max} onChange={(e) => setMax(Math.max(2, Math.min(100, Number(e.target.value) || 2)))} /></Field>
        </div>
      </div>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, Eye, FilePlus2, FolderPlus, MoreVertical, Pencil, Send, Trash2, UserPlus, Users, Archive, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Alert, Avatar, Badge, Button, ButtonLink, Card, CardBody, CardHeader, ConfirmDialog, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock,
  Menu, MenuContent, MenuItem, MenuTrigger, PageHeader, ProgressBar, Select, StatusBadge, Tabs, Textarea, useToast,
} from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn, downloadCsv, errorMessage, pct } from '@/lib/utils';
import { useTeachingClasses } from '@/features/teachers/queries';
import { useAuth } from '@/features/authentication/AuthProvider';
import { ClassroomPanel } from '@/features/classroom/ClassroomPanel';
import { AnnouncementComposer, AnnouncementList } from '@/features/notifications/Announcements';
import { CourseResourcesManager } from '@/features/teachers/TeacherResources';
import { CourseFormFields, toFormValues } from './CourseForm';
import { useCourseOutline, type OutlineModule } from './queries';

function useEditableCourse(courseId?: string) {
  return useQuery({
    queryKey: ['course-edit', courseId],
    enabled: Boolean(courseId),
    queryFn: async () => unwrap(await supabase.from('courses').select('*').eq('id', courseId!).maybeSingle()),
  });
}

export function CourseEditor() {
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'curriculum';
  const { data: course, isLoading } = useEditableCourse(courseId);
  const qc = useQueryClient();
  const toast = useToast();
  if (isLoading) return <LoadingBlock />;
  if (!course) return <EmptyState title="Course not found" description="You may not have access to manage this course." />;
  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/teach/courses', label: 'My courses' }} eyebrow={<span className="inline-flex items-center gap-2">Course editor <StatusBadge status={course.status} /></span>} title={course.title}
        actions={<>
          <ButtonLink to={`/courses/${course.slug}`} variant="outline" leftIcon={<Eye className="h-4 w-4" />} target="_blank">Course page</ButtonLink>
          <PreviewAsStudent courseId={course.id} />
        </>} />
      <PublishBar course={course} />
      {(course.visibility === 'class' || course.visibility === 'private') && <CourseClasses courseId={course.id} />}
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} tabs={[
        { value: 'curriculum', label: 'Curriculum', content: <Curriculum courseId={course.id} /> },
        { value: 'details', label: 'Details', content: (
          <div className="max-w-3xl"><CourseFormFields initial={toFormValues(course)} courseId={course.id} allowSchoolChoice={false} submitLabel="Save details" onSubmit={async (row) => {
            const { school_id: _ignored, ...rest } = row;
            const { error } = await supabase.from('courses').update(rest).eq('id', course.id);
            if (error) throw new Error(error.message);
            toast.success('Course saved');
            void qc.invalidateQueries({ queryKey: ['course-edit', course.id] });
          }} /></div>
        ) },
        { value: 'learners', label: 'Learners & insights', content: <CourseLearners courseId={course.id} title={course.title} /> },
        { value: 'team', label: 'Team & enrolment', content: <CourseTeam courseId={course.id} /> },
        { value: 'classroom', label: 'Classroom', content: <ClassroomPanel type="course" roomId={course.id} canModerate title={course.title} /> },
        { value: 'announcements', label: 'Announcements', content: <div className="space-y-5"><AnnouncementComposer scope="course" courseId={course.id} /><AnnouncementList scope="course" id={course.id} manage /></div> },
        { value: 'resources', label: 'Resources', content: <CourseResourcesManager courseId={course.id} /> },
      ]} />
    </div>
  );
}

function PreviewAsStudent({ courseId }: { courseId: string }) {
  const { data } = useCourseOutline(courseId);
  const first = data?.flatMap((m) => m.lessons)[0];
  if (!first) return null;
  return <ButtonLink to={`/learn/courses/${courseId}/lessons/${first.id}`} variant="secondary" leftIcon={<Eye className="h-4 w-4" />}>Preview as student</ButtonLink>;
}

function PublishBar({ course }: { course: { id: string; status: string; school_id: string | null; review_notes: string | null; title: string; visibility: string } }) {
  const { context, isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const isSchoolAdmin = Boolean(course.school_id && context?.schools.some((s) => s.school_id === course.school_id && s.roles?.includes('school_admin')));
  const classCourse = course.visibility === 'class' || course.visibility === 'private';
  const canPublish = isAdmin || isSchoolAdmin;
  const canDirect = canPublish || classCourse;
  const act = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) toast.error('Action failed', error.message); else { toast.success(ok); void qc.invalidateQueries({ queryKey: ['course-edit', course.id] }); void qc.invalidateQueries({ queryKey: ['managed-courses'] }); }
  };
  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-sm">
          {course.status === 'draft' && <p><strong>Draft.</strong> Only you and your co-teachers can see this course.</p>}
          {course.status === 'in_review' && <p><strong>In review.</strong> {canPublish ? 'Review the content and publish when ready.' : 'The ProfJero team is reviewing your course.'}</p>}
          {course.status === 'published' && <p className="text-growth-700"><CheckCircle2 className="mr-1 inline h-4 w-4" /><strong>Published.</strong> {course.visibility === 'class' ? 'Members of the classes it is assigned to can study it. Nobody else can open it.' : 'Learners can find and study this course.'}</p>}
          {course.status === 'draft' && course.visibility === 'class' && <p className="text-ink-500">Class-only course — publish it whenever it’s ready; no review needed.</p>}
          {course.status === 'unpublished' && <p><strong>Unpublished.</strong> Enrolled learners keep access; it's hidden from the catalogue.</p>}
          {course.status === 'archived' && <p><strong>Archived.</strong></p>}
          {course.review_notes && <p className="mt-1 text-sun-700"><AlertTriangle className="mr-1 inline h-4 w-4" />Reviewer notes: {course.review_notes}</p>}
        </div>
        {(course.status === 'draft' || course.status === 'unpublished') && !canPublish && classCourse && <Button size="sm" variant="success" loading={busy === 'publish'} onClick={() => act('publish', () => supabase.from('courses').update({ status: 'published' }).eq('id', course.id), 'Published to your class')}>Publish to class</Button>}
        {(course.status === 'draft' || course.status === 'unpublished') && !canPublish && !classCourse && <Button size="sm" loading={busy === 'submit'} leftIcon={<Send className="h-4 w-4" />} onClick={() => act('submit', () => supabase.rpc('submit_course_for_review', { p_course: course.id }), 'Submitted for review')}>Submit for review</Button>}
        {canPublish && course.status !== 'published' && course.status !== 'archived' && <Button size="sm" variant="success" loading={busy === 'publish'} onClick={() => act('publish', () => supabase.rpc('review_course', { p_course: course.id, p_action: 'publish' }), 'Course published')}>Publish</Button>}
        {canPublish && course.status === 'in_review' && <Button size="sm" variant="outline" loading={busy === 'reject'} onClick={() => act('reject', () => supabase.rpc('review_course', { p_course: course.id, p_action: 'reject', p_notes: 'Changes requested' }), 'Returned to draft')}>Request changes</Button>}
        {course.status === 'published' && canPublish && <Button size="sm" variant="outline" loading={busy === 'unpub'} onClick={() => act('unpub', () => supabase.rpc('review_course', { p_course: course.id, p_action: 'unpublish' }), 'Course unpublished')}>Unpublish</Button>}
        {course.status === 'published' && !canPublish && canDirect && <Button size="sm" variant="outline" loading={busy === 'unpub'} onClick={() => act('unpub', () => supabase.from('courses').update({ status: 'unpublished' }).eq('id', course.id), 'Course unpublished')}>Unpublish</Button>}
        {course.status !== 'archived' && <Button size="sm" variant="ghost" leftIcon={<Archive className="h-4 w-4" />} loading={busy === 'arch'} onClick={() => act('arch', () => supabase.from('courses').update({ status: 'archived' }).eq('id', course.id), 'Course archived')}>Archive</Button>}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Curriculum({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const { data: modules, isLoading } = useCourseOutline(courseId);
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [editModule, setEditModule] = useState<OutlineModule | 'new' | null>(null);
  const [del, setDel] = useState<{ kind: 'module' | 'lesson'; id: string; title: string } | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['course-outline', courseId] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error } = await p;
    if (error) toast.error('Action failed', error.message); else { if (ok) toast.success(ok); refresh(); }
  };
  const addLesson = async (m: OutlineModule) => {
    const { data, error } = await supabase.from('lessons').insert({ course_id: courseId, module_id: m.id, title: 'Untitled lesson', position: m.lessons.length, status: 'draft', created_by: user!.id }).select('id').single();
    if (error) return toast.error('Could not add lesson', error.message);
    nav(`/teach/courses/${courseId}/lessons/${data.id}`);
  };
  const moveModule = (i: number, d: -1 | 1) => {
    const ids = (modules ?? []).map((m) => m.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void run(supabase.rpc('reorder_modules', { p_course: courseId, p_ids: ids }));
  };
  const moveLesson = (m: OutlineModule, i: number, d: -1 | 1) => {
    const ids = m.lessons.map((l) => l.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void run(supabase.rpc('reorder_lessons', { p_module: m.id, p_ids: ids }));
  };
  const moveToModule = (lessonId: string, target: OutlineModule) => void run(supabase.rpc('reorder_lessons', { p_module: target.id, p_ids: [...target.lessons.map((l) => l.id), lessonId] }), 'Lesson moved');

  if (isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">Organise your course into modules and lessons. Only <strong>published</strong> lessons in published modules are visible to learners.</p>
        <Button variant="outline" leftIcon={<FolderPlus className="h-4 w-4" />} onClick={() => setEditModule('new')}>Add module</Button>
      </div>
      {!modules?.length && <EmptyState icon={<FolderPlus className="h-7 w-7" />} title="No modules yet" description="Modules group related lessons, like chapters in a book." action={<Button onClick={() => setEditModule('new')}>Add first module</Button>} />}
      {modules?.map((m, i) => (
        <Card key={m.id}>
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3">
            <div className="flex flex-col">
              <button aria-label="Move module up" disabled={i === 0} onClick={() => moveModule(i, -1)} className="text-ink-400 hover:text-ink-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button aria-label="Move module down" disabled={i === modules.length - 1} onClick={() => moveModule(i, 1)} className="text-ink-400 hover:text-ink-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            </div>
            <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-ink-400">Module {i + 1}</p><p className="font-bold text-ink-900">{m.title}</p></div>
            <StatusBadge status={m.status} />
            <Button size="sm" variant="secondary" leftIcon={<FilePlus2 className="h-4 w-4" />} onClick={() => addLesson(m)}>Add lesson</Button>
            <Menu>
              <MenuTrigger className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" aria-label={`Module ${m.title} actions`}><MoreVertical className="h-4 w-4" /></MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => setEditModule(m)}>Edit module</MenuItem>
                <MenuItem onSelect={() => run(supabase.from('course_modules').update({ status: m.status === 'published' ? 'draft' : 'published' }).eq('id', m.id), m.status === 'published' ? 'Module hidden' : 'Module published')}>{m.status === 'published' ? 'Hide module' : 'Publish module'}</MenuItem>
                <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => setDel({ kind: 'module', id: m.id, title: m.title })}>Delete module</MenuItem>
              </MenuContent>
            </Menu>
          </div>
          <ul className="divide-y divide-ink-100">
            {m.lessons.map((l, j) => (
              <li key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex flex-col">
                  <button aria-label="Move lesson up" disabled={j === 0} onClick={() => moveLesson(m, j, -1)} className="text-ink-300 hover:text-ink-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button aria-label="Move lesson down" disabled={j === m.lessons.length - 1} onClick={() => moveLesson(m, j, 1)} className="text-ink-300 hover:text-ink-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <Link to={`/teach/courses/${courseId}/lessons/${l.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800 hover:text-brand-700">{l.title}</Link>
                {l.is_preview && <Badge tone="violet">Free preview</Badge>}
                <StatusBadge status={l.status} />
                <Menu>
                  <MenuTrigger className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" aria-label={`Lesson ${l.title} actions`}><MoreVertical className="h-4 w-4" /></MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => nav(`/teach/courses/${courseId}/lessons/${l.id}`)}>Edit lesson</MenuItem>
                    <MenuItem icon={<Copy className="h-4 w-4" />} onSelect={() => run(supabase.rpc('duplicate_lesson', { p_lesson: l.id }), 'Lesson duplicated')}>Duplicate</MenuItem>
                    {modules.filter((x) => x.id !== m.id).map((x) => <MenuItem key={x.id} onSelect={() => moveToModule(l.id, x)}>Move to “{x.title}”</MenuItem>)}
                    <MenuItem icon={<Archive className="h-4 w-4" />} onSelect={() => run(supabase.from('lessons').update({ status: l.status === 'archived' ? 'draft' : 'archived' }).eq('id', l.id), l.status === 'archived' ? 'Lesson restored to draft' : 'Lesson archived')}>{l.status === 'archived' ? 'Restore' : 'Archive'}</MenuItem>
                    <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => setDel({ kind: 'lesson', id: l.id, title: l.title })}>Delete</MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            ))}
            {!m.lessons.length && <li className="px-4 py-4 text-sm text-ink-500">No lessons in this module yet.</li>}
          </ul>
        </Card>
      ))}
      <ModuleDialog courseId={courseId} module={editModule} count={modules?.length ?? 0} onClose={() => { setEditModule(null); refresh(); }} />
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} tone="danger" confirmLabel="Delete" title={`Delete “${del?.title}”?`}
        description={del?.kind === 'module' ? 'All lessons in this module will be deleted. Learner progress on them is removed. Consider hiding it instead.' : 'This removes the lesson and learner progress on it. Consider archiving instead.'}
        onConfirm={async () => { if (!del) return; await run(supabase.from(del.kind === 'module' ? 'course_modules' : 'lessons').delete().eq('id', del.id), 'Deleted'); setDel(null); }} />
    </div>
  );
}

function ModuleDialog({ courseId, module, count, onClose }: { courseId: string; module: OutlineModule | 'new' | null; count: number; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = module === 'new';
  useEffect(() => {
    setTitle(module && module !== 'new' ? module.title : '');
    setDesc(module && module !== 'new' ? module.description ?? '' : '');
  }, [module]);
  return (
    <Dialog open={Boolean(module)} onOpenChange={(o) => { if (!o) onClose(); }} title={isNew ? 'Add module' : 'Edit module'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!title.trim()} onClick={async () => {
        setBusy(true);
        const res = isNew
          ? await supabase.from('course_modules').insert({ course_id: courseId, title: title.trim(), description: desc || null, position: count })
          : await supabase.from('course_modules').update({ title: title.trim(), description: desc || null }).eq('id', (module as OutlineModule).id);
        setBusy(false);
        if (res.error) toast.error('Could not save', res.error.message); else { setTitle(''); setDesc(''); onClose(); }
      }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Module title"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
        <Field label="Description (optional)"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
type Analytics = {
  enrolled: number; completed: number; avg_progress: number; inactive_14d: number; advanced: boolean;
  learners: { user_id: string; name: string; progress: number; status: string; last_activity_at: string | null; enrolled_at: string; avg_score: number | null }[];
  assessments: { id: string; title: string; attempts: number; avg_pct: number | null; pass_rate: number | null }[];
  missed_questions: { question_id: string; prompt: string; answers: number; wrong_rate: number }[] | null;
};

function CourseLearners({ courseId, title }: { courseId: string; title: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['course-analytics', courseId], queryFn: async () => unwrap(await supabase.rpc('course_analytics', { p_course: courseId })) as unknown as Analytics });
  if (isLoading || !data) return <LoadingBlock />;
  const behind = data.learners.filter((l) => l.status === 'active' && (!l.last_activity_at || Date.now() - new Date(l.last_activity_at).getTime() > 14 * 86400_000));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Enrolled', data.enrolled], ['Completed', data.completed], ['Average progress', `${Math.round(data.avg_progress)}%`], ['Inactive 14+ days', data.inactive_14d]].map(([l, v]) => (
          <div key={l as string} className="card p-4"><p className="text-xs font-semibold uppercase text-ink-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>
        ))}
      </div>
      {behind.length > 0 && <Alert tone="warning" title={`${behind.length} learner${behind.length > 1 ? 's' : ''} may be falling behind`}>{behind.slice(0, 6).map((b) => b.name).join(', ')}{behind.length > 6 && '…'} — no activity in 14 days. Consider a check-in message in the classroom.</Alert>}
      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => downloadCsv(`${title}-learners.csv`, data.learners.map((l) => ({ name: l.name, status: l.status, progress_pct: pct(l.progress), avg_score: l.avg_score ?? '', last_activity: l.last_activity_at ?? '', enrolled_at: l.enrolled_at })))}>Export CSV</Button></div>
      <DataTable rows={data.learners} rowKey={(r) => r.user_id} caption="Learners" empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No learners yet" />} columns={[
        { key: 'n', header: 'Learner', primary: true, cell: (r) => <span className="inline-flex items-center gap-2"><Avatar name={r.name} size={28} />{r.name}</span> },
        { key: 'p', header: 'Progress', cell: (r) => <div className="flex min-w-[8rem] items-center gap-2"><ProgressBar value={r.progress} className="flex-1" /><span className="text-xs font-semibold">{pct(r.progress)}%</span></div> },
        { key: 'sc', header: 'Avg score', cell: (r) => (r.avg_score == null ? '—' : `${r.avg_score}%`) },
        { key: 'a', header: 'Last active', cell: (r) => (r.last_activity_at ? fromNow(r.last_activity_at) : 'Never') },
        { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      ]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Assessments" /><CardBody className="space-y-3">
          {data.assessments.length ? data.assessments.map((a) => (
            <Link key={a.id} to={`/teach/assessments/${a.id}`} className="flex items-center justify-between rounded-lg p-2 text-sm hover:bg-ink-50"><span className="font-semibold">{a.title}</span><span className="text-ink-500">{a.attempts} attempts · avg {a.avg_pct ?? '—'}% · pass {a.pass_rate ?? '—'}%</span></Link>
          )) : <p className="text-sm text-ink-500">No assessments yet.</p>}
        </CardBody></Card>
        <Card><CardHeader title="Most-missed questions" description="Where learners struggle most" /><CardBody>
          {data.missed_questions == null ? <Alert tone="info">Question-level insights are part of EduPro for Teachers.</Alert> : data.missed_questions.length ? (
            <ul className="space-y-2">{data.missed_questions.map((q) => <li key={q.question_id} className="flex items-start justify-between gap-3 text-sm"><span className="line-clamp-2">{q.prompt}</span><Badge tone="red">{q.wrong_rate}% wrong</Badge></li>)}</ul>
          ) : <p className="text-sm text-ink-500">Not enough answers yet.</p>}
        </CardBody></Card>
      </div>
    </div>
  );
}

function CourseTeam({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const team = useQuery({ queryKey: ['course-team', courseId], queryFn: async () => unwrap(await supabase.rpc('course_team', { p_course: courseId })) });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('instructor');
  const [emails, setEmails] = useState('');
  const add = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('add_course_instructor', { p_course: courseId, p_email: email, p_role: role })),
    onSuccess: () => { setEmail(''); toast.success('Co-teacher added'); void qc.invalidateQueries({ queryKey: ['course-team', courseId] }); },
    onError: (e) => toast.error('Could not add', errorMessage(e)),
  });
  const enrol = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('enrol_by_email', { p_course: courseId, p_emails: emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) })) as unknown as { enrolled: number; not_found: number },
    onSuccess: (r) => { setEmails(''); toast.success(`${r.enrolled} learner(s) enrolled`, r.not_found ? `${r.not_found} email(s) have no account yet — ask them to sign up first.` : undefined); void qc.invalidateQueries({ queryKey: ['course-analytics', courseId] }); },
    onError: (e) => toast.error('Enrolment failed', errorMessage(e)),
  });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Teaching team" description="Co-teachers can edit content, grade and run the classroom." />
        <CardBody className="space-y-4">
          <ul className="space-y-2">{(team.data ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 text-sm"><Avatar name={m.name} src={m.avatar_url} size={32} /><span className="flex-1 font-semibold">{m.name}</span><Badge tone={m.is_owner ? 'navy' : 'brand'}>{m.is_owner ? 'Owner' : m.role}</Badge>
              {!m.is_owner && <button className="text-ink-400 hover:text-red-600" aria-label={`Remove ${m.name}`} onClick={async () => { await supabase.from('course_instructors').delete().eq('course_id', courseId).eq('user_id', m.user_id); void team.refetch(); }}><Trash2 className="h-4 w-4" /></button>}</li>
          ))}</ul>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Input type="email" required placeholder="colleague@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Co-teacher email" />
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-36" aria-label="Role"><option value="instructor">Instructor</option><option value="assistant">Assistant</option><option value="lead">Lead</option></Select>
            <Button type="submit" loading={add.isPending} leftIcon={<UserPlus className="h-4 w-4" />}>Add</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Enrol learners" description="Add learners who already have ProfJero Edu accounts. For school classes, assign the course to the class instead." />
        <CardBody className="space-y-3">
          <Field label="Learner emails" hint="Separate with commas or new lines (up to 300)"><Textarea rows={5} value={emails} onChange={(e) => setEmails(e.target.value)} /></Field>
          <Button loading={enrol.isPending} disabled={!emails.trim()} onClick={() => enrol.mutate()}>Enrol learners</Button>
        </CardBody>
      </Card>
    </div>
  );
}

/** Which of my classes can study this course. */
function CourseClasses({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const mine = useTeachingClasses();
  const linked = useQuery({ queryKey: ['course-classes', courseId], queryFn: async () => unwrap(await supabase.from('class_courses').select('class_id').eq('course_id', courseId)) });
  const ids = new Set((linked.data ?? []).map((r) => r.class_id));
  const toggle = async (classId: string, on: boolean) => {
    const { error } = on
      ? await supabase.from('class_courses').insert({ class_id: classId, course_id: courseId, assigned_by: user!.id })
      : await supabase.from('class_courses').delete().eq('class_id', classId).eq('course_id', courseId);
    if (error) toast.error('Could not update', error.message);
    else { toast.success(on ? 'Added to class — members were enrolled' : 'Removed from class'); void qc.invalidateQueries({ queryKey: ['course-classes', courseId] }); }
  };
  return (
    <Card><CardBody>
      <p className="text-sm font-bold text-ink-800">Classes that can study this course</p>
      <p className="text-xs text-ink-500">Members are enrolled automatically, including anyone who joins later. People who leave the class lose access.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(mine.data ?? []).map((c) => (
          <button key={c.id} onClick={() => void toggle(c.id, !ids.has(c.id))} aria-pressed={ids.has(c.id)}
            className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold transition', ids.has(c.id) ? 'border-growth-500 bg-growth-50 text-growth-700' : 'border-ink-200 text-ink-600 hover:border-brand-300')}>
            {ids.has(c.id) ? '✓ ' : '+ '}{c.name}
          </button>
        ))}
        {!mine.data?.length && <p className="text-sm text-ink-500">You have no classes yet. <Link to="/teach/classes?new=1" className="font-semibold text-brand-700">Create one</Link>.</p>}
      </div>
    </CardBody></Card>
  );
}

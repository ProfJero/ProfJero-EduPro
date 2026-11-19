import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ClipboardCheck, ClipboardList, Plus, Presentation, Users, Video } from 'lucide-react';
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, LoadingBlock, PageHeader, Section, StatCard, StatusBadge } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses, useTeachingClasses } from './queries';
import { SessionCard } from '@/features/live/SessionCard';
import { LIVE_SELECT, type LiveSessionRow } from '@/features/learning/queries';
import { classColor } from '@/features/classroom/LearnerClasses';
import { cn } from '@/lib/utils';

export function TeacherHome() {
  const { user, context } = useAuth();
  const overview = useQuery({ queryKey: ['teacher-overview', user?.id], queryFn: async () => unwrap(await supabase.rpc('teacher_overview')) as Record<string, number> });
  const courses = useManagedCourses();
  const classes = useTeachingClasses();
  const sessions = useQuery({
    queryKey: ['host-sessions', user?.id],
    queryFn: async () => unwrap(await supabase.from('live_sessions').select(LIVE_SELECT).eq('host_id', user!.id).gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString()).order('starts_at').limit(5)) as unknown as LiveSessionRow[],
  });
  const toGrade = useQuery({
    queryKey: ['to-grade', user?.id],
    queryFn: async () => unwrap(await supabase.from('assignment_submissions').select('id, submitted_at, is_late, assignment:assignments(id, title)').eq('status', 'submitted').neq('user_id', user!.id).order('submitted_at').limit(8)) as unknown as { id: string; submitted_at: string; is_late: boolean; assignment: { id: string; title: string } | null }[],
  });
  const o = overview.data;
  const isIndependent = context?.roles.includes('teacher');
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Teaching workspace" title="Your teaching day" description="Courses, classes, marking and live sessions — all in one place."
        actions={<>{isIndependent || context?.schools.some((s) => s.roles?.some((r) => r === 'teacher' || r === 'school_admin')) ? <ButtonLink to="/teach/courses/new" leftIcon={<Plus className="h-4 w-4" />}>New course</ButtonLink> : null}<ButtonLink to="/teach/live" variant="outline" leftIcon={<Video className="h-4 w-4" />}>Schedule live class</ButtonLink></>} />
      {!isIndependent && !context?.schools.length && <Alert tone="info" title="Independent instructor access pending">To create your own courses, <Link to="/teach/apply" className="font-semibold underline">apply as an instructor</Link>. If you teach at a school, ask your administrator to invite you.</Alert>}
      {overview.isLoading ? <LoadingBlock rows={1} /> : o && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="Courses" value={o.courses} icon={<BookOpen className="h-5 w-5" />} to="/teach/courses" />
          <StatCard label="Classes" value={o.classes} icon={<Presentation className="h-5 w-5" />} tone="green" to="/teach/classes" />
          <StatCard label="Learners" value={o.learners} icon={<Users className="h-5 w-5" />} tone="violet" to="/teach/students" />
          <StatCard label="To mark" value={o.pending_submissions} icon={<ClipboardList className="h-5 w-5" />} tone="amber" to="/teach/assignments" />
          <StatCard label="Answers to mark" value={o.pending_manual_grading} icon={<ClipboardCheck className="h-5 w-5" />} tone="amber" to="/teach/assessments" />
          <StatCard label="Upcoming live" value={o.upcoming_sessions} icon={<Video className="h-5 w-5" />} tone="navy" to="/teach/live" />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Section title="My classes" action={<Link to="/teach/classes" className="text-sm font-semibold text-brand-700">All classes</Link>}>
            {classes.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">{classes.data.slice(0, 4).map((c) => (
                <Link key={c.id} to={`/teach/classes/${c.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
                  <span className={cn('h-10 w-2 rounded-full', classColor[c.color])} />
                  <span className="min-w-0"><span className="block truncate font-bold">{c.name}{c.stream ? ` · ${c.stream}` : ''}</span><span className="block truncate text-xs text-ink-500">{c.school?.name}{c.subject ? ` · ${c.subject}` : ''}</span></span>
                  {c.is_class_teacher && <Badge tone="green" className="ml-auto">Class teacher</Badge>}
                </Link>
              ))}</div>
            ) : <Card><CardBody className="text-sm text-ink-500">No school classes assigned to you.</CardBody></Card>}
          </Section>
          <Section title="Recent courses" action={<Link to="/teach/courses" className="text-sm font-semibold text-brand-700">All courses</Link>}>
            {courses.data?.length ? (
              <ul className="card divide-y divide-ink-100">{courses.data.slice(0, 5).map((c) => (
                <li key={c.id}><Link to={`/teach/courses/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50"><BookOpen className="h-4 w-4 text-ink-400" /><span className="flex-1 truncate font-semibold">{c.title}</span><StatusBadge status={c.status} /><span className="hidden text-xs text-ink-400 sm:inline">{fromNow(c.updated_at)}</span></Link></li>
              ))}</ul>
            ) : <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No courses yet" description="Create your first course with the lesson builder." action={<ButtonLink to="/teach/courses/new">Create course</ButtonLink>} />}
          </Section>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Waiting to be marked" action={<Link to="/teach/assignments" className="text-sm font-semibold text-brand-700">All</Link>} />
            <CardBody className="space-y-2">
              {toGrade.data?.length ? toGrade.data.map((s) => s.assignment && (
                <Link key={s.id} to={`/teach/assignments/${s.assignment.id}`} className="flex items-center justify-between gap-3 rounded-lg p-2 text-sm hover:bg-ink-50"><span className="truncate font-medium">{s.assignment.title}</span><span className="shrink-0 text-xs text-ink-500">{fromNow(s.submitted_at)}{s.is_late && <Badge tone="amber" className="ml-1">late</Badge>}</span></Link>
              )) : <p className="text-sm text-ink-500">Nothing waiting. Nice work!</p>}
            </CardBody>
          </Card>
          <Section title="Your upcoming live classes">
            {sessions.data?.length ? <div className="space-y-3">{sessions.data.map((s) => <SessionCard key={s.id} s={s} compact />)}</div> : <Card><CardBody className="text-sm text-ink-500">No upcoming sessions. <Link to="/teach/live" className="font-semibold text-brand-700">Schedule one</Link>.</CardBody></Card>}
          </Section>
        </div>
      </div>
    </div>
  );
}

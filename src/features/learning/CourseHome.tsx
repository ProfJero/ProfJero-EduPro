import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, CheckCircle2, Circle, ClipboardCheck, ClipboardList, Download, LogOut, Megaphone, PlayCircle, Presentation, Video } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, ConfirmDialog, EmptyState, LoadingBlock, PageHeader, ProgressRing, Tabs, useToast } from '@/components/ui';
import { useCourse, useCourseOutline, useMyEnrolment, useEnrol } from '@/features/courses/queries';
import { ClassroomPanel } from '@/features/classroom/ClassroomPanel';
import { SessionCard } from '@/features/live/SessionCard';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fmtDateTime, fromNow } from '@/lib/dates';
import { errorMessage, plural, safeExternalUrl } from '@/lib/utils';
import { useLessonProgress, useUpcomingSessions } from './queries';
import { useMyAssignments } from '@/features/assignments/queries';
import { useMyAssessments } from '@/features/assessments/queries';

export function CourseHome() {
  const { courseId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: course, isLoading } = useCourse({ id: courseId });
  const { data: outline } = useCourseOutline(courseId);
  const { data: enr, refetch } = useMyEnrolment(courseId);
  const { data: progress } = useLessonProgress(courseId);
  const enrol = useEnrol();
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState('lessons');

  if (isLoading) return <LoadingBlock />;
  if (!course) return <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Course not available" description="It may be private, or your access has ended." action={<ButtonLink to="/learn/courses">My Learning</ButtonLink>} />;
  const enrolled = enr && enr.status !== 'dropped';
  const done = new Set((progress ?? []).filter((p) => p.status === 'completed').map((p) => p.lesson_id));
  const modules = (outline ?? []).filter((m) => m.status === 'published').map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.status === 'published') }));
  const allLessons = modules.flatMap((m) => m.lessons);
  const nextLesson = allLessons.find((l) => !done.has(l.id)) ?? allLessons[0];

  if (!enrolled) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ to: '/learn/courses', label: 'My Learning' }} title={course.title} description={course.short_description} />
        <Alert tone="info" title={enr?.status === 'dropped' ? 'You left this course' : 'You are not enrolled'} action={course.enrolment_method === 'open' ? (
          <Button size="sm" loading={enrol.isPending} onClick={() => enrol.mutate(course.id, { onSuccess: () => void refetch(), onError: (e) => toast.error('Could not enrol', errorMessage(e)) })}>{enr ? 'Rejoin' : 'Enrol'}</Button>
        ) : undefined}>Enrol to open lessons, join the class discussion and track your progress.</Alert>
        <ButtonLink to={`/courses/${course.slug}`} variant="outline">View course details</ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/learn/courses', label: 'My Learning' }} eyebrow={course.category?.name} title={course.title}
        actions={<>
          {nextLesson && <ButtonLink to={`/learn/courses/${course.id}/lessons/${enr.last_lesson_id ?? nextLesson.id}`} leftIcon={<PlayCircle className="h-4 w-4" />}>{done.size ? 'Continue' : 'Start learning'}</ButtonLink>}
          {enr.status === 'completed' && <ButtonLink to="/learn/certificates" variant="success" leftIcon={<Award className="h-4 w-4" />}>Certificate</ButtonLink>}
        </>} />
      <Card>
        <CardBody className="flex flex-wrap items-center gap-6">
          <ProgressRing value={enr.progress_pct} size={72} stroke={7} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink-900">{enr.status === 'completed' ? 'Course completed 🎉' : `${done.size} of ${plural(allLessons.length, 'lesson')} complete`}</p>
            <p className="text-sm text-ink-500">{enr.status === 'completed' ? `Completed ${fmtDate(enr.completed_at)}` : `Enrolled ${fromNow(enr.enrolled_at)}`}{course.completion_requires_assessments && ' · Pass the course assessments to finish'}</p>
          </div>
          {enr.source === 'self' && enr.status === 'active' && <Button variant="ghost" size="sm" leftIcon={<LogOut className="h-4 w-4" />} onClick={() => setLeaving(true)}>Leave course</Button>}
        </CardBody>
      </Card>

      <Tabs value={tab} onValueChange={setTab} tabs={[
        { value: 'lessons', label: 'Lessons', content: (
          <div className="space-y-4">
            {modules.map((m, i) => (
              <Card key={m.id}>
                <div className="border-b border-ink-100 px-5 py-3.5"><p className="text-xs font-bold uppercase tracking-wider text-ink-400">Module {i + 1}</p><h2 className="font-bold">{m.title}</h2></div>
                <ul className="divide-y divide-ink-100">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <Link to={`/learn/courses/${course.id}/lessons/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                        {done.has(l.id) ? <CheckCircle2 className="h-5 w-5 shrink-0 text-growth-600" aria-label="Completed" /> : <Circle className="h-5 w-5 shrink-0 text-ink-300" aria-label="Not completed" />}
                        <span className="flex-1 text-sm font-medium text-ink-800">{l.title}</span>
                        {l.completion_rule !== 'mark_complete' && <Badge tone="violet">{l.completion_rule === 'quiz_pass' ? 'Quiz' : 'Assignment'}</Badge>}
                        {l.estimated_minutes && <span className="text-xs text-ink-400">{l.estimated_minutes} min</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            {!modules.length && <EmptyState title="Lessons coming soon" description="Your instructor is preparing the lessons for this course." />}
          </div>
        ) },
        { value: 'classroom', label: <span className="inline-flex items-center gap-1.5"><Presentation className="h-4 w-4" />Classroom</span>, content: <ClassroomPanel type="course" roomId={course.id} canModerate={false} title={course.title} /> },
        { value: 'live', label: <span className="inline-flex items-center gap-1.5"><Video className="h-4 w-4" />Live classes</span>, content: <CourseLive courseId={course.id} /> },
        { value: 'work', label: 'Assessments & work', content: <CourseWork courseId={course.id} /> },
        { value: 'news', label: <span className="inline-flex items-center gap-1.5"><Megaphone className="h-4 w-4" />Announcements</span>, content: <CourseAnnouncements courseId={course.id} /> },
        { value: 'resources', label: 'Resources', content: <CourseResources courseId={course.id} /> },
      ]} />

      <ConfirmDialog open={leaving} onOpenChange={setLeaving} title="Leave this course?" description="Your progress is kept. You can rejoin later from the course page." confirmLabel="Leave course" tone="danger"
        onConfirm={async () => {
          const { error } = await supabase.from('course_enrolments').update({ status: 'dropped' }).eq('id', enr.id);
          setLeaving(false);
          if (error) toast.error('Could not leave', error.message); else { toast.success('You left the course'); nav('/learn/courses'); }
        }} />
    </div>
  );
}

function CourseLive({ courseId }: { courseId: string }) {
  const { data, isLoading } = useUpcomingSessions({ courseId, days: 60 });
  if (isLoading) return <LoadingBlock rows={2} />;
  return data?.length ? <div className="space-y-3">{data.map((s) => <SessionCard key={s.id} s={s} compact />)}</div> : <EmptyState icon={<Video className="h-6 w-6" />} title="No live classes scheduled" description="When your instructor schedules a live class it will appear here and in your timetable." />;
}

function CourseWork({ courseId }: { courseId: string }) {
  const a = useMyAssessments();
  const s = useMyAssignments();
  const tests = (a.data ?? []).filter((x) => x.course_id === courseId);
  const work = (s.data ?? []).filter((x) => x.course_id === courseId);
  if (a.isLoading || s.isLoading) return <LoadingBlock rows={2} />;
  if (!tests.length && !work.length) return <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="No assessments or assignments yet" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tests.map((t) => (
        <Link key={t.id} to={`/learn/assessments/${t.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
          <ClipboardCheck className="h-5 w-5 text-brand-600" />
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.title}</span><span className="text-xs text-ink-500">{t.kind} · {t.closes_at ? `closes ${fmtDateTime(t.closes_at)}` : 'no closing date'}</span></span>
          {t.best ? <Badge tone={t.best.passed ? 'green' : 'amber'}>{Math.round(Number(t.best.percentage))}%</Badge> : <Badge>Not attempted</Badge>}
        </Link>
      ))}
      {work.map((w) => (
        <Link key={w.id} to={`/learn/assignments/${w.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
          <ClipboardList className="h-5 w-5 text-sun-500" />
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{w.title}</span><span className="text-xs text-ink-500">{w.due_at ? `due ${fmtDateTime(w.due_at)}` : 'no deadline'}</span></span>
          <Badge tone={w.grade ? 'green' : w.submission?.status === 'submitted' ? 'brand' : 'amber'}>{w.grade ? `${Number(w.grade.score)}/${Number(w.max_marks)}` : w.submission?.status ?? 'to do'}</Badge>
        </Link>
      ))}
    </div>
  );
}

function CourseAnnouncements({ courseId }: { courseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['announcements', 'course', courseId],
    queryFn: async () => unwrap(await supabase.from('announcements').select('id, title, body, is_pinned, published_at').eq('scope', 'course').eq('course_id', courseId).order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(30)),
  });
  if (isLoading) return <LoadingBlock rows={2} />;
  return data?.length ? (
    <div className="space-y-3">{data.map((a) => (
      <article key={a.id} className="card p-5">
        <div className="flex items-center gap-2">{a.is_pinned && <Badge tone="brand">Pinned</Badge>}<h3 className="font-bold">{a.title}</h3></div>
        <p className="mt-0.5 text-xs text-ink-400">{fmtDateTime(a.published_at)}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{a.body}</p>
      </article>
    ))}</div>
  ) : <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements yet" />;
}

function CourseResources({ courseId }: { courseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['course-resources', courseId],
    queryFn: async () => unwrap(await supabase.from('course_resources').select('id, title, description, kind, url, lesson_id').eq('course_id', courseId).order('created_at')),
  });
  if (isLoading) return <LoadingBlock rows={2} />;
  return data?.length ? (
    <ul className="grid gap-3 sm:grid-cols-2">{data.map((r) => {
      const url = safeExternalUrl(r.url);
      return (
        <li key={r.id}><a href={url ?? '#'} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 hover:border-brand-300">
          <Download className="h-5 w-5 text-brand-600" /><span className="min-w-0"><span className="block truncate font-semibold">{r.title}</span>{r.description && <span className="block truncate text-xs text-ink-500">{r.description}</span>}</span>
        </a></li>
      );
    })}</ul>
  ) : <EmptyState icon={<Download className="h-6 w-6" />} title="No resources yet" description="Downloadable notes and links from your instructor will appear here." />;
}

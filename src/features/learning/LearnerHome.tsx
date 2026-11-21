import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, BookOpen, Building2, CalendarClock, ClipboardCheck, ClipboardList, Compass, Flame, MailOpen, MessageSquareText, PlayCircle } from 'lucide-react';
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, LoadingBlock, ProgressBar, Section, StatCard } from '@/components/ui';
import { useAuth } from '@/features/authentication/AuthProvider';
import { supabase, unwrap } from '@/lib/supabase';
import { dayLabel, fmtDateTime, fromNow } from '@/lib/dates';
import { pct } from '@/lib/utils';
import { useMyCourses, useUpcomingSessions } from './queries';
import { useMyAssignments, isPending } from '@/features/assignments/queries';
import { useMyAssessments, assessmentWindow } from '@/features/assessments/queries';
import { SessionCard } from '@/features/live/SessionCard';
import { CourseCover } from '@/features/courses/CourseCover';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function LearnerHome() {
  const { profile, context, user } = useAuth();
  const courses = useMyCourses();
  const sessions = useUpcomingSessions({ days: 7 });
  const assignments = useMyAssignments();
  const assessments = useMyAssessments();
  const activity = useQuery({
    queryKey: ['activity-14', user?.id],
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('learning_activity').select('created_at, kind').eq('user_id', user!.id).gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString())),
  });

  const active = (courses.data ?? []).filter((c) => c.status === 'active');
  const completed = (courses.data ?? []).filter((c) => c.status === 'completed');
  const resume = active[0];
  const pendingA = (assignments.data ?? []).filter(isPending);
  const openTests = (assessments.data ?? []).filter((a) => assessmentWindow(a) === 'open' && (a.attempts.length < a.max_attempts || a.open) && !a.best?.passed);
  const feedback = (assignments.data ?? []).filter((a) => a.grade).sort((a, b) => (b.grade!.graded_at).localeCompare(a.grade!.graded_at)).slice(0, 3);
  const days = streak(activity.data?.map((a) => a.created_at) ?? []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-brand-600">{greeting()},</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{profile?.display_name || profile?.full_name?.split(' ')[0] || 'Learner'} 👋</h1>
          <p className="mt-1 text-ink-500">Here is your day in class.</p>
        </div>
        <ButtonLink to="/learn/explore" variant="outline" leftIcon={<Compass className="h-4 w-4" />}>Find a course</ButtonLink>
      </div>

      {(context?.pending_invitations ?? 0) > 0 && (
        <Alert tone="info" title="You have a school invitation" action={<ButtonLink size="sm" to="/invitations">View</ButtonLink>}><MailOpen className="hidden" />A school has invited you to join. Accept to see your classes.</Alert>
      )}
      {context?.school_applications?.map((a) => (
        <Alert key={a.school_id} tone={a.status === 'rejected' ? 'warning' : 'info'} title={`School registration: ${a.name}`}>
          {a.status === 'pending' ? 'Your application is being reviewed by the ProfJero team. You will be notified once it is approved.' : 'Your application was not approved. Check your notifications for details.'}
        </Alert>
      ))}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In progress" value={active.length} icon={<BookOpen className="h-5 w-5" />} to="/learn/courses" />
        <StatCard label="Completed" value={completed.length} icon={<Award className="h-5 w-5" />} tone="green" to="/learn/certificates" />
        <StatCard label="Work due" value={pendingA.length} icon={<ClipboardList className="h-5 w-5" />} tone="amber" to="/learn/assignments" />
        <StatCard label="Active days (14d)" value={days} icon={<Flame className="h-5 w-5" />} tone="violet" to="/learn/progress" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {courses.isLoading ? <LoadingBlock rows={2} /> : resume?.course ? (
            <Card className="overflow-hidden">
              <div className="grid sm:grid-cols-[14rem_1fr]">
                <div className="aspect-video sm:aspect-auto"><CourseCover course={{ ...resume.course }} /></div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Continue where you left off</p>
                  <h2 className="mt-1 text-xl font-extrabold">{resume.course.title}</h2>
                  <div className="mt-3 flex items-center gap-3"><ProgressBar value={resume.progress_pct} className="flex-1" /><span className="text-sm font-bold">{pct(resume.progress_pct)}%</span></div>
                  <ButtonLink to={resume.last_lesson_id ? `/learn/courses/${resume.course_id}/lessons/${resume.last_lesson_id}` : `/learn/courses/${resume.course_id}`} className="mt-4" leftIcon={<PlayCircle className="h-4 w-4" />}>Resume learning</ButtonLink>
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Start your first course" description="Browse the catalogue and enrol for free — your progress will show up here." action={<ButtonLink to="/learn/explore">Explore courses</ButtonLink>} />
          )}

          <Section title="Today's timetable" action={<Link to="/learn/classes" className="text-sm font-semibold text-brand-700">Full timetable</Link>}>
            {sessions.isLoading ? <LoadingBlock rows={2} /> : sessions.data?.length ? (
              <div className="space-y-3">{sessions.data.slice(0, 4).map((s) => <SessionCard key={s.id} s={s} />)}</div>
            ) : <Card><CardBody className="flex items-center gap-3 text-sm text-ink-500"><CalendarClock className="h-5 w-5" />No live classes in the next 7 days.</CardBody></Card>}
          </Section>

          {active.length > 1 && (
            <Section title="My courses" action={<Link to="/learn/courses" className="text-sm font-semibold text-brand-700">See all</Link>}>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.slice(1, 5).map((c) => (
                  <Link key={c.id} to={`/learn/courses/${c.course_id}`} className="card p-4 hover:border-brand-300">
                    <p className="truncate font-bold text-ink-900">{c.course?.title}</p>
                    <div className="mt-2 flex items-center gap-2"><ProgressBar value={c.progress_pct} className="flex-1" /><span className="text-xs font-semibold">{pct(c.progress_pct)}%</span></div>
                    <p className="mt-1 text-xs text-ink-500">{c.last_activity_at ? `Last studied ${fromNow(c.last_activity_at)}` : 'Not started yet'}</p>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Coming up" description="Assignments and assessments" />
            <CardBody className="space-y-3">
              {pendingA.slice(0, 4).map((a) => (
                <Link key={a.id} to={`/learn/assignments/${a.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sun-50 text-sun-700"><ClipboardList className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.title}</span><span className="block text-xs text-ink-500">{a.due_at ? `Due ${dayLabel(a.due_at)}` : 'No deadline'}{a.submission?.status === 'returned' && ' · returned for correction'}</span></span>
                </Link>
              ))}
              {openTests.slice(0, 4).map((a) => (
                <Link key={a.id} to={`/learn/assessments/${a.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><ClipboardCheck className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.title}</span><span className="block text-xs text-ink-500">{a.closes_at ? `Closes ${fmtDateTime(a.closes_at)}` : 'Open'}{a.open && ' · in progress'}</span></span>
                </Link>
              ))}
              {!pendingA.length && !openTests.length && <p className="text-sm text-ink-500">You're all caught up. 🎉</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent feedback" />
            <CardBody className="space-y-3">
              {feedback.length ? feedback.map((a) => (
                <Link key={a.id} to={`/learn/assignments/${a.id}`} className="block rounded-xl border border-ink-100 p-3 hover:border-ink-300">
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{a.title}</span><Badge tone="green">{Number(a.grade!.score)}/{Number(a.max_marks)}</Badge></div>
                  {a.grade!.feedback && <p className="mt-1 line-clamp-2 text-sm text-ink-600"><MessageSquareText className="mr-1 inline h-3.5 w-3.5" />{a.grade!.feedback}</p>}
                </Link>
              )) : <p className="text-sm text-ink-500">Teacher feedback on your work will appear here.</p>}
            </CardBody>
          </Card>
          {!context?.schools.length && (
            <Card><CardBody className="flex gap-3"><Building2 className="h-5 w-5 shrink-0 text-sun-500" /><div className="text-sm"><p className="font-semibold">Is your school on ProfJero Edu?</p><p className="text-ink-500">Ask your school to invite you, or <Link to="/schools/apply" className="font-semibold text-brand-700">register your school</Link>. <ArrowRight className="hidden" /></p></div></CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function streak(dates: string[]) {
  return new Set(dates.map((d) => d.slice(0, 10))).size;
}

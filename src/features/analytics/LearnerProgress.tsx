import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, ClipboardCheck, ClipboardList, Flame } from 'lucide-react';
import { Card, CardBody, CardHeader, DataTable, EmptyState, LoadingBlock, PageHeader, ProgressBar, StatCard } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { pct } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useMyCourses } from '@/features/learning/queries';
import { useMyAssessments } from '@/features/assessments/queries';
import { useMyAssignments } from '@/features/assignments/queries';

export function LearnerProgress() {
  const { user } = useAuth();
  const courses = useMyCourses();
  const tests = useMyAssessments();
  const work = useMyAssignments();
  const activity = useQuery({
    queryKey: ['activity-56', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('learning_activity').select('created_at').eq('user_id', user!.id).gte('created_at', new Date(Date.now() - 56 * 86400_000).toISOString())),
  });
  if (courses.isLoading || tests.isLoading) return <LoadingBlock />;
  const results = (tests.data ?? []).filter((t) => t.best);
  const avg = results.length ? Math.round(results.reduce((s, t) => s + Number(t.best!.percentage), 0) / results.length) : null;
  const graded = (work.data ?? []).filter((w) => w.grade);
  const counts = new Map<string, number>();
  (activity.data ?? []).forEach((a) => counts.set(a.created_at.slice(0, 10), (counts.get(a.created_at.slice(0, 10)) ?? 0) + 1));
  const days = Array.from({ length: 56 }, (_, i) => { const d = new Date(Date.now() - (55 - i) * 86400_000).toISOString().slice(0, 10); return { d, n: counts.get(d) ?? 0 }; });
  return (
    <div className="space-y-6">
      <PageHeader title="My progress" description="An honest picture of your learning — based on the work you've actually done." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Courses" value={(courses.data ?? []).filter((c) => c.status !== 'dropped').length} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Completed" value={(courses.data ?? []).filter((c) => c.status === 'completed').length} icon={<Award className="h-5 w-5" />} tone="green" />
        <StatCard label="Average score" value={avg == null ? '—' : `${avg}%`} icon={<ClipboardCheck className="h-5 w-5" />} tone="violet" />
        <StatCard label="Graded work" value={graded.length} icon={<ClipboardList className="h-5 w-5" />} tone="amber" />
      </div>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Flame className="h-5 w-5 text-sun-500" />Learning activity — last 8 weeks</span>} description="Lessons completed, enrolments and assessments, by day." />
        <CardBody>
          <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto" role="img" aria-label={`Active on ${days.filter((d) => d.n).length} of the last 56 days`}>
            {days.map((d) => <span key={d.d} title={`${fmtDate(d.d)}: ${d.n} activities`} className={`h-4 w-4 rounded ${d.n === 0 ? 'bg-ink-100' : d.n < 3 ? 'bg-growth-100' : d.n < 6 ? 'bg-growth-500/70' : 'bg-growth-600'}`} />)}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Course progress" />
        <CardBody className="space-y-4">
          {(courses.data ?? []).filter((c) => c.status !== 'dropped').map((c) => (
            <div key={c.id}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{c.course?.title}</span><span className="font-bold">{pct(c.progress_pct)}%</span></div>
              <ProgressBar value={c.progress_pct} tone={c.status === 'completed' ? 'green' : 'brand'} className="mt-1.5" />
            </div>
          ))}
          {!courses.data?.length && <p className="text-sm text-ink-500">Enrol in a course to see progress here.</p>}
        </CardBody>
      </Card>
      <section>
        <h2 className="mb-3 text-lg font-bold">Assessment history</h2>
        <DataTable rows={results} rowKey={(r) => r.id} empty={<EmptyState title="No assessment results yet" />} columns={[
          { key: 't', header: 'Assessment', primary: true, cell: (r) => r.title },
          { key: 'c', header: 'Course / class', cell: (r) => r.course?.title ?? r.cls?.name },
          { key: 'a', header: 'Attempts', cell: (r) => r.attempts.length },
          { key: 's', header: 'Best score', cell: (r) => `${Math.round(Number(r.best!.percentage))}%` },
          { key: 'p', header: 'Result', cell: (r) => r.best!.pending_manual ? 'Marking' : r.best!.passed ? 'Passed' : 'Not yet' },
        ]} />
      </section>
    </div>
  );
}

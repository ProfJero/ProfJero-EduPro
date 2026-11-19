import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Card, CardBody, EmptyState, LoadingBlock, PageHeader, ProgressBar, Select } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { pct } from '@/lib/utils';
import { useManagedCourses } from '@/features/teachers/queries';

type An = { enrolled: number; completed: number; avg_progress: number; inactive_14d: number; learners: { progress: number; status: string }[]; assessments: { title: string; attempts: number; avg_pct: number | null; pass_rate: number | null }[] };

export function TeacherReports() {
  const courses = useManagedCourses();
  const [id, setId] = useState('');
  const active = id || courses.data?.[0]?.id || '';
  const { data, isLoading } = useQuery({ queryKey: ['course-analytics', active], enabled: Boolean(active), queryFn: async () => unwrap(await supabase.rpc('course_analytics', { p_course: active })) as unknown as An });
  if (courses.isLoading) return <LoadingBlock />;
  if (!courses.data?.length) return <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="No courses to report on" />;
  const buckets = [0, 25, 50, 75, 100].map((lo, i, arr) => ({ label: i === arr.length - 1 ? '100%' : `${lo}–${arr[i + 1] - 1}%`, n: (data?.learners ?? []).filter((l) => (i === arr.length - 1 ? pct(l.progress) === 100 : pct(l.progress) >= lo && pct(l.progress) < arr[i + 1])).length }));
  const max = Math.max(1, ...buckets.map((b) => b.n));
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Participation, progress and assessment performance per course. Class reports are in each class and the school workspace." />
      <Select value={active} onChange={(e) => setId(e.target.value)} className="max-w-md" aria-label="Course">{courses.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
      {isLoading || !data ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[['Enrolled', data.enrolled], ['Completed', data.completed], ['Completion rate', data.enrolled ? `${Math.round((100 * data.completed) / data.enrolled)}%` : '—'], ['Inactive 14+ days', data.inactive_14d]].map(([l, v]) => <div key={l as string} className="card p-4"><p className="text-xs font-semibold uppercase text-ink-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>)}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardBody>
              <h2 className="font-bold">Progress distribution</h2>
              <div className="mt-4 space-y-2.5">{buckets.map((b) => <div key={b.label} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm"><span className="text-ink-500">{b.label}</span><div className="h-5 rounded bg-ink-100"><div className="h-5 rounded bg-brand-600" style={{ width: `${(100 * b.n) / max}%` }} /></div><span className="text-right font-semibold">{b.n}</span></div>)}</div>
            </CardBody></Card>
            <Card><CardBody>
              <h2 className="font-bold">Assessment performance</h2>
              <ul className="mt-4 space-y-3">{data.assessments.map((a) => <li key={a.title} className="text-sm"><div className="flex justify-between"><span className="font-semibold">{a.title}</span><span className="text-ink-500">{a.attempts} attempts</span></div><div className="mt-1 flex items-center gap-2"><ProgressBar value={a.pass_rate ?? 0} tone="green" className="flex-1" /><span className="text-xs">pass {a.pass_rate ?? '—'}% · avg {a.avg_pct ?? '—'}%</span></div></li>)}{!data.assessments.length && <li className="text-sm text-ink-500">No assessments.</li>}</ul>
            </CardBody></Card>
          </div>
        </>
      )}
    </div>
  );
}

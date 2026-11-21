import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Table2 } from 'lucide-react';
import { Button, Card, CardBody, EmptyState, ErrorState, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, downloadCsv } from '@/lib/utils';
import { useManagedCourses, useTeachingClasses } from '@/features/teachers/queries';

type Book = { columns: { id: string; type: string; title: string; weight: number; max: number }[]; rows: { user_id: string; name: string; average: number | null; cells: Record<string, { pct: number | null; status: string | null }> }[] };

export function GradebookPage() {
  const courses = useManagedCourses();
  const classes = useTeachingClasses();
  const [scope, setScope] = useState('');
  const [kind, id] = scope.split(':');
  const book = useQuery({
    queryKey: ['gradebook', scope], enabled: Boolean(scope),
    queryFn: async () => unwrap(await supabase.rpc('gradebook', kind === 'course' ? { p_course: id } : { p_class: id })) as unknown as Book,
  });
  const exportCsv = () => {
    if (!book.data) return;
    downloadCsv('gradebook.csv', book.data.rows.map((r) => ({ Learner: r.name, ...Object.fromEntries(book.data!.columns.map((c) => [c.title, r.cells[c.id]?.pct ?? ''])), 'Weighted average': r.average ?? '' })));
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Gradebook" description="Scores for every published assessment and assignment, with a weighted average. Change weights on each assessment or assignment."
        actions={<Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} disabled={!book.data?.rows.length} onClick={exportCsv}>Export CSV</Button>} />
      <Select value={scope} onChange={(e) => setScope(e.target.value)} className="max-w-md" aria-label="Course or class">
        <option value="">Choose a course or class…</option>
        {(courses.data ?? []).length > 0 && <optgroup label="Courses">{courses.data!.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.title}</option>)}</optgroup>}
        {(classes.data ?? []).length > 0 && <optgroup label="Classes">{classes.data!.map((c) => <option key={c.id} value={`class:${c.id}`}>{c.name}</option>)}</optgroup>}
      </Select>
      {!scope ? <EmptyState icon={<Table2 className="h-8 w-8" />} title="Pick a course or class" /> : book.isLoading ? <LoadingBlock /> : book.error ? <ErrorState error={book.error} /> : !book.data?.rows.length ? (
        <EmptyState title="No learners yet" description="Learners appear here once they enrol or join." />
      ) : (
        <Card><CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead><tr className="bg-ink-50">
              <th className="sticky left-0 bg-ink-50 px-3 py-2 text-left font-semibold">Learner</th>
              {book.data.columns.map((c) => <th key={c.id} className="px-3 py-2 text-left font-semibold"><span className="block max-w-[10rem] truncate" title={c.title}>{c.title}</span><span className="text-xs font-normal text-ink-500">{c.type} · ×{c.weight}</span></th>)}
              <th className="px-3 py-2 text-right font-semibold">Average</th>
            </tr></thead>
            <tbody>{book.data.rows.map((r) => (
              <tr key={r.user_id} className="border-t border-ink-100">
                <td className="sticky left-0 bg-surface px-3 py-2 font-medium">{r.name}</td>
                {book.data!.columns.map((c) => { const cell = r.cells[c.id]; return (
                  <td key={c.id} className="px-3 py-2 tabular-nums">{cell?.pct != null ? <span className={cn('font-semibold', cell.pct >= 70 ? 'text-growth-700' : cell.pct >= 50 ? 'text-sun-700' : 'text-red-700')}>{Math.round(cell.pct)}%</span> : <span className="text-xs text-ink-400">{cell?.status ?? '—'}</span>}</td>
                ); })}
                <td className="px-3 py-2 text-right font-extrabold tabular-nums">{r.average != null ? `${r.average}%` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardBody></Card>
      )}
    </div>
  );
}

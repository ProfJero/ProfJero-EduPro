import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, ErrorState, LoadingBlock, PageHeader, ProgressRing } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export function MyGrades() {
  const q = useQuery({ queryKey: ['my-grades'], queryFn: async () => unwrap(await supabase.rpc('my_grades')) });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  const byCtx = new Map<string, typeof rows>();
  rows.forEach((r) => byCtx.set(r.context ?? 'Other', [...(byCtx.get(r.context ?? 'Other') ?? []), r]));
  return (
    <div className="space-y-6">
      <PageHeader title="My grades" description="Every marked assessment and assignment in one place." />
      {!rows.length ? <EmptyState icon={<GraduationCap className="h-8 w-8" />} title="No grades yet" description="When your teachers mark your work, results appear here." /> : (
        [...byCtx.entries()].map(([ctx, list]) => {
          const avg = Math.round(list.reduce((a, r) => a + Number(r.pct ?? 0), 0) / list.length);
          return (
            <Card key={ctx}><CardBody>
              <div className="mb-3 flex items-center gap-4"><ProgressRing value={avg} size={52} /><div><h2 className="text-lg font-bold">{ctx}</h2><p className="text-sm text-ink-500">Average {avg}% across {list.length} item{list.length === 1 ? '' : 's'}</p></div></div>
              <ul className="divide-y divide-ink-100">{list.map((r) => (
                <li key={r.kind + r.item_id}><Link to={r.link} className="flex items-center gap-3 py-2.5 hover:text-brand-700">
                  <Badge>{r.kind}</Badge><span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                  <span className="hidden text-xs text-ink-400 sm:inline">{r.graded_at ? fmtDate(r.graded_at) : ''}</span>
                  <span className="text-sm tabular-nums text-ink-500">{Number(r.score)}/{Number(r.max_score)}</span>
                  <span className={cn('w-14 text-right font-extrabold tabular-nums', Number(r.pct) >= 70 ? 'text-growth-600' : Number(r.pct) >= 50 ? 'text-sun-500' : 'text-red-600')}>{Math.round(Number(r.pct))}%</span>
                </Link></li>
              ))}</ul>
            </CardBody></Card>
          );
        })
      )}
    </div>
  );
}

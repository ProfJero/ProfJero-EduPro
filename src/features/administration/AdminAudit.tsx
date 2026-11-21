import { useInfiniteQuery } from '@tanstack/react-query';
import { Button, DataTable, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/dates';

const PAGE = 50;
export function AdminAudit() {
  const q = useInfiniteQuery({
    queryKey: ['audit-logs'], initialPageParam: 0,
    queryFn: async ({ pageParam }) => unwrap(await supabase.from('audit_logs').select('id, actor_id, action, entity_type, entity_id, details, created_at').order('created_at', { ascending: false }).range(pageParam * PAGE, pageParam * PAGE + PAGE - 1)),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length : undefined),
  });
  const rows = q.data?.pages.flat() ?? [];
  return (
    <div>
      <PageHeader title="Audit log" description="Every privileged action — role changes, approvals, suspensions, grants, imports and publishing — is recorded here and cannot be edited." />
      {q.isLoading ? <LoadingBlock /> : <DataTable rows={rows} rowKey={(r) => String(r.id)} empty={<EmptyState title="No entries yet" />} columns={[
        { key: 'w', header: 'When', primary: true, cell: (r) => fmtDateTime(r.created_at) },
        { key: 'a', header: 'Action', cell: (r) => <span className="font-semibold">{r.action}</span> },
        { key: 'e', header: 'Entity', cell: (r) => <span className="font-mono text-xs">{r.entity_type}:{r.entity_id?.slice(0, 12)}</span> },
        { key: 'by', header: 'Actor', cell: (r) => <span className="font-mono text-xs">{r.actor_id?.slice(0, 8) ?? 'system'}</span> },
        { key: 'd', header: 'Details', hideOnMobile: true, cell: (r) => <code className="line-clamp-2 text-xs text-ink-500">{JSON.stringify(r.details)}</code> },
      ]} />}
      {q.hasNextPage && <div className="mt-4 text-center"><Button variant="outline" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button></div>}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Avatar, DataTable, EmptyState, LoadingBlock } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import type { AdminUser } from './AdminUsers';

/** Users holding a given platform role (paged through admin_list_users). */
export function AdminUsersTable({ role }: { role: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users-role', role],
    queryFn: async () => (unwrap(await supabase.rpc('admin_list_users', { p_search: null as never, p_limit: 200, p_offset: 0 })) as AdminUser[]).filter((u) => u.roles.includes(role)),
  });
  if (isLoading) return <LoadingBlock />;
  return <DataTable rows={data ?? []} rowKey={(r) => r.user_id} empty={<EmptyState title="None yet" />} columns={[
    { key: 'n', header: 'Name', primary: true, cell: (r) => <span className="inline-flex items-center gap-2"><Avatar name={r.full_name || r.email} size={28} />{r.full_name || r.email}</span> },
    { key: 'e', header: 'Email', cell: (r) => r.email },
    { key: 'j', header: 'Joined', cell: (r) => fmtDate(r.created_at) },
  ]} />;
}

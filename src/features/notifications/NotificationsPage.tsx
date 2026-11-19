import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Button, EmptyState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';

const PAGE = 30;
type N = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['notifications', 'list', user?.id, unreadOnly],
    enabled: Boolean(user),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let qq = supabase.from('notifications').select('id, type, title, body, link, read_at, created_at').order('created_at', { ascending: false }).range(pageParam * PAGE, pageParam * PAGE + PAGE - 1);
      if (unreadOnly) qq = qq.is('read_at', null);
      return unwrap(await qq) as N[];
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length : undefined),
  });
  const items = q.data?.pages.flat() ?? [];
  const open = async (n: N) => {
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link?.startsWith('/')) nav(n.link);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" actions={<>
        <Button variant="outline" size="sm" onClick={() => setUnreadOnly((u) => !u)} aria-pressed={unreadOnly}>{unreadOnly ? 'Show all' : 'Unread only'}</Button>
        <Button size="sm" variant="secondary" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={async () => {
          const { error } = await supabase.rpc('mark_all_notifications_read');
          if (error) toast.error('Failed', error.message); else void qc.invalidateQueries({ queryKey: ['notifications'] });
        }}>Mark all read</Button>
      </>} />
      {q.isLoading ? <LoadingBlock /> : items.length ? (
        <ul className="card divide-y divide-ink-100 overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={cn('flex w-full gap-3 px-5 py-4 text-left hover:bg-ink-50', !n.read_at && 'bg-brand-50/50')}>
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-600')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', n.read_at ? 'text-ink-700' : 'font-bold text-ink-900')}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-ink-500">{n.body}</span>}
                  <span className="mt-1 block text-xs text-ink-400">{fromNow(n.created_at)}{!n.read_at && <span className="sr-only"> · unread</span>}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Bell className="h-7 w-7" />} title="You're all caught up" description="Notifications about classes, assignments, grades and announcements will appear here." />}
      {q.hasNextPage && <div className="mt-4 text-center"><Button variant="outline" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button></div>}
    </div>
  );
}

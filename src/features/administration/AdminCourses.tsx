import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, MoreVertical } from 'lucide-react';
import { Badge, DataTable, EmptyState, LoadingBlock, Menu, MenuContent, MenuItem, MenuTrigger, PageHeader, Select, StatusBadge, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';

export function AdminCourses() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('in_review');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-courses', status],
    queryFn: async () => {
      let q = supabase.from('courses').select('id, title, slug, status, visibility, is_premium, updated_at, school:schools(name)').order('updated_at', { ascending: false }).limit(300);
      if (status !== 'all') q = q.eq('status', status as 'draft');
      return unwrap(await q) as unknown as { id: string; title: string; slug: string; status: string; visibility: string; is_premium: boolean; updated_at: string; school: { name: string } | null }[];
    },
  });
  const act = async (id: string, action: string) => {
    const { error } = await supabase.rpc('review_course', { p_course: id, p_action: action });
    if (error) toast.error('Failed', error.message); else { toast.success(`Course ${action === 'reject' ? 'returned to draft' : action + 'ed'}`); void qc.invalidateQueries({ queryKey: ['admin-courses'] }); }
  };
  const premium = async (id: string, v: boolean) => {
    const { error } = await supabase.from('courses').update({ is_premium: v }).eq('id', id);
    if (error) toast.error('Failed', error.message); else { toast.success(v ? 'Marked as EduPro course' : 'Now a free course'); void qc.invalidateQueries({ queryKey: ['admin-courses'] }); }
  };
  return (
    <div>
      <PageHeader title="Courses & content" description="Review submissions, publish or unpublish content, and choose which courses are EduPro."
        actions={<Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48" aria-label="Status"><option value="in_review">In review</option><option value="published">Published</option><option value="draft">Draft</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option><option value="all">All</option></Select>} />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState title="No courses in this state" />} columns={[
          { key: 't', header: 'Course', primary: true, cell: (r) => <Link to={`/teach/courses/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'o', header: 'Owner', cell: (r) => r.school?.name ?? 'Independent' },
          { key: 'p', header: 'Offering', cell: (r) => (r.is_premium ? <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>EduPro</Badge> : <Badge tone="brand">Edu</Badge>) },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'u', header: 'Updated', cell: (r) => fromNow(r.updated_at) },
          { key: 'x', header: '', cell: (r) => (
            <Menu>
              <MenuTrigger className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${r.title}`}><MoreVertical className="h-4 w-4" /></MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => window.open(`/courses/${r.slug}`, '_blank', 'noopener')}>View course page</MenuItem>
                {r.status !== 'published' && <MenuItem onSelect={() => act(r.id, 'publish')}>Publish</MenuItem>}
                {r.status === 'in_review' && <MenuItem onSelect={() => act(r.id, 'reject')}>Request changes</MenuItem>}
                {r.status === 'published' && <MenuItem onSelect={() => act(r.id, 'unpublish')}>Unpublish</MenuItem>}
                <MenuItem onSelect={() => premium(r.id, !r.is_premium)}>{r.is_premium ? 'Make free (Edu)' : 'Make EduPro course'}</MenuItem>
                {r.status !== 'archived' && <MenuItem danger onSelect={() => act(r.id, 'archive')}>Archive</MenuItem>}
              </MenuContent>
            </Menu>
          ) },
        ]} />
      )}
    </div>
  );
}

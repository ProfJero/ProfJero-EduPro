import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import { ButtonLink, DataTable, EmptyState, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';

export function SchoolCourses() {
  const { schoolId } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['school-courses', schoolId], queryFn: async () => unwrap(await supabase.from('courses').select('id, title, status, visibility, updated_at, owner_id').eq('school_id', schoolId!).order('updated_at', { ascending: false })) });
  return (
    <div>
      <PageHeader title="School courses" description="Courses owned by your school. As a school administrator you can review and publish them, then assign them to classes." actions={<ButtonLink to="/teach/courses/new" leftIcon={<Plus className="h-4 w-4" />}>New school course</ButtonLink>} />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState icon={<BookOpen className="h-7 w-7" />} title="No school courses yet" description="Teachers can create courses for the school from their teaching workspace. Public ProfJero courses can also be assigned to classes." />} columns={[
          { key: 't', header: 'Course', primary: true, cell: (r) => <Link to={`/teach/courses/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'v', header: 'Visibility', cell: (r) => <span className="capitalize">{r.visibility}</span> },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'u', header: 'Updated', cell: (r) => fromNow(r.updated_at) },
        ]} />
      )}
    </div>
  );
}

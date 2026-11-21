import { Link } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import { Badge, ButtonLink, DataTable, EmptyState, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { fromNow } from '@/lib/dates';
import { useManagedCourses } from '@/features/teachers/queries';

export function TeacherCourses() {
  const { data, isLoading } = useManagedCourses();
  return (
    <div>
      <PageHeader title="My courses" description="Courses you own or teach. Drafts stay private until published." actions={<ButtonLink to="/teach/courses/new" leftIcon={<Plus className="h-4 w-4" />}>New course</ButtonLink>} />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} caption="My courses"
          empty={<EmptyState icon={<BookOpen className="h-7 w-7" />} title="Create your first course" description="Build structured modules and interactive lessons — no developer needed." action={<ButtonLink to="/teach/courses/new">Create course</ButtonLink>} />}
          columns={[
            { key: 't', header: 'Course', primary: true, cell: (r) => <Link to={`/teach/courses/${r.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{r.title}</Link> },
            { key: 'sc', header: 'Context', cell: (r) => r.school ? <Badge tone="amber">{r.school.name}</Badge> : <Badge tone="brand">Independent</Badge> },
            { key: 'v', header: 'Visibility', cell: (r) => <span className="capitalize text-ink-600">{r.visibility}</span> },
            { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'u', header: 'Updated', cell: (r) => fromNow(r.updated_at) },
          ]} />
      )}
    </div>
  );
}

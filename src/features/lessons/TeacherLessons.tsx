import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileStack } from 'lucide-react';
import { DataTable, EmptyState, Input, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { useManagedCourses } from '@/features/teachers/queries';

export function TeacherLessons() {
  const courses = useManagedCourses();
  const ids = (courses.data ?? []).map((c) => c.id);
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['all-lessons', ids.join(',')], enabled: ids.length > 0,
    queryFn: async () => unwrap(await supabase.from('lessons').select('id, title, status, updated_at, course_id, module:course_modules(title)').in('course_id', ids).order('updated_at', { ascending: false }).limit(300)) as unknown as { id: string; title: string; status: string; updated_at: string; course_id: string; module: { title: string } | null }[],
  });
  const rows = (data ?? []).filter((l) => l.title.toLowerCase().includes(q.toLowerCase()));
  const title = (id: string) => courses.data?.find((c) => c.id === id)?.title;
  return (
    <div>
      <PageHeader title="Lessons" description="Every lesson across your courses — jump straight into the editor." />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons" aria-label="Search lessons" className="mb-4 max-w-sm" />
      {courses.isLoading || isLoading ? <LoadingBlock /> : (
        <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState icon={<FileStack className="h-7 w-7" />} title="No lessons yet" description="Open a course's curriculum to add lessons." />} columns={[
          { key: 't', header: 'Lesson', primary: true, cell: (r) => <Link to={`/teach/courses/${r.course_id}/lessons/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'c', header: 'Course', cell: (r) => <span className="text-ink-600">{title(r.course_id)}</span> },
          { key: 'm', header: 'Module', cell: (r) => r.module?.title },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'u', header: 'Edited', cell: (r) => fromNow(r.updated_at) },
        ]} />
      )}
    </div>
  );
}

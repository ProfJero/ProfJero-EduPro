import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { useMyClasses, useMyCourses } from '@/features/learning/queries';
import { useTeachingRooms } from '@/features/teachers/queries';

export function DiscussionsPage() {
  const courses = useMyCourses();
  const classes = useMyClasses();
  const teaching = useTeachingRooms();
  const rooms = [
    ...(teaching.data?.courses ?? []).map((c) => ({ key: `tc-${c.id}`, to: `/teach/courses/${c.id}?tab=classroom`, title: c.title, kind: 'Course you teach' })),
    ...(teaching.data?.classes ?? []).map((c) => ({ key: `tk-${c.id}`, to: `/teach/classes/${c.id}`, title: c.name, kind: 'Class you teach' })),
    ...(courses.data ?? []).filter((c) => c.status !== 'dropped' && c.course).map((c) => ({ key: `c-${c.course_id}`, to: `/learn/courses/${c.course_id}`, title: c.course!.title, kind: 'Course classroom' })),
    ...(classes.data ?? []).filter((c) => c.cls).map((c) => ({ key: `k-${c.class_id}`, to: `/learn/classes/${c.class_id}`, title: c.cls!.name, kind: 'School class' })),
  ];
  if (courses.isLoading || classes.isLoading) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Discussions" description="Every classroom you belong to — jump into the class board and Q&A." />
      {rooms.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rooms.map((r) => (
          <li key={r.key}><Link to={r.to} className="card flex items-center gap-3 p-4 hover:border-brand-300"><MessagesSquare className="h-5 w-5 text-brand-600" /><span className="min-w-0"><span className="block truncate font-semibold">{r.title}</span><span className="text-xs text-ink-500">{r.kind}</span></span></Link></li>
        ))}</ul>
      ) : <EmptyState icon={<MessagesSquare className="h-7 w-7" />} title="No classrooms yet" description="Enrol in a course or join a class to start discussing." />}
    </div>
  );
}

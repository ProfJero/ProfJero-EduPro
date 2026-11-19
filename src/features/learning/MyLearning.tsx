import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PlayCircle } from 'lucide-react';
import { Badge, ButtonLink, EmptyState, ErrorState, LoadingBlock, PageHeader, ProgressBar, Tabs } from '@/components/ui';
import { CourseCover } from '@/features/courses/CourseCover';
import { fromNow } from '@/lib/dates';
import { pct } from '@/lib/utils';
import { useMyCourses, type MyCourse } from './queries';

export function MyLearning() {
  const { data, isLoading, error, refetch } = useMyCourses();
  const [tab, setTab] = useState('active');
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  const by = (s: string) => (data ?? []).filter((c) => c.status === s);
  const grid = (rows: MyCourse[], empty: React.ReactNode) => rows.length ? (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{rows.map((c) => <EnrolledCard key={c.id} e={c} />)}</div>
  ) : empty;
  return (
    <div>
      <PageHeader title="My Learning" description="Every course you are enrolled in — by yourself, your teacher or your school." actions={<ButtonLink to="/learn/explore" variant="outline">Explore courses</ButtonLink>} />
      {isLoading ? <LoadingBlock /> : (
        <Tabs value={tab} onValueChange={setTab} tabs={[
          { value: 'active', label: 'In progress', count: by('active').length, content: grid(by('active'), <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No courses in progress" description="Find something you'd like to learn." action={<ButtonLink to="/learn/explore">Explore courses</ButtonLink>} />) },
          { value: 'completed', label: 'Completed', count: by('completed').length, content: grid(by('completed'), <EmptyState title="No completed courses yet" description="Finish a course to earn your first certificate." />) },
          { value: 'dropped', label: 'Left', count: by('dropped').length, content: grid(by('dropped'), <EmptyState title="Nothing here" description="Courses you leave appear here so you can rejoin later." />) },
        ]} />
      )}
    </div>
  );
}

function EnrolledCard({ e }: { e: MyCourse }) {
  if (!e.course) return null;
  const to = e.last_lesson_id && e.status === 'active' ? `/learn/courses/${e.course_id}/lessons/${e.last_lesson_id}` : `/learn/courses/${e.course_id}`;
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link to={`/learn/courses/${e.course_id}`} className="block aspect-[16/8]" tabIndex={-1} aria-hidden><CourseCover course={e.course} /></Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          {e.source !== 'self' && <Badge tone="violet">Assigned by {e.source === 'school' ? 'school' : 'teacher'}</Badge>}
          {e.status === 'completed' && <Badge tone="green">Completed</Badge>}
        </div>
        <Link to={`/learn/courses/${e.course_id}`} className="mt-2 font-bold text-ink-900 hover:text-brand-700">{e.course.title}</Link>
        <div className="mt-3 flex items-center gap-2"><ProgressBar value={e.progress_pct} tone={e.status === 'completed' ? 'green' : 'brand'} className="flex-1" /><span className="text-xs font-bold">{pct(e.progress_pct)}%</span></div>
        <p className="mt-1 text-xs text-ink-500">{e.last_activity_at ? `Last studied ${fromNow(e.last_activity_at)}` : `Enrolled ${fromNow(e.enrolled_at)}`}</p>
        <ButtonLink to={to} variant={e.status === 'active' ? 'primary' : 'outline'} size="sm" className="mt-4" leftIcon={<PlayCircle className="h-4 w-4" />}>{e.status === 'active' ? (e.last_lesson_id ? 'Resume' : 'Start') : 'Open course'}</ButtonLink>
      </div>
    </article>
  );
}

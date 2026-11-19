import { Link } from 'react-router-dom';
import { Presentation } from 'lucide-react';
import { Badge, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { useTeachingClasses } from '@/features/teachers/queries';
import { cn } from '@/lib/utils';
import { classColor } from './LearnerClasses';

export function TeacherClasses() {
  const { data, isLoading } = useTeachingClasses();
  const bySchool = new Map<string, NonNullable<typeof data>>();
  (data ?? []).forEach((c) => bySchool.set(c.school?.name ?? 'School', [...(bySchool.get(c.school?.name ?? 'School') ?? []), c]));
  return (
    <div>
      <PageHeader title="My classes" description="Classes you teach, grouped by school. You only see the schools and classes you're assigned to." />
      {isLoading ? <LoadingBlock /> : bySchool.size ? [...bySchool.entries()].map(([school, list]) => (
        <section key={school} className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-400">{school}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <Link key={c.id} to={`/teach/classes/${c.id}`} className="card overflow-hidden hover:shadow-[var(--shadow-lift)]">
                <div className="board-surface flex h-20 items-end gap-2 p-4 text-white"><span className={cn('h-3 w-3 rounded-full', classColor[c.color])} /><span className="text-lg font-extrabold">{c.name}{c.stream ? ` · ${c.stream}` : ''}</span></div>
                <div className="flex flex-wrap items-center gap-2 p-4 text-sm text-ink-600">{c.subject && <span>{c.subject}</span>}{c.is_class_teacher && <Badge tone="green">Class teacher</Badge>}{c.level && <Badge>{c.level}</Badge>}</div>
              </Link>
            ))}
          </div>
        </section>
      )) : <EmptyState icon={<Presentation className="h-7 w-7" />} title="No classes assigned" description="Your school administrator assigns you to classes. Independent courses have their classroom inside the course editor." />}
    </div>
  );
}

import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Presentation } from 'lucide-react';
import { Badge, Button, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { CreateClassDialog } from './ClassManage';
import { useTeachingClasses } from '@/features/teachers/queries';
import { cn } from '@/lib/utils';
import { classColor } from './LearnerClasses';

export function TeacherClasses() {
  const { data, isLoading } = useTeachingClasses();
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const setCreating = (o: boolean) => setParams((p) => { if (o) p.set('new', '1'); else p.delete('new'); return p; }, { replace: true });
  const bySchool = new Map<string, NonNullable<typeof data>>();
  (data ?? []).forEach((c) => bySchool.set(c.school?.name ?? 'My own classes', [...(bySchool.get(c.school?.name ?? 'My own classes') ?? []), c]));
  return (
    <div>
      <PageHeader title="My classes" description="Your own classes and the school classes you're assigned to." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Create a class</Button>} />
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
      )) : <EmptyState icon={<Presentation className="h-7 w-7" />} title="No classes yet" description="Create your own class and invite learners with a code or link — or wait for your school to assign you." action={<Button onClick={() => setCreating(true)}>Create a class</Button>} />}
      <CreateClassDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

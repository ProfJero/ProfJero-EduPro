import { Link } from 'react-router-dom';
import { CalendarClock, Presentation, School } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, LoadingBlock, PageHeader, Section } from '@/components/ui';
import { useMyClasses, useUpcomingSessions } from '@/features/learning/queries';
import { SessionCard } from '@/features/live/SessionCard';
import { dayLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';

export const classColor: Record<string, string> = { blue: 'bg-brand-600', green: 'bg-growth-600', amber: 'bg-sun-500', rose: 'bg-rose-600', violet: 'bg-violet-600', teal: 'bg-teal-600', slate: 'bg-ink-700' };

export function LearnerClasses() {
  const classes = useMyClasses();
  const sessions = useUpcomingSessions({ days: 14 });
  const byDay = new Map<string, NonNullable<typeof sessions.data>>();
  (sessions.data ?? []).forEach((s) => byDay.set(dayLabel(s.starts_at), [...(byDay.get(dayLabel(s.starts_at)) ?? []), s]));
  return (
    <div className="space-y-8">
      <PageHeader title="Classes & timetable" description="Your school classes and every live class coming up in the next two weeks." />
      <Section title="My classes">
        {classes.isLoading ? <LoadingBlock rows={2} /> : classes.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.data.map((c) => c.cls && (
              <Link key={c.class_id} to={`/learn/classes/${c.class_id}`} className="card group overflow-hidden hover:shadow-[var(--shadow-lift)]">
                <div className={cn('board-surface flex h-24 items-end p-4 text-white')}>
                  <span className={cn('mr-2 h-3 w-3 rounded-full', classColor[c.cls.color] ?? 'bg-brand-600')} />
                  <span className="text-lg font-extrabold">{c.cls.name}{c.cls.stream ? ` · ${c.cls.stream}` : ''}</span>
                </div>
                <div className="flex items-center gap-2 p-4 text-sm text-ink-600"><School className="h-4 w-4" />{c.cls.school?.name}{c.cls.level && <Badge className="ml-auto">{c.cls.level}</Badge>}</div>
              </Link>
            ))}
          </div>
        ) : <EmptyState icon={<Presentation className="h-7 w-7" />} title="You are not in a school class" description="When your school adds you to a class it will appear here. Independent courses have their own classroom inside each course." />}
      </Section>
      <Section title="Timetable">
        {sessions.isLoading ? <LoadingBlock rows={3} /> : byDay.size ? (
          <div className="space-y-6">
            {[...byDay.entries()].map(([day, list]) => (
              <div key={day}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-400">{day}</h3>
                <div className="space-y-3">{list.map((s) => <SessionCard key={s.id} s={s} />)}</div>
              </div>
            ))}
          </div>
        ) : <Card><CardBody className="flex items-center gap-3 text-sm text-ink-500"><CalendarClock className="h-5 w-5" />No live classes scheduled in the next two weeks.</CardBody></Card>}
      </Section>
    </div>
  );
}

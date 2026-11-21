import { Link } from 'react-router-dom';
import { Clock, Crown, BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { CourseCover } from './CourseCover';
import { levelLabel, type CourseCardData, type InstructorCard } from './catalog';

export function CourseCard({ course, to, instructors, footer }: { course: CourseCardData; to: string; instructors?: InstructorCard[]; footer?: React.ReactNode }) {
  const lead = instructors?.find((i) => i.course_id === course.id);
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <Link to={to} className="block aspect-[16/9] overflow-hidden bg-ink-100" tabIndex={-1} aria-hidden>
        <CourseCover course={course} className="transition duration-500 group-hover:scale-[1.03]" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {course.category && <Badge tone="brand">{course.category.name}</Badge>}
          {course.is_premium && <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>EduPro</Badge>}
        </div>
        <h3 className="text-base font-bold leading-snug text-ink-900">
          <Link to={to} className="after:absolute after:inset-0 focus:outline-none [&]:relative">{course.title}</Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-500">{course.short_description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs font-medium text-ink-500">
          <span className="inline-flex items-center gap-1"><BarChart2 className="h-3.5 w-3.5" />{levelLabel[course.level] ?? course.level}</span>
          {course.estimated_hours ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{course.estimated_hours} h</span> : null}
          {lead && <span className="truncate">by {lead.name}</span>}
        </div>
        {footer && <div className="relative z-10 mt-3">{footer}</div>}
      </div>
    </article>
  );
}

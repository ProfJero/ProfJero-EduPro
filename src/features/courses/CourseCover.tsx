import { cldSrcSet, cldUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { CategoryIcon } from './CategoryIcon';
import type { CourseCardData } from './catalog';
import { useLowData } from '@/features/preferences/PreferencesProvider';

const gradients = ['from-brand-600 to-ink-900', 'from-growth-600 to-board-900', 'from-ink-800 to-brand-700', 'from-sun-500 to-sun-700', 'from-violet-600 to-ink-900', 'from-teal-600 to-ink-900'];
const gi = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length;

export function CourseCover({ course, className }: { course: Pick<CourseCardData, 'title' | 'cover_url' | 'category'>; className?: string }) {
  const lowData = useLowData();
  if (course.cover_url && !lowData) {
    return <img src={cldUrl(course.cover_url, { w: 640 })} srcSet={cldSrcSet(course.cover_url, [320, 640, 960])} sizes="(min-width: 1024px) 33vw, 100vw" alt="" loading="lazy" className={cn('h-full w-full object-cover', className)} />;
  }
  return (
    <div className={cn('relative flex h-full w-full items-end overflow-hidden bg-gradient-to-br p-4', gradients[gi(course.title)], className)}>
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute right-6 top-6 text-white/80"><CategoryIcon name={course.category?.icon} className="h-10 w-10" /></div>
      <span className="relative line-clamp-2 text-lg font-extrabold leading-snug text-white">{course.title}</span>
    </div>
  );
}


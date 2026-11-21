import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * ProfJero Edu / EduPro logo.
 * The cap-and-PJ mark comes from the official artwork. The wordmark is live
 * text so it stays crisp at every size and adapts to light/dark themes.
 *  - tier "edu":    blue pill, tagline "Learning Without Limits."
 *  - tier "edupro": blue→violet pill with a star, tagline "Learn. Practise. Achieve More."
 */
export function LogoMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('relative inline-block shrink-0', className)} aria-hidden>
      <img src="/brand/mark.webp" alt="" width={40} height={40} className={cn('h-full w-full', onDark ? 'hidden' : 'dark:hidden')} />
      <img src="/brand/mark-dark.webp" alt="" width={40} height={40} className={cn('h-full w-full', onDark ? 'block' : 'hidden dark:block')} />
    </span>
  );
}

export function Wordmark({ pro, onDark, size = 'md', tagline }: { pro?: boolean; onDark?: boolean; size?: 'sm' | 'md' | 'lg'; tagline?: boolean }) {
  const text = { sm: 'text-[1.05rem]', md: 'text-[1.2rem]', lg: 'text-3xl sm:text-4xl' }[size];
  const pill = { sm: 'px-1.5 py-[1px] text-[0.8rem] rounded-md', md: 'px-2 py-[2px] text-[0.92rem] rounded-lg', lg: 'px-3 py-1 text-2xl sm:text-3xl rounded-xl' }[size];
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={cn('inline-flex items-center gap-1.5 font-extrabold tracking-tight', text)}>
        <span className={onDark ? 'text-white' : 'text-ink-900'}>Prof</span>
        <span className={cn('-ml-1.5', onDark ? 'text-brand-300' : 'text-brand-600')}>Jero</span>
        <span className={cn('relative ml-0.5 font-extrabold text-white shadow-sm', pill, pro ? 'pro-gradient' : 'bg-brand-600')}>
          {pro ? 'EduPro' : 'Edu'}
          {pro && <svg viewBox="0 0 24 24" className="absolute -right-2 -top-2 h-3.5 w-3.5 fill-sun-400 drop-shadow" aria-hidden><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" /></svg>}
        </span>
      </span>
      {tagline && (
        <span className={cn('mt-1.5 font-semibold italic tracking-wide', size === 'lg' ? 'text-base' : 'text-[0.62rem]', onDark ? 'text-brand-200' : 'text-ink-600')}>
          {pro ? 'Learn. Practise. Achieve More.' : 'Learning Without Limits.'}
        </span>
      )}
    </span>
  );
}

export function Logo({ className, to = '/', compact, light, pro, tagline }: { className?: string; to?: string; compact?: boolean; light?: boolean; pro?: boolean; tagline?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 rounded-lg', className)} aria-label={pro ? 'ProfJero EduPro home' : 'ProfJero Edu home'}>
      <LogoMark className="h-10 w-10" onDark={light} />
      {!compact && <Wordmark pro={pro} onDark={light} tagline={tagline} />}
    </Link>
  );
}

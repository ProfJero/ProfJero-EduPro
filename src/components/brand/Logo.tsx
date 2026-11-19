import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** ProfJero brand mark (from the supplied logo artwork) + text wordmark. */
export function Logo({ className, to = '/', compact, light, pro }: { className?: string; to?: string; compact?: boolean; light?: boolean; pro?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-lg', className)} aria-label="ProfJero Edu home">
      <img src="/brand/profjero-mark.webp" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
      {!compact && (
        <span className="leading-none">
          <span className={cn('block text-[1.15rem] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink-900')}>
            Prof<span className={light ? 'text-brand-300' : 'text-brand-600'}>Jero</span>{' '}
            <span className={cn('font-bold', light ? 'text-white/90' : 'text-ink-700')}>Edu</span>
            {pro && <span className="ml-1 rounded-md bg-sun-400 px-1.5 py-0.5 align-middle text-[0.6rem] font-extrabold uppercase tracking-wider text-ink-900">Pro</span>}
          </span>
          <span className={cn('mt-0.5 block whitespace-nowrap text-[0.55rem] font-semibold uppercase tracking-[0.12em]', light ? 'text-growth-100' : 'text-growth-600')}>by ProfJero Digital Studio</span>
        </span>
      )}
    </Link>
  );
}

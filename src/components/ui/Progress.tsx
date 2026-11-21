import { cn, pct } from '@/lib/utils';

export function ProgressBar({ value, className, tone = 'brand', label }: { value: number | string | null | undefined; className?: string; tone?: 'brand' | 'green' | 'amber'; label?: string }) {
  const v = pct(value);
  const color = tone === 'green' ? 'bg-growth-500' : tone === 'amber' ? 'bg-sun-500' : 'bg-brand-600';
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label ?? 'Progress'}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 56, stroke = 6, className }: { value: number | string | null | undefined; size?: number; stroke?: number; className?: string }) {
  const v = pct(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="img" aria-label={`${v}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-ink-100" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className="fill-none stroke-brand-600 transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} />
      </svg>
      <span className="absolute text-xs font-bold text-ink-800">{v}%</span>
    </div>
  );
}

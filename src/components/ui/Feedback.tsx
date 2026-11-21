import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertTone = 'info' | 'success' | 'warning' | 'error';
const alertStyles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: <Info className="h-5 w-5 text-brand-600" aria-hidden /> },
  success: { box: 'border-growth-100 bg-growth-50 text-growth-700', icon: <CheckCircle2 className="h-5 w-5 text-growth-600" aria-hidden /> },
  warning: { box: 'border-sun-100 bg-sun-50 text-sun-700', icon: <TriangleAlert className="h-5 w-5 text-sun-500" aria-hidden /> },
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: <AlertCircle className="h-5 w-5 text-red-600" aria-hidden /> },
};
export function Alert({ tone = 'info', title, children, className, action }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  const s = alertStyles[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-4 text-sm', s.box, className)}>
      <div className="shrink-0">{s.icon}</div>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-ink-100', className)} aria-hidden />;
}

export function LoadingBlock({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-16 w-full', i % 2 && 'h-12')} />
      ))}
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-surface/60 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>}
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong while loading this page.';
  return (
    <Alert tone="error" title="We couldn't load this" action={onRetry && <button className="text-sm font-semibold underline" onClick={onRetry}>Retry</button>}>
      {msg}
    </Alert>
  );
}

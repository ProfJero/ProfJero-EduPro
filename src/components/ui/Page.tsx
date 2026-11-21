import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions, back, eyebrow, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string }; eyebrow?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-700">
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap gap-2 sm:shrink-0">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, icon, hint, tone = 'brand', to }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; tone?: 'brand' | 'green' | 'amber' | 'violet' | 'navy'; to?: string }) {
  const toneCls = { brand: 'bg-brand-50 text-brand-600', green: 'bg-growth-50 text-growth-600', amber: 'bg-sun-50 text-sun-700', violet: 'bg-violet-50 text-violet-600', navy: 'bg-ink-100 text-ink-800' }[tone];
  const body = (
    <div className="card flex h-full items-start gap-3.5 p-4 transition hover:border-ink-300">
      {icon && <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneCls)}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold text-ink-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block rounded-2xl">{body}</Link> : body;
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

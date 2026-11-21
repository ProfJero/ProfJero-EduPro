import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui';
import { LAB_TOOLS, type LabKind } from './catalog';

/** Shared layout for science/math labs: tool switcher + workspace. */
export function LabToolShell({ lab, tool, title, description, children }: { lab: LabKind; tool: string; title: string; description: string; children: ReactNode }) {
  const tools = LAB_TOOLS.filter((t) => t.lab === lab);
  const current = tools.find((t) => t.id === tool);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="EduLab" title={title} description={description} back={{ to: '/lab', label: 'EduLab' }} />
      <nav className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={`${title} tools`}>
        {tools.map((t) => (
          <Link key={t.id} to={`/lab/${lab}/${t.id}`} aria-current={t.id === tool ? 'page' : undefined}
            className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', t.id === tool ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300')}>
            {t.name}
          </Link>
        ))}
      </nav>
      {current && <p className="text-sm text-ink-500"><span className="font-semibold text-ink-700">{current.subject}</span> · {current.level} — {current.description}</p>}
      {children}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-semibold text-ink-700"><span>{label}</span><span className="tabular-nums text-brand-700">{Number.isInteger(step) ? value : value.toFixed(String(step).split('.')[1]?.length ?? 1)}{unit ? ` ${unit}` : ''}</span></span>
      <input type="range" className="mt-1 w-full accent-[var(--color-brand-600)]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Readout({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

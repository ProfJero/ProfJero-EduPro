import * as T from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Tabs({ tabs, value, onValueChange, defaultValue, className }: {
  tabs: { value: string; label: ReactNode; content: ReactNode; count?: number }[]; value?: string; onValueChange?: (v: string) => void; defaultValue?: string; className?: string;
}) {
  return (
    <T.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <T.List className="-mx-4 flex gap-1 overflow-x-auto border-b border-ink-200 px-4 sm:mx-0 sm:px-0" aria-label="Sections">
        {tabs.map((t) => (
          <T.Trigger key={t.value} value={t.value}
            className="relative shrink-0 px-3 py-2.5 text-sm font-semibold text-ink-500 transition hover:text-ink-800 data-[state=active]:text-brand-700 data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-brand-600">
            {t.label}
            {t.count != null && <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 text-xs text-ink-600">{t.count}</span>}
          </T.Trigger>
        ))}
      </T.List>
      {tabs.map((t) => (
        <T.Content key={t.value} value={t.value} className={cn('pt-5 focus-visible:outline-none')}>
          {t.content}
        </T.Content>
      ))}
    </T.Root>
  );
}

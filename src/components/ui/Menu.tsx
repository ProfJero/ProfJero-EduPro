import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn('z-50 min-w-[13rem] rounded-xl border border-ink-200 bg-surface p-1.5 shadow-[var(--shadow-lift)]', className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}
export function MenuItem({ children, onSelect, danger, icon, disabled }: { children: ReactNode; onSelect?: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean }) {
  return (
    <M.Item disabled={disabled} onSelect={onSelect} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-ink-100', danger ? 'text-red-600' : 'text-ink-700')}>
      {icon}
      {children}
    </M.Item>
  );
}
export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{children}</M.Label>;
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-ink-100" />;

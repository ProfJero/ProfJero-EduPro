import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; hideOnMobile?: boolean; primary?: boolean };

/** Table on desktop, stacked cards on mobile (no horizontal scrolling for phones). */
export function DataTable<T>({ rows, columns, rowKey, empty, onRowClick, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; empty?: ReactNode; onRowClick?: (r: T) => void; caption?: string }) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="card overflow-hidden">
      <table className="hidden w-full text-left text-sm md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-ink-100 bg-ink-50/70 text-xs uppercase tracking-wide text-ink-500">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('px-4 py-3 font-semibold', c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={rowKey(r)} className={cn('align-middle', onRowClick && 'cursor-pointer hover:bg-ink-50')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3', c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-ink-100 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className={cn('space-y-1.5 p-4', onRowClick && 'cursor-pointer active:bg-ink-50')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
            {columns.filter((c) => !c.hideOnMobile).map((c) =>
              c.primary ? <div key={c.key} className="font-semibold text-ink-900">{c.cell(r)}</div> : (
                <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-500">{c.header}</span>
                  <span className="text-right">{c.cell(r)}</span>
                </div>
              ),
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

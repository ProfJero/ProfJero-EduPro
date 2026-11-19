import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'violet' | 'navy';
const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100',
  green: 'bg-growth-50 text-growth-700 ring-1 ring-inset ring-growth-100',
  amber: 'bg-sun-50 text-sun-700 ring-1 ring-inset ring-sun-100',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-100',
  violet: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100',
  navy: 'bg-ink-900 text-white',
};
export function Badge({ children, tone = 'neutral', className, icon }: { children: ReactNode; tone?: Tone; className?: string; icon?: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{icon}{children}</span>;
}

const statusTone: Record<string, Tone> = {
  published: 'green', active: 'green', approved: 'green', graded: 'green', completed: 'green', valid: 'green', resolved: 'green', present: 'green', connected: 'green',
  draft: 'neutral', unpublished: 'neutral', archived: 'neutral', closed: 'neutral', dropped: 'neutral', removed: 'neutral', cancelled: 'neutral', expired: 'neutral',
  in_review: 'amber', pending: 'amber', submitted: 'brand', in_progress: 'brand', invited: 'amber', open: 'brand', awaiting_user: 'amber', late: 'amber', scheduled: 'brand', returned: 'amber', trialing: 'violet',
  rejected: 'red', suspended: 'red', revoked: 'red', absent: 'red', urgent: 'red', live: 'green',
};
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return <Badge tone={statusTone[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}

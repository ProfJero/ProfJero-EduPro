import { LogIn } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { cn } from '@/lib/utils';

const KEY = 'pje:known-user';

/** Remember (on this device only) that someone has an account, so we can point them to "Log in". */
export function rememberKnownUser(name: string | null | undefined) {
  try { localStorage.setItem(KEY, JSON.stringify({ name: (name ?? '').split(' ')[0].slice(0, 30), at: Date.now() })); } catch { /* ignore */ }
}
export function knownUser(): { name: string } | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}

/** "Welcome back — log in" for people who already have an account on this device. */
export function WelcomeBack({ className, compact }: { className?: string; compact?: boolean }) {
  const k = knownUser();
  if (!k) return null;
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center', className)} role="note">
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-ink-900">Welcome back{k.name ? `, ${k.name}` : ''}! 👋</p>
        <p className="text-sm text-ink-600">{compact ? 'You already have an account on this device.' : 'You already have an account on this device. Log in with the same email — no need to create a new account.'}</p>
      </div>
      <ButtonLink to="/login" size="lg" leftIcon={<LogIn className="h-5 w-5" />}>Log in</ButtonLink>
    </div>
  );
}

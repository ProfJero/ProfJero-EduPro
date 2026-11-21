import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { BellRing, CalendarClock, GraduationCap, Megaphone, Share, SquarePlus, X } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { enablePush, pushState, type PushState } from '@/lib/push';
import { cn, errorMessage } from '@/lib/utils';

const KEY = 'pje:push-sheet-snoozed';
type Ctx = { state: PushState | null; open: () => void; refresh: () => void };
const PushCtx = createContext<Ctx>({ state: null, open: () => undefined, refresh: () => undefined });
export const usePush = () => useContext(PushCtx);

function snoozed() {
  try { return Number(localStorage.getItem(KEY) ?? 0) > Date.now() - 3 * 86400_000; } catch { return false; }
}

/** Provides push state, shows the "Allow notifications" sheet a few seconds after sign-in. */
export function PushProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [sheet, setSheet] = useState(false);
  const refresh = useCallback(() => { void pushState().then(setState); }, []);
  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || !(state === 'off' || state === 'install') || snoozed() || navigator.webdriver) return;
    const t = setTimeout(() => setSheet(true), 4000);
    return () => clearTimeout(t);
  }, [enabled, state]);
  return (
    <PushCtx.Provider value={{ state: enabled ? state : null, open: () => setSheet(true), refresh }}>
      {children}
      {enabled && sheet && state && <PushSheet state={state} onClose={(snooze) => { setSheet(false); if (snooze) { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } } refresh(); }} />}
    </PushCtx.Provider>
  );
}

/** Top-bar pill: visible until notifications are on. */
export function PushPill() {
  const { state, open } = usePush();
  if (!state || state === 'on' || state === 'unsupported' || state === 'unconfigured') return null;
  return (
    <button onClick={open} className="relative inline-flex items-center gap-1.5 rounded-full bg-sun-50 px-2.5 py-1.5 text-xs font-bold text-sun-700 ring-1 ring-sun-400/40 transition hover:bg-sun-100" aria-label="Allow notifications">
      <BellRing className="h-4 w-4 motion-safe:animate-[wiggle_2.4s_ease-in-out_infinite]" />
      <span className="hidden md:inline">{state === 'blocked' ? 'Notifications blocked' : 'Allow notifications'}</span>
      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface motion-safe:animate-ping" aria-hidden />
    </button>
  );
}

function PushSheet({ state, onClose }: { state: PushState; onClose: (snooze: boolean) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<PushState>(state);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const allow = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === 'granted') { toast.success('Notifications are on 🎉', 'You’ll get class, deadline and grade alerts on this device.'); onClose(false); }
      else if (r === 'denied') setNow('blocked');
      else if (r === 'install') setNow('install');
    } catch (e) {
      toast.error('Could not turn on notifications', errorMessage(e));
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/50 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="push-title" onClick={(e) => e.target === e.currentTarget && onClose(true)}>
      <div className="w-full max-w-md animate-[sheet-up_.35s_cubic-bezier(.2,.9,.3,1.2)] rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex justify-between">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg"><BellRing className="h-7 w-7 motion-safe:animate-[wiggle_1.6s_ease-in-out_2]" /></span>
          <button onClick={() => onClose(true)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {now === 'install' ? (
          <>
            <h2 id="push-title" className="mt-4 text-xl font-extrabold">Add ProfJero Edu to your Home Screen</h2>
            <p className="mt-1 text-ink-600">On iPhone and iPad, notifications work once the app is on your Home Screen.</p>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100"><Share className="h-4 w-4" /></span>Tap <b>Share</b> in Safari’s toolbar</li>
              <li className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100"><SquarePlus className="h-4 w-4" /></span>Choose <b>Add to Home Screen</b></li>
              <li className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100"><BellRing className="h-4 w-4" /></span>Open ProfJero Edu from your Home Screen and tap <b>Allow notifications</b></li>
            </ol>
            <Button className="mt-6 w-full" onClick={() => onClose(true)}>Got it</Button>
          </>
        ) : now === 'blocked' ? (
          <>
            <h2 id="push-title" className="mt-4 text-xl font-extrabold">Notifications are blocked</h2>
            <p className="mt-1 text-ink-600">Your browser is blocking notifications for ProfJero Edu. To turn them on:</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink-700">
              <li>Tap the <b>lock</b> or <b>settings</b> icon beside the web address.</li>
              <li>Find <b>Notifications</b> and choose <b>Allow</b>.</li>
              <li>Reload this page.</li>
            </ol>
            <Button className="mt-6 w-full" onClick={() => onClose(true)}>OK</Button>
          </>
        ) : (
          <>
            <h2 id="push-title" className="mt-4 text-xl font-extrabold">Never miss a class</h2>
            <p className="mt-1 text-ink-600">Allow notifications and we’ll tell you — even when the app is closed:</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[[CalendarClock, 'Live classes starting soon and schedule changes'], [GraduationCap, 'New assignments, deadlines and your grades'], [Megaphone, 'Announcements from your teachers and class leaders']].map(([I, t], i) => {
                const Icon = I as typeof CalendarClock;
                return <li key={i} className={cn('flex items-center gap-3 motion-safe:animate-[fade-up_.4s_ease-out_both]')} style={{ animationDelay: `${120 + i * 90}ms` }}><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></span>{t as string}</li>;
              })}
            </ul>
            <Button size="lg" className="mt-6 w-full" loading={busy} onClick={() => void allow()} leftIcon={<BellRing className="h-5 w-5" />}>Allow notifications</Button>
            <button className="mt-2 w-full py-2 text-sm font-semibold text-ink-500 hover:text-ink-800" onClick={() => onClose(true)}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}

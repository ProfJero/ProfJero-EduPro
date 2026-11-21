import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { enablePush, pushConfigured, pushSupported } from '@/lib/push';

const KEY = 'pje:push-prompt-dismissed';

/** Friendly in-app prompt before the browser's permission dialog. */
export function PushPrompt() {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = Number(localStorage.getItem(KEY) ?? 0) > Date.now() - 14 * 86400_000;
    } catch {
      /* ignore */
    }
    setShow(pushSupported() && pushConfigured() && Notification.permission === 'default' && !dismissed);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center" role="region" aria-label="Turn on notifications">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><BellRing className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink-900">Never miss a class</p>
        <p className="text-sm text-ink-600">Get notified about live classes, deadlines, grades and announcements — even when ProfJero Edu is closed.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={busy} onClick={async () => {
          setBusy(true);
          try {
            const r = await enablePush();
            if (r === 'granted') toast.success('Notifications are on', 'You will get updates on this device.');
            else if (r === 'denied') toast.info('Notifications blocked', 'You can turn them on later in your browser settings.');
            setShow(false);
          } catch (e) {
            toast.error('Could not turn on notifications', e instanceof Error ? e.message : undefined);
          } finally {
            setBusy(false);
          }
        }}>Turn on</Button>
        <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Not now"><X className="h-4 w-4" />Not now</Button>
      </div>
    </div>
  );
}

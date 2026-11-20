import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui';

export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-ink-200 bg-surface p-4 shadow-[var(--shadow-lift)] sm:bottom-6">
      <p className="flex-1 text-sm text-ink-700">A new version of ProfJero Edu is available.</p>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>Later</Button>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>Update</Button>
    </div>
  );
}

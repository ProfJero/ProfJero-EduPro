import { useEffect, useState } from 'react';
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share, Smartphone } from 'lucide-react';
import { Button, Dialog } from '@/components/ui';
import { canPromptInstall, detectPlatform, isInstalled, onInstallChange, promptInstall, type Platform } from '@/lib/install';
import { cn } from '@/lib/utils';

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  return { installed: isInstalled(), canPrompt: canPromptInstall() };
}

const STEPS: Record<Platform, { title: string; steps: React.ReactNode[] }> = {
  ios: { title: 'iPhone or iPad (Safari)', steps: [
    <>Open this site in <b>Safari</b> (not inside WhatsApp or Facebook).</>,
    <>Tap the <b>Share</b> button <Share className="inline h-4 w-4" aria-label="Share" /> at the bottom of the screen.</>,
    <>Scroll down and tap <b>Add to Home Screen</b> <PlusSquare className="inline h-4 w-4" aria-hidden />.</>,
    <>Tap <b>Add</b>. ProfJero Edu now opens like an app from your home screen.</>,
  ] },
  android: { title: 'Android phone (Chrome)', steps: [
    <>Open this site in <b>Chrome</b>.</>,
    <>Tap the <b>⋮ menu</b> <MoreVertical className="inline h-4 w-4" aria-hidden /> at the top right.</>,
    <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>,
    <>Tap <b>Install</b>. Look for the ProfJero Edu icon on your home screen.</>,
  ] },
  samsung: { title: 'Samsung Internet', steps: [
    <>Tap the <b>menu</b> (three lines) at the bottom right.</>,
    <>Tap <b>Add page to</b> → <b>Home screen</b>.</>,
    <>Tap <b>Add</b>.</>,
  ] },
  desktop: { title: 'Computer (Chrome or Edge)', steps: [
    <>Look for the <b>install icon</b> <Download className="inline h-4 w-4" aria-hidden /> at the right end of the address bar.</>,
    <>Or open the browser menu and choose <b>Install ProfJero Edu</b> (Edge: <b>Apps → Install this site as an app</b>).</>,
    <>Click <b>Install</b>.</>,
  ] },
  other: { title: 'Your browser', steps: [
    <>Open your browser menu.</>,
    <>Choose <b>Install app</b>, <b>Add to Home screen</b> or <b>Add to Home Screen</b>.</>,
  ] },
};

/** Always-available "Install app" button with step-by-step help when the browser prompt is not offered. */
export function InstallAppButton({ className, variant = 'secondary', size = 'md', label = 'Install app', compact }: { className?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'outline'; size?: 'sm' | 'md' | 'lg'; label?: string; compact?: boolean }) {
  const { installed, canPrompt } = useInstall();
  const [help, setHelp] = useState(false);
  const [done, setDone] = useState(false);
  if (installed) return null;
  const click = async () => {
    if (canPrompt) {
      const r = await promptInstall();
      if (r === 'accepted') setDone(true);
      else if (r === 'unavailable') setHelp(true);
    } else setHelp(true);
  };
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => void click()} leftIcon={<Smartphone className="h-4 w-4" />} aria-label={compact ? label : undefined}>
        {compact ? <span className="sr-only">{label}</span> : label}
      </Button>
      <InstallHelp open={help} onOpenChange={setHelp} />
      <Dialog open={done} onOpenChange={setDone} title="Installed 🎉" size="sm" footer={<Button onClick={() => setDone(false)}>Great</Button>}>
        <p className="flex items-center gap-2 text-ink-700"><CheckCircle2 className="h-5 w-5 text-growth-600" />ProfJero Edu is on your device. Open it from your home screen or app list.</p>
      </Dialog>
    </>
  );
}

export function InstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const mine = detectPlatform();
  const [tab, setTab] = useState<Platform>(mine);
  useEffect(() => { if (open) setTab(mine); }, [open, mine]);
  const order: Platform[] = ['android', 'ios', 'samsung', 'desktop'];
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Install ProfJero Edu" description="Get the app on your home screen — it opens faster, works with weak internet and can send you class alerts."
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Your device">{order.map((p) => (
          <button key={p} role="tab" aria-selected={tab === p} onClick={() => setTab(p)} className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold', tab === p ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-ink-600')}>
            {p === 'android' ? 'Android' : p === 'ios' ? 'iPhone / iPad' : p === 'samsung' ? 'Samsung' : 'Computer'}{p === mine ? ' (this device)' : ''}
          </button>
        ))}</div>
        <p className="font-bold">{STEPS[tab].title}</p>
        <ol className="space-y-3">{STEPS[tab].steps.map((s, i) => (
          <li key={i} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span><span className="pt-0.5 text-ink-700">{s}</span></li>
        ))}</ol>
        <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-600">Opened ProfJero Edu from WhatsApp? Tap <b>⋮</b> and choose <b>Open in Chrome</b> (or <b>Open in Safari</b>) first.</p>
      </div>
    </Dialog>
  );
}

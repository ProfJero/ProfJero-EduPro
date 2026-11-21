import { useState, type ReactNode } from 'react';
import { ImageIcon, PlayCircle } from 'lucide-react';
import { useLowData } from '@/features/preferences/PreferencesProvider';

/** In low-data mode, defers heavy media until the learner taps to load it. */
export function TapToLoad({ children, kind = 'image', label }: { children: ReactNode; kind?: 'image' | 'video' | 'embed'; label?: string }) {
  const lowData = useLowData();
  const [show, setShow] = useState(false);
  if (!lowData || show) return <>{children}</>;
  const Icon = kind === 'image' ? ImageIcon : PlayCircle;
  return (
    <button type="button" onClick={() => setShow(true)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4 text-left text-sm text-ink-600 hover:border-brand-300">
      <Icon className="h-5 w-5 text-brand-600" />
      <span><strong className="text-ink-800">Tap to load {kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'interactive content'}</strong>{label && <span className="block text-xs text-ink-500">{label}</span>}<span className="block text-xs text-ink-500">Low-data mode is on</span></span>
    </button>
  );
}

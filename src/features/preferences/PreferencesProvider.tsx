import { applyCustomAccent } from './customAccent';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'forest' | 'violet' | 'lagoon' | 'rose' | 'kente' | 'indigo' | 'custom';
export type LowDataPref = 'auto' | 'on' | 'off';
export type TextSize = 'sm' | 'md' | 'lg';
export type Prefs = { theme: ThemeMode; accent: Accent; customAccent: string; lowData: LowDataPref; textSize: TextSize; sidebarCollapsed: boolean; reduceMotion: boolean; festive: boolean };

export const ACCENTS: { id: Accent; name: string; swatch: string }[] = [
  { id: 'blue', name: 'ProfJero Blue', swatch: '#1554d6' },
  { id: 'indigo', name: 'Indigo', swatch: '#4f46e5' },
  { id: 'violet', name: 'Royal Violet', swatch: '#7c3aed' },
  { id: 'lagoon', name: 'Lagoon', swatch: '#0d9488' },
  { id: 'forest', name: 'Forest', swatch: '#059669' },
  { id: 'kente', name: 'Kente Gold', swatch: '#c26a05' },
  { id: 'rose', name: 'Rose', swatch: '#e11d48' },
];

const DEFAULTS: Prefs = { theme: 'system', accent: 'blue', customAccent: '#1554d6', lowData: 'auto', textSize: 'md', sidebarCollapsed: false, reduceMotion: false, festive: true };
const KEY = 'pje-prefs';

type NetInfo = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
function connection(): NetInfo | undefined {
  return (navigator as unknown as { connection?: NetInfo }).connection;
}
/** Auto-detect constrained networks (Data Saver or 2G/slow-2G). */
export function networkIsConstrained(): boolean {
  const c = connection();
  return Boolean(c?.saveData || c?.effectiveType === '2g' || c?.effectiveType === 'slow-2g');
}

export function readPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

/** Applies preferences to <html> synchronously (also called before React renders to avoid a flash). */
export function applyPrefs(p: Prefs, lowDataActive: boolean) {
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', Boolean(dark));
  root.dataset.accent = p.accent;
  applyCustomAccent(p.accent === 'custom' ? p.customAccent : null);
  root.dataset.text = p.textSize;
  root.classList.toggle('low-data', lowDataActive);
  root.classList.toggle('reduce-motion', p.reduceMotion);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#1554D6');
  // Web fonts are skipped entirely in low-data mode.
  const id = 'pje-font';
  if (!lowDataActive && !document.getElementById(id)) {
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }
}

type Ctx = { prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; replacePrefs: (p: Partial<Prefs>) => void; lowData: boolean; isDark: boolean };
const PrefsCtx = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [constrained, setConstrained] = useState(networkIsConstrained);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const lowData = prefs.lowData === 'on' || (prefs.lowData === 'auto' && constrained);
  const isDark = prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark);

  useEffect(() => {
    applyPrefs(prefs, lowData);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [prefs, lowData, systemDark]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onMq = () => setSystemDark(mq.matches);
    mq?.addEventListener?.('change', onMq);
    const c = connection();
    const onNet = () => setConstrained(networkIsConstrained());
    c?.addEventListener?.('change', onNet);
    return () => {
      mq?.removeEventListener?.('change', onMq);
      c?.removeEventListener?.('change', onNet);
    };
  }, []);

  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v })), []);
  const replacePrefs = useCallback((p: Partial<Prefs>) => setPrefs((cur) => ({ ...cur, ...p })), []);
  const value = useMemo(() => ({ prefs, setPref, replacePrefs, lowData, isDark }), [prefs, setPref, replacePrefs, lowData, isDark]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error('usePrefs outside PreferencesProvider');
  return c;
}
/** Safe variant for components that may render outside the provider (tests). */
export function useLowData(): boolean {
  return useContext(PrefsCtx)?.lowData ?? false;
}

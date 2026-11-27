import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { usePublicSettings } from '@/features/administration/settings';
import { usePrefs } from '@/features/preferences/PreferencesProvider';
import { cn } from '@/lib/utils';
import { currentOccasion, daysUntil, OCCASIONS, readConfig, type Occasion } from './occasions';

const PREVIEW = 'pje:occasion-preview';

/** Owner preview: show an occasion on this device for 10 minutes. */
export function previewOccasion(id: string | null) {
  try {
    if (id) localStorage.setItem(PREVIEW, JSON.stringify({ id, until: Date.now() + 10 * 60_000 }));
    else localStorage.removeItem(PREVIEW);
    window.dispatchEvent(new Event('pje:occasion'));
  } catch { /* ignore */ }
}
function readPreview(): string | null {
  try {
    const p = JSON.parse(localStorage.getItem(PREVIEW) ?? 'null') as { id: string; until: number } | null;
    return p && p.until > Date.now() ? p.id : null;
  } catch { return null; }
}

/** The occasion currently shown to this person (null when none, or when they turned decorations off). */
export function useOccasion(): { occasion: Occasion | null; message: string | null; effects: boolean } {
  const settings = usePublicSettings();
  const { prefs } = usePrefs();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('pje:occasion', on);
    const t = setInterval(on, 30 * 60_000); // pick up midnight changes
    return () => { window.removeEventListener('pje:occasion', on); clearInterval(t); };
  }, []);
  return useMemo(() => {
    void tick;
    const cfg = readConfig(settings.data?.['occasions.config']);
    const preview = readPreview();
    const occasion = preview ? OCCASIONS.find((o) => o.id === preview) ?? null : prefs.festive ? currentOccasion(cfg) : null;
    return { occasion, message: occasion ? cfg.messages[occasion.id]?.trim() || null : null, effects: cfg.effects };
  }, [settings.data, prefs.festive, tick]);
}

/** Garland, logo accessory and a short burst of falling decorations. */
export function OccasionLayer() {
  const { occasion, effects } = useOccasion();
  const { lowData, prefs } = usePrefs();
  useEffect(() => {
    const root = document.documentElement;
    if (occasion) { root.dataset.occasion = occasion.id; if (occasion.hat) root.dataset.occasionHat = occasion.hat; else delete root.dataset.occasionHat; }
    else { delete root.dataset.occasion; delete root.dataset.occasionHat; }
  }, [occasion]);
  if (!occasion) return null;
  const motionOk = !prefs.reduceMotion && !lowData && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <>
      {occasion.decoration !== 'none' && <Garland o={occasion} />}
      {effects && motionOk && occasion.particles && <Particles o={occasion} />}
    </>
  );
}

function Garland({ o }: { o: Occasion }) {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const r = () => setW(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const gap = o.decoration === 'flags' ? 30 : 46;
  const n = Math.ceil(w / gap) + 1;
  return (
    <div className="decor pointer-events-none fixed inset-x-0 top-0 z-[45] h-8 overflow-hidden" aria-hidden data-testid="occasion-garland">
      <svg width={w} height={32} className="block">
        <path d={`M0 4 ${Array.from({ length: n }, (_, i) => `Q ${i * gap + gap / 2} ${o.decoration === 'flags' ? 9 : 14} ${(i + 1) * gap} 4`).join(' ')}`} fill="none" stroke={o.decoration === 'lights' ? '#1f2937' : '#78350f'} strokeOpacity={0.55} strokeWidth={1.5} />
        {Array.from({ length: n }, (_, i) => <Item key={i} o={o} i={i} x={i * gap + gap / 2} />)}
      </svg>
    </div>
  );
}

function Item({ o, i, x }: { o: Occasion; i: number; x: number }) {
  const c = o.colors[i % o.colors.length];
  const delay = `${(i * 0.37) % 2.4}s`;
  switch (o.decoration) {
    case 'lights':
      return <g transform={`translate(${x} 9)`}><rect x={-2.5} y={-1} width={5} height={4} rx={1} fill="#374151" />
        <ellipse cy={9} rx={4.5} ry={7} fill={c} className="occasion-twinkle" style={{ animationDelay: delay, filter: `drop-shadow(0 0 4px ${c})` }} /></g>;
    case 'flags': {
      const gh = o.colors.length === 4 && o.colors[0] === '#ce1126';
      const col = gh ? ['#ce1126', '#fcd116', '#006b3f'][i % 3] : c;
      return <g transform={`translate(${x} 5)`}><path d="M-12 0 H12 L0 20 Z" fill={col} />{gh && i % 3 === 1 && <path d="M0 4 l1.6 3.3 3.6.4-2.7 2.4.8 3.6L0 11.9l-3.3 1.8.8-3.6-2.7-2.4 3.6-.4z" fill="#111" />}</g>;
    }
    case 'hearts':
      return <path transform={`translate(${x - 7} 8) scale(0.6)`} d="M12 21s-8-5.3-10.4-10C-.2 6.9 2.2 2 6.6 2c2.3 0 4 1.3 5.4 3.1C13.4 3.3 15.1 2 17.4 2c4.4 0 6.8 4.9 5 9-2.4 4.7-10.4 10-10.4 10z" fill={c} className="occasion-sway" style={{ animationDelay: delay }} />;
    case 'eggs':
      return <g transform={`translate(${x} 10)`} className="occasion-sway" style={{ animationDelay: delay }}><ellipse cy={8} rx={6} ry={8} fill={c} /><path d="M-6 8 q3 -3 6 0 t6 0" stroke="#fff" strokeWidth={1.6} fill="none" /></g>;
    case 'stars': case 'confetti':
      return <path transform={`translate(${x - 8} 8) scale(0.66)`} d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" fill={c} className="occasion-twinkle" style={{ animationDelay: delay }} />;
    default: {
      const emoji = o.decoration === 'flowers' ? ['🌸', '🌺', '🌼'][i % 3] : o.decoration === 'harvest' ? ['🌽', '🌾', '🍫', '🥭'][i % 4] : o.decoration === 'apples' ? ['🍎', '✏️', '📚'][i % 3] : '•';
      return <text x={x} y={24} textAnchor="middle" fontSize={15} className="occasion-sway" style={{ animationDelay: delay }}>{emoji}</text>;
    }
  }
}

/** Light, time-limited particles (stops after ~20 s to save battery and data). */
function Particles({ o }: { o: Occasion }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    window.addEventListener('resize', size);
    const count = innerWidth < 640 ? 22 : 38;
    const ps = Array.from({ length: count }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.8, r: 3 + Math.random() * 4,
      vy: 0.5 + Math.random() * 1.1, vx: (Math.random() - 0.5) * 0.6, a: Math.random() * Math.PI * 2, va: (Math.random() - 0.5) * 0.05, c: o.colors[Math.floor(Math.random() * o.colors.length)] }));
    const start = performance.now();
    const LIFE = 20_000;
    let raf = 0;
    const draw = (t: number) => {
      const age = t - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = age > LIFE - 3000 ? Math.max(0, (LIFE - age) / 3000) : 1;
      for (const p of ps) {
        p.y += p.vy; p.x += p.vx + Math.sin(p.a) * 0.4; p.a += p.va;
        if (p.y > innerHeight + 20 && age < LIFE - 5000) { p.y = -20; p.x = Math.random() * innerWidth; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        if (o.particles === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.shadowColor = 'rgba(56,189,248,0.6)'; ctx.shadowBlur = 4; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); ctx.fill(); }
        else if (o.particles === 'confetti') { ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25); }
        else if (o.particles === 'hearts') { ctx.fillStyle = p.c; ctx.scale(p.r / 10, p.r / 10); ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-10, -5, -4, -12, 0, -6); ctx.bezierCurveTo(4, -12, 10, -5, 0, 3); ctx.fill(); }
        else if (o.particles === 'petals' || o.particles === 'leaves') { ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r / 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillStyle = p.c; ctx.beginPath(); for (let k = 0; k < 5; k++) { ctx.lineTo(Math.cos((18 + k * 72) * Math.PI / 180) * p.r, -Math.sin((18 + k * 72) * Math.PI / 180) * p.r); ctx.lineTo(Math.cos((54 + k * 72) * Math.PI / 180) * p.r / 2.4, -Math.sin((54 + k * 72) * Math.PI / 180) * p.r / 2.4); } ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      if (age < LIFE && !document.hidden) raf = requestAnimationFrame(draw); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [o]);
  return <canvas ref={ref} className="decor pointer-events-none fixed inset-0 z-[44]" aria-hidden />;
}

/** A friendly, dismissible greeting (with a countdown before the big day). */
export function OccasionGreeting({ className, outer }: { className?: string; outer?: string }) {
  const { occasion, message } = useOccasion();
  const key = occasion ? `pje:greeting:${occasion.id}:${new Date().getFullYear()}` : '';
  const [closed, setClosed] = useState(false);
  useEffect(() => { try { setClosed(Boolean(key && localStorage.getItem(key))); } catch { setClosed(false); } }, [key]);
  if (!occasion || closed) return null;
  const now = new Date();
  const target = occasion.countdownTo?.(now.getFullYear());
  const days = target ? daysUntil(target, now) : null;
  const count = days != null && days > 0 && days <= 40 ? `${days} day${days === 1 ? '' : 's'} to ${occasion.id === 'christmas' ? 'Christmas' : occasion.name}!` : null;
  const box = (
    <div role="status" className={cn('occasion-greeting relative mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-card', className)}
      style={{ background: `linear-gradient(110deg, ${occasion.colors[0]}1f, ${occasion.colors[1] ?? occasion.colors[0]}24 55%, ${occasion.colors[2] ?? occasion.colors[0]}1a)`, borderColor: `${occasion.colors[0]}55` }}>
      <span className="text-3xl motion-safe:animate-[wiggle_2.4s_ease-in-out_infinite]" aria-hidden>{occasion.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink-900">{message ?? occasion.greeting}</p>
        {count && <p className="text-sm font-semibold text-ink-600">{count}</p>}
      </div>
      <button onClick={() => { setClosed(true); try { localStorage.setItem(key, '1'); } catch { /* ignore */ } }} className="rounded-lg p-1.5 text-ink-500 hover:bg-black/5 hover:text-ink-800" aria-label="Dismiss greeting"><X className="h-4 w-4" /></button>
    </div>
  );
  return outer ? <div className={outer}>{box}</div> : box;
}

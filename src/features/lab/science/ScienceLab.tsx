import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button, Card, CardBody, Select } from '@/components/ui';
import { usePrefs } from '@/features/preferences/PreferencesProvider';
import { cn } from '@/lib/utils';
import { LabToolShell, Readout, Slider } from '../LabToolShell';
import { CircuitBuilder } from './CircuitBuilder';
import { FlameTest, GasTests, HookesLaw, Indicators, ReactionRates } from './Practicals';

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

/** requestAnimationFrame loop that respects reduced motion. Returns elapsed seconds. */
function useClock(running: boolean) {
  const [t, setT] = useState(0);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!running) { last.current = null; return; }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current != null) setT((x) => x + (now - last.current!) / 1000);
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return [t, setT] as const;
}

export function ScienceLab() {
  const { tool } = useParams();
  if (!tool) return <Navigate to="/lab/science/circuit-builder" replace />;
  const Tool = { 'circuit-builder': CircuitBuilder, 'flame-test': FlameTest, 'gas-tests': GasTests, 'reaction-rates': ReactionRates, indicators: Indicators, 'hookes-law': HookesLaw, circuit: Circuit, projectile: Projectile, pendulum: Pendulum, titration: Titration, elements: Elements, buoyancy: Buoyancy }[tool];
  if (!Tool) return <Navigate to="/lab/science/circuit" replace />;
  return (
    <LabToolShell lab="science" tool={tool} title="Science Lab" description="Choose your apparatus, run the experiment yourself, record results and draw conclusions — as many times as you like.">
      <Tool />
    </LabToolShell>
  );
}

function Workspace({ controls, children, notes }: { controls: React.ReactNode; children: React.ReactNode; notes?: React.ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card className="overflow-hidden"><div className="bg-board-900/[0.03] p-3 sm:p-5 dark:bg-ink-50">{children}</div></Card>
      <div className="space-y-4">
        <Card><CardBody className="space-y-4">{controls}</CardBody></Card>
        {notes && <Card><CardBody className="text-sm text-ink-600">{notes}</CardBody></Card>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Circuits
function Circuit() {
  const { prefs } = usePrefs();
  const [v, setV] = useState(9);
  const [r1, setR1] = useState(100);
  const [r2, setR2] = useState(200);
  const [mode, setMode] = useState<'series' | 'parallel'>('series');
  const rt = mode === 'series' ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const i = v / rt;
  const i1 = mode === 'series' ? i : v / r1;
  const i2 = mode === 'series' ? i : v / r2;
  const v1 = i1 * r1;
  const v2 = i2 * r2;
  const speed = Math.min(6, Math.max(0.6, i * 40));
  const animate = !prefs.reduceMotion;
  return (
    <Workspace
      controls={<>
        <div className="flex gap-2">{(['series', 'parallel'] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? 'primary' : 'secondary'} onClick={() => setMode(m)} className="flex-1 capitalize">{m}</Button>)}</div>
        <Slider label="Battery voltage" value={v} min={1} max={24} unit="V" onChange={setV} />
        <Slider label="Resistor R₁" value={r1} min={10} max={1000} step={10} unit="Ω" onChange={setR1} />
        <Slider label="Resistor R₂" value={r2} min={10} max={1000} step={10} unit="Ω" onChange={setR2} />
        <div className="grid grid-cols-2 gap-2">
          <Readout label="Total R" value={`${fmt(rt, 1)} Ω`} />
          <Readout label="Current I" value={`${fmt(i * 1000, 1)} mA`} />
          <Readout label="V across R₁" value={`${fmt(v1)} V`} hint={`I₁ = ${fmt(i1 * 1000, 1)} mA`} />
          <Readout label="V across R₂" value={`${fmt(v2)} V`} hint={`I₂ = ${fmt(i2 * 1000, 1)} mA`} />
          <Readout label="Power" value={`${fmt(v * i, 3)} W`} />
        </div>
      </>}
      notes={<><p className="font-semibold text-ink-800">Ohm’s law: V = I × R</p><p className="mt-1">In <b>series</b> the same current flows through every resistor and voltages add up. In <b>parallel</b> each branch gets the full voltage and the currents add up: 1/R = 1/R₁ + 1/R₂.</p></>}>
      <svg viewBox="0 0 400 260" className="mx-auto w-full max-w-xl" role="img" aria-label={`${mode} circuit with a ${v} volt battery, R1 ${r1} ohms and R2 ${r2} ohms`}>
        <style>{`.wire{fill:none;stroke:var(--color-ink-700);stroke-width:3}.flow{fill:none;stroke:var(--color-sun-500);stroke-width:3;stroke-dasharray:4 14;${animate ? `animation:flow ${(3 / speed).toFixed(2)}s linear infinite` : ''}}@keyframes flow{to{stroke-dashoffset:-18}}`}</style>
        {mode === 'series' ? (<>
          <path className="wire" d="M60 200 V60 H340 V200 H60" /><path className="flow" d="M60 200 V60 H340 V200 H60" />
          <Res x={150} y={60} label={`R₁ ${r1}Ω`} /><Res x={250} y={60} label={`R₂ ${r2}Ω`} />
        </>) : (<>
          <path className="wire" d="M60 200 V40 H340 V200 H60 M120 40 V130 H280 V40" /><path className="flow" d="M60 200 V40 H340 V200 H60 M120 40 V130 H280 V40" />
          <Res x={200} y={40} label={`R₁ ${r1}Ω`} /><Res x={200} y={130} label={`R₂ ${r2}Ω`} />
        </>)}
        <rect x="40" y="110" width="40" height="40" rx="6" fill="var(--color-surface)" stroke="var(--color-ink-700)" strokeWidth="3" />
        <text x="60" y="135" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink-900)">{v}V</text>
        <g transform="translate(200 215)"><circle r="22" fill="var(--color-surface)" stroke="var(--color-brand-600)" strokeWidth="3" /><text textAnchor="middle" y="5" fontSize="12" fontWeight="700" fill="var(--color-brand-700)">{fmt(i * 1000, 0)}mA</text></g>
        <text x="200" y="252" textAnchor="middle" fontSize="11" fill="var(--color-ink-500)">Ammeter</text>
      </svg>
    </Workspace>
  );
}
function Res({ x, y, label }: { x: number; y: number; label: string }) {
  return (<g transform={`translate(${x} ${y})`}>
    <rect x="-28" y="-10" width="56" height="20" rx="4" fill="var(--color-surface)" stroke="var(--color-growth-600)" strokeWidth="3" />
    <path d="M-22 0 l5 -6 l6 12 l6 -12 l6 12 l6 -12 l5 6" fill="none" stroke="var(--color-growth-600)" strokeWidth="2" />
    <text y="-16" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink-700)">{label}</text>
  </g>);
}

// ---------------------------------------------------------------- Projectile
const PLANETS = { Earth: 9.81, Moon: 1.62, Mars: 3.71, Jupiter: 24.79 } as const;
function Projectile() {
  const [v0, setV0] = useState(20);
  const [angle, setAngle] = useState(45);
  const [h0, setH0] = useState(0);
  const [planet, setPlanet] = useState<keyof typeof PLANETS>('Earth');
  const [running, setRunning] = useState(false);
  const [t, setT] = useClock(running);
  const g = PLANETS[planet];
  const rad = (angle * Math.PI) / 180;
  const vx = v0 * Math.cos(rad);
  const vy = v0 * Math.sin(rad);
  const flight = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  const range = vx * flight;
  const hmax = h0 + (vy * vy) / (2 * g);
  const tt = Math.min(t, flight);
  useEffect(() => { if (t >= flight && running) setRunning(false); }, [t, flight, running]);
  const scale = useMemo(() => Math.min(340 / Math.max(range, 1), 180 / Math.max(hmax, 1)), [range, hmax]);
  const pts = Array.from({ length: 61 }, (_, k) => { const s = (flight * k) / 60; return [20 + vx * s * scale, 210 - (h0 + vy * s - 0.5 * g * s * s) * scale]; });
  const bx = 20 + vx * tt * scale;
  const by = 210 - (h0 + vy * tt - 0.5 * g * tt * tt) * scale;
  const reset = () => { setRunning(false); setT(0); };
  return (
    <Workspace
      controls={<>
        <Slider label="Launch speed" value={v0} min={1} max={60} unit="m/s" onChange={(x) => { setV0(x); reset(); }} />
        <Slider label="Angle" value={angle} min={0} max={90} unit="°" onChange={(x) => { setAngle(x); reset(); }} />
        <Slider label="Launch height" value={h0} min={0} max={50} unit="m" onChange={(x) => { setH0(x); reset(); }} />
        <label className="block text-sm font-semibold text-ink-700">Gravity
          <Select value={planet} onChange={(e) => { setPlanet(e.target.value as keyof typeof PLANETS); reset(); }} className="mt-1">{Object.entries(PLANETS).map(([k, val]) => <option key={k} value={k}>{k} ({val} m/s²)</option>)}</Select>
        </label>
        <div className="flex gap-2"><Button className="flex-1" onClick={() => { if (t >= flight) setT(0); setRunning(!running); }} leftIcon={running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>{running ? 'Pause' : 'Launch'}</Button><Button variant="secondary" onClick={reset} aria-label="Reset"><RotateCcw className="h-4 w-4" /></Button></div>
        <div className="grid grid-cols-2 gap-2"><Readout label="Range" value={`${fmt(range, 1)} m`} /><Readout label="Max height" value={`${fmt(hmax, 1)} m`} /><Readout label="Flight time" value={`${fmt(flight)} s`} /><Readout label="Time" value={`${fmt(tt)} s`} /></div>
      </>}
      notes={<p>Horizontal velocity stays constant (vₓ = v cos θ) while gravity changes vertical velocity. Without air resistance, 45° gives the longest range from ground level. Try the Moon!</p>}>
      <svg viewBox="0 0 380 230" className="w-full" role="img" aria-label={`Projectile trajectory: range ${fmt(range, 1)} metres`}>
        <line x1="10" y1="210" x2="375" y2="210" stroke="var(--color-growth-600)" strokeWidth="3" />
        {h0 > 0 && <rect x="8" y={210 - h0 * scale} width="12" height={h0 * scale} fill="var(--color-ink-300)" />}
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--color-brand-400)" strokeDasharray="4 4" strokeWidth="2" />
        <circle cx={bx} cy={by} r="7" fill="var(--color-sun-500)" stroke="var(--color-ink-800)" strokeWidth="1.5" />
        <text x="370" y="225" textAnchor="end" fontSize="10" fill="var(--color-ink-500)">{fmt(range, 0)} m</text>
      </svg>
    </Workspace>
  );
}

// ---------------------------------------------------------------- Pendulum
function Pendulum() {
  const [len, setLen] = useState(1);
  const [g, setG] = useState(9.81);
  const [amp, setAmp] = useState(15);
  const [running, setRunning] = useState(true);
  const [t, setT] = useClock(running);
  const period = 2 * Math.PI * Math.sqrt(len / g);
  const theta = ((amp * Math.PI) / 180) * Math.cos((2 * Math.PI * t) / period);
  const L = 60 + len * 70;
  const x = 200 + L * Math.sin(theta);
  const y = 20 + L * Math.cos(theta);
  return (
    <Workspace
      controls={<>
        <Slider label="Length" value={len} min={0.2} max={2.5} step={0.1} unit="m" onChange={(v) => { setLen(v); setT(0); }} />
        <Slider label="Gravity" value={g} min={1} max={25} step={0.01} unit="m/s²" onChange={(v) => { setG(v); setT(0); }} />
        <Slider label="Starting angle" value={amp} min={2} max={30} unit="°" onChange={setAmp} />
        <div className="flex gap-2"><Button className="flex-1" onClick={() => setRunning(!running)} leftIcon={running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>{running ? 'Pause' : 'Swing'}</Button><Button variant="secondary" onClick={() => setT(0)} aria-label="Reset timer"><RotateCcw className="h-4 w-4" /></Button></div>
        <div className="grid grid-cols-2 gap-2"><Readout label="Period T" value={`${fmt(period)} s`} hint="T = 2π√(L/g)" /><Readout label="Oscillations" value={Math.floor(t / period)} hint={`${fmt(t, 1)} s elapsed`} /></div>
      </>}
      notes={<p>For small angles the period depends only on length and gravity — not on the mass or how far you pull it. Double the length and the period grows by √2.</p>}>
      <svg viewBox="0 0 400 300" className="mx-auto w-full max-w-lg" role="img" aria-label={`Pendulum of length ${len} metres, period ${fmt(period)} seconds`}>
        <line x1="120" y1="20" x2="280" y2="20" stroke="var(--color-ink-700)" strokeWidth="4" />
        <line x1="200" y1="20" x2={x} y2={y} stroke="var(--color-ink-600)" strokeWidth="2" />
        <circle cx={x} cy={y} r="16" fill="var(--color-brand-600)" stroke="var(--color-ink-900)" strokeWidth="1.5" />
      </svg>
    </Workspace>
  );
}

// ---------------------------------------------------------------- Titration (strong acid / strong base)
const INDICATORS = {
  phenolphthalein: { name: 'Phenolphthalein', color: (ph: number) => (ph < 8.2 ? 'rgba(255,255,255,0.35)' : ph < 10 ? '#f9a8d4' : '#db2777') },
  methylorange: { name: 'Methyl orange', color: (ph: number) => (ph < 3.1 ? '#dc2626' : ph < 4.4 ? '#f97316' : '#facc15') },
  universal: { name: 'Universal indicator', color: (ph: number) => ['#dc2626', '#ea580c', '#f59e0b', '#facc15', '#a3e635', '#22c55e', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#4f46e5', '#7c3aed'][Math.max(0, Math.min(11, Math.floor(ph - 1)))] },
};
function phFor(acidVol: number, acidM: number, baseVol: number, baseM: number) {
  const hPlus = acidVol * acidM - baseVol * baseM; // millimoles
  const total = (acidVol + baseVol) / 1000;
  if (Math.abs(hPlus) < 1e-9) return 7;
  if (hPlus > 0) return -Math.log10(hPlus / 1000 / total);
  return 14 + Math.log10(-hPlus / 1000 / total);
}
function Titration() {
  const [acidM, setAcidM] = useState(0.1);
  const [baseM, setBaseM] = useState(0.1);
  const [added, setAdded] = useState(0);
  const [ind, setInd] = useState<keyof typeof INDICATORS>('phenolphthalein');
  const acidVol = 25;
  const ph = phFor(acidVol, acidM, added, baseM);
  const eq = (acidVol * acidM) / baseM;
  const curve = Array.from({ length: 101 }, (_, k) => { const vb = (50 * k) / 100; return [40 + vb * 6.4, 210 - phFor(acidVol, acidM, vb, baseM) * 14]; });
  return (
    <Workspace
      controls={<>
        <Slider label="Acid (HCl) concentration" value={acidM} min={0.05} max={0.5} step={0.05} unit="M" onChange={setAcidM} />
        <Slider label="Base (NaOH) concentration" value={baseM} min={0.05} max={0.5} step={0.05} unit="M" onChange={setBaseM} />
        <Slider label="NaOH added" value={added} min={0} max={50} step={0.1} unit="mL" onChange={setAdded} />
        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setAdded((a) => Math.max(0, +(a - 1).toFixed(1)))}>−1 mL</Button><Button size="sm" variant="secondary" onClick={() => setAdded((a) => Math.min(50, +(a + 0.1).toFixed(1)))}>+1 drop</Button><Button size="sm" variant="secondary" onClick={() => setAdded((a) => Math.min(50, +(a + 1).toFixed(1)))}>+1 mL</Button></div>
        <label className="block text-sm font-semibold text-ink-700">Indicator<Select className="mt-1" value={ind} onChange={(e) => setInd(e.target.value as keyof typeof INDICATORS)}>{Object.entries(INDICATORS).map(([k, i]) => <option key={k} value={k}>{i.name}</option>)}</Select></label>
        <div className="grid grid-cols-2 gap-2"><Readout label="pH" value={fmt(ph)} hint={ph < 6.9 ? 'Acidic' : ph > 7.1 ? 'Alkaline' : 'Neutral'} /><Readout label="End point" value={`${fmt(eq, 1)} mL`} hint="n(acid) = n(base)" /></div>
      </>}
      notes={<p>HCl + NaOH → NaCl + H₂O. At the equivalence point moles of acid equal moles of base, so V<sub>base</sub> = (C<sub>acid</sub> × 25 mL) ÷ C<sub>base</sub>. Notice the steep jump in pH near the end point.</p>}>
      <div className="grid items-end gap-4 sm:grid-cols-[9rem_1fr]">
        <svg viewBox="0 0 120 240" className="mx-auto h-60" role="img" aria-label={`Flask at pH ${fmt(ph, 1)}`}>
          <rect x="52" y="0" width="16" height="80" fill="var(--color-surface)" stroke="var(--color-ink-500)" />
          <rect x="54" y={2 + (added / 50) * 76} width="12" height={76 - (added / 50) * 76} fill="#bfdbfe" />
          <path d="M45 120 h30 v30 l35 70 a8 8 0 0 1 -7 12 h-86 a8 8 0 0 1 -7 -12 l35 -70 z" fill="var(--color-surface)" stroke="var(--color-ink-600)" strokeWidth="2" />
          <path d={`M${20 - added * 0.1} ${200 - added * 0.3} h${80 + added * 0.2} l9 18 a6 6 0 0 1 -5 9 h-88 a6 6 0 0 1 -5 -9 z`} fill={INDICATORS[ind].color(ph)} opacity="0.9" style={{ transition: 'fill .4s' }} />
        </svg>
        <svg viewBox="0 0 380 240" className="w-full" role="img" aria-label="Titration curve">
          <line x1="40" y1="14" x2="40" y2="210" stroke="var(--color-ink-400)" /><line x1="40" y1="210" x2="360" y2="210" stroke="var(--color-ink-400)" />
          {[0, 7, 14].map((p) => <text key={p} x="34" y={214 - p * 14} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">{p}</text>)}
          <text x="360" y="228" textAnchor="end" fontSize="10" fill="var(--color-ink-500)">50 mL NaOH</text>
          <polyline points={curve.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" />
          <circle cx={40 + added * 6.4} cy={210 - ph * 14} r="5" fill="var(--color-sun-500)" stroke="var(--color-ink-800)" />
        </svg>
      </div>
    </Workspace>
  );
}

// ---------------------------------------------------------------- Periodic table (first 20 elements)
type El = { z: number; s: string; n: string; m: number; g: number; p: number; cat: string };
const ELEMENTS: El[] = [
  [1, 'H', 'Hydrogen', 1.008, 1, 1, 'nonmetal'], [2, 'He', 'Helium', 4.0026, 18, 1, 'noble gas'], [3, 'Li', 'Lithium', 6.94, 1, 2, 'alkali metal'], [4, 'Be', 'Beryllium', 9.0122, 2, 2, 'alkaline earth metal'],
  [5, 'B', 'Boron', 10.81, 13, 2, 'metalloid'], [6, 'C', 'Carbon', 12.011, 14, 2, 'nonmetal'], [7, 'N', 'Nitrogen', 14.007, 15, 2, 'nonmetal'], [8, 'O', 'Oxygen', 15.999, 16, 2, 'nonmetal'],
  [9, 'F', 'Fluorine', 18.998, 17, 2, 'halogen'], [10, 'Ne', 'Neon', 20.18, 18, 2, 'noble gas'], [11, 'Na', 'Sodium', 22.99, 1, 3, 'alkali metal'], [12, 'Mg', 'Magnesium', 24.305, 2, 3, 'alkaline earth metal'],
  [13, 'Al', 'Aluminium', 26.982, 13, 3, 'post-transition metal'], [14, 'Si', 'Silicon', 28.085, 14, 3, 'metalloid'], [15, 'P', 'Phosphorus', 30.974, 15, 3, 'nonmetal'], [16, 'S', 'Sulfur', 32.06, 16, 3, 'nonmetal'],
  [17, 'Cl', 'Chlorine', 35.45, 17, 3, 'halogen'], [18, 'Ar', 'Argon', 39.948, 18, 3, 'noble gas'], [19, 'K', 'Potassium', 39.098, 1, 4, 'alkali metal'], [20, 'Ca', 'Calcium', 40.078, 2, 4, 'alkaline earth metal'],
].map(([z, s, n, m, g, p, cat]) => ({ z, s, n, m, g, p, cat }) as El);
const CAT_COLOR: Record<string, string> = { nonmetal: 'bg-growth-100 text-growth-700', 'noble gas': 'bg-violet-100 text-violet-800', 'alkali metal': 'bg-red-100 text-red-800', 'alkaline earth metal': 'bg-sun-100 text-sun-700', metalloid: 'bg-teal-100 text-teal-800', halogen: 'bg-sky-100 text-sky-800', 'post-transition metal': 'bg-ink-100 text-ink-800' };
function shells(z: number) { const caps = [2, 8, 8, 2]; const out: number[] = []; let left = z; for (const c of caps) { if (left <= 0) break; out.push(Math.min(c, left)); left -= c; } return out; }
function Elements() {
  const [sel, setSel] = useState<El>(ELEMENTS[5]);
  const sh = shells(sel.z);
  return (
    <Workspace
      controls={<>
        <div className="flex items-center gap-3"><div className={cn('grid h-16 w-16 place-items-center rounded-xl text-2xl font-extrabold', CAT_COLOR[sel.cat])}>{sel.s}</div><div><p className="text-lg font-extrabold">{sel.n}</p><p className="text-sm capitalize text-ink-500">{sel.cat}</p></div></div>
        <div className="grid grid-cols-2 gap-2"><Readout label="Atomic number" value={sel.z} hint={`${sel.z} protons`} /><Readout label="Relative mass" value={sel.m} /><Readout label="Group / Period" value={`${sel.g} / ${sel.p}`} /><Readout label="Electrons" value={sh.join(', ')} hint={`Valence: ${sh[sh.length - 1]}`} /></div>
        <svg viewBox="-100 -100 200 200" className="mx-auto h-44" role="img" aria-label={`Bohr model of ${sel.n}: shells ${sh.join(', ')}`}>
          <circle r="12" fill="var(--color-sun-500)" /><text y="4" textAnchor="middle" fontSize="10" fontWeight="700">{sel.s}</text>
          {sh.map((count, k) => { const r = 28 + k * 20; return (<g key={k}><circle r={r} fill="none" stroke="var(--color-ink-300)" />{Array.from({ length: count }, (_, e) => { const a = (2 * Math.PI * e) / count; return <circle key={e} cx={r * Math.cos(a)} cy={r * Math.sin(a)} r="4" fill="var(--color-brand-600)" />; })}</g>); })}
        </svg>
      </>}
      notes={<p>Elements in the same group have the same number of outer (valence) electrons, so they react in similar ways. The period number tells you how many electron shells an atom has.</p>}>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
        {[1, 2, 3, 4].flatMap((p) => Array.from({ length: 18 }, (_, gi) => {
          const el = ELEMENTS.find((e) => e.p === p && e.g === gi + 1);
          return el ? (
            <button key={`${p}-${gi}`} onClick={() => setSel(el)} aria-pressed={sel.z === el.z} title={el.n}
              className={cn('aspect-square rounded-md p-0.5 text-center text-[0.6rem] font-bold leading-tight transition sm:text-xs', CAT_COLOR[el.cat], sel.z === el.z && 'ring-2 ring-brand-600 ring-offset-1')}>
              <span className="block text-[0.5rem] font-medium opacity-70 sm:text-[0.6rem]">{el.z}</span>{el.s}
            </button>
          ) : <div key={`${p}-${gi}`} />;
        }))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">{Object.entries(CAT_COLOR).map(([c, cls]) => <span key={c} className={cn('rounded-full px-2 py-0.5 capitalize', cls)}>{c}</span>)}</div>
    </Workspace>
  );
}

// ---------------------------------------------------------------- Buoyancy
const MATERIALS = { Cork: 0.24, 'Pine wood': 0.5, Ice: 0.92, 'Plastic (HDPE)': 0.95, Brick: 1.9, Aluminium: 2.7, Iron: 7.87, Gold: 19.3 } as const;
const LIQUIDS = { 'Fresh water': 1.0, 'Sea water': 1.03, 'Cooking oil': 0.92, Honey: 1.42 } as const;
function Buoyancy() {
  const [mat, setMat] = useState<keyof typeof MATERIALS>('Ice');
  const [liq, setLiq] = useState<keyof typeof LIQUIDS>('Fresh water');
  const [vol, setVol] = useState(100);
  const ro = MATERIALS[mat];
  const rl = LIQUIDS[liq];
  const floats = ro < rl;
  const frac = floats ? ro / rl : 1;
  const mass = ro * vol;
  const size = 40 + Math.cbrt(vol) * 6;
  const surface = 90;
  const top = floats ? surface - size * (1 - frac) : 220 - size;
  return (
    <Workspace
      controls={<>
        <label className="block text-sm font-semibold text-ink-700">Object material<Select className="mt-1" value={mat} onChange={(e) => setMat(e.target.value as keyof typeof MATERIALS)}>{Object.entries(MATERIALS).map(([k, d]) => <option key={k} value={k}>{k} ({d} g/cm³)</option>)}</Select></label>
        <label className="block text-sm font-semibold text-ink-700">Liquid<Select className="mt-1" value={liq} onChange={(e) => setLiq(e.target.value as keyof typeof LIQUIDS)}>{Object.entries(LIQUIDS).map(([k, d]) => <option key={k} value={k}>{k} ({d} g/cm³)</option>)}</Select></label>
        <Slider label="Object volume" value={vol} min={10} max={1000} step={10} unit="cm³" onChange={setVol} />
        <div className="grid grid-cols-2 gap-2"><Readout label="Result" value={floats ? 'Floats' : ro === rl ? 'Suspends' : 'Sinks'} /><Readout label="Submerged" value={`${fmt(frac * 100, 0)}%`} /><Readout label="Mass" value={`${fmt(mass, 0)} g`} /><Readout label="Max upthrust" value={`${fmt((rl * vol * 9.81) / 1000, 2)} N`} hint="ρ × V × g" /></div>
      </>}
      notes={<p>An object floats when its density is less than the liquid’s. A floating object sinks until it displaces its own weight of liquid (Archimedes’ principle), so the fraction under the surface equals ρ<sub>object</sub> ÷ ρ<sub>liquid</sub>.</p>}>
      <svg viewBox="0 0 300 240" className="mx-auto w-full max-w-md" role="img" aria-label={`${mat} in ${liq}: ${floats ? 'floats' : 'sinks'}`}>
        <rect x="30" y="30" width="240" height="195" fill="none" stroke="var(--color-ink-500)" strokeWidth="3" />
        <rect x="32" y={surface} width="236" height={225 - surface - 1} fill={liq === 'Honey' ? '#f59e0b' : liq === 'Cooking oil' ? '#fde68a' : '#93c5fd'} opacity="0.55" />
        <rect x={150 - size / 2} y={top} width={size} height={size} rx="4" fill={mat === 'Gold' ? '#eab308' : ro > 2 ? 'var(--color-ink-500)' : '#d6a466'} stroke="var(--color-ink-800)" style={{ transition: 'y .6s' }} />
      </svg>
    </Workspace>
  );
}

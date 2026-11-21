import { useMemo, useState } from 'react';
import { Battery, Gauge, Lightbulb, MousePointer2, RotateCcw, ToggleLeft, Trash2, Zap } from 'lucide-react';
import { Alert, Button, Card, CardBody } from '@/components/ui';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/features/preferences/PreferencesProvider';
import { Readout, Slider } from '../LabToolShell';

/* A free-form circuit sandbox. Components sit on the edges of a node grid and
   the circuit is solved with nodal analysis (batteries as Norton sources). */
type Kind = 'wire' | 'battery' | 'resistor' | 'bulb' | 'switch' | 'ammeter' | 'voltmeter';
type Part = { kind: Kind; value: number; on?: boolean; flip?: boolean };
const COLS = 7, ROWS = 5, GAP = 72, PAD = 36;
const W = PAD * 2 + GAP * (COLS - 1), H = PAD * 2 + GAP * (ROWS - 1);
const DEFAULTS: Record<Kind, Part> = {
  wire: { kind: 'wire', value: 0 }, battery: { kind: 'battery', value: 6 }, resistor: { kind: 'resistor', value: 100 }, bulb: { kind: 'bulb', value: 12 },
  switch: { kind: 'switch', value: 0, on: true }, ammeter: { kind: 'ammeter', value: 0 }, voltmeter: { kind: 'voltmeter', value: 0 },
};
const TOOLS: { kind: Kind | 'select'; label: string; icon: typeof Zap }[] = [
  { kind: 'select', label: 'Select', icon: MousePointer2 }, { kind: 'wire', label: 'Wire', icon: Zap }, { kind: 'battery', label: 'Cell / battery', icon: Battery },
  { kind: 'resistor', label: 'Resistor', icon: Zap }, { kind: 'bulb', label: 'Bulb', icon: Lightbulb }, { kind: 'switch', label: 'Switch', icon: ToggleLeft },
  { kind: 'ammeter', label: 'Ammeter', icon: Gauge }, { kind: 'voltmeter', label: 'Voltmeter', icon: Gauge },
];
const node = (c: number, r: number) => r * COLS + c;
const pos = (n: number) => [PAD + (n % COLS) * GAP, PAD + Math.floor(n / COLS) * GAP] as const;
const edgeNodes = (id: string): [number, number] => { const [d, c, r] = id.split('-'); const C = +c, R = +r; return d === 'h' ? [node(C, R), node(C + 1, R)] : [node(C, R), node(C, R + 1)]; };
const R_INT = 0.05;
const conductance = (p: Part) => p.kind === 'wire' ? 1e3 : p.kind === 'resistor' ? 1 / Math.max(p.value, 0.1) : p.kind === 'bulb' ? 1 / Math.max(p.value, 0.1)
  : p.kind === 'switch' ? (p.on ? 1e3 : 1e-12) : p.kind === 'ammeter' ? 100 : p.kind === 'voltmeter' ? 1e-7 : 1 / R_INT;

export function solve(parts: Record<string, Part>) {
  const N = COLS * ROWS;
  const G = Array.from({ length: N }, () => new Float64Array(N));
  const I = new Float64Array(N);
  const stamp = (a: number, b: number, g: number) => { G[a][a] += g; G[b][b] += g; G[a][b] -= g; G[b][a] -= g; };
  let ground = -1;
  for (const [id, p] of Object.entries(parts)) {
    const [a, b] = edgeNodes(id);
    const g = conductance(p);
    stamp(a, b, g);
    if (p.kind === 'battery') {
      const [plus, minus] = p.flip ? [a, b] : [b, a];
      I[plus] += p.value * g; I[minus] -= p.value * g;
      if (ground < 0) ground = minus;
    }
  }
  for (let i = 0; i < N; i++) G[i][i] += 1e-9;
  if (ground >= 0) { for (let j = 0; j < N; j++) { G[ground][j] = 0; } G[ground][ground] = 1; I[ground] = 0; }
  // Gaussian elimination with partial pivoting
  const A = G.map((row, i) => [...row, I[i]]);
  for (let k = 0; k < N; k++) {
    let piv = k; for (let i = k + 1; i < N; i++) if (Math.abs(A[i][k]) > Math.abs(A[piv][k])) piv = i;
    [A[k], A[piv]] = [A[piv], A[k]];
    const d = A[k][k] || 1e-18;
    for (let i = k + 1; i < N; i++) { const f = A[i][k] / d; if (f) for (let j = k; j <= N; j++) A[i][j] -= f * A[k][j]; }
  }
  const v = new Float64Array(N);
  for (let i = N - 1; i >= 0; i--) { let s = A[i][N]; for (let j = i + 1; j < N; j++) s -= A[i][j] * v[j]; v[i] = s / (A[i][i] || 1e-18); }
  const res: Record<string, { i: number; dv: number; p: number }> = {};
  for (const [id, p] of Object.entries(parts)) {
    const [a, b] = edgeNodes(id);
    const dv = v[a] - v[b];
    const g = conductance(p);
    let cur = dv * g;
    if (p.kind === 'battery') { const [plus, minus] = p.flip ? [a, b] : [b, a]; cur = g * (p.value - (v[plus] - v[minus])); }
    res[id] = { i: cur, dv, p: Math.abs(cur * dv) };
  }
  return res;
}

export const PRESETS: Record<string, Record<string, Part>> = {
  series: { 'v-0-1': { kind: 'battery', value: 6 }, 'v-0-0': { kind: 'wire', value: 0 }, 'h-0-0': { kind: 'wire', value: 0 }, 'h-1-0': { kind: 'bulb', value: 12 }, 'h-2-0': { kind: 'bulb', value: 12 },
    'v-3-0': { kind: 'switch', value: 0, on: true }, 'v-3-1': { kind: 'wire', value: 0 }, 'h-2-2': { kind: 'ammeter', value: 0 }, 'h-1-2': { kind: 'wire', value: 0 }, 'h-0-2': { kind: 'wire', value: 0 } },
  parallel: { 'v-0-1': { kind: 'battery', value: 6 }, 'v-0-0': { kind: 'wire', value: 0 }, 'h-0-0': { kind: 'wire', value: 0 }, 'h-1-0': { kind: 'wire', value: 0 }, 'h-2-0': { kind: 'wire', value: 0 },
    'v-1-0': { kind: 'bulb', value: 12 }, 'v-1-1': { kind: 'wire', value: 0 }, 'v-3-0': { kind: 'bulb', value: 12 }, 'v-3-1': { kind: 'wire', value: 0 }, 'h-0-2': { kind: 'ammeter', value: 0 }, 'h-1-2': { kind: 'wire', value: 0 }, 'h-2-2': { kind: 'wire', value: 0 } },
  empty: {},
};

export function CircuitBuilder() {
  const { prefs } = usePrefs();
  const [parts, setParts] = useState<Record<string, Part>>(PRESETS.series);
  const [tool, setTool] = useState<Kind | 'select'>('select');
  const [sel, setSel] = useState<string | null>(null);
  const res = useMemo(() => solve(parts), [parts]);
  const batteries = Object.entries(parts).filter(([, p]) => p.kind === 'battery');
  const short = batteries.some(([id]) => Math.abs(res[id]?.i ?? 0) > 8);
  const edges = useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (c < COLS - 1) out.push(`h-${c}-${r}`); if (r < ROWS - 1) out.push(`v-${c}-${r}`); }
    return out;
  }, []);
  const click = (id: string) => {
    if (tool === 'select') { setSel(parts[id] ? id : null); return; }
    setParts((p) => ({ ...p, [id]: { ...DEFAULTS[tool] } })); setSel(id);
  };
  const p = sel ? parts[sel] : null;
  const upd = (patch: Partial<Part>) => sel && setParts((x) => ({ ...x, [sel]: { ...x[sel], ...patch } }));
  const fmtA = (a: number) => (Math.abs(a) < 1 ? `${(Math.abs(a) * 1000).toFixed(1)} mA` : `${Math.abs(a).toFixed(2)} A`);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card className="overflow-hidden"><CardBody className="space-y-3 p-3 sm:p-4">
        <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="toolbar" aria-label="Components">
          {TOOLS.map((t) => (
            <button key={t.kind} onClick={() => setTool(t.kind)} aria-pressed={tool === t.kind} className={cn('flex shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-1.5 text-[0.7rem] font-bold transition active:scale-95', tool === t.kind ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-brand-300')}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">{tool === 'select' ? 'Tap a component to change it. Pick a tool, then tap the gap between two dots to place it.' : `Tap the gap between two dots to place a ${TOOLS.find((t) => t.kind === tool)?.label.toLowerCase()}.`}</p>
        <div className="overflow-x-auto rounded-2xl bg-[#0f2e26] p-2" data-no-contrast>
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full min-w-[30rem] max-w-3xl touch-manipulation select-none" role="img" aria-label="Circuit board">
            <style>{`.flow{stroke-dasharray:3 11;${prefs.reduceMotion ? '' : 'animation:cflow var(--spd) linear infinite'}}@keyframes cflow{to{stroke-dashoffset:-14}}`}</style>
            {edges.map((id) => {
              const [a, b] = edgeNodes(id); const [x1, y1] = pos(a); const [x2, y2] = pos(b);
              const part = parts[id]; const r = res[id];
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const vert = id.startsWith('v');
              const amps = Math.abs(r?.i ?? 0);
              return (
                <g key={id} onClick={() => click(id)} className="cursor-pointer">
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={26} />
                  {!part && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={2} strokeDasharray="2 6" />}
                  {part && <>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={sel === id ? '#fcd34d' : '#e2e8f0'} strokeWidth={3} />
                    {amps > 1e-4 && part.kind !== 'voltmeter' && <line x1={(r!.i >= 0) === (part.kind === 'battery' ? !part.flip : true) ? x1 : x2} y1={(r!.i >= 0) === (part.kind === 'battery' ? !part.flip : true) ? y1 : y2} x2={(r!.i >= 0) === (part.kind === 'battery' ? !part.flip : true) ? x2 : x1} y2={(r!.i >= 0) === (part.kind === 'battery' ? !part.flip : true) ? y2 : y1} className="flow" stroke="#fbbf24" strokeWidth={3} style={{ ['--spd' as string]: `${Math.max(0.25, Math.min(3, 0.4 / Math.max(amps, 0.02)))}s` }} />}
                    <g transform={`translate(${mx} ${my}) rotate(${vert ? 90 : 0})`}><Symbol part={part} r={r} vert={vert} /></g>
                  </>}
                </g>
              );
            })}
            {Array.from({ length: COLS * ROWS }, (_, n) => { const [x, y] = pos(n); return <circle key={n} cx={x} cy={y} r={4} fill="#94a3b8" />; })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setParts(PRESETS.series); setSel(null); }}>Series example</Button>
          <Button size="sm" variant="secondary" onClick={() => { setParts(PRESETS.parallel); setSel(null); }}>Parallel example</Button>
          <Button size="sm" variant="ghost" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => { setParts({}); setSel(null); setTool('battery'); }}>Empty board</Button>
        </div>
      </CardBody></Card>
      <div className="space-y-4">
        {short && <Alert tone="error" title="Short circuit!">A very large current is flowing — the cell would overheat. Add a resistor or bulb to the loop.</Alert>}
        <Card><CardBody className="space-y-3">
          {p ? (<>
            <p className="font-bold capitalize">{p.kind}</p>
            {p.kind === 'battery' && <><Slider label="Voltage" value={p.value} min={1.5} max={24} step={0.5} unit="V" onChange={(v) => upd({ value: v })} /><Button size="sm" variant="secondary" onClick={() => upd({ flip: !p.flip })}>Flip + / −</Button></>}
            {p.kind === 'resistor' && <Slider label="Resistance" value={p.value} min={1} max={1000} step={1} unit="Ω" onChange={(v) => upd({ value: v })} />}
            {p.kind === 'bulb' && <Slider label="Filament resistance" value={p.value} min={2} max={60} step={1} unit="Ω" onChange={(v) => upd({ value: v })} />}
            {p.kind === 'switch' && <Button size="sm" onClick={() => upd({ on: !p.on })}>{p.on ? 'Open the switch' : 'Close the switch'}</Button>}
            {sel && res[sel] && <div className="grid grid-cols-2 gap-2">
              <Readout label={p.kind === 'voltmeter' ? 'Reading' : 'Voltage across'} value={`${Math.abs(res[sel].dv).toFixed(2)} V`} />
              {p.kind !== 'voltmeter' && <Readout label={p.kind === 'ammeter' ? 'Reading' : 'Current'} value={fmtA(res[sel].i)} />}
              {(p.kind === 'bulb' || p.kind === 'resistor') && <Readout label="Power" value={`${res[sel].p.toFixed(3)} W`} />}
            </div>}
            <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => { setParts((x) => { const n = { ...x }; delete n[sel!]; return n; }); setSel(null); }}>Remove</Button>
          </>) : <p className="text-sm text-ink-500">Select a component to set its value and see its readings.</p>}
        </CardBody></Card>
        <Card><CardBody className="space-y-2 text-sm">
          <p className="font-bold">Meters</p>
          {Object.entries(parts).filter(([, x]) => x.kind === 'ammeter' || x.kind === 'voltmeter').map(([id, x], i) => <p key={id} className="flex justify-between"><span>{x.kind === 'ammeter' ? 'Ammeter' : 'Voltmeter'} {i + 1}</span><b className="tabular-nums">{x.kind === 'ammeter' ? fmtA(res[id]?.i ?? 0) : `${Math.abs(res[id]?.dv ?? 0).toFixed(2)} V`}</b></p>)}
          {!Object.values(parts).some((x) => x.kind === 'ammeter' || x.kind === 'voltmeter') && <p className="text-ink-500">Add an ammeter in series or a voltmeter in parallel to take readings.</p>}
          <p className="pt-2 text-xs text-ink-500">Ohm’s law: V = I × R. Ammeters go in series (in the loop); voltmeters go in parallel (across a component).</p>
        </CardBody></Card>
      </div>
    </div>
  );
}

function Symbol({ part, r, vert }: { part: Part; r?: { i: number; dv: number; p: number }; vert?: boolean }) {
  const label = (y: number, text: string, fill: string) => <text transform={vert ? `rotate(-90) translate(${y + 6} 0)` : undefined} y={vert ? 4 : y} x={vert ? 0 : 0} textAnchor={vert ? 'start' : 'middle'} fontSize={10} fill={fill}>{text}</text>;
  const bg = '#0f2e26';
  switch (part.kind) {
    case 'wire': return null;
    case 'battery': return (<g><rect x={-14} y={-16} width={28} height={32} fill={bg} /><line x1={-5} y1={-14} x2={-5} y2={14} stroke="#e2e8f0" strokeWidth={3} /><line x1={5} y1={-8} x2={5} y2={8} stroke="#e2e8f0" strokeWidth={5} />
      <text x={part.flip ? 12 : -14} y={-18} fontSize={11} fill="#fca5a5" fontWeight={700}>+</text>{label(22, `${part.value}V`, '#a7f3d0')}</g>);
    case 'resistor': return (<g><rect x={-16} y={-7} width={32} height={14} rx={2} fill={bg} stroke="#6ee7b7" strokeWidth={2.5} />{label(16, `${part.value}Ω`, '#a7f3d0')}</g>);
    case 'bulb': { const glow = Math.min(1, (r?.p ?? 0) / 3); return (<g>{glow > 0.02 && <circle r={22} fill="#fde047" opacity={0.15 + glow * 0.55} />}<circle r={11} fill={glow > 0.02 ? `rgba(253,224,71,${0.3 + glow * 0.7})` : bg} stroke="#e2e8f0" strokeWidth={2.5} /><path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="#e2e8f0" strokeWidth={2} /></g>); }
    case 'switch': return (<g><rect x={-15} y={-14} width={30} height={20} fill={bg} /><circle cx={-12} cy={0} r={3} fill="#e2e8f0" /><circle cx={12} cy={0} r={3} fill="#e2e8f0" /><line x1={-12} y1={0} x2={part.on ? 12 : 9} y2={part.on ? 0 : -12} stroke="#e2e8f0" strokeWidth={3} /></g>);
    case 'ammeter': case 'voltmeter': return (<g><circle r={13} fill={bg} stroke={part.kind === 'ammeter' ? '#93c5fd' : '#c4b5fd'} strokeWidth={2.5} /><text y={4} textAnchor="middle" fontSize={12} fontWeight={800} fill={part.kind === 'ammeter' ? '#93c5fd' : '#c4b5fd'}>{part.kind === 'ammeter' ? 'A' : 'V'}</text></g>);
  }
}

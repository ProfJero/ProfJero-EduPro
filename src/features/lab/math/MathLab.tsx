import { useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Dices, Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Card, CardBody, Field, Input, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LabToolShell, Readout, Slider } from '../LabToolShell';
import { compile, gcd, variablesIn } from './expr';
import { Sequences, Transformations, UnitCircle } from './MathExtra';

const r = (n: number, d = 4) => (Number.isFinite(n) ? String(+n.toFixed(d)) : '—');

export function MathLab() {
  const { tool } = useParams();
  if (!tool) return <Navigate to="/lab/math/grapher" replace />;
  const Tool = { transformations: Transformations, 'unit-circle': UnitCircle, sequences: Sequences, grapher: Grapher, solver: Solver, statistics: Statistics, triangle: Triangle, fractions: Fractions, probability: Probability }[tool];
  if (!Tool) return <Navigate to="/lab/math/grapher" replace />;
  return (
    <LabToolShell lab="math" tool={tool} title="Math Lab" description="Explore, visualise and check your mathematics.">
      <Tool />
    </LabToolShell>
  );
}

function Panel({ side, children }: { side: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
      <Card className="overflow-hidden"><div className="p-3 sm:p-5">{children}</div></Card>
      <Card><CardBody className="space-y-4">{side}</CardBody></Card>
    </div>
  );
}

// ---------------------------------------------------------------- Grapher
const COLORS = ['var(--color-brand-600)', 'var(--color-growth-600)', '#e11d48', 'var(--color-sun-500)'];
function Grapher() {
  const [fns, setFns] = useState(['sin(x)', 'a*x^2 + b']);
  const [params, setParams] = useState<Record<string, number>>({ a: 0.5, b: -1, c: 1 });
  const [zoom, setZoom] = useState(10);
  const [traceX, setTraceX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600, H = 400;
  const xMin = -zoom, xMax = zoom, yMin = -zoom * (H / W), yMax = zoom * (H / W);
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  const compiled = useMemo(() => fns.map((f) => { try { return { fn: f.trim() ? compile(f) : null, vars: f.trim() ? variablesIn(f) : [], error: null as string | null }; } catch (e) { return { fn: null, vars: [], error: (e as Error).message }; } }), [fns]);
  const usedParams = [...new Set(compiled.flatMap((c) => c.vars).filter((v) => v !== 'x'))];
  const paths = compiled.map((c) => {
    if (!c.fn) return '';
    let d = ''; let pen = false;
    for (let px = 0; px <= W; px += 2) {
      const x = xMin + (px / W) * (xMax - xMin);
      let y: number;
      try { y = c.fn({ ...params, x }); } catch { return ''; }
      if (!Number.isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue; }
      const py = sy(y);
      if (py < -H || py > 2 * H) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`; pen = true;
    }
    return d;
  });
  const step = zoom > 20 ? 5 : zoom > 8 ? 2 : 1;
  const ticks = (lo: number, hi: number) => { const out: number[] = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v); return out; };
  const onMove = (e: React.PointerEvent) => { const rect = svgRef.current!.getBoundingClientRect(); setTraceX(xMin + ((e.clientX - rect.left) / rect.width) * (xMax - xMin)); };
  return (
    <Panel side={<>
      {fns.map((f, i) => (
        <div key={i}>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
            <span className="text-sm font-semibold text-ink-600">y =</span>
            <Input value={f} onChange={(e) => setFns(fns.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Function ${i + 1}`} className="font-mono" spellCheck={false} />
            <button className="rounded p-1 text-ink-400 hover:text-red-600" onClick={() => setFns(fns.filter((_, k) => k !== i))} aria-label="Remove function"><Trash2 className="h-4 w-4" /></button>
          </div>
          {compiled[i]?.error && <p className="mt-1 text-xs text-red-700">{compiled[i].error}</p>}
        </div>
      ))}
      {fns.length < 4 && <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setFns([...fns, ''])}>Add function</Button>}
      {usedParams.map((p) => <Slider key={p} label={`Parameter ${p}`} value={params[p] ?? 1} min={-5} max={5} step={0.1} onChange={(v) => setParams({ ...params, [p]: v })} />)}
      <Slider label="Zoom (x range ±)" value={zoom} min={2} max={50} onChange={setZoom} />
      <p className="text-xs text-ink-500">Use x, numbers, + − × ÷ ^, brackets, sin cos tan sqrt abs ln log exp, pi and e. Letters other than x become sliders. Implicit multiplication works: 2x, 3(x+1).</p>
      {traceX != null && (
        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <p className="font-semibold">x = {r(traceX, 2)}</p>
          {compiled.map((c, i) => c.fn && <p key={i} style={{ color: COLORS[i] }}>y{i + 1} = {(() => { try { return r(c.fn({ ...params, x: traceX }), 3); } catch { return '—'; } })()}</p>)}
        </div>
      )}
    </>}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none rounded-xl bg-surface" onPointerMove={onMove} onPointerLeave={() => setTraceX(null)} role="img" aria-label={`Graph of ${fns.filter(Boolean).join(', ')}`}>
        {ticks(xMin, xMax).map((v) => <line key={`x${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={H} stroke="var(--color-ink-100)" />)}
        {ticks(yMin, yMax).map((v) => <line key={`y${v}`} y1={sy(v)} y2={sy(v)} x1={0} x2={W} stroke="var(--color-ink-100)" />)}
        <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--color-ink-500)" /><line y1={0} y2={H} x1={sx(0)} x2={sx(0)} stroke="var(--color-ink-500)" />
        {ticks(xMin, xMax).filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={sy(0) + 13} fontSize="10" textAnchor="middle" fill="var(--color-ink-500)">{v}</text>)}
        {ticks(yMin, yMax).filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={sx(0) - 5} y={sy(v) + 3} fontSize="10" textAnchor="end" fill="var(--color-ink-500)">{v}</text>)}
        {paths.map((d, i) => d && <path key={i} d={d} fill="none" stroke={COLORS[i]} strokeWidth="2.5" />)}
        {traceX != null && <line x1={sx(traceX)} x2={sx(traceX)} y1={0} y2={H} stroke="var(--color-ink-400)" strokeDasharray="3 3" />}
      </svg>
    </Panel>
  );
}

// ---------------------------------------------------------------- Solver
function Solver() {
  const [kind, setKind] = useState<'linear' | 'quadratic' | 'simultaneous'>('quadratic');
  const [q, setQ] = useState({ a: 1, b: -5, c: 6, d: 0, e: 0, f: 0 });
  const num = (k: keyof typeof q, label: string) => <Field label={label}><Input type="number" step="any" value={q[k]} onChange={(e) => setQ({ ...q, [k]: Number(e.target.value) })} /></Field>;
  const steps: string[] = [];
  let answer: string;
  if (kind === 'linear') {
    const { a, b, c } = q;
    steps.push(`${a}x + ${b} = ${c}`);
    if (a === 0) answer = b === c ? 'Every x is a solution (identity).' : 'No solution.';
    else { steps.push(`Subtract ${b} from both sides: ${a}x = ${c - b}`); steps.push(`Divide both sides by ${a}: x = ${c - b} ÷ ${a}`); answer = `x = ${r((c - b) / a)}`; }
  } else if (kind === 'quadratic') {
    const { a, b, c } = q;
    steps.push(`${a}x² + ${b}x + ${c} = 0`);
    if (a === 0) answer = b ? `Not quadratic (a = 0): x = ${r(-c / b)}` : 'Not an equation in x.';
    else {
      const D = b * b - 4 * a * c;
      steps.push(`Discriminant: b² − 4ac = (${b})² − 4(${a})(${c}) = ${r(D)}`);
      steps.push('Quadratic formula: x = (−b ± √D) ÷ 2a');
      if (D > 0) { const s = Math.sqrt(D); steps.push(`√D = ${r(s)}, so two real roots`); answer = `x = ${r((-b + s) / (2 * a))}  or  x = ${r((-b - s) / (2 * a))}`; }
      else if (D === 0) { steps.push('D = 0, so one repeated root'); answer = `x = ${r(-b / (2 * a))}`; }
      else { const s = Math.sqrt(-D); steps.push('D < 0, so the roots are complex'); answer = `x = ${r(-b / (2 * a))} ± ${r(s / (2 * a))}i`; }
      steps.push(`Vertex at (${r(-b / (2 * a))}, ${r(c - (b * b) / (4 * a))}); the parabola opens ${a > 0 ? 'upwards' : 'downwards'}.`);
    }
  } else {
    const { a, b, c, d, e, f } = q;
    steps.push(`${a}x + ${b}y = ${c}`, `${d}x + ${e}y = ${f}`);
    const det = a * e - b * d;
    steps.push(`Determinant: (${a})(${e}) − (${b})(${d}) = ${r(det)}`);
    if (det === 0) answer = 'The lines are parallel or the same: no unique solution.';
    else { steps.push(`x = (${c}·${e} − ${b}·${f}) ÷ ${r(det)}`, `y = (${a}·${f} − ${c}·${d}) ÷ ${r(det)}`); answer = `x = ${r((c * e - b * f) / det)},  y = ${r((a * f - c * d) / det)}`; }
  }
  return (
    <Panel side={<>
      <div className="flex gap-1.5">{(['linear', 'quadratic', 'simultaneous'] as const).map((k) => <Button key={k} size="sm" variant={kind === k ? 'primary' : 'secondary'} onClick={() => setKind(k)} className="flex-1 capitalize">{k}</Button>)}</div>
      {kind === 'linear' && <div className="grid grid-cols-3 gap-2">{num('a', 'a')}{num('b', 'b')}{num('c', '= c')}</div>}
      {kind === 'quadratic' && <div className="grid grid-cols-3 gap-2">{num('a', 'a')}{num('b', 'b')}{num('c', 'c')}</div>}
      {kind === 'simultaneous' && <div className="grid grid-cols-3 gap-2">{num('a', 'a')}{num('b', 'b')}{num('c', '= c')}{num('d', 'd')}{num('e', 'e')}{num('f', '= f')}</div>}
      <p className="text-xs text-ink-500">{kind === 'linear' ? 'Solves ax + b = c.' : kind === 'quadratic' ? 'Solves ax² + bx + c = 0.' : 'Solves ax + by = c and dx + ey = f.'}</p>
    </>}>
      <h3 className="font-bold">Working</h3>
      <ol className="mt-3 space-y-2">{steps.map((s, i) => <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span><span className="font-mono text-sm">{s}</span></li>)}</ol>
      <div className="mt-5 rounded-2xl bg-growth-50 p-4"><p className="text-xs font-semibold uppercase text-growth-700">Answer</p><p className="mt-1 font-mono text-lg font-bold text-ink-900">{answer}</p></div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Statistics
function Statistics() {
  const [raw, setRaw] = useState('12, 15, 15, 18, 20, 22, 22, 22, 25, 30');
  const data = raw.split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const mean = n ? data.reduce((a, b) => a + b, 0) / n : NaN;
  const median = (arr: number[]) => { const m = arr.length; if (!m) return NaN; return m % 2 ? arr[(m - 1) / 2] : (arr[m / 2 - 1] + arr[m / 2]) / 2; };
  const freq = new Map<number, number>(); data.forEach((x) => freq.set(x, (freq.get(x) ?? 0) + 1));
  const maxF = Math.max(0, ...freq.values());
  const modes = [...freq.entries()].filter(([, f]) => f === maxF && maxF > 1).map(([v]) => v);
  const variance = n ? data.reduce((a, x) => a + (x - mean) ** 2, 0) / n : NaN;
  const half = Math.floor(n / 2);
  const q1 = median(sorted.slice(0, half)); const q3 = median(sorted.slice(n % 2 ? half + 1 : half));
  const keys = [...freq.keys()].sort((a, b) => a - b);
  return (
    <Panel side={<>
      <Field label="Your data" hint="Numbers separated by commas or spaces"><Textarea rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} className="font-mono" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Count" value={n} /><Readout label="Mean" value={r(mean, 3)} /><Readout label="Median" value={r(median(sorted), 3)} /><Readout label="Mode" value={modes.length ? modes.join(', ') : 'None'} />
        <Readout label="Range" value={n ? r(sorted[n - 1] - sorted[0], 3) : '—'} /><Readout label="Std deviation" value={r(Math.sqrt(variance), 3)} hint="Population (σ)" />
        <Readout label="Q1 / Q3" value={`${r(q1, 2)} / ${r(q3, 2)}`} /><Readout label="IQR" value={r(q3 - q1, 3)} />
      </div>
    </>}>
      <h3 className="font-bold">Frequency chart</h3>
      {n ? (
        <svg viewBox={`0 0 ${Math.max(keys.length * 50, 300)} 220`} className="mt-3 w-full" role="img" aria-label="Bar chart of frequencies">
          {keys.map((k, i) => { const h = (freq.get(k)! / maxF) * 160; return (<g key={k} transform={`translate(${i * 50 + 10} 0)`}><rect x="0" y={190 - h} width="36" height={h} rx="4" fill="var(--color-brand-500)" /><text x="18" y="205" fontSize="11" textAnchor="middle" fill="var(--color-ink-600)">{k}</text><text x="18" y={185 - h} fontSize="11" textAnchor="middle" fontWeight="700" fill="var(--color-ink-800)">{freq.get(k)}</text></g>); })}
        </svg>
      ) : <Alert tone="info">Enter some numbers to see the chart.</Alert>}
      <p className="mt-3 font-mono text-xs text-ink-500">Sorted: {sorted.join(', ')}</p>
    </Panel>
  );
}

// ---------------------------------------------------------------- Triangle
function Triangle() {
  const [pts, setPts] = useState<[number, number][]>([[60, 260], [340, 260], [140, 60]]);
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const UNIT = 20;
  const dist = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]) / UNIT;
  const [A, B, C] = pts;
  const a = dist(B, C), b = dist(A, C), c = dist(A, B);
  const ang = (x: number, y: number, z: number) => (Math.acos(Math.max(-1, Math.min(1, (y * y + z * z - x * x) / (2 * y * z)))) * 180) / Math.PI;
  const angA = ang(a, b, c), angB = ang(b, a, c), angC = 180 - angA - angB;
  const area = Math.abs((A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])) / 2) / (UNIT * UNIT);
  const maxAng = Math.max(angA, angB, angC);
  const kind = Math.abs(maxAng - 90) < 1 ? 'Right-angled' : maxAng > 90 ? 'Obtuse' : 'Acute';
  const sides = [a, b, c].map((s) => +s.toFixed(1));
  const sideKind = sides[0] === sides[1] && sides[1] === sides[2] ? 'equilateral' : new Set(sides).size === 2 ? 'isosceles' : 'scalene';
  const move = (e: React.PointerEvent) => {
    if (drag == null) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.max(10, Math.min(390, ((e.clientX - rect.left) / rect.width) * 400));
    const y = Math.max(10, Math.min(290, ((e.clientY - rect.top) / rect.height) * 300));
    setPts(pts.map((p, i) => (i === drag ? [Math.round(x / 5) * 5, Math.round(y / 5) * 5] : p)) as [number, number][]);
  };
  const sorted = [a, b, c].sort((x, y) => x - y);
  return (
    <Panel side={<>
      <div className="grid grid-cols-3 gap-2"><Readout label="∠A" value={`${r(angA, 1)}°`} /><Readout label="∠B" value={`${r(angB, 1)}°`} /><Readout label="∠C" value={`${r(angC, 1)}°`} /></div>
      <div className="grid grid-cols-3 gap-2"><Readout label="a (BC)" value={r(a, 2)} /><Readout label="b (AC)" value={r(b, 2)} /><Readout label="c (AB)" value={r(c, 2)} /></div>
      <div className="grid grid-cols-2 gap-2"><Readout label="Area" value={`${r(area, 2)} u²`} /><Readout label="Perimeter" value={`${r(a + b + c, 2)} u`} /></div>
      <p className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-800">{kind}, {sideKind} triangle. Angles add up to {r(angA + angB + angC, 1)}°.</p>
      {kind === 'Right-angled' && <p className="text-sm">Pythagoras: {r(sorted[0], 2)}² + {r(sorted[1], 2)}² = {r(sorted[0] ** 2 + sorted[1] ** 2, 2)} ≈ {r(sorted[2], 2)}² = {r(sorted[2] ** 2, 2)}</p>}
      <Button size="sm" variant="secondary" onClick={() => setPts([[60, 260], [300, 260], [60, 80]])}>Make a 3-4-5 style right triangle</Button>
    </>}>
      <p className="mb-2 text-sm text-ink-500">Drag the corners A, B and C. One grid square = 1 unit.</p>
      <svg ref={svgRef} viewBox="0 0 400 300" className="w-full touch-none rounded-xl bg-surface" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)} role="img" aria-label={`Triangle with angles ${r(angA, 0)}, ${r(angB, 0)} and ${r(angC, 0)} degrees`}>
        {Array.from({ length: 21 }, (_, i) => <line key={`v${i}`} x1={i * 20} x2={i * 20} y1={0} y2={300} stroke="var(--color-ink-100)" />)}
        {Array.from({ length: 16 }, (_, i) => <line key={`h${i}`} y1={i * 20} y2={i * 20} x1={0} x2={400} stroke="var(--color-ink-100)" />)}
        <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="var(--color-brand-100)" fillOpacity="0.6" stroke="var(--color-brand-600)" strokeWidth="2.5" />
        {pts.map((p, i) => (
          <g key={i} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(i); }} className="cursor-grab">
            <circle cx={p[0]} cy={p[1]} r="14" fill="transparent" /><circle cx={p[0]} cy={p[1]} r="7" fill="var(--color-sun-500)" stroke="var(--color-ink-800)" strokeWidth="1.5" />
            <text x={p[0] + 10} y={p[1] - 10} fontWeight="700" fontSize="14" fill="var(--color-ink-800)">{'ABC'[i]}</text>
          </g>
        ))}
      </svg>
    </Panel>
  );
}

// ---------------------------------------------------------------- Fractions
function FractionBar({ n, d, color }: { n: number; d: number; color: string }) {
  const parts = Math.min(Math.max(d, 1), 24);
  const whole = Math.floor(n / d);
  const bars = Math.min(Math.max(1, Math.ceil(n / d)), 4);
  return (
    <div className="space-y-1">{Array.from({ length: bars }, (_, b) => (
      <div key={b} className="flex h-8 overflow-hidden rounded-lg border border-ink-300">{Array.from({ length: parts }, (_, i) => {
        const filled = b < whole || (b === whole && i < n % d);
        return <div key={i} className={cn('flex-1 border-r border-ink-200 last:border-r-0')} style={{ background: filled ? color : 'transparent' }} />;
      })}</div>
    ))}</div>
  );
}
function Fractions() {
  const [f, setF] = useState({ a: 1, b: 2, c: 1, d: 3 });
  const [op, setOp] = useState<'+' | '-' | '×' | '÷'>('+');
  let n: number, d: number;
  if (op === '+') { n = f.a * f.d + f.c * f.b; d = f.b * f.d; } else if (op === '-') { n = f.a * f.d - f.c * f.b; d = f.b * f.d; } else if (op === '×') { n = f.a * f.c; d = f.b * f.d; } else { n = f.a * f.d; d = f.b * f.c; }
  const valid = f.b !== 0 && f.d !== 0 && d !== 0;
  const g = valid ? gcd(n, d) : 1;
  const sn = (n / g) * Math.sign(d), sd = Math.abs(d / g);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.max(k === 'a' || k === 'c' ? 0 : 1, Math.min(99, Math.round(Number(e.target.value) || 0))) });
  const lcd = (f.b * f.d) / gcd(f.b, f.d);
  return (
    <Panel side={<>
      <div className="flex items-center gap-2">
        <div className="w-16 space-y-1"><Input type="number" value={f.a} onChange={set('a')} aria-label="First numerator" /><Input type="number" value={f.b} onChange={set('b')} aria-label="First denominator" /></div>
        <Select value={op} onChange={(e) => setOp(e.target.value as typeof op)} className="w-16" aria-label="Operation">{['+', '-', '×', '÷'].map((o) => <option key={o}>{o}</option>)}</Select>
        <div className="w-16 space-y-1"><Input type="number" value={f.c} onChange={set('c')} aria-label="Second numerator" /><Input type="number" value={f.d} onChange={set('d')} aria-label="Second denominator" /></div>
      </div>
      {valid ? (<>
        <Readout label="Result" value={sd === 1 ? `${sn}` : `${sn}/${sd}`} hint={Math.abs(sn) > sd && sd !== 1 ? `= ${Math.trunc(sn / sd)} ${Math.abs(sn % sd)}/${sd} (mixed number)` : `≈ ${r(sn / sd, 4)}`} />
        <ol className="space-y-1 text-sm">
          {(op === '+' || op === '-') && <><li>Common denominator (LCD) = {lcd}</li><li>{f.a}/{f.b} = {f.a * (lcd / f.b)}/{lcd} and {f.c}/{f.d} = {f.c * (lcd / f.d)}/{lcd}</li><li>{op === '+' ? 'Add' : 'Subtract'} numerators: {f.a * (lcd / f.b)} {op} {f.c * (lcd / f.d)} = {f.a * (lcd / f.b) + (op === '+' ? 1 : -1) * f.c * (lcd / f.d)}</li></>}
          {op === '×' && <li>Multiply tops and bottoms: ({f.a}×{f.c})/({f.b}×{f.d}) = {n}/{d}</li>}
          {op === '÷' && <li>Flip the second fraction and multiply: {f.a}/{f.b} × {f.d}/{f.c} = {n}/{d}</li>}
          <li>Simplify by dividing by the HCF {Math.abs(g)}: {sd === 1 ? sn : `${sn}/${sd}`}</li>
        </ol>
      </>) : <Alert tone="warning">A denominator can’t be zero.</Alert>}
    </>}>
      <div className="space-y-5">
        <div><p className="mb-1 text-sm font-semibold">{f.a}/{f.b}</p><FractionBar n={f.a} d={f.b} color="var(--color-brand-500)" /></div>
        <div><p className="mb-1 text-sm font-semibold">{f.c}/{f.d}</p><FractionBar n={f.c} d={f.d} color="var(--color-growth-500)" /></div>
        {valid && sn >= 0 && <div><p className="mb-1 text-sm font-semibold">Result: {sd === 1 ? sn : `${sn}/${sd}`}</p><FractionBar n={sn} d={sd} color="var(--color-sun-500)" /></div>}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Probability
function Probability() {
  const [kind, setKind] = useState<'coin' | 'die' | 'two-dice'>('die');
  const [trials, setTrials] = useState(100);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const outcomes = kind === 'coin' ? ['Heads', 'Tails'] : kind === 'die' ? ['1', '2', '3', '4', '5', '6'] : Array.from({ length: 11 }, (_, i) => String(i + 2));
  const theory = (o: string) => (kind === 'coin' ? 1 / 2 : kind === 'die' ? 1 / 6 : (6 - Math.abs(7 - Number(o))) / 36);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const roll = () => {
    const next = { ...counts };
    const rnd = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 2 ** 32; };
    for (let i = 0; i < trials; i++) {
      const o = kind === 'coin' ? (rnd() < 0.5 ? 'Heads' : 'Tails') : kind === 'die' ? String(1 + Math.floor(rnd() * 6)) : String(2 + Math.floor(rnd() * 6) + Math.floor(rnd() * 6));
      next[o] = (next[o] ?? 0) + 1;
    }
    setCounts(next);
  };
  const maxP = Math.max(...outcomes.map((o) => Math.max(theory(o), total ? (counts[o] ?? 0) / total : 0)));
  return (
    <Panel side={<>
      <div className="flex gap-1.5">{(['coin', 'die', 'two-dice'] as const).map((k) => <Button key={k} size="sm" variant={kind === k ? 'primary' : 'secondary'} className="flex-1" onClick={() => { setKind(k); setCounts({}); }}>{k === 'coin' ? 'Coin' : k === 'die' ? 'One die' : 'Two dice (sum)'}</Button>)}</div>
      <Field label="Trials per run"><Select value={trials} onChange={(e) => setTrials(Number(e.target.value))}>{[1, 10, 100, 1000, 10000].map((t) => <option key={t} value={t}>{t.toLocaleString()}</option>)}</Select></Field>
      <div className="flex gap-2"><Button className="flex-1" onClick={roll} leftIcon={<Dices className="h-4 w-4" />}>Run</Button><Button variant="secondary" onClick={() => setCounts({})}>Reset</Button></div>
      <Readout label="Total trials" value={total.toLocaleString()} />
      <p className="text-sm text-ink-600">The <b>law of large numbers</b>: as trials increase, experimental probability gets closer to the theoretical probability (dashed line).</p>
    </>}>
      <svg viewBox={`0 0 ${outcomes.length * 54 + 20} 240`} className="w-full" role="img" aria-label="Experimental versus theoretical probability">
        {outcomes.map((o, i) => {
          const exp = total ? (counts[o] ?? 0) / total : 0;
          const h = (exp / maxP) * 170; const th = 200 - (theory(o) / maxP) * 170;
          return (<g key={o} transform={`translate(${i * 54 + 14} 0)`}>
            <rect x="0" y={200 - h} width="40" height={h} rx="4" fill="var(--color-growth-500)" />
            <line x1="-4" x2="44" y1={th} y2={th} stroke="var(--color-ink-800)" strokeDasharray="4 3" strokeWidth="1.5" />
            <text x="20" y="216" fontSize="11" textAnchor="middle" fill="var(--color-ink-700)">{o}</text>
            <text x="20" y="232" fontSize="9" textAnchor="middle" fill="var(--color-ink-500)">{total ? r(exp, 3) : ''}</text>
          </g>);
        })}
      </svg>
    </Panel>
  );
}

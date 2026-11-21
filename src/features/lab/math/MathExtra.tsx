import { useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/features/preferences/PreferencesProvider';
import { Readout, Slider } from '../LabToolShell';

const r2 = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Math.round(n * 100) / 100);
type Pt = [number, number];

// ---------------------------------------------------------------- Transformations
const SHAPES: Record<string, Pt[]> = { Triangle: [[1, 1], [4, 1], [1, 3]], Flag: [[1, 1], [1, 5], [3, 4], [1, 3]], 'L-shape': [[1, 1], [3, 1], [3, 2], [2, 2], [2, 4], [1, 4]], Square: [[1, 1], [3, 1], [3, 3], [1, 3]] };
type Op = 'reflect' | 'rotate' | 'translate' | 'enlarge';
function transform(p: Pt, op: Op, o: { line: string; k: number; angle: number; cx: number; cy: number; a: number; b: number; scale: number }): Pt {
  const [x, y] = p;
  if (op === 'translate') return [x + o.a, y + o.b];
  if (op === 'enlarge') return [o.cx + o.scale * (x - o.cx), o.cy + o.scale * (y - o.cy)];
  if (op === 'rotate') { const t = (o.angle * Math.PI) / 180, dx = x - o.cx, dy = y - o.cy; return [o.cx + dx * Math.cos(t) - dy * Math.sin(t), o.cy + dx * Math.sin(t) + dy * Math.cos(t)]; }
  switch (o.line) { case 'x-axis': return [x, -y]; case 'y-axis': return [-x, y]; case 'y=x': return [y, x]; case 'y=-x': return [-y, -x]; case 'x=k': return [2 * o.k - x, y]; default: return [x, 2 * o.k - y]; }
}
export function Transformations() {
  const { prefs } = usePrefs();
  const [shape, setShape] = useState('Triangle');
  const [op, setOp] = useState<Op>('reflect');
  const [o, setO] = useState({ line: 'y-axis', k: 0, angle: 90, cx: 0, cy: 0, a: 3, b: -4, scale: 2 });
  const [t, setT] = useState(1);
  const obj = SHAPES[shape];
  const img = obj.map((p) => transform(p, op, o));
  const anim = obj.map((p, i) => [p[0] + (img[i][0] - p[0]) * t, p[1] + (img[i][1] - p[1]) * t] as Pt);
  const raf = useRef(0);
  const play = () => {
    if (prefs.reduceMotion) return setT(1);
    cancelAnimationFrame(raf.current); const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 900); setT(1 - Math.pow(1 - k, 3)); if (k < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const S = 20, Z = 10; const X = (v: number) => (v + Z) * S, Y = (v: number) => (Z - v) * S;
  const L = (i: number) => 'ABCDEF'[i];
  const desc = op === 'reflect' ? `Reflection in ${o.line === 'x=k' ? `x = ${o.k}` : o.line === 'y=k' ? `y = ${o.k}` : o.line}` : op === 'rotate' ? `Rotation of ${o.angle}° ${o.angle > 0 ? 'anticlockwise' : 'clockwise'} about (${o.cx}, ${o.cy})` : op === 'translate' ? `Translation by vector (${o.a}, ${o.b})` : `Enlargement, scale factor ${o.scale}, centre (${o.cx}, ${o.cy})`;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
      <Card className="overflow-hidden"><div className="p-3 sm:p-5">
        <svg viewBox={`0 0 ${2 * Z * S} ${2 * Z * S}`} className="mx-auto w-full max-w-xl rounded-xl bg-surface" role="img" aria-label={desc}>
          {Array.from({ length: 2 * Z + 1 }, (_, i) => <g key={i}><line x1={i * S} x2={i * S} y1={0} y2={2 * Z * S} stroke="var(--color-ink-100)" /><line y1={i * S} y2={i * S} x1={0} x2={2 * Z * S} stroke="var(--color-ink-100)" /></g>)}
          <line x1={0} x2={2 * Z * S} y1={Y(0)} y2={Y(0)} stroke="var(--color-ink-500)" /><line y1={0} y2={2 * Z * S} x1={X(0)} x2={X(0)} stroke="var(--color-ink-500)" />
          {op === 'reflect' && (() => { const l = o.line; const pts = l === 'x-axis' ? [[-Z, 0], [Z, 0]] : l === 'y-axis' ? [[0, -Z], [0, Z]] : l === 'y=x' ? [[-Z, -Z], [Z, Z]] : l === 'y=-x' ? [[-Z, Z], [Z, -Z]] : l === 'x=k' ? [[o.k, -Z], [o.k, Z]] : [[-Z, o.k], [Z, o.k]]; return <line x1={X(pts[0][0])} y1={Y(pts[0][1])} x2={X(pts[1][0])} y2={Y(pts[1][1])} stroke="#e11d48" strokeWidth={2} strokeDasharray="6 4" />; })()}
          {(op === 'rotate' || op === 'enlarge') && <circle cx={X(o.cx)} cy={Y(o.cy)} r={4} fill="#e11d48" />}
          {op === 'enlarge' && obj.map((_p, i) => <line key={i} x1={X(o.cx)} y1={Y(o.cy)} x2={X(img[i][0])} y2={Y(img[i][1])} stroke="#e11d48" strokeOpacity={0.3} />)}
          <polygon points={obj.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill="var(--color-brand-500)" fillOpacity={0.35} stroke="var(--color-brand-600)" strokeWidth={2} />
          <polygon points={anim.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill="#f59f0b" fillOpacity={0.4} stroke="#d97706" strokeWidth={2} />
          {obj.map(([x, y], i) => <text key={`o${i}`} x={X(x) + 4} y={Y(y) - 4} fontSize={11} fontWeight={700} fill="var(--color-brand-700)">{L(i)}</text>)}
          {t > 0.99 && img.map(([x, y], i) => <text key={`i${i}`} x={X(x) + 4} y={Y(y) - 4} fontSize={11} fontWeight={700} fill="#b45309">{L(i)}′</text>)}
        </svg>
      </div></Card>
      <Card><CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Object"><Select value={shape} onChange={(e) => { setShape(e.target.value); setT(1); }}>{Object.keys(SHAPES).map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Transformation"><Select value={op} onChange={(e) => { setOp(e.target.value as Op); setT(0); }}><option value="reflect">Reflection</option><option value="rotate">Rotation</option><option value="translate">Translation</option><option value="enlarge">Enlargement</option></Select></Field>
        </div>
        {op === 'reflect' && <><Field label="Mirror line"><Select value={o.line} onChange={(e) => setO({ ...o, line: e.target.value })}>{['x-axis', 'y-axis', 'y=x', 'y=-x', 'x=k', 'y=k'].map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>{(o.line === 'x=k' || o.line === 'y=k') && <Slider label="k" value={o.k} min={-5} max={5} onChange={(k) => setO({ ...o, k })} />}</>}
        {op === 'rotate' && <><Field label="Angle"><Select value={o.angle} onChange={(e) => setO({ ...o, angle: Number(e.target.value) })}>{[90, 180, 270, -90].map((a) => <option key={a} value={a}>{a === -90 ? '90° clockwise' : `${a}° anticlockwise`}</option>)}</Select></Field><div className="grid grid-cols-2 gap-2"><Slider label="Centre x" value={o.cx} min={-5} max={5} onChange={(cx) => setO({ ...o, cx })} /><Slider label="Centre y" value={o.cy} min={-5} max={5} onChange={(cy) => setO({ ...o, cy })} /></div></>}
        {op === 'translate' && <div className="grid grid-cols-2 gap-2"><Slider label="Right/left (a)" value={o.a} min={-8} max={8} onChange={(a) => setO({ ...o, a })} /><Slider label="Up/down (b)" value={o.b} min={-8} max={8} onChange={(b) => setO({ ...o, b })} /></div>}
        {op === 'enlarge' && <><Field label="Scale factor"><Select value={o.scale} onChange={(e) => setO({ ...o, scale: Number(e.target.value) })}>{[3, 2, 1.5, 0.5, -1, -2].map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field><div className="grid grid-cols-2 gap-2"><Slider label="Centre x" value={o.cx} min={-5} max={5} onChange={(cx) => setO({ ...o, cx })} /><Slider label="Centre y" value={o.cy} min={-5} max={5} onChange={(cy) => setO({ ...o, cy })} /></div></>}
        <Button leftIcon={<Play className="h-4 w-4" />} onClick={play} className="w-full">Animate</Button>
        <p className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-800">{desc}</p>
        <table className="w-full text-sm"><thead><tr className="text-left text-ink-500"><th>Point</th><th>Object</th><th>Image</th></tr></thead>
          <tbody>{obj.map((p, i) => <tr key={i} className="border-t border-ink-100"><td className="py-1 font-bold">{L(i)}</td><td className="tabular-nums">({p[0]}, {p[1]})</td><td className="tabular-nums">({r2(img[i][0])}, {r2(img[i][1])})</td></tr>)}</tbody></table>
      </CardBody></Card>
    </div>
  );
}

// ---------------------------------------------------------------- Unit circle
const EXACT: Record<number, [string, string, string]> = { 0: ['0', '1', '0'], 30: ['1/2', '√3/2', '1/√3'], 45: ['1/√2', '1/√2', '1'], 60: ['√3/2', '1/2', '√3'], 90: ['1', '0', 'undefined'], 180: ['0', '−1', '0'], 270: ['−1', '0', 'undefined'], 360: ['0', '1', '0'] };
export function UnitCircle() {
  const [deg, setDeg] = useState(30);
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const t = (deg * Math.PI) / 180, s = Math.sin(t), c = Math.cos(t);
  const R = 90, CX = 110, CY = 110;
  const quad = deg % 360 < 90 ? 1 : deg % 360 < 180 ? 2 : deg % 360 < 270 ? 3 : 4;
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !svg.current) return;
    const r = svg.current.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * 220 - CX, y = CY - ((e.clientY - r.top) / r.height) * 220;
    setDeg(((Math.round((Math.atan2(y, x) * 180) / Math.PI) % 360) + 360) % 360);
  };
  const wave = (f: (x: number) => number) => Array.from({ length: 73 }, (_, i) => `${i === 0 ? 'M' : 'L'}${10 + i * (300 / 72)} ${60 - f((i * 5 * Math.PI) / 180) * 45}`).join(' ');
  const ex = EXACT[deg];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
      <Card><CardBody className="space-y-4">
        <svg ref={svg} viewBox="0 0 220 220" className="mx-auto w-full max-w-sm touch-none select-none" onPointerMove={onMove} onPointerUp={() => setDrag(false)} onPointerLeave={() => setDrag(false)} role="img" aria-label={`Angle ${deg} degrees`}>
          {[[1, 'All'], [2, 'Sin'], [3, 'Tan'], [4, 'Cos']].map(([q, l]) => <text key={q} x={q === 1 || q === 4 ? 180 : 22} y={q === 1 || q === 2 ? 30 : 200} fontSize={11} fontWeight={800} fill={quad === q ? 'var(--color-growth-600)' : 'var(--color-ink-300)'}>{l}</text>)}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-ink-300)" strokeWidth={2} />
          <line x1={10} x2={210} y1={CY} y2={CY} stroke="var(--color-ink-400)" /><line y1={10} y2={210} x1={CX} x2={CX} stroke="var(--color-ink-400)" />
          <path d={`M${CX + 20} ${CY} A20 20 0 ${deg > 180 ? 1 : 0} 0 ${CX + 20 * c} ${CY - 20 * s}`} fill="none" stroke="#f59f0b" strokeWidth={2} />
          <line x1={CX} y1={CY} x2={CX + R * c} y2={CY - R * s} stroke="var(--color-brand-600)" strokeWidth={3} />
          <line x1={CX + R * c} y1={CY} x2={CX + R * c} y2={CY - R * s} stroke="#e11d48" strokeWidth={3} />
          <line x1={CX} y1={CY} x2={CX + R * c} y2={CY} stroke="var(--color-growth-600)" strokeWidth={3} />
          <circle cx={CX + R * c} cy={CY - R * s} r={9} fill="var(--color-brand-600)" stroke="white" strokeWidth={2} className="cursor-grab" onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(true); }} />
        </svg>
        <svg viewBox="0 0 320 120" className="w-full" role="img" aria-label="Sine and cosine graphs">
          <line x1={10} x2={310} y1={60} y2={60} stroke="var(--color-ink-300)" />
          <path d={wave(Math.sin)} fill="none" stroke="#e11d48" strokeWidth={2} /><path d={wave(Math.cos)} fill="none" stroke="var(--color-growth-600)" strokeWidth={2} />
          <line x1={10 + (deg / 360) * 300} x2={10 + (deg / 360) * 300} y1={10} y2={110} stroke="var(--color-brand-500)" strokeDasharray="3 3" />
          <circle cx={10 + (deg / 360) * 300} cy={60 - s * 45} r={4} fill="#e11d48" /><circle cx={10 + (deg / 360) * 300} cy={60 - c * 45} r={4} fill="var(--color-growth-600)" />
          <text x={300} y={20} fontSize={9} textAnchor="end" fill="#e11d48">sin θ</text><text x={300} y={32} fontSize={9} textAnchor="end" fill="var(--color-growth-600)">cos θ</text>
        </svg>
      </CardBody></Card>
      <Card><CardBody className="space-y-3">
        <Slider label="Angle θ" value={deg} min={0} max={360} unit="°" onChange={setDeg} />
        <div className="flex flex-wrap gap-1">{[0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270, 300, 330].map((a) => <button key={a} onClick={() => setDeg(a)} className={cn('rounded-lg border px-2 py-1 text-xs font-semibold', deg === a ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200')}>{a}°</button>)}</div>
        <div className="grid grid-cols-3 gap-2">
          <Readout label="sin θ" value={r2(s).toFixed(2)} hint={ex?.[0]} /><Readout label="cos θ" value={r2(c).toFixed(2)} hint={ex?.[1]} /><Readout label="tan θ" value={Math.abs(c) < 1e-9 ? '∞' : r2(s / c).toFixed(2)} hint={ex?.[2]} />
        </div>
        <p className="rounded-xl bg-ink-50 p-3 text-sm">Quadrant {quad}: <b>{['All are positive', 'Only sin is positive', 'Only tan is positive', 'Only cos is positive'][quad - 1]}</b> (CAST). sin²θ + cos²θ = {(s * s + c * c).toFixed(2)}.</p>
        <p className="text-xs text-ink-500">Drag the blue point. Red is sin θ (height), green is cos θ (width) of the right-angled triangle in a circle of radius 1.</p>
      </CardBody></Card>
    </div>
  );
}

// ---------------------------------------------------------------- Sequences & series
export function Sequences() {
  const [kind, setKind] = useState<'ap' | 'gp'>('ap');
  const [a, setA] = useState(2);
  const [d, setD] = useState(3);
  const [r, setR] = useState(2);
  const [n, setN] = useState(10);
  const terms = useMemo(() => Array.from({ length: n }, (_, i) => (kind === 'ap' ? a + i * d : a * Math.pow(r, i))), [kind, a, d, r, n]);
  const sums = terms.reduce<number[]>((acc, t) => [...acc, (acc[acc.length - 1] ?? 0) + t], []);
  const Tn = kind === 'ap' ? a + (n - 1) * d : a * Math.pow(r, n - 1);
  const Sn = kind === 'ap' ? (n / 2) * (2 * a + (n - 1) * d) : r === 1 ? a * n : (a * (1 - Math.pow(r, n))) / (1 - r);
  const max = Math.max(1, ...terms.map(Math.abs), ...sums.map(Math.abs));
  const fmt = (x: number) => (Math.abs(x) >= 1e6 ? x.toExponential(2) : r2(x).toString());
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
      <Card><CardBody className="space-y-3">
        <svg viewBox="0 0 400 220" className="w-full" role="img" aria-label="Terms and running totals">
          <line x1={20} x2={390} y1={110} y2={110} stroke="var(--color-ink-300)" />
          {terms.map((t, i) => { const w = 360 / n; const h = (t / max) * 95; const sh = (sums[i] / max) * 95; return (<g key={i}>
            <rect x={22 + i * w} y={h >= 0 ? 110 - h : 110} width={w * 0.45} height={Math.abs(h)} fill="var(--color-brand-500)" rx={2} />
            <rect x={22 + i * w + w * 0.48} y={sh >= 0 ? 110 - sh : 110} width={w * 0.45} height={Math.abs(sh)} fill="#f59f0b" fillOpacity={0.6} rx={2} />
            {n <= 12 && <text x={22 + i * w + w * 0.45} y={215} fontSize={9} textAnchor="middle" fill="var(--color-ink-500)">T{i + 1}</text>}
          </g>); })}
        </svg>
        <p className="flex gap-4 text-xs"><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-500" />term Tₙ</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sun-400" />sum Sₙ</span></p>
        <p className="font-mono text-sm text-ink-700">{terms.slice(0, 12).map(fmt).join(', ')}{n > 12 ? ', …' : ''}</p>
      </CardBody></Card>
      <Card><CardBody className="space-y-3">
        <div className="flex gap-1.5">{(['ap', 'gp'] as const).map((k) => <Button key={k} size="sm" variant={kind === k ? 'primary' : 'secondary'} className="flex-1" onClick={() => setKind(k)}>{k === 'ap' ? 'Arithmetic (AP)' : 'Geometric (GP)'}</Button>)}</div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="First term a"><Input type="number" value={a} onChange={(e) => setA(Number(e.target.value))} /></Field>
          {kind === 'ap' ? <Field label="Difference d"><Input type="number" value={d} onChange={(e) => setD(Number(e.target.value))} /></Field> : <Field label="Ratio r"><Input type="number" step="0.1" value={r} onChange={(e) => setR(Number(e.target.value))} /></Field>}
          <Field label="Terms n"><Input type="number" min={1} max={30} value={n} onChange={(e) => setN(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2"><Readout label={`T${n}`} value={fmt(Tn)} hint={kind === 'ap' ? 'a + (n − 1)d' : 'arⁿ⁻¹'} /><Readout label={`S${n}`} value={fmt(Sn)} hint={kind === 'ap' ? 'n/2 [2a + (n − 1)d]' : 'a(1 − rⁿ)/(1 − r)'} /></div>
        {kind === 'gp' && Math.abs(r) < 1 && <Readout label="Sum to infinity" value={fmt(a / (1 - r))} hint="a / (1 − r), since |r| < 1" />}
        <p className="text-xs text-ink-500">Check: adding the terms one by one gives {fmt(sums[sums.length - 1] ?? 0)} — the same as the formula.</p>
      </CardBody></Card>
    </div>
  );
}

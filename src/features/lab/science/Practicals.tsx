import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Flame, Pause, Play, Plus, RotateCcw, Shuffle, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, Select } from '@/components/ui';
import { downloadCsv } from '@/lib/utils';
import { Readout, Slider } from '../LabToolShell';

/** A lab notebook: recorded readings, an auto-plotted graph and a best-fit line. */
export function ResultsTable({ columns, rows, onClear, xLabel, yLabel, fit, title = 'Results' }: { columns: string[]; rows: (string | number)[][]; onClear: () => void; xLabel?: string; yLabel?: string; fit?: boolean; title?: string }) {
  const nums = rows.map((r) => [Number(r[0]), Number(r[1])]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const showGraph = xLabel && nums.length >= 2;
  const maxX = Math.max(1e-9, ...nums.map((p) => p[0])), maxY = Math.max(1e-9, ...nums.map((p) => p[1]));
  let m = 0, c = 0;
  if (fit && nums.length >= 2) { const n = nums.length, sx = nums.reduce((a, p) => a + p[0], 0), sy = nums.reduce((a, p) => a + p[1], 0), sxy = nums.reduce((a, p) => a + p[0] * p[1], 0), sxx = nums.reduce((a, p) => a + p[0] * p[0], 0); m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); c = (sy - m * sx) / n; }
  const X = (x: number) => 40 + (x / maxX) * 260, Y = (y: number) => 170 - (y / maxY) * 150;
  return (
    <Card><CardBody className="space-y-3">
      <div className="flex items-center justify-between"><p className="font-bold">{title} <span className="text-xs font-normal text-ink-500">({rows.length})</span></p>
        <div className="flex gap-1">{rows.length > 0 && <><Button size="sm" variant="ghost" onClick={() => downloadCsv('lab-results.csv', rows.map((r) => Object.fromEntries(columns.map((col, i) => [col, r[i]]))))} aria-label="Download CSV"><Download className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear results"><Trash2 className="h-4 w-4" /></Button></>}</div></div>
      {rows.length ? (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-ink-200"><table className="w-full text-sm"><thead className="sticky top-0 bg-ink-50"><tr>{columns.map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-ink-100">{r.map((v, j) => <td key={j} className="px-2 py-1 tabular-nums">{v}</td>)}</tr>)}</tbody></table></div>
      ) : <p className="text-sm text-ink-500">Take readings to fill your table.</p>}
      {showGraph && (
        <svg viewBox="0 0 320 200" className="w-full rounded-xl bg-surface" role="img" aria-label={`Graph of ${yLabel} against ${xLabel}`}>
          <line x1={40} y1={170} x2={305} y2={170} stroke="var(--color-ink-400)" /><line x1={40} y1={15} x2={40} y2={170} stroke="var(--color-ink-400)" />
          <text x={172} y={194} textAnchor="middle" fontSize={10} fill="var(--color-ink-500)">{xLabel}</text>
          <text x={12} y={95} fontSize={10} fill="var(--color-ink-500)" transform="rotate(-90 12 95)" textAnchor="middle">{yLabel}</text>
          {fit && <line x1={X(0)} y1={Y(c)} x2={X(maxX)} y2={Y(m * maxX + c)} stroke="var(--color-brand-400)" strokeDasharray="4 3" />}
          {nums.map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r={3.5} fill="var(--color-brand-600)" />)}
        </svg>
      )}
      {fit && nums.length >= 2 && <p className="text-sm">Gradient of best-fit line: <b className="tabular-nums">{m.toFixed(3)}</b></p>}
    </CardBody></Card>
  );
}

// ---------------------------------------------------------------- Flame tests
const SALTS = [
  { ion: 'Lithium (Li⁺)', salt: 'Lithium chloride', color: '#dc143c', name: 'crimson red' },
  { ion: 'Sodium (Na⁺)', salt: 'Sodium chloride', color: '#ffb020', name: 'golden yellow' },
  { ion: 'Potassium (K⁺)', salt: 'Potassium chloride', color: '#c8a2c8', name: 'lilac' },
  { ion: 'Calcium (Ca²⁺)', salt: 'Calcium chloride', color: '#e2583e', name: 'brick red (orange-red)' },
  { ion: 'Copper (Cu²⁺)', salt: 'Copper(II) chloride', color: '#16c79a', name: 'blue-green' },
  { ion: 'Barium (Ba²⁺)', salt: 'Barium chloride', color: '#9acd32', name: 'apple (pale) green' },
  { ion: 'Strontium (Sr²⁺)', salt: 'Strontium chloride', color: '#ff2400', name: 'scarlet red' },
];
export function FlameTest() {
  const [pick, setPick] = useState(0);
  const [heating, setHeating] = useState(false);
  const [mystery, setMystery] = useState<number | null>(null);
  const [guess, setGuess] = useState('');
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const cur = mystery ?? pick;
  const s = SALTS[cur];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card className="overflow-hidden"><div className="grid place-items-center bg-[#0b1222] p-6" data-no-contrast>
        <svg viewBox="0 0 200 260" className="h-72" role="img" aria-label={heating ? `Flame colour: ${mystery == null ? s.name : 'observe it'}` : 'Bunsen burner'}>
          <defs><radialGradient id="fl" cx="50%" cy="70%" r="60%"><stop offset="0%" stopColor="#fff" stopOpacity=".9" /><stop offset="35%" stopColor={heating ? s.color : '#3b82f6'} stopOpacity=".95" /><stop offset="100%" stopColor={heating ? s.color : '#1d4ed8'} stopOpacity="0" /></radialGradient></defs>
          <ellipse cx={100} cy={heating ? 110 : 140} rx={heating ? 34 : 18} ry={heating ? 70 : 40} fill="url(#fl)" className="motion-safe:animate-pulse" />
          <rect x={88} y={170} width={24} height={60} fill="#64748b" /><rect x={70} y={228} width={60} height={12} rx={3} fill="#475569" />
          {heating && <g><line x1={160} y1={60} x2={112} y2={130} stroke="#cbd5e1" strokeWidth={3} /><circle cx={110} cy={133} r={4} fill="#f8fafc" /></g>}
        </svg>
        <p className="mt-2 text-sm text-ink-300">{heating ? (mystery == null ? <>Flame colour: <b style={{ color: s.color }}>{s.name}</b></> : 'What colour do you see?') : 'Dip the nichrome wire in the salt, then hold it in the flame.'}</p>
      </div></Card>
      <div className="space-y-4">
        <Card><CardBody className="space-y-3">
          {mystery == null ? (
            <label className="block text-sm font-semibold">Salt<Select className="mt-1" value={pick} onChange={(e) => { setPick(Number(e.target.value)); setHeating(false); }}>{SALTS.map((x, i) => <option key={x.salt} value={i}>{x.salt}</option>)}</Select></label>
          ) : <Badge tone="violet">Mystery salt — identify the metal ion</Badge>}
          <div className="flex gap-2">
            <Button className="flex-1" leftIcon={<Flame className="h-4 w-4" />} onClick={() => setHeating(true)}>Heat in flame</Button>
            {mystery == null && heating && <Button variant="secondary" onClick={() => setRows((r) => [...r, [s.salt, s.ion, s.name]])} leftIcon={<Plus className="h-4 w-4" />}>Record</Button>}
          </div>
          {mystery == null ? <Button size="sm" variant="ghost" leftIcon={<Shuffle className="h-4 w-4" />} onClick={() => { setMystery(Math.floor(Math.random() * SALTS.length)); setHeating(false); setGuess(''); }}>Try a mystery salt</Button> : (
            <div className="space-y-2">
              <Select value={guess} onChange={(e) => setGuess(e.target.value)} aria-label="Your answer"><option value="">The metal ion is…</option>{SALTS.map((x) => <option key={x.ion}>{x.ion}</option>)}</Select>
              {guess && <Alert tone={guess === s.ion ? 'success' : 'error'}>{guess === s.ion ? `Correct! ${s.ion} gives a ${s.name} flame.` : 'Not quite — compare the colour with your results table.'}</Alert>}
              <Button size="sm" variant="secondary" onClick={() => { setMystery(null); setHeating(false); }}>Back to known salts</Button>
            </div>
          )}
          <p className="text-xs text-ink-500">Clean the wire in concentrated HCl between tests so colours don’t mix. Sodium’s yellow can mask other colours.</p>
        </CardBody></Card>
        <ResultsTable columns={['Salt', 'Metal ion', 'Flame colour']} rows={rows} onClear={() => setRows([])} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Gas tests
const GASES = ['Hydrogen', 'Oxygen', 'Carbon dioxide', 'Ammonia', 'Chlorine', 'Sulfur dioxide'] as const;
const TESTS = ['Burning splint', 'Glowing splint', 'Limewater', 'Damp red litmus', 'Damp blue litmus', 'Acidified potassium dichromate'] as const;
function gasResult(g: (typeof GASES)[number], t: (typeof TESTS)[number]): { text: string; positive: boolean } {
  const m: Record<string, string> = {
    'Hydrogen|Burning splint': 'Burns with a squeaky “pop”', 'Oxygen|Glowing splint': 'The glowing splint relights', 'Oxygen|Burning splint': 'Burns more brightly',
    'Carbon dioxide|Limewater': 'Limewater turns milky (white precipitate of CaCO₃)', 'Carbon dioxide|Burning splint': 'The flame goes out', 'Carbon dioxide|Damp blue litmus': 'Turns slightly red (weakly acidic)',
    'Ammonia|Damp red litmus': 'Turns blue (alkaline gas)', 'Chlorine|Damp blue litmus': 'Turns red, then is bleached white', 'Chlorine|Damp red litmus': 'Bleached white',
    'Sulfur dioxide|Acidified potassium dichromate': 'Changes from orange to green', 'Sulfur dioxide|Damp blue litmus': 'Turns red (acidic gas)', 'Sulfur dioxide|Burning splint': 'The flame goes out',
    'Ammonia|Burning splint': 'Does not burn in air; flame may go out',
  };
  const key = `${g}|${t}`;
  const positive = ['Hydrogen|Burning splint', 'Oxygen|Glowing splint', 'Carbon dioxide|Limewater', 'Ammonia|Damp red litmus', 'Chlorine|Damp blue litmus', 'Sulfur dioxide|Acidified potassium dichromate'].includes(key);
  return { text: m[key] ?? 'No visible change', positive };
}
export function GasTests() {
  const [gas, setGas] = useState<(typeof GASES)[number]>('Hydrogen');
  const [test, setTest] = useState<(typeof TESTS)[number]>('Burning splint');
  const [done, setDone] = useState(false);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const r = gasResult(gas, test);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card><CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Gas collected in the test tube<Select className="mt-1" value={gas} onChange={(e) => { setGas(e.target.value as typeof gas); setDone(false); }}>{GASES.map((g) => <option key={g}>{g}</option>)}</Select></label>
          <label className="text-sm font-semibold">Test<Select className="mt-1" value={test} onChange={(e) => { setTest(e.target.value as typeof test); setDone(false); }}>{TESTS.map((t) => <option key={t}>{t}</option>)}</Select></label>
        </div>
        <div className="grid place-items-center rounded-2xl bg-ink-50 py-6">
          <svg viewBox="0 0 160 200" className="h-56" role="img" aria-label={`${test} on ${gas}`}>
            <path d="M55 20 h50 v130 a25 25 0 0 1 -50 0 z" fill={done && test === 'Limewater' && gas === 'Carbon dioxide' ? '#f1f5f9' : done && test.includes('dichromate') ? (gas === 'Sulfur dioxide' ? '#22c55e' : '#f97316') : 'rgba(148,163,184,.15)'} stroke="var(--color-ink-500)" strokeWidth={2} />
            {test.includes('litmus') && <rect x={72} y={4} width={16} height={60} rx={2} fill={done ? (r.text.includes('blue') ? '#3b82f6' : r.text.includes('bleached') ? '#f8fafc' : r.text.includes('red') ? '#ef4444' : test.includes('red') ? '#ef4444' : '#3b82f6') : test.includes('red') ? '#ef4444' : '#3b82f6'} stroke="var(--color-ink-500)" />}
            {test.includes('splint') && <g><line x1={80} y1={0} x2={80} y2={50} stroke="#a16207" strokeWidth={5} />{(test === 'Burning splint' && !(done && (r.text.includes('goes out') || r.text.includes('may go out')))) || (test === 'Glowing splint' && done && r.positive) ? <ellipse cx={80} cy={52} rx={7} ry={12} fill="#f97316" className="motion-safe:animate-pulse" /> : <circle cx={80} cy={50} r={3} fill="#dc2626" />}</g>}
            {done && gas === 'Hydrogen' && test === 'Burning splint' && <text x={110} y={40} fontSize={16} fontWeight={800} fill="#dc2626">POP!</text>}
          </svg>
        </div>
        <div className="flex gap-2"><Button className="flex-1" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setDone(true)}>Carry out the test</Button>
          {done && <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setRows((x) => [...x, [gas, test, r.text]])}>Record</Button>}</div>
        {done && <Alert tone={r.positive ? 'success' : 'info'} title={r.positive ? `Positive test for ${gas.toLowerCase()}` : 'Observation'}>{r.text}</Alert>}
      </CardBody></Card>
      <ResultsTable columns={['Gas', 'Test', 'Observation']} rows={rows} onClear={() => setRows([])} />
    </div>
  );
}

// ---------------------------------------------------------------- Rates of reaction
export function ReactionRates() {
  const [conc, setConc] = useState(1);
  const [temp, setTemp] = useState(25);
  const [form, setForm] = useState<'ribbon' | 'powder'>('ribbon');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const last = useRef<number | null>(null);
  const nMg = 0.1 / 24.3, nHCl = 0.05 * conc;
  const vmax = Math.min(nMg, nHCl / 2) * 24000; // cm³ at room conditions
  const k = 0.018 * conc * Math.pow(2, (temp - 25) / 10) * (form === 'powder' ? 3 : 1);
  const vol = vmax * (1 - Math.exp(-k * t));
  useEffect(() => {
    if (!running) { last.current = null; return; }
    let raf = 0;
    const tick = (now: number) => { if (last.current != null) setT((x) => Math.min(300, x + ((now - last.current!) / 1000) * 5)); last.current = now; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  useEffect(() => { if (t >= 300) setRunning(false); }, [t]);
  const reset = () => { setRunning(false); setT(0); };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card><CardBody className="space-y-4">
        <p className="text-sm text-ink-600">Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g). 0.10 g magnesium in 50 cm³ of acid; hydrogen is collected in a gas syringe.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Slider label="HCl concentration" value={conc} min={0.2} max={2} step={0.1} unit="mol/dm³" onChange={(v) => { setConc(v); reset(); }} />
          <Slider label="Temperature" value={temp} min={15} max={65} unit="°C" onChange={(v) => { setTemp(v); reset(); }} />
          <label className="text-sm font-semibold">Magnesium<Select className="mt-1" value={form} onChange={(e) => { setForm(e.target.value as typeof form); reset(); }}><option value="ribbon">Ribbon</option><option value="powder">Powder (larger surface area)</option></Select></label>
        </div>
        <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label={`Gas syringe reading ${vol.toFixed(0)} cubic centimetres`}>
          <rect x={20} y={40} width={300} height={36} rx={6} fill="var(--color-surface)" stroke="var(--color-ink-500)" strokeWidth={2} />
          {Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={20 + i * 30} y1={40} x2={20 + i * 30} y2={50} stroke="var(--color-ink-400)" /><text x={20 + i * 30} y={95} fontSize={9} textAnchor="middle" fill="var(--color-ink-500)">{i * 10}</text></g>)}
          <rect x={20 + Math.min(vol, 100) * 3} y={44} width={8} height={28} fill="var(--color-ink-600)" /><rect x={28 + Math.min(vol, 100) * 3} y={56} width={60} height={4} fill="var(--color-ink-500)" />
          <text x={180} y={115} fontSize={10} textAnchor="middle" fill="var(--color-ink-500)">Gas syringe (cm³)</text>
        </svg>
        <div className="grid grid-cols-3 gap-2"><Readout label="Time" value={`${t.toFixed(0)} s`} /><Readout label="Volume H₂" value={`${vol.toFixed(1)} cm³`} /><Readout label="Max possible" value={`${vmax.toFixed(0)} cm³`} hint={nHCl / 2 < nMg ? 'Acid is limiting' : 'Mg is limiting'} /></div>
        <div className="flex flex-wrap gap-2">
          <Button leftIcon={running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} onClick={() => setRunning(!running)}>{running ? 'Pause' : t ? 'Continue' : 'Add magnesium'}</Button>
          <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} disabled={!t} onClick={() => setRows((r) => [...r, [Math.round(t), Number(vol.toFixed(1)), `${conc} M, ${temp}°C, ${form}`]])}>Record reading</Button>
          <Button variant="ghost" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={reset}>Reset</Button>
        </div>
        <p className="text-xs text-ink-500">Time runs 5× faster. Collision theory: more concentrated acid, higher temperature and a larger surface area all give more frequent successful collisions — a faster rate.</p>
      </CardBody></Card>
      <ResultsTable columns={['Time (s)', 'Volume (cm³)', 'Conditions']} rows={rows} onClear={() => setRows([])} xLabel="Time (s)" yLabel="Volume (cm³)" />
    </div>
  );
}

// ---------------------------------------------------------------- Indicators & household pH
const SUBSTANCES = [['Lemon juice', 2.2], ['Cola drink', 2.5], ['Vinegar', 2.9], ['Orange juice', 3.5], ['Tomato juice', 4.3], ['Milk', 6.6], ['Pure water', 7], ['Baking soda solution', 8.4], ['Toothpaste', 9.2], ['Soap solution', 10], ['Ammonia cleaner', 11.3], ['Bleach', 12.5]] as const;
const INDICATORS: Record<string, (ph: number) => [string, string]> = {
  'Litmus paper': (ph) => (ph < 5 ? ['#ef4444', 'red'] : ph > 8 ? ['#3b82f6', 'blue'] : ['#8b5cf6', 'purple']),
  Phenolphthalein: (ph) => (ph < 8.2 ? ['#f8fafc', 'colourless'] : ph < 10 ? ['#f9a8d4', 'pink'] : ['#db2777', 'deep pink']),
  'Methyl orange': (ph) => (ph < 3.1 ? ['#dc2626', 'red'] : ph < 4.4 ? ['#f97316', 'orange'] : ['#facc15', 'yellow']),
  'Universal indicator': (ph) => { const c = ['#dc2626', '#ea580c', '#f59e0b', '#facc15', '#a3e635', '#22c55e', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#4f46e5', '#7c3aed']; const n = ['red', 'red-orange', 'orange', 'yellow', 'yellow-green', 'green', 'green', 'blue-green', 'blue', 'blue', 'indigo', 'violet']; const i = Math.max(0, Math.min(11, Math.round(ph) - 1)); return [c[i], n[i]]; },
  'Sobolo (hibiscus) extract': (ph) => (ph < 4 ? ['#e11d48', 'bright red'] : ph < 7 ? ['#be185d', 'pink-red'] : ph < 8 ? ['#7e22ce', 'purple'] : ph < 11 ? ['#16a34a', 'green'] : ['#ca8a04', 'yellow']),
};
export function Indicators() {
  const [sub, setSub] = useState(0);
  const [ind, setInd] = useState('Universal indicator');
  const [added, setAdded] = useState(false);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const [name, ph] = SUBSTANCES[sub];
  const [color, cname] = INDICATORS[ind](ph);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card><CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Substance<Select className="mt-1" value={sub} onChange={(e) => { setSub(Number(e.target.value)); setAdded(false); }}>{SUBSTANCES.map(([n], i) => <option key={n} value={i}>{n}</option>)}</Select></label>
          <label className="text-sm font-semibold">Indicator<Select className="mt-1" value={ind} onChange={(e) => { setInd(e.target.value); setAdded(false); }}>{Object.keys(INDICATORS).map((k) => <option key={k}>{k}</option>)}</Select></label>
        </div>
        <div className="flex items-end justify-center gap-8 rounded-2xl bg-ink-50 py-6">
          <svg viewBox="0 0 80 140" className="h-40" role="img" aria-label={added ? `${ind} turns ${cname}` : name}>
            <path d="M15 10 h50 v95 a25 25 0 0 1 -50 0 z" fill={added ? color : 'rgba(186,230,253,.45)'} stroke="var(--color-ink-500)" strokeWidth={2} style={{ transition: 'fill .6s' }} />
          </svg>
        </div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setAdded(true)}>Add a few drops of indicator</Button>
          {added && <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setRows((r) => [...r, [name, ind, cname, ph < 6.5 ? 'acidic' : ph > 7.5 ? 'alkaline' : 'neutral']])}>Record</Button>}</div>
        {added && <Alert tone="info">{ind} turns <b>{cname}</b> in {name.toLowerCase()} — {ph < 6.5 ? 'an acidic' : ph > 7.5 ? 'an alkaline' : 'a neutral'} substance{ind === 'Universal indicator' ? ` (about pH ${Math.round(ph)})` : ''}.</Alert>}
        <p className="text-xs text-ink-500">Make your own indicator at home: soak dried sobolo (hibiscus) leaves in warm water and strain. It changes colour like the one here.</p>
      </CardBody></Card>
      <ResultsTable columns={['Substance', 'Indicator', 'Colour', 'Nature']} rows={rows} onClear={() => setRows([])} />
    </div>
  );
}

// ---------------------------------------------------------------- Hooke's law
const SPRINGS = { A: { k: 25, limit: 6 }, B: { k: 40, limit: 8 }, C: { k: 12, limit: 4 } } as const;
export function HookesLaw() {
  const [spring, setSpring] = useState<keyof typeof SPRINGS>('A');
  const [mass, setMass] = useState(0);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const s = SPRINGS[spring];
  const F = (mass / 1000) * 9.81;
  const x = useMemo(() => (F <= s.limit ? F / s.k : s.limit / s.k + Math.pow(F - s.limit, 1.4) / s.k * 1.8), [F, s]); // metres
  const xcm = x * 100;
  const past = F > s.limit;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card><CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Spring<Select className="mt-1" value={spring} onChange={(e) => { setSpring(e.target.value as keyof typeof SPRINGS); setMass(0); }}><option value="A">Spring A</option><option value="B">Spring B</option><option value="C">Spring C</option></Select></label>
          <Slider label="Load (slotted masses)" value={mass} min={0} max={1000} step={50} unit="g" onChange={setMass} />
        </div>
        <svg viewBox="0 0 220 300" className="mx-auto h-80" role="img" aria-label={`Extension ${xcm.toFixed(1)} centimetres`}>
          <rect x={20} y={10} width={180} height={8} fill="var(--color-ink-600)" />
          <rect x={150} y={18} width={22} height={270} fill="#fde68a" stroke="#a16207" />
          {Array.from({ length: 27 }, (_, i) => <g key={i}><line x1={150} x2={i % 5 === 0 ? 162 : 157} y1={30 + i * 10} y2={30 + i * 10} stroke="#713f12" /> {i % 5 === 0 && <text x={176} y={33 + i * 10} fontSize={8} fill="var(--color-ink-500)">{i}</text>}</g>)}
          <path d={`M80 18 ${Array.from({ length: 12 }, (_, i) => `L${i % 2 ? 95 : 65} ${18 + (i + 1) * ((40 + xcm * 10) / 12)}`).join(' ')} L80 ${58 + xcm * 10}`} fill="none" stroke="var(--color-ink-500)" strokeWidth={2.5} />
          <line x1={84} y1={58 + xcm * 10} x2={148} y2={58 + xcm * 10} stroke="#dc2626" strokeDasharray="2 2" />
          {mass > 0 && <rect x={62} y={60 + xcm * 10} width={36} height={8 + mass / 50} rx={2} fill="var(--color-ink-700)" />}
        </svg>
        <div className="grid grid-cols-3 gap-2"><Readout label="Force" value={`${F.toFixed(2)} N`} hint="F = mg" /><Readout label="Pointer reading" value={`${xcm.toFixed(1)} cm`} hint="extension" /><Readout label="Elastic?" value={past ? 'No!' : 'Yes'} hint={past ? 'Past the elastic limit' : 'Within the limit'} /></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setRows((r) => [...r, [Number(xcm.toFixed(1)), Number(F.toFixed(2)), mass]])}>Record reading</Button>
        <p className="text-xs text-ink-500">Hooke’s law: F = kx (up to the elastic limit). Plot force against extension; the gradient (in N/cm × 100) gives the spring constant k in N/m.</p>
      </CardBody></Card>
      <ResultsTable columns={['Extension (cm)', 'Force (N)', 'Mass (g)']} rows={rows} onClear={() => setRows([])} xLabel="Extension (cm)" yLabel="Force (N)" fit />
    </div>
  );
}

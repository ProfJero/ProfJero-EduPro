import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, Play, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { Alert, Button, ButtonLink, Card, CardBody, ErrorState, Input, LoadingBlock, ProgressBar } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, errorMessage } from '@/lib/utils';
import { CodeWorkspace } from '@/features/lab/code/CodeLab';
import type { LangId } from '@/features/lab/code/languages';
import type { TestResult } from '@/features/lab/code/runners';
import { GAME_META } from './ArenaHome';

type Started = { attempt_id: string; payload: Record<string, unknown>; time_limit_seconds: number; server_now: string; game: string; title: string };
type Result = { score: number; max_score: number; accuracy: number | null; time_ms: number; xp: number; first_clear: boolean; passed: boolean; detail: unknown; verified: boolean };

export function ArenaPlay() {
  const { slug } = useParams();
  const qc = useQueryClient();
  const ch = useQuery({ queryKey: ['arena-challenge', slug], queryFn: async () => unwrap(await supabase.from('arena_challenges').select('*').eq('slug', slug!).single()) });
  const [run, setRun] = useState<Started | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const answers = useRef<unknown>({});
  const start = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('arena_start', { p_challenge: ch.data!.id })) as unknown as Started,
    onSuccess: (s) => { answers.current = s.game === 'math_sprint' ? [] : {}; setResult(null); setRun(s); },
  });
  const submit = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('arena_submit', { p_attempt: run!.attempt_id, p_answers: answers.current as never })) as unknown as Result,
    onSuccess: (r) => { setResult(r); setRun(null); void qc.invalidateQueries({ queryKey: ['arena-summary'] }); void qc.invalidateQueries({ queryKey: ['arena-board'] }); },
  });
  const next = useQuery({
    queryKey: ['arena-next', ch.data?.track, ch.data?.level], enabled: Boolean(ch.data && result?.passed),
    queryFn: async () => unwrap(await supabase.from('arena_challenges').select('slug, title').eq('track', ch.data!.track).eq('level', ch.data!.level + 1).eq('status', 'published').maybeSingle()),
  });
  if (ch.isLoading) return <LoadingBlock />;
  if (ch.error || !ch.data) return <ErrorState error={ch.error ?? new Error('Challenge not found')} />;
  const c = ch.data;
  const meta = GAME_META[c.game];
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to="/arena" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />Arena</Link>
      <div className={cn('flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r p-5 text-white', meta.color)}>
        <meta.icon className="h-10 w-10" />
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-white/75">{meta.name} · Level {c.level} · {c.difficulty}</p><h1 className="text-2xl font-extrabold">{c.title}</h1><p className="text-white/85">{c.description}</p></div>
        {run && <Countdown key={run.attempt_id} seconds={run.time_limit_seconds} onDone={() => !submit.isPending && submit.mutate()} />}
      </div>
      {start.error && <Alert tone="error">{errorMessage(start.error)}</Alert>}
      {submit.error && <Alert tone="error">{errorMessage(submit.error)}</Alert>}
      {!run && !result && (
        <Card><CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="max-w-md text-ink-600">You have <b>{Math.round(c.time_limit_seconds / 60 * 10) / 10} minutes</b>. Earn up to <b>{c.xp_reward} XP</b> the first time you clear it (60%+), and a little more for practice after that.</p>
          <Button size="lg" onClick={() => start.mutate()} loading={start.isPending} leftIcon={<Play className="h-5 w-5" />}>Start challenge</Button>
        </CardBody></Card>
      )}
      {run && (
        <Card><CardBody>
          {run.game === 'math_sprint' && <MathSprint payload={run.payload} onChange={(a) => (answers.current = a)} onFinish={() => submit.mutate()} />}
          {run.game === 'quiz_rush' && <QuizRush payload={run.payload} onChange={(a) => (answers.current = a)} onFinish={() => submit.mutate()} />}
          {run.game === 'word_builder' && <WordBuilder payload={run.payload} onChange={(a) => (answers.current = a)} onFinish={() => submit.mutate()} />}
          {run.game === 'typing_race' && <TypingRace payload={run.payload} onChange={(a) => (answers.current = a)} onFinish={() => submit.mutate()} />}
          {run.game === 'code_quest' && <CodeQuest payload={run.payload} onChange={(a) => (answers.current = a)} onFinish={() => submit.mutate()} />}
          {run.game !== 'code_quest' && <div className="mt-5 flex justify-end"><Button variant="secondary" loading={submit.isPending} onClick={() => submit.mutate()}>Finish now</Button></div>}
        </CardBody></Card>
      )}
      {result && (
        <Card><CardBody className="space-y-5">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            {result.passed ? <Trophy className="h-14 w-14 text-sun-500" /> : <RotateCcw className="h-12 w-12 text-ink-400" />}
            <h2 className="text-2xl font-extrabold">{result.passed ? (result.first_clear ? 'Level cleared!' : 'Great run!') : 'Keep practising'}</h2>
            <p className="text-ink-600">Score <b>{result.score}</b> / {result.max_score}{result.accuracy != null && <> · accuracy {Math.round(Number(result.accuracy))}%</>} · {(result.time_ms / 1000).toFixed(1)} s · <b className="text-brand-700">+{result.xp} XP</b></p>
            {!result.verified && <p className="text-xs text-ink-500">Code Quest results are checked in your browser, so they don’t appear on public leaderboards.</p>}
          </div>
          <ResultDetail game={c.game} detail={result.detail} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => start.mutate()} loading={start.isPending} leftIcon={<RotateCcw className="h-4 w-4" />}>Try again</Button>
            {result.passed && next.data && <ButtonLink to={`/arena/play/${next.data.slug}`} onClick={() => setResult(null)}>Next level →</ButtonLink>}
            <ButtonLink to="/arena" variant="ghost">Back to the Arena</ButtonLink>
          </div>
        </CardBody></Card>
      )}
    </div>
  );
}

function Countdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => { const l = Math.max(0, Math.round((end - Date.now()) / 1000)); setLeft(l); if (l === 0) { clearInterval(t); done.current(); } }, 250);
    return () => clearInterval(t);
  }, [seconds]);
  return (
    <div className={cn('flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2 text-2xl font-extrabold tabular-nums', left <= 10 && 'animate-pulse bg-red-500/60')} role="timer" aria-live="off" aria-label={`${left} seconds left`}>
      <Clock className="h-5 w-5" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </div>
  );
}

type GameProps = { payload: Record<string, unknown>; onChange: (answers: unknown) => void; onFinish: () => void };

function MathSprint({ payload, onChange, onFinish }: GameProps) {
  const problems = payload.problems as { i: number; text: string }[];
  const [idx, setIdx] = useState(0);
  const [vals, setVals] = useState<string[]>([]);
  const [cur, setCur] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, [idx]);
  const submit = () => {
    const next = [...vals]; next[idx] = cur.trim(); setVals(next); onChange(next); setCur('');
    if (idx + 1 >= problems.length) onFinish(); else setIdx(idx + 1);
  };
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <ProgressBar value={(idx / problems.length) * 100} className="w-full max-w-md" label={`Problem ${idx + 1} of ${problems.length}`} />
      <p className="text-5xl font-extrabold tabular-nums tracking-tight">{problems[idx].text} = ?</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
        <Input ref={ref} value={cur} onChange={(e) => setCur(e.target.value.replace(/[^\d-]/g, ''))} inputMode="numeric" className="w-36 text-center text-2xl font-bold" aria-label="Your answer" autoComplete="off" />
        <Button type="submit" size="lg">Enter</Button>
      </form>
      <p className="text-sm text-ink-500">Press Enter to go to the next problem. Skipping counts as wrong.</p>
    </div>
  );
}

function QuizRush({ payload, onChange, onFinish }: GameProps) {
  const qs = payload.questions as { id: string; prompt: string; options: string[] }[];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const q = qs[idx];
  if (!q) return <p>No questions.</p>;
  const pick = (o: string) => {
    const next = { ...picked, [q.id]: o }; setPicked(next); onChange(next);
    setTimeout(() => (idx + 1 >= qs.length ? onFinish() : setIdx(idx + 1)), 180);
  };
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <ProgressBar value={(idx / qs.length) * 100} label={`Question ${idx + 1} of ${qs.length}`} />
      <h2 className="text-xl font-bold">{q.prompt}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((o, k) => (
          <button key={o} onClick={() => pick(o)} className={cn('rounded-2xl border-2 p-4 text-left font-semibold transition hover:border-brand-400', picked[q.id] === o ? 'border-brand-600 bg-brand-50' : 'border-ink-200')}>
            <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-lg bg-ink-100 text-sm">{'ABCD'[k]}</span>{o}
          </button>
        ))}
      </div>
    </div>
  );
}

function WordBuilder({ payload, onChange, onFinish }: GameProps) {
  const words = payload.words as { id: string; letters: string; hint: string; length: number }[];
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState<Record<string, string>>({});
  const [cur, setCur] = useState('');
  const w = words[idx];
  if (!w) return <p>No words.</p>;
  const submit = () => {
    const next = { ...given, [w.id]: cur.toUpperCase() }; setGiven(next); onChange(next); setCur('');
    if (idx + 1 >= words.length) onFinish(); else setIdx(idx + 1);
  };
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <ProgressBar value={(idx / words.length) * 100} className="w-full max-w-md" label={`Word ${idx + 1} of ${words.length}`} />
      <p className="text-ink-600"><b>Clue:</b> {w.hint}</p>
      <div className="flex flex-wrap justify-center gap-2">{w.letters.split('').map((l, i) => <span key={i} className="grid h-12 w-12 place-items-center rounded-xl bg-growth-100 text-2xl font-extrabold text-growth-700 shadow-sm">{l}</span>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
        <Input autoFocus value={cur} maxLength={w.length} onChange={(e) => setCur(e.target.value.replace(/[^a-z]/gi, ''))} className="w-48 text-center text-xl font-bold uppercase tracking-widest" aria-label="Your word" autoComplete="off" />
        <Button type="submit" size="lg">Enter</Button>
      </form>
      <p className="text-sm text-ink-500">{w.length} letters</p>
    </div>
  );
}

function TypingRace({ payload, onChange, onFinish }: GameProps) {
  const passage = (payload.passage as string) ?? '';
  const [typed, setTyped] = useState('');
  const [t0] = useState(Date.now());
  const correct = useMemo(() => { let n = 0; for (let i = 0; i < typed.length; i++) if (typed[i] === passage[i]) n++; return n; }, [typed, passage]);
  const minutes = Math.max((Date.now() - t0) / 60000, 0.05);
  const wpm = Math.round(((typed.length / 5) * (typed.length ? correct / typed.length : 1)) / minutes);
  return (
    <div className="space-y-4 py-2">
      <p className="rounded-2xl bg-ink-50 p-4 font-mono text-lg leading-relaxed" aria-label="Passage to type">
        {passage.split('').map((ch, i) => <span key={i} className={cn(i < typed.length ? (typed[i] === ch ? 'text-growth-700' : 'bg-red-100 text-red-700') : 'text-ink-400', i === typed.length && 'border-b-2 border-brand-600')}>{ch}</span>)}
      </p>
      <textarea autoFocus value={typed} onPaste={(e) => e.preventDefault()} spellCheck={false} autoCorrect="off" autoCapitalize="off"
        onChange={(e) => { const v = e.target.value.slice(0, passage.length); setTyped(v); onChange({ typed: v }); if (v.length >= passage.length) onFinish(); }}
        className="h-28 w-full rounded-2xl border border-ink-200 bg-surface p-4 font-mono text-lg focus:border-brand-500 focus:outline-none" aria-label="Type here" />
      <div className="flex gap-6 text-sm font-semibold text-ink-600"><span>≈ {wpm} WPM</span><span>Accuracy {typed.length ? Math.round((correct / typed.length) * 100) : 100}%</span><span>{Math.round((typed.length / Math.max(passage.length, 1)) * 100)}% done</span></div>
    </div>
  );
}

function CodeQuest({ payload, onChange, onFinish }: GameProps) {
  const lang = (payload.language as LangId) ?? 'python';
  const tests = (payload.tests as { args: unknown[]; expected: unknown }[]) ?? [];
  const [results, setResults] = useState<TestResult[] | null>(null);
  const passed = results?.filter((r) => r.pass).length ?? 0;
  const main = lang === 'python' ? 'main.py' : 'main.js';
  return (
    <div className="space-y-4">
      <Alert tone="info" title="Your task">{payload.prompt as string} Write the function <code className="font-mono font-bold">{payload.function as string}</code>, then press <b>Check my work</b>.</Alert>
      <div className="h-[32rem]">
        <CodeWorkspace compact hideProjectBar initialLang={lang} initialFiles={[{ name: main, content: (payload.starter as string) ?? '' }]} tests={tests} testFn={payload.function as string}
          onTests={(r) => { setResults(r); onChange({ passed: r.filter((x) => x.pass).length }); }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{results ? `${passed} of ${tests.length} tests passing` : `${tests.length} hidden-answer tests`}</p>
        <Button onClick={onFinish} disabled={!results}>Submit solution</Button>
      </div>
    </div>
  );
}

function ResultDetail({ game, detail }: { game: string; detail: unknown }) {
  if (game === 'typing_race') {
    const d = detail as { wpm: number; accuracy: number; completed_pct: number };
    return <div className="grid grid-cols-3 gap-3 text-center">{[['WPM', d.wpm], ['Accuracy', `${d.accuracy}%`], ['Completed', `${d.completed_pct}%`]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-500">{k}</p><p className="text-xl font-extrabold">{v}</p></div>)}</div>;
  }
  if (!Array.isArray(detail) || game === 'code_quest') return null;
  const rows = detail as { i?: number; id?: string; correct: boolean; answer: unknown; explanation?: string }[];
  return (
    <details className="rounded-2xl border border-ink-200 p-4">
      <summary className="cursor-pointer font-semibold">Review answers ({rows.filter((r) => r.correct).length}/{rows.length} correct)</summary>
      <ul className="mt-3 space-y-2 text-sm">{rows.map((r, k) => (
        <li key={k} className="flex gap-2">{r.correct ? <CheckCircle2 className="h-4 w-4 shrink-0 text-growth-600" /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
          <span>#{r.i ?? k + 1}: answer <b>{String(r.answer)}</b>{r.explanation ? ` — ${r.explanation}` : ''}</span></li>
      ))}</ul>
    </details>
  );
}

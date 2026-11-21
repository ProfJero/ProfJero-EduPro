import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Code2, Eye, EyeOff, Keyboard, Plus, Puzzle, Trash2, Trophy, Zap } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, ConfirmDialog, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, errorMessage, slugify } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useTeachingClasses } from '@/features/teachers/queries';

export type QItem = { prompt: string; options: string[]; answer: string; explanation: string | null; position: number };
/** "Question\nOption\nOption\n=Answer\n?Explanation" blocks separated by blank lines. */
export function parseQuestionBlocks(text: string): QItem[] {
  return text.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((l) => l.length >= 2).map((lines, i) => ({
    prompt: lines[0],
    options: lines.slice(1).filter((l) => !l.startsWith('=') && !l.startsWith('?')),
    answer: lines.find((l) => l.startsWith('='))?.slice(1).trim() ?? '',
    explanation: lines.find((l) => l.startsWith('?'))?.slice(1).trim() ?? null,
    position: i,
  }));
}
export const questionBlocksError = (items: QItem[], game: string) => {
  if (!items.length) return 'Add at least one question.';
  const bad = items.findIndex((q) => !q.answer || (game === 'quiz_rush' && (q.options.length < 2 || !q.options.includes(q.answer))) || (game === 'word_builder' && !/^[A-Za-z]{2,20}$/.test(q.answer)));
  if (bad >= 0) return game === 'word_builder' ? `Word ${bad + 1}: the answer (=WORD) must be letters only.` : `Question ${bad + 1}: give at least two options and an =answer that matches one of them exactly.`;
  return null;
};

const GAMES = [
  { id: 'quiz_rush', name: 'Quiz Rush', icon: Zap, text: 'Multiple-choice questions against the clock.' },
  { id: 'word_builder', name: 'Word Builder', icon: Puzzle, text: 'Unscramble key vocabulary from clues.' },
  { id: 'math_sprint', name: 'Math Sprint', icon: Calculator, text: 'Auto-generated arithmetic at the level you choose.' },
  { id: 'typing_race', name: 'Typing Race', icon: Keyboard, text: 'Type a passage fast and accurately.' },
  { id: 'code_quest', name: 'Code Quest', icon: Code2, text: 'Write a function that passes your tests.' },
] as const;
type Game = (typeof GAMES)[number]['id'];

type Row = { id: string; slug: string; title: string; game: string; status: string; class_id: string | null; difficulty: string; xp_reward: number; created_at: string; cls: { name: string } | null };

export function ChallengeStudio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const list = useQuery({ queryKey: ['my-challenges', user?.id], enabled: Boolean(user), queryFn: async () => unwrap(await supabase.from('arena_challenges').select('id, slug, title, game, status, class_id, difficulty, xp_reward, created_at, cls:school_classes(name)').eq('created_by', user!.id).order('created_at', { ascending: false })) as unknown as Row[] });
  const setStatus = useMutation({
    mutationFn: async (r: Row) => unwrap(await supabase.from('arena_challenges').update({ status: r.status === 'published' ? 'draft' : 'published' }).eq('id', r.id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-challenges'] }),
    onError: (e) => toast.error('Could not update', errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('arena_challenges').delete().eq('id', id)),
    onSuccess: () => { setDel(null); toast.success('Challenge deleted'); void qc.invalidateQueries({ queryKey: ['my-challenges'] }); },
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Challenge Arena" title="Challenge Studio" description="Set fun, timed challenges for your class or for everyone. Learners earn XP and compete on leaderboards; answers stay hidden on the server."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New challenge</Button>} />
      {list.isLoading ? <LoadingBlock /> : list.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.data.map((r) => {
          const g = GAMES.find((x) => x.id === r.game) ?? GAMES[0];
          return (
            <Card key={r.id}><CardBody className="flex h-full flex-col gap-2">
              <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><g.icon className="h-5 w-5" /></span><Badge tone={r.status === 'published' ? 'green' : 'neutral'}>{r.status === 'published' ? 'Live' : 'Draft'}</Badge><Badge tone={r.class_id ? 'amber' : 'brand'}>{r.class_id ? r.cls?.name ?? 'Class' : 'Public'}</Badge></div>
              <p className="font-bold">{r.title}</p>
              <p className="text-xs text-ink-500">{g.name} · {r.difficulty} · {r.xp_reward} XP</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant={r.status === 'published' ? 'secondary' : 'success'} leftIcon={r.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onClick={() => setStatus.mutate(r)}>{r.status === 'published' ? 'Unpublish' : 'Publish'}</Button>
                <Link to={`/arena/play/${r.slug}`} className="inline-flex items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700"><Trophy className="h-4 w-4" />Play & leaderboard</Link>
                <button className="ml-auto rounded p-1.5 text-ink-400 hover:text-red-600" onClick={() => setDel(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            </CardBody></Card>
          );
        })}</div>
      ) : <EmptyState icon={<Trophy className="h-8 w-8" />} title="No challenges yet" description="Create a quick quiz for your class — it takes two minutes." action={<Button onClick={() => setOpen(true)}>Create a challenge</Button>} />}
      {open && <ChallengeDialog onClose={() => { setOpen(false); void qc.invalidateQueries({ queryKey: ['my-challenges'] }); }} />}
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title="Delete this challenge?" description="Attempts and leaderboard entries are removed too." tone="danger" confirmLabel="Delete" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </div>
  );
}

function ChallengeDialog({ onClose }: { onClose: () => void }) {
  const { user, context } = useAuth();
  const toast = useToast();
  const classes = useTeachingClasses();
  const canPublic = Boolean(context?.roles.includes('teacher') || context?.teaches_classes);
  const [game, setGame] = useState<Game>('quiz_rush');
  const [m, setM] = useState({ title: '', description: '', subject: '', scope: '', difficulty: 'easy', time: 120, xp: 50 });
  const [qs, setQs] = useState('');
  const [sprint, setSprint] = useState({ ops: ['+', '-'], min: 1, max: 20, count: 15 });
  const [passage, setPassage] = useState('');
  const [code, setCode] = useState({ language: 'python', fn: 'solve', prompt: '', starter: 'def solve(n):\n    # your code here\n    pass\n', tests: '[{"args": [2], "expected": 4}]' });
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (m.title.trim().length < 3) throw new Error('Give the challenge a title.');
      if (!m.scope) throw new Error('Choose who can play it.');
      let config: Record<string, unknown> = {};
      let items: ReturnType<typeof parseQuestionBlocks> = [];
      if (game === 'quiz_rush' || game === 'word_builder') {
        items = parseQuestionBlocks(qs);
        const err = questionBlocksError(items, game); if (err) throw new Error(err);
        config = { count: Math.min(items.length, 20) };
      } else if (game === 'math_sprint') {
        if (!sprint.ops.length || sprint.min >= sprint.max) throw new Error('Pick at least one operation and a valid number range.');
        config = { ops: sprint.ops, min: sprint.min, max: sprint.max, count: sprint.count };
      } else if (game === 'typing_race') {
        if (passage.trim().length < 40) throw new Error('Write a passage of at least 40 characters.');
        config = { passage: passage.trim().replace(/\s+/g, ' ') };
      } else {
        let tests: unknown;
        try { tests = JSON.parse(code.tests); } catch { throw new Error('Tests must be valid JSON, e.g. [{"args": [2], "expected": 4}].'); }
        if (!Array.isArray(tests) || !tests.length || !tests.every((t) => t && Array.isArray(t.args) && 'expected' in t)) throw new Error('Each test needs "args" (a list) and "expected".');
        if (!/^[A-Za-z_]\w*$/.test(code.fn)) throw new Error('Function name must be a valid identifier.');
        config = { language: code.language, function: code.fn, prompt: code.prompt || m.description, starter: code.starter, tests };
      }
      const slug = `${slugify(m.title).slice(0, 50)}-${Math.random().toString(36).slice(2, 7)}`;
      const row = unwrap(await supabase.from('arena_challenges').insert({
        slug, game, track: `t-${slug}`, title: m.title.trim(), description: m.description.trim() || m.title.trim(), subject: m.subject || null, level: 1,
        difficulty: m.difficulty, time_limit_seconds: m.time, xp_reward: Math.min(m.xp, 150), config: config as never, status: 'draft', created_by: user!.id,
        class_id: m.scope === 'public' ? null : m.scope,
      }).select('id').single());
      if (items.length) unwrap(await supabase.from('arena_questions').insert(items.map((q) => ({ ...q, answer: game === 'word_builder' ? q.answer.toUpperCase() : q.answer, challenge_id: row.id }))));
      if (publish) unwrap(await supabase.from('arena_challenges').update({ status: 'published' }).eq('id', row.id));
    },
    onSuccess: (_d, publish) => { toast.success(publish ? 'Challenge is live 🎉' : 'Saved as draft', publish && m.scope !== 'public' ? 'Your class has been notified.' : undefined); onClose(); },
    onError: (e) => toast.error('Could not save', errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="xl" title="New challenge"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="outline" loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>Save draft</Button><Button loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)}>Publish</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-5">{GAMES.map((g) => (
          <button key={g.id} onClick={() => setGame(g.id)} aria-pressed={game === g.id} className={cn('rounded-2xl border-2 p-3 text-left transition', game === g.id ? 'border-rose-500 bg-rose-50' : 'border-ink-200 hover:border-rose-300')}>
            <g.icon className={cn('h-5 w-5', game === g.id ? 'text-rose-600' : 'text-ink-400')} /><p className="mt-1 text-sm font-bold">{g.name}</p><p className="text-[0.7rem] leading-tight text-ink-500">{g.text}</p>
          </button>
        ))}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required><Input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} maxLength={100} placeholder="Photosynthesis quick-fire" /></Field>
          <Field label="Who can play" required><Select value={m.scope} onChange={(e) => setM({ ...m, scope: e.target.value })}>
            <option value="">Choose…</option>
            {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>My class: {c.name}</option>)}
            {canPublic && <option value="public">Everyone (public challenge)</option>}
          </Select></Field>
          <Field label="Subject"><Input value={m.subject} onChange={(e) => setM({ ...m, subject: e.target.value })} maxLength={60} placeholder="Integrated Science" /></Field>
          <Field label="Short description"><Input value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} maxLength={200} /></Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="Difficulty"><Select value={m.difficulty} onChange={(e) => setM({ ...m, difficulty: e.target.value })}><option>easy</option><option>medium</option><option>hard</option></Select></Field>
            <Field label="Time limit"><Select value={m.time} onChange={(e) => setM({ ...m, time: Number(e.target.value) })}>{[60, 90, 120, 180, 300, 600, 900].map((t) => <option key={t} value={t}>{t < 120 ? `${t} s` : `${t / 60} min`}</option>)}</Select></Field>
            <Field label="XP reward"><Select value={m.xp} onChange={(e) => setM({ ...m, xp: Number(e.target.value) })}>{[20, 30, 50, 75, 100, 150].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          </div>
        </div>
        {(game === 'quiz_rush' || game === 'word_builder') && (
          <Field label={game === 'quiz_rush' ? 'Questions' : 'Words'} hint={game === 'quiz_rush' ? 'One question per block: question, options (one per line), =correct option, optional ?explanation. Blank line between questions.' : 'One word per block: the clue, then =WORD. Blank line between words.'}>
            <Textarea rows={12} value={qs} onChange={(e) => setQs(e.target.value)} className="font-mono text-sm"
              placeholder={game === 'quiz_rush' ? 'Which gas do plants absorb for photosynthesis?\nOxygen\nCarbon dioxide\nNitrogen\n=Carbon dioxide\n?Plants take in CO2 through their stomata.' : 'The green pigment in leaves\n=CHLOROPHYLL'} />
          </Field>
        )}
        {game === 'math_sprint' && (
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Operations"><div className="flex gap-1">{['+', '-', '×', '÷'].map((o) => <button key={o} type="button" onClick={() => setSprint((s) => ({ ...s, ops: s.ops.includes(o) ? s.ops.filter((x) => x !== o) : [...s.ops, o] }))} aria-pressed={sprint.ops.includes(o)} className={cn('h-10 w-10 rounded-xl border-2 text-lg font-bold', sprint.ops.includes(o) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200')}>{o}</button>)}</div></Field>
            <Field label="Smallest number"><Input type="number" value={sprint.min} onChange={(e) => setSprint({ ...sprint, min: Number(e.target.value) })} /></Field>
            <Field label="Largest number"><Input type="number" value={sprint.max} onChange={(e) => setSprint({ ...sprint, max: Number(e.target.value) })} /></Field>
            <Field label="Problems"><Input type="number" min={5} max={40} value={sprint.count} onChange={(e) => setSprint({ ...sprint, count: Math.min(40, Math.max(5, Number(e.target.value))) })} /></Field>
          </div>
        )}
        {game === 'typing_race' && <Field label="Passage to type"><Textarea rows={5} value={passage} onChange={(e) => setPassage(e.target.value)} maxLength={1200} placeholder="Ghana gained independence on 6 March 1957…" /></Field>}
        {game === 'code_quest' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Language"><Select value={code.language} onChange={(e) => setCode({ ...code, language: e.target.value, starter: e.target.value === 'python' ? `def ${code.fn}(n):\n    # your code here\n    pass\n` : `function ${code.fn}(n) {\n  // your code here\n}\n` })}><option value="python">Python</option><option value="javascript">JavaScript</option></Select></Field>
            <Field label="Function name"><Input value={code.fn} onChange={(e) => setCode({ ...code, fn: e.target.value })} className="font-mono" /></Field>
            <Field label="Task for learners" className="sm:col-span-2"><Textarea rows={2} value={code.prompt} onChange={(e) => setCode({ ...code, prompt: e.target.value })} placeholder="Return double the number n." /></Field>
            <Field label="Starter code"><Textarea rows={6} value={code.starter} onChange={(e) => setCode({ ...code, starter: e.target.value })} className="font-mono text-sm" /></Field>
            <Field label="Tests (JSON)" hint='[{"args": [2], "expected": 4}]'><Textarea rows={6} value={code.tests} onChange={(e) => setCode({ ...code, tests: e.target.value })} className="font-mono text-sm" /></Field>
          </div>
        )}
        <Alert tone="info">Class challenges notify the class when published and get their own leaderboard. Public challenges appear in everyone’s Arena under “From teachers”.</Alert>
      </div>
    </Dialog>
  );
}

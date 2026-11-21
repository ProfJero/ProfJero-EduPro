import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trophy } from 'lucide-react';
import { Badge, Button, Card, CardBody, DataTable, Dialog, Field, Input, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { errorMessage, slugify } from '@/lib/utils';
import { GAME_META } from '@/features/arena/ArenaHome';

/** Manage Challenge Arena levels and their hidden questions. */
export function AdminArena() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['admin-arena'], queryFn: async () => unwrap(await supabase.from('arena_challenges').select('id, slug, game, track, title, level, difficulty, status, xp_reward, time_limit_seconds').order('track').order('level')) });
  const [editing, setEditing] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: async (r: { id: string; status: string }) => unwrap(await supabase.from('arena_challenges').update({ status: r.status === 'published' ? 'draft' : 'published' }).eq('id', r.id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-arena'] }),
    onError: (e) => toast.error('Update failed', errorMessage(e)),
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Challenge Arena" description="Levels unlock in order within each track (60% to pass). Quiz and word answers stay on the server." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>New quiz level</Button>} />
      <Card><CardBody className="p-0">
        <DataTable rows={list.data ?? []} rowKey={(r) => r.id} columns={[
          { key: 't', header: 'Challenge', primary: true, cell: (r) => <span className="font-semibold">{r.title}</span> },
          { key: 'g', header: 'Game', cell: (r) => GAME_META[r.game]?.name ?? r.game },
          { key: 'l', header: 'Level', cell: (r) => `${r.level} · ${r.difficulty}` },
          { key: 'x', header: 'XP / time', hideOnMobile: true, cell: (r) => `${r.xp_reward} XP · ${r.time_limit_seconds}s` },
          { key: 's', header: 'Status', cell: (r) => <Badge tone={r.status === 'published' ? 'green' : 'neutral'}>{r.status}</Badge> },
          { key: 'a', header: '', cell: (r) => <div className="flex gap-2">{(r.game === 'quiz_rush' || r.game === 'word_builder') && <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>Questions</Button>}<Button size="sm" variant="ghost" onClick={() => toggle.mutate(r)}>{r.status === 'published' ? 'Unpublish' : 'Publish'}</Button></div> },
        ]} empty={<p className="p-6 text-center text-sm text-ink-500"><Trophy className="mx-auto mb-2 h-6 w-6" />No challenges yet.</p>} />
      </CardBody></Card>
      {editing && <QuestionEditor id={editing} onClose={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['admin-arena'] }); }} />}
    </div>
  );
}

function QuestionEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const isNew = id === 'new';
  const [meta, setMeta] = useState({ title: '', track: 'quiz-custom', level: 1, subject: '', difficulty: 'easy', time: 120, xp: 50, game: 'quiz_rush' });
  const qs = useQuery({ queryKey: ['admin-arena-q', id], enabled: !isNew, queryFn: async () => unwrap(await supabase.from('arena_questions').select('prompt, options, answer, explanation').eq('challenge_id', id).order('position')) });
  const [text, setText] = useState<string | null>(null);
  const current = text ?? (qs.data ?? []).map((q) => [q.prompt, ...((q.options as string[]) ?? []), `=${q.answer}`, q.explanation ? `?${q.explanation}` : ''].filter(Boolean).join('\n')).join('\n\n');
  const parse = () => current.split(/\n\s*\n/).map((blk) => blk.split('\n').map((l) => l.trim()).filter(Boolean)).filter((l) => l.length >= 2).map((lines, i) => {
    const answer = lines.find((l) => l.startsWith('='))?.slice(1).trim() ?? '';
    const explanation = lines.find((l) => l.startsWith('?'))?.slice(1).trim() ?? null;
    const options = lines.slice(1).filter((l) => !l.startsWith('=') && !l.startsWith('?'));
    return { prompt: lines[0], options, answer, explanation, position: i };
  });
  const save = useMutation({
    mutationFn: async () => {
      const items = parse();
      if (!items.length || items.some((q) => !q.answer || (q.options.length > 0 && !q.options.includes(q.answer)))) throw new Error('Each question needs "=answer" matching one of its options.');
      let cid = id;
      if (isNew) {
        cid = unwrap(await supabase.from('arena_challenges').insert({ slug: `${slugify(meta.title)}-${Date.now().toString(36)}`, game: meta.game, track: meta.track, title: meta.title, subject: meta.subject || null, level: meta.level, difficulty: meta.difficulty, time_limit_seconds: meta.time, xp_reward: meta.xp, status: 'draft', config: { count: Math.min(items.length, 10) } }).select('id').single()).id;
      }
      unwrap(await supabase.from('arena_questions').delete().eq('challenge_id', cid));
      unwrap(await supabase.from('arena_questions').insert(items.map((q) => ({ ...q, challenge_id: cid }))));
    },
    onSuccess: () => { toast.success('Saved'); onClose(); },
    onError: (e) => toast.error('Could not save', errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" title={isNew ? 'New quiz level' : 'Edit questions'} description="One question per block: the question line, then options, then =answer and optional ?explanation. Separate questions with a blank line. Word Builder: question line is the clue and =WORD is the answer (no options)."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={isNew && meta.title.trim().length < 3} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-4">
        {isNew && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Title" className="sm:col-span-2"><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
            <Field label="Game"><Select value={meta.game} onChange={(e) => setMeta({ ...meta, game: e.target.value })}><option value="quiz_rush">Quiz Rush</option><option value="word_builder">Word Builder</option></Select></Field>
            <Field label="Track"><Input value={meta.track} onChange={(e) => setMeta({ ...meta, track: slugify(e.target.value) })} /></Field>
            <Field label="Level"><Input type="number" min={1} max={50} value={meta.level} onChange={(e) => setMeta({ ...meta, level: Number(e.target.value) || 1 })} /></Field>
            <Field label="Subject"><Input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} /></Field>
            <Field label="Difficulty"><Select value={meta.difficulty} onChange={(e) => setMeta({ ...meta, difficulty: e.target.value })}><option>easy</option><option>medium</option><option>hard</option></Select></Field>
            <Field label="Time (s)"><Input type="number" min={15} max={3600} value={meta.time} onChange={(e) => setMeta({ ...meta, time: Number(e.target.value) || 120 })} /></Field>
            <Field label="XP"><Input type="number" min={0} max={1000} value={meta.xp} onChange={(e) => setMeta({ ...meta, xp: Number(e.target.value) || 0 })} /></Field>
          </div>
        )}
        <Textarea rows={16} value={current} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" aria-label="Questions" placeholder={'What is the capital of Ghana?\nKumasi\nAccra\nTamale\n=Accra\n?Accra has been the capital since 1877.'} />
        <p className="text-xs text-ink-500">{parse().length} questions parsed. New levels start as drafts — publish them from the table.</p>
      </div>
    </Dialog>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Lock, Plus, Trash2, Vote } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Dialog, Field, Input, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow, localInputToIso } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import type { RoomType } from '@/features/classroom/usePresence';

type Results = {
  closed: boolean; voted: boolean; can_manage: boolean; visible: boolean; my_votes: string[]; total_voters: number | null;
  options: { id: string; label: string; votes: number | null; voters: string[] | null }[];
};

export function PollsPanel({ type, roomId, canCreate, compact }: { type: RoomType; roomId: string; canCreate: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const polls = useQuery({
    queryKey: ['polls', type, roomId], refetchInterval: compact ? false : 20_000,
    queryFn: async () => unwrap(await supabase.from('polls').select('id, question, description, multiple, anonymous, closes_at, is_closed, created_at').eq('room_type', type).eq('room_id', roomId).order('created_at', { ascending: false }).limit(10)),
  });
  if (!canCreate && !polls.data?.length) return null;
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><Vote className="h-5 w-5 text-violet-600" />Polls & votes</span>}
        action={canCreate ? <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>New poll</Button> : undefined} />
      <CardBody className="space-y-4">
        {polls.data?.length ? polls.data.map((p) => <PollCard key={p.id} poll={p} />) : <p className="text-sm text-ink-500">Ask the class a quick question — results update live.</p>}
      </CardBody>
      {canCreate && <CreatePollDialog open={open} onOpenChange={setOpen} type={type} roomId={roomId} />}
    </Card>
  );
}

function PollCard({ poll }: { poll: { id: string; question: string; description: string | null; multiple: boolean; anonymous: boolean; closes_at: string | null; is_closed: boolean; created_at: string } }) {
  const qc = useQueryClient();
  const toast = useToast();
  const res = useQuery({ queryKey: ['poll', poll.id], queryFn: async () => unwrap(await supabase.rpc('poll_results', { p_poll: poll.id })) as unknown as Results, refetchInterval: 15_000 });
  const [picked, setPicked] = useState<string[]>([]);
  const vote = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('cast_vote', { p_poll: poll.id, p_option_ids: picked })),
    onSuccess: () => { setPicked([]); void qc.invalidateQueries({ queryKey: ['poll', poll.id] }); },
    onError: (e) => toast.error('Vote not counted', errorMessage(e)),
  });
  const close = useMutation({
    mutationFn: async () => unwrap(await supabase.from('polls').update({ is_closed: true }).eq('id', poll.id)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['poll', poll.id] }); void qc.invalidateQueries({ queryKey: ['polls'] }); },
    onError: (e) => toast.error('Could not close the poll', errorMessage(e)),
  });
  const r = res.data;
  const total = Math.max(1, r?.options.reduce((a, o) => a + (o.votes ?? 0), 0) ?? 0);
  const canVote = r && !r.closed && !r.voted;
  return (
    <div className="rounded-xl border border-ink-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink-900">{poll.question}</p>
        {r?.closed ? <Badge icon={<Lock className="h-3 w-3" />}>Closed</Badge> : poll.closes_at ? <Badge tone="amber">Closes {fromNow(poll.closes_at)}</Badge> : null}
      </div>
      {poll.description && <p className="mt-0.5 text-xs text-ink-500">{poll.description}</p>}
      <ul className="mt-2 space-y-1.5">
        {r?.options.map((o) => {
          const mine = r.my_votes.includes(o.id);
          const sel = picked.includes(o.id);
          const pctv = r.visible && o.votes != null ? Math.round((o.votes / total) * 100) : null;
          return (
            <li key={o.id}>
              <button disabled={!canVote} onClick={() => setPicked(poll.multiple ? (sel ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : [o.id])}
                className={cn('relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition', sel ? 'border-violet-500 ring-2 ring-violet-200' : mine ? 'border-violet-400' : 'border-ink-200', canVote && 'hover:border-violet-400')}>
                {pctv != null && <span className="absolute inset-y-0 left-0 bg-violet-100" style={{ width: `${pctv}%` }} aria-hidden />}
                <span className="relative flex justify-between gap-2"><span className="font-medium">{o.label}{mine && ' ✓'}</span>{pctv != null && <span className="font-bold tabular-nums">{pctv}%</span>}</span>
                {o.voters && o.voters.length > 0 && <span className="relative mt-0.5 block truncate text-xs text-ink-500">{o.voters.join(', ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-500">
        <span>{r?.visible && r.total_voters != null ? `${r.total_voters} voted` : r?.voted ? 'Vote counted — results appear later' : poll.anonymous ? 'Anonymous' : 'Names visible to the class'}{poll.multiple ? ' · choose any' : ''}</span>
        <div className="flex gap-2">
          {canVote && <Button size="sm" disabled={!picked.length} loading={vote.isPending} onClick={() => vote.mutate()}>Vote</Button>}
          {r?.can_manage && !r.closed && <Button size="sm" variant="ghost" loading={close.isPending} onClick={() => close.mutate()}>Close</Button>}
        </div>
      </div>
    </div>
  );
}

function CreatePollDialog({ open, onOpenChange, type, roomId }: { open: boolean; onOpenChange: (o: boolean) => void; type: RoomType; roomId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [show, setShow] = useState('after_vote');
  const [closes, setCloses] = useState('');
  const valid = question.trim().length >= 3 && options.filter((o) => o.trim()).length >= 2;
  const create = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('create_poll', {
      p_room_type: type, p_room: roomId, p_question: question.trim(), p_options: options.map((o) => o.trim()).filter(Boolean),
      p_multiple: multiple, p_anonymous: anonymous, p_show_results: show, p_closes_at: closes ? localInputToIso(closes) ?? undefined : undefined,
    })),
    onSuccess: () => { onOpenChange(false); setQuestion(''); setOptions(['', '']); void qc.invalidateQueries({ queryKey: ['polls', type, roomId] }); toast.success('Poll posted'); },
    onError: (e) => toast.error('Could not create the poll', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={<span className="inline-flex items-center gap-2"><BarChart3 className="h-5 w-5" />New poll</span>}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!valid} loading={create.isPending} onClick={() => create.mutate()}>Post poll</Button></>}>
      <div className="space-y-4">
        <Field label="Question" required><Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Which topic should we revise on Friday?" /></Field>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-700">Options</p>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2"><Input value={o} onChange={(e) => setOptions(options.map((x, k) => (k === i ? e.target.value : x)))} maxLength={200} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} />
              {options.length > 2 && <button className="rounded p-2 text-ink-400 hover:text-red-600" onClick={() => setOptions(options.filter((_, k) => k !== i))} aria-label="Remove option"><Trash2 className="h-4 w-4" /></button>}</div>
          ))}
          {options.length < 10 && <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOptions([...options, ''])}>Add option</Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Show results"><Select value={show} onChange={(e) => setShow(e.target.value)}><option value="after_vote">After voting</option><option value="always">Always</option><option value="after_close">When the poll closes</option></Select></Field>
          <Field label="Closes (optional)"><Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></Field>
        </div>
        <Checkbox label="Allow choosing more than one option" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
        <Checkbox label="Anonymous voting" description="Hide who voted for what" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
      </div>
    </Dialog>
  );
}

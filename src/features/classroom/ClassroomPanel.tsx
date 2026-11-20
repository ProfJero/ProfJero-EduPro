import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, CornerDownRight, Hand, HelpCircle, MessageCircle, Pin, PinOff, Presentation, Send, Trash2, Users, WifiOff, Pencil } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap, type Updates } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useClassPresence, type RoomType } from './usePresence';

type Msg = { id: string; user_id: string; author_name: string; kind: string; body: string; parent_id: string | null; is_pinned: boolean; is_resolved: boolean; deleted_at: string | null; created_at: string };
type Member = { user_id: string; name: string; avatar_url: string | null; member_role: string };

export function useRoomMessages(type: RoomType, roomId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['room-messages', type, roomId],
    enabled: Boolean(roomId),
    queryFn: async () => unwrap(await supabase.from('classroom_messages').select('id, user_id, author_name, kind, body, parent_id, is_pinned, is_resolved, deleted_at, created_at')
      .eq('room_type', type).eq('room_id', roomId!).is('deleted_at', null).order('created_at', { ascending: false }).limit(200)) as Msg[],
  });
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`msgs:${type}:${roomId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classroom_messages', filter: `room_id=eq.${roomId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['room-messages', type, roomId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [type, roomId, qc]);
  return q;
}

export function useRoomMembers(type: RoomType, roomId?: string) {
  return useQuery({
    queryKey: ['room-members', type, roomId],
    enabled: Boolean(roomId),
    staleTime: 120_000,
    queryFn: async () => (unwrap(await supabase.rpc('room_members', { p_type: type, p_room: roomId! })) ?? []) as Member[],
  });
}

/** The full "classroom": board, who's in class, raise-hand and discussion. */
export function ClassroomPanel({ type, roomId, canModerate, title }: { type: RoomType; roomId: string; canModerate: boolean; title?: string }) {
  const presence = useClassPresence(type, roomId, { role: canModerate ? 'teacher' : 'learner' });
  const msgs = useRoomMessages(type, roomId);
  const board = msgs.data?.find((m) => m.kind === 'board');
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <ClassBoard type={type} roomId={roomId} board={board} canModerate={canModerate} title={title} />
        <Discussion type={type} roomId={roomId} messages={msgs.data ?? []} loading={msgs.isLoading} canModerate={canModerate} />
      </div>
      <div className="space-y-5">
        <InClassNow type={type} roomId={roomId} presence={presence} canModerate={canModerate} />
      </div>
    </div>
  );
}

function ClassBoard({ type, roomId, board, canModerate, title }: { type: RoomType; roomId: string; board?: Msg; canModerate: boolean; title?: string }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const toast = useToast();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => unwrap(await supabase.from('classroom_messages').insert({ room_type: type, room_id: roomId, user_id: user!.id, kind: 'board', body: text.trim() })),
    onSuccess: () => { setEditing(false); void qc.invalidateQueries({ queryKey: ['room-messages', type, roomId] }); },
    onError: (e) => toast.error('Could not update the board', errorMessage(e)),
  });
  return (
    <section className="board-surface overflow-hidden rounded-2xl p-5 text-white shadow-[var(--shadow-lift)] sm:p-6" aria-label="Class board">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-growth-100"><Presentation className="h-4 w-4" />Class board{title ? ` · ${title}` : ''}</p>
        {canModerate && !editing && <Button size="sm" variant="board" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setText(board?.body ?? ''); setEditing(true); }}>Write on board</Button>}
      </div>
      {editing ? (
        <div className="mt-4 space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} aria-label="Board text" className="border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/10" placeholder="Today's topic, key points, reminders…" />
          <div className="flex gap-2"><Button size="sm" className="bg-surface text-board-900 hover:bg-growth-50" loading={save.isPending} disabled={!text.trim()} onClick={() => save.mutate()}>Post to board</Button><Button size="sm" variant="board" onClick={() => setEditing(false)}>Cancel</Button></div>
        </div>
      ) : board ? (
        <>
          <p className="mt-4 whitespace-pre-wrap text-lg font-semibold leading-relaxed sm:text-xl" style={{ fontFamily: 'inherit' }}>{board.body}</p>
          <p className="mt-3 text-xs text-white/60">{board.author_name} · {fromNow(board.created_at)}</p>
        </>
      ) : (
        <p className="mt-4 text-white/70">{canModerate ? 'Nothing on the board yet. Write today’s topic, key points or reminders for the class.' : 'Your teacher hasn’t written on the board yet.'}</p>
      )}
    </section>
  );
}

function InClassNow({ type, roomId, presence, canModerate }: { type: RoomType; roomId: string; presence: ReturnType<typeof useClassPresence>; canModerate: boolean }) {
  const { user } = useAuth();
  const { data: roster } = useRoomMembers(type, roomId);
  const online = new Set(presence.members.map((m) => m.user_id));
  const hands = presence.members.filter((m) => m.hand).sort((a, b) => (a.hand_at ?? '').localeCompare(b.hand_at ?? ''));
  const [showAll, setShowAll] = useState(false);
  const offline = (roster ?? []).filter((r) => !online.has(r.user_id));
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2">{presence.status === 'live' ? <span className="live-dot h-2.5 w-2.5 rounded-full bg-growth-500" /> : <WifiOff className="h-4 w-4 text-ink-400" />}In class now</span>}
        description={`${presence.members.length} present${roster ? ` of ${roster.length}` : ''}`} />
      <CardBody className="space-y-4">
        {!canModerate && (
          <Button className="w-full" variant={presence.hand ? 'success' : 'outline'} onClick={() => presence.setHand(!presence.hand)} aria-pressed={presence.hand}
            leftIcon={<Hand className={cn('h-4 w-4', presence.hand && 'hand-wave')} />}>
            {presence.hand ? 'Hand raised — lower it' : 'Raise hand'}
          </Button>
        )}
        {hands.length > 0 && (
          <div className="rounded-xl border border-sun-100 bg-sun-50 p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-sun-700">Hands up ({hands.length})</p>
              {canModerate && <button className="text-xs font-semibold text-sun-700 underline" onClick={() => presence.lowerHand()}>Lower all</button>}</div>
            <ul className="mt-2 space-y-1.5">
              {hands.map((h, i) => (
                <li key={h.user_id} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-xs font-bold text-sun-700">{i + 1}</span>
                  <Avatar name={h.name} src={h.avatar_url} size={24} />
                  <span className="flex-1 truncate font-medium">{h.name}{h.user_id === user?.id && ' (you)'}</span>
                  {canModerate && <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => presence.lowerHand(h.user_id)}>Answer</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-4" aria-label="Present now">
          {presence.members.map((m) => (
            <li key={m.user_id} className="flex flex-col items-center gap-1 text-center">
              <Avatar name={m.name} src={m.avatar_url} size={42} ring={m.hand ? 'hand' : 'online'} />
              <span className="w-full truncate text-[0.7rem] font-medium text-ink-700">{m.user_id === user?.id ? 'You' : m.name.split(' ')[0]}</span>
              {m.role === 'teacher' && <Badge tone="green" className="px-1.5 text-[0.6rem]">Teacher</Badge>}
            </li>
          ))}
        </ul>
        {presence.status === 'offline' && <p className="text-xs text-ink-500">Live presence is unavailable right now. Discussion still works.</p>}
        {offline.length > 0 && (
          <div>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}><Users className="h-3.5 w-3.5" />{showAll ? 'Hide' : 'Show'} class register ({offline.length} not in class)</button>
            {showAll && <ul className="mt-2 space-y-1.5">{offline.map((r) => <li key={r.user_id} className="flex items-center gap-2 text-sm text-ink-500"><Avatar name={r.name} src={r.avatar_url} size={24} className="opacity-60" />{r.name}{r.member_role === 'teacher' && <Badge>Teacher</Badge>}</li>)}</ul>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Discussion({ type, roomId, messages, loading, canModerate }: { type: RoomType; roomId: string; messages: Msg[]; loading: boolean; canModerate: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [asQuestion, setAsQuestion] = useState(false);
  const [filter, setFilter] = useState<'all' | 'questions' | 'open'>('all');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['room-messages', type, roomId] });
  const post = useMutation({
    mutationFn: async (v: { body: string; kind: string; parent_id?: string }) =>
      unwrap(await supabase.from('classroom_messages').insert({ room_type: type, room_id: roomId, user_id: user!.id, body: v.body, kind: v.kind, parent_id: v.parent_id ?? null })),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error('Message not sent', errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Updates<'classroom_messages'> }) => unwrap(await supabase.from('classroom_messages').update(v.patch).eq('id', v.id)),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error('Update failed', errorMessage(e)),
  });

  const { top, replies } = useMemo(() => {
    const visible = messages.filter((m) => m.kind !== 'board');
    const replies = new Map<string, Msg[]>();
    visible.filter((m) => m.parent_id).forEach((m) => replies.set(m.parent_id!, [...(replies.get(m.parent_id!) ?? []), m]));
    let top = visible.filter((m) => !m.parent_id);
    if (filter === 'questions') top = top.filter((m) => m.kind === 'question');
    if (filter === 'open') top = top.filter((m) => m.kind === 'question' && !m.is_resolved);
    top.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at));
    return { top, replies };
  }, [messages, filter]);

  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><MessageCircle className="h-5 w-5 text-brand-600" />Class discussion</span>} description="Ask questions, share ideas and help each other. Be kind — your teacher can see everything here."
        action={<div className="flex gap-1 rounded-lg bg-ink-100 p-0.5 text-xs font-semibold">{(['all', 'questions', 'open'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn('rounded-md px-2.5 py-1', filter === f ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500')}>{f === 'open' ? 'Unanswered' : f[0].toUpperCase() + f.slice(1)}</button>)}</div>} />
      <CardBody>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; post.mutate({ body: body.trim(), kind: asQuestion ? 'question' : 'message' }, { onSuccess: () => { setBody(''); setAsQuestion(false); } }); }}>
          <label htmlFor={`compose-${roomId}`} className="sr-only">Write a message</label>
          <Textarea id={`compose-${roomId}`} value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} placeholder={asQuestion ? 'What would you like to ask?' : 'Say something to the class…'} />
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-600"><input type="checkbox" checked={asQuestion} onChange={(e) => setAsQuestion(e.target.checked)} className="h-4 w-4 accent-brand-600" /><HelpCircle className="h-4 w-4 text-brand-600" />Ask as a question</label>
            <Button type="submit" size="sm" loading={post.isPending} disabled={!body.trim()} leftIcon={<Send className="h-3.5 w-3.5" />}>Post</Button>
          </div>
        </form>
        <div className="mt-5 space-y-3" aria-live="polite">
          {loading ? <p className="text-sm text-ink-500">Loading discussion…</p> : top.length === 0 ? (
            <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No messages yet" description="Start the conversation — ask a question or share what you learned." className="py-8" />
          ) : top.map((m) => (
            <MessageItem key={m.id} m={m} replies={(replies.get(m.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))} mine={m.user_id === user?.id} canModerate={canModerate}
              onReply={(text) => post.mutate({ body: text, kind: canModerate ? 'answer' : 'message', parent_id: m.id })}
              onUpdate={(id, patch) => update.mutate({ id, patch })} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function MessageItem({ m, replies, mine, canModerate, onReply, onUpdate }: { m: Msg; replies: Msg[]; mine: boolean; canModerate: boolean; onReply: (t: string) => void; onUpdate: (id: string, patch: Updates<'classroom_messages'>) => void }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const { user } = useAuth();
  return (
    <article className={cn('rounded-xl border p-3.5', m.is_pinned ? 'border-brand-200 bg-brand-50/50' : m.kind === 'question' ? 'border-ink-200 bg-surface' : 'border-ink-100 bg-ink-50/50')}>
      <div className="flex gap-3">
        <Avatar name={m.author_name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-ink-900">{m.author_name || 'Member'}</span>
            {m.kind === 'question' && <Badge tone={m.is_resolved ? 'green' : 'amber'}>{m.is_resolved ? 'Answered' : 'Question'}</Badge>}
            {m.is_pinned && <Badge tone="brand" icon={<Pin className="h-3 w-3" />}>Pinned</Badge>}
            <span className="text-xs text-ink-400">{fromNow(m.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{m.body}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-ink-500">
            <button className="hover:text-brand-700" onClick={() => setReplying((r) => !r)}>Reply</button>
            {(canModerate || mine) && m.kind === 'question' && <button className="inline-flex items-center gap-1 hover:text-growth-700" onClick={() => onUpdate(m.id, { is_resolved: !m.is_resolved })}><CheckCheck className="h-3.5 w-3.5" />{m.is_resolved ? 'Reopen' : 'Mark answered'}</button>}
            {canModerate && <button className="inline-flex items-center gap-1 hover:text-brand-700" onClick={() => onUpdate(m.id, { is_pinned: !m.is_pinned })}>{m.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}{m.is_pinned ? 'Unpin' : 'Pin'}</button>}
            {(canModerate || mine) && <button className="inline-flex items-center gap-1 hover:text-red-600" onClick={() => onUpdate(m.id, { deleted_at: new Date().toISOString() })}><Trash2 className="h-3.5 w-3.5" />Remove</button>}
          </div>
          {replies.length > 0 && (
            <ul className="mt-3 space-y-2 border-l-2 border-ink-100 pl-3">
              {replies.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center gap-2"><CornerDownRight className="h-3.5 w-3.5 text-ink-300" /><span className="font-semibold text-ink-800">{r.author_name}</span>{r.kind === 'answer' && <Badge tone="green">Teacher</Badge>}<span className="text-xs text-ink-400">{fromNow(r.created_at)}</span>
                    {(canModerate || r.user_id === user?.id) && <button className="ml-auto text-ink-300 hover:text-red-600" aria-label="Remove reply" onClick={() => onUpdate(r.id, { deleted_at: new Date().toISOString() })}><Trash2 className="h-3.5 w-3.5" /></button>}</div>
                  <p className="ml-5 whitespace-pre-wrap text-ink-700">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
          {replying && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onReply(text.trim()); setText(''); setReplying(false); } }}>
              <label className="sr-only" htmlFor={`reply-${m.id}`}>Reply</label>
              <input id={`reply-${m.id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} className="h-9 flex-1 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Write a reply…" autoFocus />
              <Button type="submit" size="sm">Reply</Button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

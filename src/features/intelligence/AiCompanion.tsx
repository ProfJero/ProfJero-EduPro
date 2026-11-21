import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Bot, HelpCircle, Lightbulb, ListChecks, MessageSquarePlus, Send, Sparkles, Square, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, PageHeader, Select, Textarea } from '@/components/ui';
import { Markdown } from '@/components/app/Markdown';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { aiAvailable, streamChat, type Citation } from './aiClient';

const MODES = [
  { id: 'explain', label: 'Explain', icon: Lightbulb, hint: 'Clear explanations with Ghanaian examples' },
  { id: 'hint', label: 'Guide me', icon: HelpCircle, hint: 'Hints and questions — not the answer' },
  { id: 'quiz', label: 'Quiz me', icon: ListChecks, hint: 'Practice questions with feedback' },
  { id: 'summary', label: 'Summarise', icon: BookOpenCheck, hint: 'Key points and revision notes' },
] as const;
const GRADES = ['Basic 7', 'Basic 8', 'Basic 9', 'Basic 10', 'SHS 1', 'SHS 2', 'SHS 3', 'Tertiary'];
type Msg = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[] };

export function AiCompanion() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const lessonId = params.get('lesson') ?? undefined;
  const [convId, setConvId] = useState<string | undefined>(params.get('c') ?? undefined);
  const [mode, setMode] = useState<string>('explain');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [input, setInput] = useState(params.get('q') ?? '');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({ queryKey: ['ai-convs', user?.id], enabled: Boolean(user), queryFn: async () => unwrap(await supabase.from('ai_conversations').select('id, title, updated_at').eq('user_id', user!.id).eq('mode', 'tutor').order('updated_at', { ascending: false }).limit(30)) });
  const subjects = useQuery({ queryKey: ['curriculum-subjects'], staleTime: 3_600_000, queryFn: async () => unwrap(await supabase.from('curriculum_items').select('title').eq('kind', 'subject').eq('status', 'approved').order('position')) });
  const lesson = useQuery({ queryKey: ['ai-lesson', lessonId], enabled: Boolean(lessonId), queryFn: async () => unwrap(await supabase.from('lessons').select('title').eq('id', lessonId!).maybeSingle()) });

  useEffect(() => {
    if (!convId) { setMsgs([]); return; }
    let live = true;
    void supabase.from('ai_messages').select('id, role, content, citations').eq('conversation_id', convId).order('created_at').then(({ data }) => {
      if (live && data) setMsgs(data.map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, citations: (m.citations as Citation[]) ?? [] })));
    });
    return () => { live = false; };
  }, [convId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs]);

  const send = async (text = input) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput(''); setError(null); setBusy(true);
    const aId = `a-${Date.now()}`;
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: message }, { id: aId, role: 'assistant', content: '' }]);
    abort.current = new AbortController();
    await streamChat({ conversation_id: convId, message, mode, lesson_id: lessonId, subject: subject || undefined, grade: grade || undefined }, (e) => {
      if (e.type === 'meta') { setRemaining(e.remaining); if (!convId) { setConvId(e.conversation_id); setParams((p) => { p.set('c', e.conversation_id); return p; }, { replace: true }); } setMsgs((m) => m.map((x) => (x.id === aId ? { ...x, citations: e.citations } : x))); }
      else if (e.type === 'delta') setMsgs((m) => m.map((x) => (x.id === aId ? { ...x, content: x.content + e.text } : x)));
      else if (e.type === 'error') { setError(e.message); setMsgs((m) => m.filter((x) => !(x.id === aId && !x.content))); }
    }, abort.current.signal);
    setBusy(false);
    void qc.invalidateQueries({ queryKey: ['ai-convs'] });
  };
  const newChat = () => { abort.current?.abort(); setConvId(undefined); setMsgs([]); setParams((p) => { p.delete('c'); return p; }, { replace: true }); };
  const remove = async (id: string) => { await supabase.from('ai_conversations').delete().eq('id', id); if (id === convId) newChat(); void qc.invalidateQueries({ queryKey: ['ai-convs'] }); };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="EduIntelligence" title="AI Companion" description="Your study partner, grounded in the approved GES/NaCCA curriculum and your lessons. It helps you understand — it won’t do graded work for you."
        actions={<Button variant="secondary" leftIcon={<MessageSquarePlus className="h-4 w-4" />} onClick={newChat}>New chat</Button>} />
      {!aiAvailable() && <Alert tone="warning" title="AI service not connected">The AI Companion needs the ProfJero Edu API service with an AI key configured by the administrator.</Alert>}
      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden space-y-1 lg:block">
          <p className="px-2 text-xs font-bold uppercase tracking-wider text-ink-400">Recent chats</p>
          {(convs.data ?? []).map((c) => (
            <div key={c.id} className={cn('group flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm', c.id === convId ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-50')}>
              <button className="min-w-0 flex-1 text-left" onClick={() => { setConvId(c.id); setParams((p) => { p.set('c', c.id); return p; }, { replace: true }); }}><span className="block truncate font-medium">{c.title}</span><span className="text-xs text-ink-400">{fromNow(c.updated_at)}</span></button>
              <button className="rounded p-1 text-ink-300 opacity-0 hover:text-red-600 group-hover:opacity-100" onClick={() => void remove(c.id)} aria-label="Delete chat"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {!convs.data?.length && <p className="px-2 text-sm text-ink-500">Your chats appear here.</p>}
        </aside>
        <Card className="flex min-h-[60vh] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3">
            {MODES.map((m) => <button key={m.id} title={m.hint} onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold', mode === m.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-ink-600 hover:border-brand-300')}><m.icon className="h-4 w-4" />{m.label}</button>)}
            <div className="ml-auto flex gap-2">
              <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto py-1.5 text-sm" aria-label="Subject"><option value="">Any subject</option>{subjects.data?.map((s) => <option key={s.title}>{s.title}</option>)}</Select>
              <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-auto py-1.5 text-sm" aria-label="Class level"><option value="">Any level</option>{GRADES.map((g) => <option key={g}>{g}</option>)}</Select>
            </div>
          </div>
          {lessonId && <p className="border-b border-ink-100 bg-teal-50/60 px-4 py-2 text-sm text-teal-700">Using your lesson <b>{lesson.data?.title ?? '…'}</b> as context.</p>}
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {!msgs.length && (
              <div className="mx-auto max-w-lg py-10 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Bot className="h-7 w-7" /></span>
                <h2 className="mt-3 text-lg font-bold">What would you like to learn today?</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">{['Explain photosynthesis simply', 'Help me understand simultaneous equations', 'Quiz me on the parts of a computer', 'Summarise the causes of the 1948 riots'].map((s) => <button key={s} onClick={() => void send(s)} className="rounded-xl border border-ink-200 p-3 text-left text-sm hover:border-brand-300 hover:bg-brand-50/50">{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Sparkles className="h-4 w-4" /></span>}
                <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-ink-50')}>
                  {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.content}</p> : m.content ? <Markdown text={m.content} /> : <span className="inline-flex gap-1" aria-label="Thinking"><span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-ink-400 [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-ink-400 [animation-delay:240ms]" /></span>}
                  {m.citations && m.citations.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{m.citations.slice(0, 6).map((c, i) => <Badge key={i} tone="green" className="text-[0.65rem]">{c.code ? `${c.code} · ` : ''}{c.title.slice(0, 60)}</Badge>)}</div>}
                </div>
              </div>
            ))}
            {error && <Alert tone="error">{error}</Alert>}
            <div ref={endRef} />
          </div>
          <form className="border-t border-ink-100 p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <div className="flex items-end gap-2">
              <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} placeholder="Ask anything about your studies…" aria-label="Message"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} className="resize-none" />
              {busy ? <Button variant="secondary" onClick={() => abort.current?.abort()} aria-label="Stop"><Square className="h-4 w-4" /></Button> : <Button type="submit" disabled={!input.trim() || !aiAvailable()} aria-label="Send"><Send className="h-4 w-4" /></Button>}
            </div>
            <p className="mt-1.5 text-xs text-ink-400">AI can make mistakes — check important facts with your teacher or textbook.{remaining != null && ` · ${remaining} requests left today`}</p>
          </form>
        </Card>
      </div>
    </div>
  );
}

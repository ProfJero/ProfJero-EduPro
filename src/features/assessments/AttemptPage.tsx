import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, Loader2, Save, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, ConfirmDialog, EmptyState, Input, LoadingBlock, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, errorMessage } from '@/lib/utils';
import { fmtDateTime } from '@/lib/dates';

export type AttemptQuestion = {
  id: string; type: string; prompt: string; marks: number; options: { id: string; label: string }[];
  data: { left?: { id: string; text: string }[]; right?: { id: string; text: string }[]; items?: { id: string; text: string }[] };
  response: Record<string, unknown>; awarded_marks?: number | null; is_correct?: boolean | null; needs_manual?: boolean; feedback?: string | null; explanation?: string | null; answer_key?: Record<string, unknown> | null;
};
export type AttemptPayload = {
  attempt: { id: string; status: string; attempt_no: number; started_at: string; deadline_at: string | null; submitted_at: string | null; auto_submitted: boolean; user_id: string; learner_name: string };
  assessment: { id: string; title: string; instructions: string; kind: string; pass_mark_pct: number; max_attempts: number; closes_at: string | null; results_visibility: string; course_id: string | null; class_id: string | null };
  server_now: string; released: boolean; is_manager: boolean; questions: AttemptQuestion[];
  result: { score: number; max_score: number; percentage: number; passed: boolean; pending_manual: boolean } | null;
};

export function useAttempt(attemptId?: string) {
  return useQuery({
    queryKey: ['attempt', attemptId],
    enabled: Boolean(attemptId),
    queryFn: async () => unwrap(await supabase.rpc('get_attempt', { p_attempt: attemptId! })) as unknown as AttemptPayload,
    refetchOnWindowFocus: false,
  });
}

export function AttemptPage() {
  const { attemptId } = useParams();
  const { data, isLoading, error } = useAttempt(attemptId);
  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <EmptyState title="Attempt not available" description={errorMessage(error)} />;
  return data.attempt.status === 'in_progress' ? <TakeAttempt payload={data} /> : <AttemptReview payload={data} back={{ to: `/learn/assessments/${data.assessment.id}`, label: 'Assessment' }} />;
}

// ---------------------------------------------------------------------------
function TakeAttempt({ payload }: { payload: AttemptPayload }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { attempt, assessment, questions } = payload;
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>(() => Object.fromEntries(questions.map((q) => [q.id, q.response ?? {}])));
  const [i, setI] = useState(0);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Record<string, unknown>>>({});
  const skew = useMemo(() => new Date(payload.server_now).getTime() - Date.now(), [payload.server_now]);
  const deadline = attempt.deadline_at ? new Date(attempt.deadline_at).getTime() : null;
  const [left, setLeft] = useState<number | null>(deadline ? deadline - (Date.now() + skew) : null);

  const flush = useCallback(async (qid: string) => {
    const resp = pending.current[qid];
    if (!resp) return;
    delete pending.current[qid];
    setSaveState('saving');
    const { error } = await supabase.rpc('save_answer', { p_attempt: attempt.id, p_question: qid, p_response: resp as never });
    if (error) {
      setSaveState('error');
      if (/submitted|Time is up/i.test(error.message)) {
        toast.info('Attempt submitted', error.message);
        void qc.invalidateQueries({ queryKey: ['attempt', attempt.id] });
      } else pending.current[qid] = resp; // keep for retry
    } else setSaveState('saved');
  }, [attempt.id, qc, toast]);

  const setAnswer = (qid: string, resp: Record<string, unknown>) => {
    setAnswers((a) => ({ ...a, [qid]: resp }));
    pending.current[qid] = resp;
    clearTimeout(timers.current[qid]);
    timers.current[qid] = setTimeout(() => void flush(qid), 700);
  };
  const flushAll = async () => {
    Object.values(timers.current).forEach(clearTimeout);
    await Promise.all(Object.keys(pending.current).map((k) => flush(k)));
  };

  const submit = useCallback(async () => {
    setSubmitting(true);
    await flushAll();
    const { error } = await supabase.rpc('submit_attempt', { p_attempt: attempt.id });
    setSubmitting(false);
    setConfirm(false);
    if (error) return toast.error('Submission failed', errorMessage(error));
    toast.success('Submitted', 'Your answers have been submitted.');
    void qc.invalidateQueries({ queryKey: ['attempt', attempt.id] });
    void qc.invalidateQueries({ queryKey: ['my-assessments'] });
    void qc.invalidateQueries({ queryKey: ['progress'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const ms = deadline - (Date.now() + skew);
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(t);
        void submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, skew, submit]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const q = questions[i];
  const answered = (qq: AttemptQuestion) => isAnswered(qq, answers[qq.id]);
  const unanswered = questions.filter((qq) => !answered(qq)).length;
  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky top-16 z-10 -mx-4 mb-6 border-b border-ink-200 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><p className="truncate font-bold text-ink-900">{assessment.title}</p><p className="text-xs text-ink-500">Attempt {attempt.attempt_no} · Question {i + 1} of {questions.length}</p></div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-ink-500" aria-live="polite">{saveState === 'saving' ? <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Saving</> : saveState === 'saved' ? <><Save className="mr-1 inline h-3 w-3" />Saved</> : saveState === 'error' ? <span className="text-red-600">Not saved — retrying</span> : null}</span>
            {left != null && <span role="timer" aria-label="Time remaining" className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold', left < 60_000 ? 'bg-red-50 text-red-700' : left < 300_000 ? 'bg-sun-50 text-sun-700' : 'bg-ink-100 text-ink-800')}><Clock className="h-4 w-4" />{fmtLeft(left)}</span>}
            <Button size="sm" onClick={() => setConfirm(true)}>Submit</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_14rem]">
        <Card>
          <CardBody className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Question {i + 1} · {Number(q.marks)} mark{Number(q.marks) === 1 ? '' : 's'}</p>
              <button onClick={() => setFlags((f) => { const n = new Set(f); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })} className={cn('inline-flex items-center gap-1 text-xs font-semibold', flags.has(q.id) ? 'text-sun-700' : 'text-ink-400 hover:text-ink-700')} aria-pressed={flags.has(q.id)}><Flag className="h-3.5 w-3.5" />{flags.has(q.id) ? 'Flagged' : 'Flag for review'}</button>
            </div>
            <h2 id={`q-${q.id}`} className="whitespace-pre-wrap text-lg font-semibold text-ink-900">{q.prompt}</h2>
            <QuestionInput q={q} value={answers[q.id] ?? {}} onChange={(v) => setAnswer(q.id, v)} />
            <div className="flex justify-between border-t border-ink-100 pt-4">
              <Button variant="outline" disabled={i === 0} onClick={() => { void flushAll(); setI(i - 1); }} leftIcon={<ChevronLeft className="h-4 w-4" />}>Previous</Button>
              {i < questions.length - 1 ? <Button onClick={() => { void flushAll(); setI(i + 1); }}>Next<ChevronRight className="h-4 w-4" /></Button> : <Button variant="success" onClick={() => setConfirm(true)}>Review & submit</Button>}
            </div>
          </CardBody>
        </Card>
        <nav aria-label="Questions" className="card h-fit p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Questions</p>
          <ol className="mt-3 grid grid-cols-6 gap-2 lg:grid-cols-4">
            {questions.map((qq, j) => (
              <li key={qq.id}><button onClick={() => { void flushAll(); setI(j); }} aria-current={j === i ? 'step' : undefined} aria-label={`Question ${j + 1}${answered(qq) ? ', answered' : ''}${flags.has(qq.id) ? ', flagged' : ''}`}
                className={cn('relative flex h-10 w-full items-center justify-center rounded-lg border text-sm font-bold', j === i ? 'border-brand-600 bg-brand-600 text-white' : answered(qq) ? 'border-growth-500/40 bg-growth-50 text-growth-700' : 'border-ink-200 text-ink-600 hover:border-ink-300')}>
                {j + 1}{flags.has(qq.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-sun-500" />}
              </button></li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-500">{questions.length - unanswered} of {questions.length} answered</p>
        </nav>
      </div>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Submit your answers?" confirmLabel="Submit now" loading={submitting} onConfirm={() => void submit()}
        description={unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You cannot change answers after submitting.` : 'You cannot change your answers after submitting.'} />
    </div>
  );
}

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`;
}

export function isAnswered(q: AttemptQuestion, v: Record<string, unknown> | undefined) {
  if (!v) return false;
  switch (q.type) {
    case 'multiple_choice': case 'true_false': return Boolean(v.option_id);
    case 'multiple_select': return Array.isArray(v.option_ids) && v.option_ids.length > 0;
    case 'matching': return Boolean(v.pairs && Object.keys(v.pairs as object).length);
    case 'ordering': return Array.isArray(v.order) && v.order.length > 0;
    case 'file_upload': return Boolean(v.url);
    default: return typeof v.text === 'string' && v.text.trim().length > 0;
  }
}

function QuestionInput({ q, value, onChange, readOnly }: { q: AttemptQuestion; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; readOnly?: boolean }) {
  const labelled = { 'aria-labelledby': `q-${q.id}` };
  switch (q.type) {
    case 'multiple_choice':
    case 'true_false':
      return (
        <div role="radiogroup" {...labelled} className="space-y-2.5">
          {q.options.map((o) => (
            <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition', value.option_id === o.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300')}>
              <input type="radio" name={q.id} className="h-4 w-4 accent-brand-600" checked={value.option_id === o.id} disabled={readOnly} onChange={() => onChange({ option_id: o.id })} />
              <span className="text-ink-800">{o.label}</span>
            </label>
          ))}
        </div>
      );
    case 'multiple_select': {
      const sel = new Set((value.option_ids as string[]) ?? []);
      return (
        <fieldset {...labelled} className="space-y-2.5">
          <p className="text-sm text-ink-500">Select all that apply.</p>
          {q.options.map((o) => (
            <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5', sel.has(o.id) ? 'border-brand-600 bg-brand-50' : 'border-ink-200 hover:border-ink-300')}>
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={sel.has(o.id)} disabled={readOnly} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(o.id); else n.delete(o.id); onChange({ option_ids: [...n] }); }} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    case 'fill_blank':
    case 'short_answer':
      return <Input {...labelled} value={(value.text as string) ?? ''} disabled={readOnly} maxLength={500} onChange={(e) => onChange({ text: e.target.value })} placeholder="Type your answer" />;
    case 'essay':
      return <Textarea {...labelled} rows={10} value={(value.text as string) ?? ''} disabled={readOnly} maxLength={20000} onChange={(e) => onChange({ text: e.target.value })} placeholder="Write your answer…" />;
    case 'file_upload':
      return (
        <div className="space-y-2">
          <Input {...labelled} type="url" value={(value.url as string) ?? ''} disabled={readOnly} onChange={(e) => onChange({ url: e.target.value })} placeholder="https:// link to your file (e.g. Google Drive, shared with your teacher)" />
          <p className="text-xs text-ink-500">Share a secure link to your work. Make sure your teacher has permission to open it.</p>
        </div>
      );
    case 'matching': {
      const pairs = (value.pairs as Record<string, string>) ?? {};
      return (
        <div className="space-y-3" {...labelled} role="group">
          {(q.data.left ?? []).map((l) => (
            <div key={l.id} className="grid items-center gap-2 rounded-xl border border-ink-200 p-3 sm:grid-cols-2">
              <span className="font-medium text-ink-800">{l.text}</span>
              <Select aria-label={`Match for ${l.text}`} value={pairs[l.id] ?? ''} disabled={readOnly} onChange={(e) => onChange({ pairs: { ...pairs, [l.id]: e.target.value } })}>
                <option value="">Choose a match…</option>
                {(q.data.right ?? []).map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </Select>
            </div>
          ))}
        </div>
      );
    }
    case 'ordering': {
      const items = q.data.items ?? [];
      const order = ((value.order as string[])?.length ? (value.order as string[]) : items.map((x) => x.id));
      const move = (idx: number, d: -1 | 1) => { const n = [...order]; const j = idx + d; [n[idx], n[j]] = [n[j], n[idx]]; onChange({ order: n }); };
      return (
        <ol className="space-y-2" {...labelled}>
          <p className="text-sm text-ink-500">Put the items in the correct order using the arrows.</p>
          {order.map((id, idx) => (
            <li key={id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-surface px-3 py-2.5">
              <span className="w-6 text-center text-sm font-bold text-ink-400">{idx + 1}</span>
              <span className="flex-1">{items.find((x) => x.id === id)?.text}</span>
              {!readOnly && <>
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Move up" className="h-8 w-8"><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={idx === order.length - 1} onClick={() => move(idx, 1)} aria-label="Move down" className="h-8 w-8"><ArrowDown className="h-4 w-4" /></Button>
              </>}
            </li>
          ))}
        </ol>
      );
    }
    default:
      return <p className="text-sm text-ink-500">Unsupported question type.</p>;
  }
}

// ---------------------------------------------------------------------------
export function AttemptReview({ payload, back, grader }: { payload: AttemptPayload; back: { to: string; label: string }; grader?: React.ReactNode }) {
  const { attempt, assessment, result, released, questions } = payload;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader back={back} eyebrow={`Attempt ${attempt.attempt_no}${payload.is_manager ? ` · ${attempt.learner_name}` : ''}`} title={assessment.title}
        description={`Submitted ${fmtDateTime(attempt.submitted_at)}${attempt.auto_submitted ? ' (automatically when time ran out)' : ''}`} />
      {!released ? (
        <Alert tone="info" title="Submitted — results not released yet">{assessment.results_visibility === 'after_close' ? `Results are released after the assessment closes${assessment.closes_at ? ` (${fmtDateTime(assessment.closes_at)})` : ''}.` : 'Your teacher will release results after marking.'}</Alert>
      ) : result && (
        <Card className={cn('overflow-hidden', result.passed ? 'ring-2 ring-growth-500/30' : '')}>
          <CardBody className="flex flex-wrap items-center gap-6">
            <div className={cn('flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-extrabold', result.pending_manual ? 'bg-brand-50 text-brand-700' : result.passed ? 'bg-growth-50 text-growth-700' : 'bg-sun-50 text-sun-700')}>{Math.round(Number(result.percentage))}%</div>
            <div>
              <p className="text-xl font-extrabold">{result.pending_manual ? 'Awaiting teacher marking' : result.passed ? 'Passed 🎉' : 'Not passed yet'}</p>
              <p className="text-ink-600">Score {Number(result.score)} / {Number(result.max_score)} · pass mark {Number(assessment.pass_mark_pct)}%</p>
            </div>
            {!payload.is_manager && <Link to={`/learn/assessments/${assessment.id}`} className="ml-auto text-sm font-semibold text-brand-700">Back to assessment</Link>}
          </CardBody>
        </Card>
      )}
      {grader}
      {(released || payload.is_manager) && questions.map((q, n) => (
        <Card key={q.id}>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Question {n + 1} · {q.type.replace(/_/g, ' ')}</p>
              {q.needs_manual && q.awarded_marks == null ? <Badge tone="brand">Needs marking</Badge> : q.is_correct ? <Badge tone="green" icon={<CheckCircle2 className="h-3 w-3" />}>{Number(q.awarded_marks)}/{Number(q.marks)}</Badge> : <Badge tone={Number(q.awarded_marks) > 0 ? 'amber' : 'red'} icon={<XCircle className="h-3 w-3" />}>{Number(q.awarded_marks ?? 0)}/{Number(q.marks)}</Badge>}
            </div>
            <p id={`q-${q.id}`} className="whitespace-pre-wrap font-semibold text-ink-900">{q.prompt}</p>
            <QuestionInput q={q} value={q.response ?? {}} onChange={() => undefined} readOnly />
            {q.answer_key && <CorrectAnswer q={q} />}
            {q.feedback && <Alert tone="info" title="Teacher feedback">{q.feedback}</Alert>}
            {q.explanation && <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-700"><strong>Explanation: </strong>{q.explanation}</p>}
            {payload.is_manager && q.needs_manual && <GradeQuestion attemptId={attempt.id} q={q} />}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function CorrectAnswer({ q }: { q: AttemptQuestion }) {
  const k = q.answer_key ?? {};
  let text = '';
  if (Array.isArray(k.correct)) text = q.options.filter((o) => (k.correct as string[]).includes(o.id)).map((o) => o.label).join(', ');
  else if (Array.isArray(k.accepted)) text = (k.accepted as string[]).join(' / ');
  else if (k.pairs) text = Object.entries(k.pairs as Record<string, string>).map(([l, r]) => `${q.data.left?.find((x) => x.id === l)?.text} → ${q.data.right?.find((x) => x.id === r)?.text}`).join('; ');
  else if (Array.isArray(k.order)) text = (k.order as string[]).map((id) => q.data.items?.find((x) => x.id === id)?.text).join(' → ');
  if (!text) return null;
  return <p className="rounded-xl bg-growth-50 p-3 text-sm text-growth-700"><strong>Correct answer: </strong>{text}</p>;
}

function GradeQuestion({ attemptId, q }: { attemptId: string; q: AttemptQuestion }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [marks, setMarks] = useState(q.awarded_marks != null ? String(q.awarded_marks) : '');
  const [fb, setFb] = useState(q.feedback ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="text-sm font-bold text-ink-900">Mark this answer</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label className="text-sm"><span className="mb-1 block font-semibold">Marks (max {Number(q.marks)})</span><Input type="number" min={0} max={Number(q.marks)} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Feedback</span><Textarea rows={2} value={fb} onChange={(e) => setFb(e.target.value)} /></label>
      </div>
      <Button size="sm" className="mt-3" loading={busy} disabled={marks === ''} onClick={async () => {
        setBusy(true);
        const { error } = await supabase.rpc('grade_answer', { p_attempt: attemptId, p_question: q.id, p_marks: Number(marks), p_feedback: fb || null as never });
        setBusy(false);
        if (error) toast.error('Could not save mark', error.message); else { toast.success('Mark saved'); void qc.invalidateQueries({ queryKey: ['attempt', attemptId] }); }
      }}>Save mark</Button>
    </div>
  );
}

/** Teacher view of a learner's attempt with manual grading. */
export function GradeAttemptPage() {
  const { attemptId } = useParams();
  const { data, isLoading, error } = useAttempt(attemptId);
  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <EmptyState title="Attempt not available" description={errorMessage(error)} />;
  if (data.attempt.status === 'in_progress') return <Alert tone="info">This attempt is still in progress.</Alert>;
  return <AttemptReview payload={data} back={{ to: `/teach/assessments/${data.assessment.id}?tab=results`, label: 'Results' }} />;
}

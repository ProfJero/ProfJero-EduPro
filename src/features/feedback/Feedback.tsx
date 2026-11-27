import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, BarChart3, CheckCircle2, Copy, Download, Eye, Lock, MessageSquareHeart, Play, Plus, Square, Trash2, X } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, CardHeader, Checkbox, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { downloadCsv } from '@/features/classroom/Roster';

export type QType = 'rating' | 'scale' | 'choice' | 'multi' | 'yesno' | 'text';
export type Question = { id: string; type: QType; label: string; required?: boolean; options?: string[]; hint?: string };
type Form = { id: string; title: string; description: string | null; audience: 'all' | 'learners' | 'teachers'; questions: Question[]; status: 'draft' | 'open' | 'closed';
  anonymous: boolean; nudge: boolean; closes_at: string | null; opened_at: string | null; created_at: string };
type Answers = Record<string, number | string | string[]>;

export const TYPE_LABELS: Record<QType, string> = { rating: 'Star rating (1–5)', scale: 'Score 0–10', choice: 'Pick one', multi: 'Pick any', yesno: 'Yes / No', text: 'Written answer' };
const AUDIENCE = { all: 'Everyone', learners: 'Learners', teachers: 'Teachers' };
const qid = () => Math.random().toString(36).slice(2, 9);

export const TEMPLATES: { name: string; title: string; description: string; audience: Form['audience']; questions: Omit<Question, 'id'>[] }[] = [
  { name: 'Platform experience', title: 'How is ProfJero Edu working for you?', description: 'Help us improve the platform. It takes about a minute.', audience: 'all', questions: [
    { type: 'rating', label: 'Overall, how would you rate ProfJero Edu?', required: true },
    { type: 'scale', label: 'How likely are you to recommend ProfJero Edu to a friend?', required: true },
    { type: 'multi', label: 'Which parts do you use most?', options: ['Classes', 'Lessons & courses', 'EduLab', 'AI Companion', 'Discussions', 'Challenge Arena', 'Calendar'] },
    { type: 'choice', label: 'How easy is it to find what you need?', options: ['Very easy', 'Easy', 'Okay', 'Hard', 'Very hard'] },
    { type: 'text', label: 'What should we improve or add?' },
  ] },
  { name: 'Learning experience (learners)', title: 'Your learning experience', description: 'Tell us how learning on ProfJero Edu feels.', audience: 'learners', questions: [
    { type: 'rating', label: 'How helpful are the lessons and materials?', required: true },
    { type: 'yesno', label: 'Do you understand topics better after using ProfJero Edu?', required: true },
    { type: 'choice', label: 'Which device do you mostly use?', options: ['Phone', 'Tablet', 'Laptop / computer', 'School computer lab'] },
    { type: 'choice', label: 'How is your internet when using the platform?', options: ['Good', 'Sometimes slow', 'Often slow', 'I use low-data mode'] },
    { type: 'text', label: 'What do you enjoy most?' },
    { type: 'text', label: 'What is difficult for you?' },
  ] },
  { name: 'Teaching tools (teachers)', title: 'Teaching with ProfJero Edu', description: 'Your feedback shapes the teacher tools.', audience: 'teachers', questions: [
    { type: 'rating', label: 'How useful are the class tools (register, groups, scores)?', required: true },
    { type: 'scale', label: 'How much time does ProfJero Edu save you each week? (0 = none, 10 = a lot)' },
    { type: 'multi', label: 'Which tools do you use?', options: ['Roll call', 'Score sheets', 'Assignments', 'Live classes', 'Class board', 'Study groups', 'AI resource studio'] },
    { type: 'text', label: 'Which tool would make your teaching easier?' },
  ] },
];

/* ------------------------------------------------------------------ admin */

export function AdminFeedback() {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const forms = useQuery({ queryKey: ['feedback-forms'], queryFn: async () => unwrap(await supabase.from('feedback_forms').select('*').order('created_at', { ascending: false })) as unknown as Form[] });
  const overview = useQuery({ queryKey: ['feedback-overview'], queryFn: async () => unwrap(await supabase.rpc('feedback_overview')) as { form_id: string; responses: number; learners: number; teachers: number }[] });
  const counts = new Map((overview.data ?? []).map((o) => [o.form_id, o]));
  const create = useMutation({
    mutationFn: async (t?: (typeof TEMPLATES)[number]) => unwrap(await supabase.from('feedback_forms').insert({
      title: t?.title ?? 'Untitled feedback form', description: t?.description ?? null, audience: t?.audience ?? 'all',
      questions: (t?.questions ?? [{ type: 'rating', label: 'How would you rate ProfJero Edu?', required: true }]).map((q) => ({ ...q, id: qid() })),
    }).select('id').single()),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['feedback-forms'] }); nav(`/admin/feedback/${r.id}`); },
    onError: (e) => toast.error('Could not create', errorMessage(e)),
  });
  return (
    <div>
      <PageHeader title="Feedback" description="Ask learners and teachers about their experience. They answer in the app and are notified when a form opens." />
      <Card className="mb-6"><CardHeader title="Start a new form" description="Begin from a ready-made template or a blank form. Nothing is sent until you open it." />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => create.mutate(t)} disabled={create.isPending} className="rounded-2xl border border-ink-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300">
              <MessageSquareHeart className="h-5 w-5 text-rose-600" /><p className="mt-2 font-bold">{t.name}</p><p className="text-xs text-ink-500">{t.questions.length} questions · {AUDIENCE[t.audience]}</p>
            </button>
          ))}
          <button onClick={() => create.mutate(undefined)} disabled={create.isPending} className="rounded-2xl border border-dashed border-ink-300 p-4 text-left hover:border-brand-300">
            <Plus className="h-5 w-5 text-brand-600" /><p className="mt-2 font-bold">Blank form</p><p className="text-xs text-ink-500">Write your own questions</p>
          </button>
        </CardBody>
      </Card>
      {forms.isLoading ? <LoadingBlock /> : forms.data?.length ? (
        <ul className="space-y-3">{forms.data.map((f) => {
          const c = counts.get(f.id);
          return (
            <li key={f.id}><Link to={`/admin/feedback/${f.id}`} className="card flex flex-wrap items-center gap-3 p-4 hover:border-brand-300">
              <div className="min-w-0 flex-1"><p className="font-bold">{f.title}</p><p className="text-xs text-ink-500">{AUDIENCE[f.audience]} · {f.questions.length} questions{f.anonymous ? ' · anonymous' : ''} · created {fmtDate(f.created_at)}</p></div>
              <Badge tone="brand">{c?.responses ?? 0} response{Number(c?.responses) === 1 ? '' : 's'}</Badge>
              <Badge tone={f.status === 'open' ? 'green' : f.status === 'closed' ? 'neutral' : 'amber'}>{f.status === 'open' ? 'Open' : f.status === 'closed' ? 'Closed' : 'Draft'}</Badge>
            </Link></li>
          );
        })}</ul>
      ) : <EmptyState icon={<MessageSquareHeart className="h-7 w-7" />} title="No feedback forms yet" description="Pick a template above to get started." />}
    </div>
  );
}

export function AdminFeedbackForm() {
  const { formId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const form = useQuery({ queryKey: ['feedback-form', formId], queryFn: async () => unwrap(await supabase.from('feedback_forms').select('*').eq('id', formId!).single()) as unknown as Form });
  const results = useQuery({ queryKey: ['feedback-results', formId], queryFn: async () => unwrap(await supabase.rpc('feedback_results', { p_form: formId! })) as { id: string; respondent: string | null; respondent_role: string; answers: Answers; created_at: string }[] });
  const [draft, setDraft] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<'open' | 'close' | 'delete' | null>(null);
  useEffect(() => { if (form.data) setDraft(form.data); }, [form.data]);
  const locked = (results.data?.length ?? 0) > 0;
  const save = useMutation({
    mutationFn: async (patch: Partial<Form>) => unwrap(await supabase.from('feedback_forms').update(patch).eq('id', formId!)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feedback-form', formId] }); void qc.invalidateQueries({ queryKey: ['feedback-forms'] }); },
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  const dup = useMutation({
    mutationFn: async () => unwrap(await supabase.from('feedback_forms').insert({ title: `${draft!.title} (copy)`, description: draft!.description, audience: draft!.audience, anonymous: draft!.anonymous, questions: draft!.questions }).select('id').single()),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['feedback-forms'] }); nav(`/admin/feedback/${r.id}`); toast.success('Copy created'); },
  });
  const del = useMutation({ mutationFn: async () => unwrap(await supabase.from('feedback_forms').delete().eq('id', formId!)), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feedback-forms'] }); nav('/admin/feedback'); } });
  if (form.isLoading || !draft) return <LoadingBlock />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(form.data);
  const setQ = (i: number, patch: Partial<Question>) => setDraft({ ...draft, questions: draft.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const move = (i: number, d: number) => { const qs = [...draft.questions]; const [x] = qs.splice(i, 1); qs.splice(i + d, 0, x); setDraft({ ...draft, questions: qs }); };
  const saveAll = () => save.mutate({ title: draft.title.trim(), description: draft.description?.trim() || null, audience: draft.audience, anonymous: draft.anonymous, nudge: draft.nudge, closes_at: draft.closes_at, ...(locked ? {} : { questions: draft.questions }) }, { onSuccess: () => toast.success('Saved') });
  return (
    <div className="space-y-5">
      <PageHeader back={{ to: '/admin/feedback', label: 'Feedback' }} title={draft.title} eyebrow={`${AUDIENCE[draft.audience]} · ${draft.status === 'open' ? 'Open' : draft.status === 'closed' ? 'Closed' : 'Draft'}`}
        actions={<div className="flex flex-wrap gap-2">
          <ButtonLink variant="ghost" to={`/feedback/${draft.id}?preview=1`} leftIcon={<Eye className="h-4 w-4" />}>Preview</ButtonLink>
          <Button variant="secondary" leftIcon={<Copy className="h-4 w-4" />} onClick={() => dup.mutate()}>Duplicate</Button>
          {draft.status === 'open' ? <Button variant="secondary" leftIcon={<Square className="h-4 w-4" />} onClick={() => setConfirm('close')}>Close form</Button>
            : <Button leftIcon={<Play className="h-4 w-4" />} disabled={dirty || !draft.questions.length} onClick={() => setConfirm('open')}>{draft.status === 'closed' ? 'Re-open' : 'Open & notify'}</Button>}
        </div>} />
      {dirty && <Alert tone="warning" action={<Button size="sm" loading={save.isPending} onClick={saveAll}>Save changes</Button>}>You have unsaved changes.</Alert>}
      <Tabs defaultValue="build" tabs={[
        { value: 'build', label: 'Questions', content: (
          <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-3">
              {locked && <Alert tone="info" title="Questions are locked">People have already answered. Duplicate the form to change its questions.</Alert>}
              {draft.questions.map((q, i) => (
                <Card key={q.id}><CardBody className="space-y-3">
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
                    <Select value={q.type} disabled={locked} onChange={(e) => { const type = e.target.value as QType; setQ(i, { type, options: type === 'choice' || type === 'multi' ? q.options?.length ? q.options : ['Option 1', 'Option 2'] : undefined }); }} aria-label="Question type" className="h-9 w-auto py-1 text-sm">
                      {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
                    <span className="flex-1" />
                    {!locked && <><button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-ink-400 hover:bg-ink-50 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === draft.questions.length - 1} className="rounded p-1.5 text-ink-400 hover:bg-ink-50 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                      <button onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })} className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete question"><Trash2 className="h-4 w-4" /></button></>}
                  </div>
                  <Input value={q.label} disabled={locked} onChange={(e) => setQ(i, { label: e.target.value })} maxLength={300} aria-label="Question" placeholder="Type your question" />
                  {(q.type === 'choice' || q.type === 'multi') && (
                    <div className="space-y-2">{(q.options ?? []).map((o, k) => (
                      <div key={k} className="flex gap-2"><Input value={o} disabled={locked} onChange={(e) => setQ(i, { options: q.options!.map((x, m) => (m === k ? e.target.value : x)) })} maxLength={120} aria-label={`Option ${k + 1}`} className="h-9" />
                        {!locked && (q.options?.length ?? 0) > 2 && <button onClick={() => setQ(i, { options: q.options!.filter((_, m) => m !== k) })} className="rounded p-2 text-ink-400 hover:text-red-600" aria-label="Remove option"><X className="h-4 w-4" /></button>}</div>
                    ))}{!locked && (q.options?.length ?? 0) < 12 && <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setQ(i, { options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`] })}>Add option</Button>}</div>
                  )}
                  <Checkbox label="Required" checked={Boolean(q.required)} disabled={locked} onChange={(e) => setQ(i, { required: e.target.checked })} />
                </CardBody></Card>
              ))}
              {!locked && draft.questions.length < 30 && <div className="flex flex-wrap gap-2">{(Object.keys(TYPE_LABELS) as QType[]).map((t) => (
                <Button key={t} size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setDraft({ ...draft, questions: [...draft.questions, { id: qid(), type: t, label: '', options: t === 'choice' || t === 'multi' ? ['Option 1', 'Option 2'] : undefined }] })}>{TYPE_LABELS[t]}</Button>
              ))}</div>}
            </div>
            <Card className="h-fit"><CardBody className="space-y-4">
              <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={140} /></Field>
              <Field label="Introduction"><Textarea rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={2000} /></Field>
              <Field label="Who should answer"><Select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Form['audience'] })}><option value="all">Everyone</option><option value="learners">Learners only</option><option value="teachers">Teachers only</option></Select></Field>
              <Field label="Closes (optional)"><Input type="datetime-local" value={draft.closes_at ? draft.closes_at.slice(0, 16) : ''} onChange={(e) => setDraft({ ...draft, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
              <Checkbox label="Anonymous" description="Hide who answered. You still see whether they are a learner or teacher." checked={draft.anonymous} disabled={locked} onChange={(e) => setDraft({ ...draft, anonymous: e.target.checked })} />
              <Checkbox label="Gently remind people in the app" description="A small card invites them to answer. They can choose “Later”." checked={draft.nudge} onChange={(e) => setDraft({ ...draft, nudge: e.target.checked })} />
              <Button className="w-full" disabled={!dirty} loading={save.isPending} onClick={saveAll}>Save</Button>
              <Button className="w-full text-red-600" variant="ghost" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('delete')}>Delete form</Button>
            </CardBody></Card>
          </div>
        ) },
        { value: 'results', label: <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Results ({results.data?.length ?? 0})</span>, content: <FeedbackResults form={draft} rows={results.data ?? []} /> },
      ]} />
      <ConfirmDialog open={confirm === 'open'} onOpenChange={(o) => !o && setConfirm(null)} title="Open this form?" confirmLabel="Open & notify" loading={save.isPending}
        description={`${AUDIENCE[draft.audience]} will get a notification and can answer once. ${draft.anonymous ? 'Answers are anonymous.' : 'You will see who answered.'}`}
        onConfirm={() => save.mutate({ status: 'open' }, { onSuccess: () => { setConfirm(null); toast.success('Form is open', 'People are being notified.'); } })} />
      <ConfirmDialog open={confirm === 'close'} onOpenChange={(o) => !o && setConfirm(null)} title="Close this form?" confirmLabel="Close form" loading={save.isPending} description="No more answers will be accepted. You can re-open it later."
        onConfirm={() => save.mutate({ status: 'closed' }, { onSuccess: () => setConfirm(null) })} />
      <ConfirmDialog open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this form?" tone="danger" confirmLabel="Delete" loading={del.isPending} description="The form and all its answers will be permanently removed." onConfirm={() => del.mutate()} />
    </div>
  );
}

function Bar({ label, n, total, tone = 'bg-brand-500' }: { label: string; n: number; total: number; tone?: string }) {
  const p = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(6rem,12rem)_1fr_4rem] items-center gap-2 text-sm">
      <span className="truncate text-ink-700">{label}</span>
      <span className="h-3 overflow-hidden rounded-full bg-ink-100"><span className={cn('block h-full rounded-full', tone)} style={{ width: `${p}%` }} /></span>
      <span className="text-right tabular-nums text-ink-600">{n} · {p}%</span>
    </div>
  );
}

function FeedbackResults({ form, rows }: { form: Form; rows: { id: string; respondent: string | null; respondent_role: string; answers: Answers; created_at: string }[] }) {
  const [role, setRole] = useState<'all' | 'learner' | 'teacher'>('all');
  const list = rows.filter((r) => role === 'all' || r.respondent_role === role);
  if (!rows.length) return <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="No answers yet" description={form.status === 'open' ? 'Answers appear here as people respond.' : 'Open the form to start collecting answers.'} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Respondents" className="w-auto"><option value="all">Everyone ({rows.length})</option><option value="learner">Learners ({rows.filter((r) => r.respondent_role === 'learner').length})</option><option value="teacher">Teachers ({rows.filter((r) => r.respondent_role === 'teacher').length})</option></Select>
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv(`${form.title.replace(/[^\w]+/g, '-')}-answers.csv`, [
          ['Submitted', 'Role', ...(form.anonymous ? [] : ['Name']), ...form.questions.map((q) => q.label)],
          ...list.map((r) => [fmtDateTime(r.created_at), r.respondent_role, ...(form.anonymous ? [] : [r.respondent]), ...form.questions.map((q) => { const a = r.answers[q.id]; return Array.isArray(a) ? a.join('; ') : a == null ? '' : String(a); })]),
        ])}>Export answers</Button>
        {form.anonymous && <Badge icon={<Lock className="h-3 w-3" />}>Anonymous</Badge>}
      </div>
      {form.questions.map((q, i) => {
        const vals = list.map((r) => r.answers[q.id]).filter((a) => a != null && a !== '' && !(Array.isArray(a) && !a.length));
        return (
          <Card key={q.id}><CardBody className="space-y-3">
            <p className="font-bold">{i + 1}. {q.label}</p><p className="-mt-2 text-xs text-ink-500">{vals.length} answer{vals.length === 1 ? '' : 's'}</p>
            {q.type === 'rating' && vals.length > 0 && <>
              <p className="text-3xl font-extrabold">{(vals.reduce((a: number, b) => a + Number(b), 0) / vals.length).toFixed(1)} <span className="text-base font-semibold text-sun-600">{'★'.repeat(Math.round(vals.reduce((a: number, b) => a + Number(b), 0) / vals.length))}</span><span className="text-sm text-ink-400"> / 5</span></p>
              {[5, 4, 3, 2, 1].map((s) => <Bar key={s} label={`${s} star${s > 1 ? 's' : ''}`} n={vals.filter((v) => Number(v) === s).length} total={vals.length} tone="bg-sun-500" />)}
            </>}
            {q.type === 'scale' && vals.length > 0 && (() => {
              const nums = vals.map(Number); const promoters = nums.filter((n) => n >= 9).length; const detractors = nums.filter((n) => n <= 6).length;
              return <><p className="text-sm text-ink-600">Average <b className="text-2xl text-ink-900">{(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)}</b> / 10 · Net score <b>{Math.round(((promoters - detractors) / nums.length) * 100)}</b></p>
                <Bar label="9–10 (big fans)" n={promoters} total={nums.length} tone="bg-growth-500" /><Bar label="7–8" n={nums.length - promoters - detractors} total={nums.length} tone="bg-sun-500" /><Bar label="0–6" n={detractors} total={nums.length} tone="bg-red-500" /></>;
            })()}
            {(q.type === 'choice' || q.type === 'multi') && (q.options ?? []).map((o) => <Bar key={o} label={o} n={vals.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length} total={list.length} />)}
            {q.type === 'yesno' && <><Bar label="Yes" n={vals.filter((v) => v === 'yes').length} total={vals.length} tone="bg-growth-500" /><Bar label="No" n={vals.filter((v) => v === 'no').length} total={vals.length} tone="bg-red-500" /></>}
            {q.type === 'text' && <ul className="max-h-96 space-y-2 overflow-y-auto">{list.filter((r) => r.answers[q.id]).map((r) => (
              <li key={r.id} className="rounded-xl bg-ink-50 p-3 text-sm"><p className="whitespace-pre-wrap text-ink-800">{String(r.answers[q.id])}</p><p className="mt-1 text-xs text-ink-400">{r.respondent ?? (r.respondent_role === 'teacher' ? 'A teacher' : 'A learner')} · {fmtDate(r.created_at)}</p></li>
            ))}</ul>}
          </CardBody></Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- respondents */

export function useOpenFeedback(enabled = true) {
  return useQuery({ queryKey: ['my-open-feedback'], enabled, staleTime: 5 * 60_000, queryFn: async () => (unwrap(await supabase.rpc('my_open_feedback')) ?? []) as (Pick<Form, 'id' | 'title' | 'description' | 'questions' | 'anonymous' | 'nudge' | 'closes_at'>)[] });
}

export function FeedbackList() {
  const open = useOpenFeedback();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Give feedback" description="Tell the ProfJero Edu team how the platform is working for you." />
      {open.isLoading ? <LoadingBlock /> : open.data?.length ? (
        <ul className="space-y-3">{open.data.map((f) => (
          <li key={f.id}><Link to={`/feedback/${f.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300"><MessageSquareHeart className="h-6 w-6 text-rose-600" />
            <div className="min-w-0 flex-1"><p className="font-bold">{f.title}</p><p className="text-xs text-ink-500">{f.questions.length} questions{f.anonymous ? ' · anonymous' : ''}{f.closes_at ? ` · closes ${fmtDate(f.closes_at)}` : ''}</p></div><Badge tone="brand">Answer</Badge></Link></li>
        ))}</ul>
      ) : <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="Nothing to answer right now" description="Thank you! When the team asks for feedback, it will appear here and you’ll get a notification." />}
    </div>
  );
}

const FACES = ['😞', '🙁', '😐', '🙂', '😍'];

export function FeedbackFormPage() {
  const { formId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const preview = new URLSearchParams(location.search).has('preview');
  const form = useQuery({ queryKey: ['feedback-answer', formId], queryFn: async () => unwrap(await supabase.from('feedback_forms').select('id, title, description, questions, anonymous, status, closes_at').eq('id', formId!).maybeSingle()) as unknown as Form | null });
  const done = useQuery({ queryKey: ['feedback-done', formId], queryFn: async () => unwrap(await supabase.from('feedback_responses').select('id').eq('form_id', formId!).maybeSingle()) });
  const [answers, setAnswers] = useState<Answers>({});
  const [sent, setSent] = useState(false);
  const missing = useMemo(() => (form.data?.questions ?? []).filter((q) => q.required && (answers[q.id] == null || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !(answers[q.id] as string[]).length))), [form.data, answers]);
  const submit = useMutation({
    mutationFn: async () => unwrap(await supabase.from('feedback_responses').insert({ form_id: formId!, answers })),
    onSuccess: () => { setSent(true); void qc.invalidateQueries({ queryKey: ['my-open-feedback'] }); },
    onError: (e) => toast.error('Not sent', errorMessage(e)),
  });
  if (form.isLoading || done.isLoading) return <LoadingBlock />;
  if (!form.data) return <EmptyState title="This form is not available" description="It may have closed." action={<ButtonLink to="/feedback">Other forms</ButtonLink>} />;
  if (sent || done.data) return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="text-6xl" aria-hidden>🎉</p><h1 className="mt-4 text-2xl font-extrabold">Thank you!</h1>
      <p className="mt-2 text-ink-600">Your feedback helps make ProfJero Edu better for every learner and teacher.</p>
      <ButtonLink to="/dashboard" className="mt-6">Back to my dashboard</ButtonLink>
    </div>
  );
  const f = form.data;
  const set = (id: string, v: Answers[string]) => setAnswers((a) => ({ ...a, [id]: v }));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={f.title} description={f.description ?? undefined} eyebrow={f.anonymous ? 'Anonymous — your name is not shared' : 'Feedback'} />
      {preview && <Alert tone="info">Preview — this is how learners and teachers see the form.</Alert>}
      {f.questions.map((q, i) => (
        <Card key={q.id}><CardBody className="space-y-3">
          <p className="font-semibold">{i + 1}. {q.label}{q.required && <span className="text-red-600" aria-label="required"> *</span>}</p>
          {q.type === 'rating' && <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.label}>{FACES.map((face, k) => (
            <button key={k} type="button" role="radio" aria-checked={answers[q.id] === k + 1} onClick={() => set(q.id, k + 1)} aria-label={`${k + 1} of 5`}
              className={cn('grid h-14 w-14 place-items-center rounded-2xl border text-3xl transition', answers[q.id] === k + 1 ? 'scale-110 border-brand-500 bg-brand-50 shadow' : 'border-ink-200 hover:border-brand-300')}>{face}</button>))}</div>}
          {q.type === 'scale' && <div><div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="radiogroup" aria-label={q.label}>{Array.from({ length: 11 }, (_, k) => (
            <button key={k} type="button" role="radio" aria-checked={answers[q.id] === k} onClick={() => set(q.id, k)}
              className={cn('h-11 rounded-xl border text-sm font-bold', answers[q.id] === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 hover:border-brand-300')}>{k}</button>))}</div>
            <div className="mt-1 flex justify-between text-xs text-ink-500"><span>Not at all</span><span>Very likely</span></div></div>}
          {q.type === 'yesno' && <div className="flex gap-2">{(['yes', 'no'] as const).map((v) => <Button key={v} type="button" variant={answers[q.id] === v ? 'primary' : 'secondary'} onClick={() => set(q.id, v)} className="min-w-24">{v === 'yes' ? 'Yes' : 'No'}</Button>)}</div>}
          {q.type === 'choice' && <div className="flex flex-wrap gap-2">{(q.options ?? []).map((o) => <button key={o} type="button" onClick={() => set(q.id, o)} aria-pressed={answers[q.id] === o}
            className={cn('rounded-full border px-4 py-2 text-sm font-semibold', answers[q.id] === o ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 hover:border-brand-300')}>{o}</button>)}</div>}
          {q.type === 'multi' && <div className="flex flex-wrap gap-2">{(q.options ?? []).map((o) => { const cur = (answers[q.id] as string[] | undefined) ?? []; const on = cur.includes(o); return (
            <button key={o} type="button" onClick={() => set(q.id, on ? cur.filter((x) => x !== o) : [...cur, o])} aria-pressed={on}
              className={cn('rounded-full border px-4 py-2 text-sm font-semibold', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 hover:border-brand-300')}>{on ? '✓ ' : ''}{o}</button>); })}</div>}
          {q.type === 'text' && <Textarea rows={3} value={(answers[q.id] as string) ?? ''} onChange={(e) => set(q.id, e.target.value)} maxLength={3000} aria-label={q.label} placeholder="Type your answer…" />}
        </CardBody></Card>
      ))}
      {missing.length > 0 && <p className="text-sm text-ink-500">Please answer the questions marked *.</p>}
      <Button size="lg" className="w-full" disabled={preview || missing.length > 0 || f.status !== 'open'} loading={submit.isPending} onClick={() => submit.mutate()}>Send feedback</Button>
    </div>
  );
}

const SNOOZE = 'pje:feedback-later';
/** A small, dismissible invitation to answer an open feedback form. */
export function FeedbackNudge() {
  const open = useOpenFeedback(!navigator.webdriver);
  const [hidden, setHidden] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(SNOOZE) ?? '{}'); } catch { return {}; } });
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 12_000); return () => clearTimeout(t); }, []);
  const form = (open.data ?? []).find((f) => f.nudge && !(hidden[f.id] && Date.now() - hidden[f.id] < 2 * 86_400_000));
  if (!ready || !form || location.pathname.startsWith('/feedback')) return null;
  const later = () => { const next = { ...hidden, [form.id]: Date.now() }; setHidden(next); try { localStorage.setItem(SNOOZE, JSON.stringify(next)); } catch { /* ignore */ } };
  return (
    <div role="dialog" aria-label="Feedback request" className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-sm animate-[sheet-up_0.35s_ease-out] rounded-2xl border border-ink-200 bg-surface p-4 shadow-lift lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
      <div className="flex gap-3"><span className="text-3xl" aria-hidden>💬</span>
        <div className="min-w-0 flex-1"><p className="font-bold">Got a minute?</p><p className="text-sm text-ink-600">{form.title}</p>
          <div className="mt-3 flex gap-2"><ButtonLink size="sm" to={`/feedback/${form.id}`} onClick={later}>Answer now</ButtonLink><Button size="sm" variant="ghost" onClick={later}>Later</Button></div></div>
        <button onClick={later} className="self-start rounded p-1 text-ink-400 hover:text-ink-700" aria-label="Close"><X className="h-4 w-4" /></button></div>
    </div>
  );
}

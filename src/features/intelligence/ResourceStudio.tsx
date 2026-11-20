import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Download, FileText, ListChecks, NotebookPen, Pencil, Printer, Save, Sparkles, Table2, Trash2, Wand2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingBlock, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { Markdown } from '@/components/app/Markdown';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses } from '@/features/teachers/queries';
import { aiAvailable, studioGenerate, type GeneratedQuestion, type StudioTask } from './aiClient';

const TASKS: { id: StudioTask; kind: string; label: string; icon: typeof FileText; text: string }[] = [
  { id: 'lesson_plan', kind: 'lesson_plan', label: 'Lesson plan', icon: ClipboardList, text: 'GES-style plan: strand, sub-strand, content standard, indicators, phases (Starter / Main / Reflection), resources and assessment.' },
  { id: 'lesson_note', kind: 'lesson_note', label: 'Structured lesson notes', icon: NotebookPen, text: 'Learner-friendly notes with explanations, worked examples, key vocabulary and a summary.' },
  { id: 'questions', kind: 'question_set', label: 'Questions from a lesson', icon: ListChecks, text: 'Objective and subjective questions with answers and marking guidance — add them straight to a question bank.' },
  { id: 'scheme_of_work', kind: 'scheme_of_work', label: 'Scheme of work', icon: Table2, text: 'A week-by-week plan for a term.' },
  { id: 'rubric', kind: 'rubric', label: 'Marking rubric', icon: Pencil, text: 'Criteria and performance levels for a task or project.' },
  { id: 'worksheet', kind: 'worksheet', label: 'Worksheet / activity', icon: FileText, text: 'Printable practice activity with an answer key.' },
];
const GRADES = ['Basic 7', 'Basic 8', 'Basic 9', 'Basic 10', 'SHS 1', 'SHS 2', 'SHS 3', 'Tertiary'];

export function ResourceStudio() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [task, setTask] = useState<StudioTask>('lesson_plan');
  const [f, setF] = useState({ subject: '', grade: 'Basic 7', topic: '', duration: 60, strand: '', sub_strand: '', content_standard: '', indicators: '', count: 10, types: 'mcq,short_answer', difficulty: 'mixed', weeks: 12, extra: '', lesson_id: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const resources = useQuery({ queryKey: ['studio-docs', user?.id], enabled: Boolean(user), queryFn: async () => unwrap(await supabase.from('teacher_resources').select('id, kind, title, subject, grade_level, status, ai_generated, updated_at').eq('owner_id', user!.id).order('updated_at', { ascending: false }).limit(60)) });
  const subjects = useQuery({ queryKey: ['curriculum-subjects'], staleTime: 3_600_000, queryFn: async () => unwrap(await supabase.from('curriculum_items').select('title').eq('kind', 'subject').eq('status', 'approved').order('position')) });
  const courses = useManagedCourses();
  const lessons = useQuery({
    queryKey: ['studio-lessons', courses.data?.map((c) => c.id).join()], enabled: Boolean(courses.data?.length),
    queryFn: async () => unwrap(await supabase.from('lessons').select('id, title, course_id').in('course_id', courses.data!.map((c) => c.id)).order('position').limit(300)),
  });
  const gen = useMutation({
    mutationFn: async () => {
      const r = await studioGenerate({ task, ...f, lesson_id: f.lesson_id || undefined, question_types: f.types.split(',') });
      const t = TASKS.find((x) => x.id === task)!;
      return unwrap(await supabase.from('teacher_resources').insert({
        owner_id: user!.id, kind: t.kind, title: r.title.slice(0, 200), subject: f.subject || null, grade_level: f.grade, lesson_id: f.lesson_id || null,
        body_md: r.markdown ?? null, content: { questions: r.questions ?? [], citations: r.citations, inputs: { task, ...f } }, ai_generated: true,
      }).select('id').single());
    },
    onSuccess: (d) => { void qc.invalidateQueries({ queryKey: ['studio-docs'] }); nav(`/studio/${d.id}`); },
    onError: (e) => toast.error('Generation failed', errorMessage(e)),
  });
  const blank = useMutation({
    mutationFn: async () => unwrap(await supabase.from('teacher_resources').insert({ owner_id: user!.id, kind: TASKS.find((x) => x.id === task)!.kind, title: f.topic.trim() || 'Untitled resource', subject: f.subject || null, grade_level: f.grade, body_md: '' }).select('id').single()),
    onSuccess: (d) => nav(`/studio/${d.id}`),
    onError: (e) => toast.error('Could not create', errorMessage(e)),
  });
  const needsTopic = task !== 'questions' || !f.lesson_id;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Teacher Resource Studio" title="Plan, write and assess — faster" description="Generate lesson plans, structured notes, questions and more, aligned to the approved GES/NaCCA curriculum. Everything is a draft you review and edit." />
      {!aiAvailable() && <Alert tone="warning" title="AI generation not connected">You can still write resources by hand. AI drafting needs the ProfJero Edu API with an AI key.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TASKS.map((t) => (
          <button key={t.id} onClick={() => setTask(t.id)} aria-pressed={task === t.id} className={cn('card flex gap-3 p-4 text-left transition', task === t.id ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-brand-300')}>
            <t.icon className={cn('h-6 w-6 shrink-0', task === t.id ? 'text-brand-600' : 'text-ink-400')} /><span><span className="block font-bold">{t.label}</span><span className="text-sm text-ink-500">{t.text}</span></span>
          </button>
        ))}
      </div>
      <Card><CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Subject" required><Select value={f.subject} onChange={(e) => set('subject', e.target.value)}><option value="">Choose…</option>{subjects.data?.map((s) => <option key={s.title}>{s.title}</option>)}<option value="Other">Other</option></Select></Field>
          <Field label="Class / level"><Select value={f.grade} onChange={(e) => set('grade', e.target.value)}>{GRADES.map((g) => <option key={g}>{g}</option>)}</Select></Field>
          {task === 'lesson_plan' && <Field label="Duration (minutes)"><Input type="number" min={20} max={240} value={f.duration} onChange={(e) => set('duration', Number(e.target.value) || 60)} /></Field>}
          {task === 'scheme_of_work' && <Field label="Weeks"><Input type="number" min={4} max={16} value={f.weeks} onChange={(e) => set('weeks', Number(e.target.value) || 12)} /></Field>}
          {task === 'questions' && <Field label="Number of questions"><Input type="number" min={3} max={30} value={f.count} onChange={(e) => set('count', Math.min(30, Number(e.target.value) || 10))} /></Field>}
        </div>
        {(task === 'questions' || task === 'lesson_note') && (
          <Field label="From one of your lessons (optional)" hint="The AI reads the lesson content you wrote."><Select value={f.lesson_id} onChange={(e) => set('lesson_id', e.target.value)}><option value="">— none —</option>{lessons.data?.map((l) => <option key={l.id} value={l.id}>{courses.data?.find((c) => c.id === l.course_id)?.title} · {l.title}</option>)}</Select></Field>
        )}
        {needsTopic && <Field label="Topic" required><Input value={f.topic} onChange={(e) => set('topic', e.target.value)} maxLength={200} placeholder="e.g. Fractions — addition with unlike denominators" /></Field>}
        {(task === 'lesson_plan' || task === 'lesson_note' || task === 'scheme_of_work') && (
          <details className="rounded-xl border border-ink-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Curriculum references (recommended)</summary>
            <p className="mt-1 text-xs text-ink-500">Copy these from your official curriculum document so the plan uses the exact wording. Approved items imported by your administrator are also used automatically.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Strand"><Input value={f.strand} onChange={(e) => set('strand', e.target.value)} /></Field>
              <Field label="Sub-strand"><Input value={f.sub_strand} onChange={(e) => set('sub_strand', e.target.value)} /></Field>
              <Field label="Content standard"><Input value={f.content_standard} onChange={(e) => set('content_standard', e.target.value)} /></Field>
              <Field label="Indicator(s)"><Input value={f.indicators} onChange={(e) => set('indicators', e.target.value)} /></Field>
            </div>
          </details>
        )}
        {task === 'questions' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Question types"><Select value={f.types} onChange={(e) => set('types', e.target.value)}><option value="mcq,short_answer">Multiple choice + short answer</option><option value="mcq">Multiple choice only</option><option value="mcq,true_false">Multiple choice + true/false</option><option value="short_answer,essay">Short answer + essay</option><option value="mcq,true_false,short_answer,essay">A bit of everything</option></Select></Field>
            <Field label="Difficulty"><Select value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}><option value="mixed">Mixed (Bloom’s levels)</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
          </div>
        )}
        <Field label="Anything else? (optional)"><Textarea rows={2} value={f.extra} onChange={(e) => set('extra', e.target.value)} maxLength={1000} placeholder="Large class of 60, few textbooks, include a group activity, use local examples…" /></Field>
        <div className="flex flex-wrap gap-2">
          <Button leftIcon={<Wand2 className="h-4 w-4" />} loading={gen.isPending} disabled={!aiAvailable() || !f.subject || (needsTopic && f.topic.trim().length < 3)} onClick={() => gen.mutate()}>{gen.isPending ? 'Drafting… (up to a minute)' : 'Generate draft'}</Button>
          <Button variant="secondary" loading={blank.isPending} onClick={() => blank.mutate()}>Start from blank</Button>
        </div>
      </CardBody></Card>
      <section>
        <h2 className="mb-3 text-lg font-bold">My resources</h2>
        {resources.isLoading ? <LoadingBlock rows={2} /> : resources.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{resources.data.map((r) => (
            <Link key={r.id} to={`/studio/${r.id}`} className="card p-4 hover:border-brand-300">
              <div className="flex items-center gap-2"><Badge>{r.kind.replace(/_/g, ' ')}</Badge>{r.ai_generated && <Badge tone="violet" icon={<Sparkles className="h-3 w-3" />}>AI draft</Badge>}{r.status === 'final' && <Badge tone="green">Final</Badge>}</div>
              <p className="mt-2 font-bold">{r.title}</p><p className="text-xs text-ink-500">{[r.subject, r.grade_level].filter(Boolean).join(' · ')} · {fromNow(r.updated_at)}</p>
            </Link>
          ))}</div>
        ) : <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No resources yet" description="Generate your first lesson plan above." />}
      </section>
    </div>
  );
}

export function StudioDocument() {
  const { docId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const doc = useQuery({ queryKey: ['studio-doc', docId], queryFn: async () => unwrap(await supabase.from('teacher_resources').select('*').eq('id', docId!).single()) });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (doc.data) { setTitle(doc.data.title); setBody(doc.data.body_md ?? ''); setEditing(!doc.data.body_md && !(doc.data.content as { questions?: unknown[] })?.questions?.length); } }, [doc.data]);
  const save = useMutation({
    mutationFn: async (status?: string) => unwrap(await supabase.from('teacher_resources').update({ title: title.trim() || 'Untitled resource', body_md: body, ...(status ? { status } : {}) }).eq('id', docId!)),
    onSuccess: () => { toast.success('Saved'); setEditing(false); void qc.invalidateQueries({ queryKey: ['studio-doc', docId] }); void qc.invalidateQueries({ queryKey: ['studio-docs'] }); },
    onError: (e) => toast.error('Could not save', errorMessage(e)),
  });
  const del = useMutation({ mutationFn: async () => unwrap(await supabase.from('teacher_resources').delete().eq('id', docId!)), onSuccess: () => nav('/studio') });
  if (doc.isLoading) return <LoadingBlock />;
  if (doc.error || !doc.data) return <ErrorState error={doc.error ?? new Error('Not found')} />;
  const d = doc.data;
  const questions = ((d.content as { questions?: GeneratedQuestion[] })?.questions ?? []);
  const download = () => { const blob = new Blob([`# ${title}\n\n${body}`], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title.replace(/[^\w-]+/g, '-').slice(0, 60)}.md`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={d.kind.replace(/_/g, ' ')} title={d.title} description={[d.subject, d.grade_level].filter(Boolean).join(' · ')} back={{ to: '/studio', label: 'Resource Studio' }}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          {editing ? <Button leftIcon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button> : <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit</Button>}
          {d.status !== 'final' && !editing && <Button variant="secondary" onClick={() => save.mutate('final')}>Mark as final</Button>}
          <Button variant="ghost" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / PDF</Button>
          <Button variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={download}>Download</Button>
          <Button variant="ghost" onClick={() => setConfirmDel(true)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
        </div>} />
      {d.ai_generated && <Alert tone="info" className="print:hidden">This is an AI draft. Check facts, curriculum codes and suitability for your learners before using it.</Alert>}
      {editing ? (
        <Card><CardBody className="space-y-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Content (Markdown: # headings, - lists, | tables |, **bold**)"><Textarea rows={24} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" /></Field>
            <div><p className="mb-1.5 text-sm font-semibold text-ink-700">Preview</p><div className="max-h-[36rem] overflow-y-auto rounded-xl border border-ink-200 p-4"><Markdown text={body || '_Nothing yet_'} /></div></div>
          </div>
        </CardBody></Card>
      ) : body ? <Card><CardBody><Markdown text={body} className="print:text-black" /></CardBody></Card> : null}
      {questions.length > 0 && <GeneratedQuestions questions={questions} />}
      <ConfirmDialog open={confirmDel} onOpenChange={setConfirmDel} title="Delete this resource?" tone="danger" confirmLabel="Delete" loading={del.isPending} onConfirm={() => del.mutate()} />
    </div>
  );
}

function GeneratedQuestions({ questions }: { questions: GeneratedQuestion[] }) {
  const toast = useToast();
  const banks = useQuery({ queryKey: ['banks-mini'], queryFn: async () => unwrap(await supabase.from('question_banks').select('id, title').order('updated_at', { ascending: false })) });
  const [bank, setBank] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set(questions.map((_, i) => i)));
  const add = useMutation({
    mutationFn: async () => {
      let n = 0;
      for (const i of picked) {
        const q = questions[i];
        const type = q.type === 'mcq' ? 'multiple_choice' : q.type;
        const payload: Record<string, unknown> = { type, prompt: q.prompt, explanation: q.explanation ?? '', difficulty: q.difficulty ?? 'medium', marks: q.marks ?? 1, tags: ['ai-studio'], data: {} };
        if (type === 'multiple_choice' || type === 'true_false') {
          const opts = type === 'true_false' ? ['True', 'False'] : (q.options ?? []);
          payload.options = opts.map((label) => ({ id: '', label }));
          const idx = opts.findIndex((o) => o.trim().toLowerCase() === String(q.answer ?? '').trim().toLowerCase());
          payload.key = { correct_index: idx >= 0 ? [idx] : [] };
          if (idx < 0) continue;
        } else if (type === 'short_answer') payload.key = { accepted: q.answer ? [q.answer] : [], case_sensitive: false };
        else payload.key = {};
        unwrap(await supabase.rpc('save_question', { p_bank: bank, p_question: null as never, p: payload as never }));
        n++;
      }
      return n;
    },
    onSuccess: (n) => toast.success(`${n} question${n === 1 ? '' : 's'} added to the bank`, 'Open Question banks to review or build an assessment.'),
    onError: (e) => toast.error('Could not add questions', errorMessage(e)),
  });
  return (
    <Card><CardBody className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <h2 className="flex-1 text-lg font-bold">Questions ({questions.length})</h2>
        <Select value={bank} onChange={(e) => setBank(e.target.value)} className="w-auto" aria-label="Question bank"><option value="">Choose a question bank…</option>{banks.data?.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</Select>
        <Button disabled={!bank || !picked.size} loading={add.isPending} onClick={() => add.mutate()}>Add {picked.size} to bank</Button>
      </div>
      {!banks.data?.length && <p className="text-sm text-ink-500 print:hidden">Create a question bank first under <Link to="/teach/banks" className="font-semibold text-brand-700">Question banks</Link>.</p>}
      <ol className="space-y-3">{questions.map((q, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-ink-200 p-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600 print:hidden" checked={picked.has(i)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} aria-label={`Include question ${i + 1}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{i + 1}. {q.prompt} <span className="text-xs font-normal text-ink-500">({q.marks ?? 1} mark{(q.marks ?? 1) === 1 ? '' : 's'} · {q.type.replace('_', ' ')}{q.difficulty ? ` · ${q.difficulty}` : ''})</span></p>
            {q.options && <ol className="mt-1 list-[upper-alpha] pl-6 text-sm">{q.options.map((o) => <li key={o} className={cn(o === q.answer && 'font-bold text-growth-700')}>{o}</li>)}</ol>}
            {q.answer && q.type !== 'mcq' && <p className="mt-1 text-sm"><b>Answer:</b> {q.answer}</p>}
            {q.explanation && <p className="mt-1 text-sm text-ink-600"><b>Why:</b> {q.explanation}</p>}
          </div>
        </li>
      ))}</ol>
    </CardBody></Card>
  );
}

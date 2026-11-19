import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Library, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Card, CardBody, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses } from '@/features/teachers/queries';

export const QTYPES: { v: string; label: string }[] = [
  { v: 'multiple_choice', label: 'Multiple choice' }, { v: 'multiple_select', label: 'Multiple select' }, { v: 'true_false', label: 'True / false' },
  { v: 'fill_blank', label: 'Fill in the blank' }, { v: 'short_answer', label: 'Short answer' }, { v: 'essay', label: 'Essay / long answer' },
  { v: 'matching', label: 'Matching' }, { v: 'ordering', label: 'Ordering' }, { v: 'file_upload', label: 'File / link submission' },
];
export const qtypeLabel = (t: string) => QTYPES.find((x) => x.v === t)?.label ?? t;

export function useMyBanks() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['banks', user?.id], enabled: Boolean(user), queryFn: async () => unwrap(await supabase.from('question_banks').select('id, title, description, course_id, updated_at, course:courses(title)').order('updated_at', { ascending: false })) as unknown as { id: string; title: string; description: string | null; course_id: string | null; updated_at: string; course: { title: string } | null }[] });
}

export function QuestionBanks() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useMyBanks();
  const courses = useManagedCourses();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  return (
    <div>
      <PageHeader title="Question banks" description="Reusable questions you can pull into any assessment. Answer keys are never visible to learners." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New bank</Button>} />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState icon={<Library className="h-7 w-7" />} title="No question banks yet" action={<Button onClick={() => setOpen(true)}>Create a bank</Button>} />} columns={[
          { key: 't', header: 'Bank', primary: true, cell: (r) => <Link to={`/teach/banks/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'c', header: 'Course', cell: (r) => r.course?.title ?? <span className="text-ink-400">Personal</span> },
          { key: 'u', header: 'Updated', cell: (r) => fromNow(r.updated_at) },
        ]} />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="New question bank" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={title.trim().length < 2} onClick={async () => {
        const course = courses.data?.find((c) => c.id === courseId);
        const { error } = await supabase.from('question_banks').insert({ title: title.trim(), owner_id: user!.id, course_id: courseId || null, school_id: course?.school_id ?? null });
        if (error) return toast.error('Could not create', error.message);
        setOpen(false); setTitle(''); void refetch();
      }}>Create</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Share with a course's teaching team" hint="Optional — co-teachers of the course can use this bank"><Select value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">Only me</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
        </div>
      </Dialog>
    </div>
  );
}

type QRow = { id: string; type: string; prompt: string; marks: number; difficulty: string; tags: string[]; category: string | null };

export function BankEditor() {
  const { bankId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const bank = useQuery({ queryKey: ['bank', bankId], queryFn: async () => unwrap(await supabase.from('question_banks').select('id, title').eq('id', bankId!).maybeSingle()) });
  const qs = useQuery({ queryKey: ['bank-questions', bankId], queryFn: async () => unwrap(await supabase.from('questions').select('id, type, prompt, marks, difficulty, tags, category').eq('bank_id', bankId!).order('created_at')) as QRow[] });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  if (bank.isLoading) return <LoadingBlock />;
  if (!bank.data) return <EmptyState title="Bank not found" />;
  const rows = (qs.data ?? []).filter((q) => !filter || q.type === filter);
  return (
    <div>
      <PageHeader back={{ to: '/teach/banks', label: 'Question banks' }} title={bank.data.title} actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Add question</Button>} />
      <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-4 max-w-xs" aria-label="Filter by type"><option value="">All types</option>{QTYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select>
      {qs.isLoading ? <LoadingBlock /> : (
        <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState title="No questions yet" action={<Button onClick={() => setEditing('new')}>Add a question</Button>} />} columns={[
          { key: 'p', header: 'Question', primary: true, cell: (r) => <button className="line-clamp-2 text-left font-medium hover:text-brand-700" onClick={() => setEditing(r.id)}>{r.prompt}</button> },
          { key: 't', header: 'Type', cell: (r) => <Badge tone="brand">{qtypeLabel(r.type)}</Badge> },
          { key: 'd', header: 'Difficulty', cell: (r) => <span className="capitalize">{r.difficulty}</span> },
          { key: 'm', header: 'Marks', cell: (r) => Number(r.marks) },
          { key: 'tg', header: 'Tags', hideOnMobile: true, cell: (r) => <span className="text-xs text-ink-500">{r.tags.join(', ')}</span> },
          { key: 'a', header: '', cell: (r) => <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Edit question" onClick={() => setEditing(r.id)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete question" onClick={async () => { const { error } = await supabase.from('questions').delete().eq('id', r.id); if (error) toast.error('Cannot delete', /foreign key|violates/i.test(error.message) ? 'This question is used in an assessment. Remove it there first.' : error.message); else void qs.refetch(); }}><Trash2 className="h-4 w-4" /></Button></div> },
        ]} />
      )}
      <QuestionEditorDialog bankId={bankId!} questionId={editing} onClose={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['bank-questions', bankId] }); }} />
    </div>
  );
}

type Item = { id: string; text: string };
type Draft = {
  type: string; prompt: string; explanation: string; category: string; difficulty: string; marks: number; tags: string;
  options: { id?: string; label: string; correct: boolean }[]; accepted: string; caseSensitive: boolean;
  pairs: { left: Item; right: Item }[]; items: Item[];
};
const sid = () => Math.random().toString(36).slice(2, 10);
const blank = (type = 'multiple_choice'): Draft => ({
  type, prompt: '', explanation: '', category: '', difficulty: 'medium', marks: 1, tags: '',
  options: type === 'true_false' ? [{ label: 'True', correct: true }, { label: 'False', correct: false }] : [{ label: '', correct: true }, { label: '', correct: false }, { label: '', correct: false }],
  accepted: '', caseSensitive: false, pairs: [{ left: { id: sid(), text: '' }, right: { id: sid(), text: '' } }, { left: { id: sid(), text: '' }, right: { id: sid(), text: '' } }],
  items: [{ id: sid(), text: '' }, { id: sid(), text: '' }, { id: sid(), text: '' }],
});

function QuestionEditorDialog({ bankId, questionId, onClose }: { bankId: string; questionId: string | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(blank());
  const [busy, setBusy] = useState(false);
  const existing = useQuery({ queryKey: ['question-full', questionId], enabled: Boolean(questionId && questionId !== 'new'), queryFn: async () => unwrap(await supabase.rpc('get_question', { p_question: questionId! })) as Record<string, unknown> });
  useEffect(() => {
    if (questionId === 'new') setD(blank());
    else if (existing.data) {
      const q = existing.data as { type: string; prompt: string; explanation: string | null; category: string | null; difficulty: string; marks: number; tags: string[]; data: { left?: Item[]; right?: Item[]; items?: Item[] }; options: { id: string; label: string }[]; key: { correct?: string[]; accepted?: string[]; case_sensitive?: boolean; pairs?: Record<string, string>; order?: string[] } };
      const base = blank(q.type);
      setD({
        ...base, type: q.type, prompt: q.prompt, explanation: q.explanation ?? '', category: q.category ?? '', difficulty: q.difficulty, marks: Number(q.marks), tags: (q.tags ?? []).join(', '),
        options: q.options.length ? q.options.map((o) => ({ id: o.id, label: o.label, correct: (q.key.correct ?? []).includes(o.id) })) : base.options,
        accepted: (q.key.accepted ?? []).join('\n'), caseSensitive: Boolean(q.key.case_sensitive),
        pairs: q.data.left?.length ? q.data.left.map((l) => ({ left: l, right: q.data.right?.find((r) => r.id === q.key.pairs?.[l.id]) ?? { id: sid(), text: '' } })) : base.pairs,
        items: q.key.order?.length ? q.key.order.map((id) => q.data.items?.find((x) => x.id === id) ?? { id, text: '' }) : base.items,
      });
    }
  }, [questionId, existing.data]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const choice = ['multiple_choice', 'multiple_select', 'true_false'].includes(d.type);

  const save = async () => {
    const payload: Record<string, unknown> = { type: d.type, prompt: d.prompt, explanation: d.explanation, category: d.category, difficulty: d.difficulty, marks: d.marks, tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean), data: {} };
    if (choice) {
      payload.options = d.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id ?? '', label: o.label.trim() }));
      payload.key = { correct_index: d.options.filter((o) => o.label.trim()).map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0) };
    } else if (d.type === 'fill_blank' || d.type === 'short_answer') {
      payload.key = { accepted: d.accepted.split('\n').map((x) => x.trim()).filter(Boolean), case_sensitive: d.caseSensitive };
      if (d.type === 'fill_blank' && !(payload.key as { accepted: string[] }).accepted.length) return toast.error('Add at least one accepted answer');
    } else if (d.type === 'matching') {
      const pairs = d.pairs.filter((p) => p.left.text.trim() && p.right.text.trim());
      if (pairs.length < 2) return toast.error('Add at least two complete pairs');
      payload.data = { left: pairs.map((p) => p.left), right: pairs.map((p) => p.right) };
      payload.key = { pairs: Object.fromEntries(pairs.map((p) => [p.left.id, p.right.id])) };
    } else if (d.type === 'ordering') {
      const items = d.items.filter((i) => i.text.trim());
      if (items.length < 2) return toast.error('Add at least two items');
      payload.data = { items };
      payload.key = { order: items.map((i) => i.id) };
    } else payload.key = {};
    setBusy(true);
    const { error } = await supabase.rpc('save_question', { p_bank: bankId, p_question: (questionId === 'new' ? null : questionId) as never, p: payload as never });
    setBusy(false);
    if (error) toast.error('Could not save question', errorMessage(error)); else { toast.success('Question saved'); onClose(); }
  };

  return (
    <Dialog open={Boolean(questionId)} onOpenChange={(o) => !o && onClose()} title={questionId === 'new' ? 'Add question' : 'Edit question'} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!d.prompt.trim()} onClick={save}>Save question</Button></>}>
      {existing.isLoading ? <LoadingBlock rows={2} /> : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type"><Select value={d.type} onChange={(e) => setD({ ...blank(e.target.value), prompt: d.prompt, explanation: d.explanation, marks: d.marks, tags: d.tags, category: d.category, difficulty: d.difficulty })}>{QTYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
            <Field label="Marks"><Input type="number" min={0.5} step={0.5} value={d.marks} onChange={(e) => set('marks', Number(e.target.value))} /></Field>
            <Field label="Difficulty"><Select value={d.difficulty} onChange={(e) => set('difficulty', e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
          </div>
          <Field label="Question"><Textarea rows={3} value={d.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder={d.type === 'fill_blank' ? 'Use ____ to show the blank' : ''} /></Field>
          {choice && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink-800">Options — tick {d.type === 'multiple_select' ? 'every' : 'the'} correct answer</legend>
              {d.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type={d.type === 'multiple_select' ? 'checkbox' : 'radio'} name="correct" checked={o.correct} aria-label={`Option ${i + 1} correct`} className="h-4 w-4 accent-growth-600"
                    onChange={(e) => set('options', d.options.map((x, j) => (d.type === 'multiple_select' ? (j === i ? { ...x, correct: e.target.checked } : x) : { ...x, correct: j === i })))} />
                  <Input value={o.label} disabled={d.type === 'true_false'} aria-label={`Option ${i + 1}`} onChange={(e) => set('options', d.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  {d.type !== 'true_false' && <Button size="icon" variant="ghost" aria-label="Remove option" disabled={d.options.length <= 2} onClick={() => set('options', d.options.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              {d.type !== 'true_false' && d.options.length < 8 && <Button size="sm" variant="ghost" onClick={() => set('options', [...d.options, { label: '', correct: false }])}>Add option</Button>}
            </fieldset>
          )}
          {(d.type === 'fill_blank' || d.type === 'short_answer') && (
            <Field label="Accepted answers (one per line)" hint={d.type === 'short_answer' ? 'Optional. Matching answers are auto-marked; others go to your marking queue.' : 'Learner answers are compared ignoring extra spaces.'}>
              <Textarea rows={3} value={d.accepted} onChange={(e) => set('accepted', e.target.value)} />
            </Field>
          )}
          {(d.type === 'fill_blank' || d.type === 'short_answer') && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.caseSensitive} onChange={(e) => set('caseSensitive', e.target.checked)} className="accent-brand-600" />Case sensitive</label>}
          {d.type === 'matching' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Pairs — learners see the right-hand items shuffled</p>
              {d.pairs.map((p, i) => (
                <div key={p.left.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input aria-label={`Left item ${i + 1}`} value={p.left.text} placeholder="Item" onChange={(e) => set('pairs', d.pairs.map((x, j) => (j === i ? { ...x, left: { ...x.left, text: e.target.value } } : x)))} />
                  <Input aria-label={`Match ${i + 1}`} value={p.right.text} placeholder="Matches with" onChange={(e) => set('pairs', d.pairs.map((x, j) => (j === i ? { ...x, right: { ...x.right, text: e.target.value } } : x)))} />
                  <Button size="icon" variant="ghost" aria-label="Remove pair" disabled={d.pairs.length <= 2} onClick={() => set('pairs', d.pairs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => set('pairs', [...d.pairs, { left: { id: sid(), text: '' }, right: { id: sid(), text: '' } }])}>Add pair</Button>
            </div>
          )}
          {d.type === 'ordering' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Items in the CORRECT order — learners see them shuffled</p>
              {d.items.map((it, i) => (
                <div key={it.id} className="flex items-center gap-2"><span className="w-6 text-center text-sm font-bold text-ink-400">{i + 1}</span><Input aria-label={`Item ${i + 1}`} value={it.text} onChange={(e) => set('items', d.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} /><Button size="icon" variant="ghost" aria-label="Remove item" disabled={d.items.length <= 2} onClick={() => set('items', d.items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button></div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => set('items', [...d.items, { id: sid(), text: '' }])}>Add item</Button>
            </div>
          )}
          {(d.type === 'essay' || d.type === 'file_upload') && <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-600">Marked manually by the teacher.</p>}
          <Field label="Explanation (shown after results are released)"><Textarea rows={2} value={d.explanation} onChange={(e) => set('explanation', e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category"><Input value={d.category} onChange={(e) => set('category', e.target.value)} /></Field>
            <Field label="Tags" hint="Comma separated"><Input value={d.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function BankQuestionPicker({ onPick, exclude }: { onPick: (ids: string[]) => void; exclude: Set<string> }) {
  const banks = useMyBanks();
  const [bank, setBank] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const active = bank || banks.data?.[0]?.id || '';
  const qs = useQuery({ queryKey: ['bank-questions', active], enabled: Boolean(active), queryFn: async () => unwrap(await supabase.from('questions').select('id, type, prompt, marks').eq('bank_id', active).order('created_at')) });
  if (banks.isLoading) return <LoadingBlock rows={1} />;
  if (!banks.data?.length) return <EmptyState title="No question banks" description="Create a bank and add questions first." action={<Link to="/teach/banks" className="font-semibold text-brand-700">Go to question banks</Link>} />;
  return (
    <Card><CardBody className="space-y-3">
      <Select value={active} onChange={(e) => { setBank(e.target.value); setSel(new Set()); }} aria-label="Question bank">{banks.data.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</Select>
      <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
        {(qs.data ?? []).map((q) => (
          <li key={q.id}><label className="flex cursor-pointer items-start gap-3 py-2.5 text-sm">
            <input type="checkbox" disabled={exclude.has(q.id)} checked={sel.has(q.id) || exclude.has(q.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(q.id); else n.delete(q.id); return n; })} className="mt-0.5 h-4 w-4 accent-brand-600" />
            <span className="flex-1"><span className="line-clamp-2">{q.prompt}</span><span className="text-xs text-ink-500">{qtypeLabel(q.type)} · {Number(q.marks)} marks</span></span>
          </label></li>
        ))}
        {!qs.data?.length && <li className="py-3 text-sm text-ink-500">This bank has no questions.</li>}
      </ul>
      <Button disabled={!sel.size} onClick={() => { onPick([...sel]); setSel(new Set()); }}>Add {sel.size || ''} question{sel.size === 1 ? '' : 's'}</Button>
    </CardBody></Card>
  );
}

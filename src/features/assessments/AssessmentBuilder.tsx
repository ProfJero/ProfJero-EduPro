import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Send, Trash2, Eye } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, DataTable, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, isoToLocalInput, localInputToIso } from '@/lib/dates';
import { downloadCsv, errorMessage } from '@/lib/utils';
import { BankQuestionPicker, qtypeLabel } from './QuestionBanks';

type A = {
  id: string; title: string; instructions: string; kind: string; course_id: string | null; class_id: string | null; opens_at: string | null; closes_at: string | null;
  duration_minutes: number | null; pass_mark_pct: number; max_attempts: number; shuffle_questions: boolean; shuffle_options: boolean;
  results_visibility: 'immediate' | 'after_close' | 'manual'; show_correct_answers: boolean; results_released: boolean; status: 'draft' | 'in_review' | 'published' | 'unpublished' | 'archived';
};
type AQ = { question_id: string; position: number; marks_override: number | null; question: { prompt: string; type: string; marks: number } | null };

export function AssessmentBuilder() {
  const { assessmentId } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const aQ = useQuery({ queryKey: ['assessment-edit', assessmentId], queryFn: async () => unwrap(await supabase.from('assessments').select('*').eq('id', assessmentId!).maybeSingle()) as A | null });
  const qsQ = useQuery({ queryKey: ['assessment-questions', assessmentId], queryFn: async () => unwrap(await supabase.from('assessment_questions').select('question_id, position, marks_override, question:questions(prompt, type, marks)').eq('assessment_id', assessmentId!).order('position')) as unknown as AQ[] });
  const [form, setForm] = useState<A | null>(null);
  useEffect(() => { if (aQ.data) setForm(aQ.data); }, [aQ.data]);
  if (aQ.isLoading || !form) return aQ.isLoading ? <LoadingBlock /> : <EmptyState title="Assessment not found" />;
  const a = aQ.data!;
  const qs = qsQ.data ?? [];
  const total = qs.reduce((s, q) => s + Number(q.marks_override ?? q.question?.marks ?? 0), 0);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['assessment-edit', assessmentId] }); void qc.invalidateQueries({ queryKey: ['assessment-questions', assessmentId] }); void qc.invalidateQueries({ queryKey: ['teacher-assessments'] }); };
  const saveSettings = async () => {
    const { id: _id, ...rest } = form;
    const { error } = await supabase.from('assessments').update({ ...rest, duration_minutes: rest.duration_minutes || null }).eq('id', a.id);
    if (error) toast.error('Could not save', error.message); else { toast.success('Settings saved'); refresh(); }
  };
  const setStatus = async (status: A['status']) => {
    if (status === 'published' && !qs.length) return toast.error('Add questions first');
    const { error } = await supabase.from('assessments').update({ status }).eq('id', a.id);
    if (error) toast.error('Could not update', error.message); else { toast.success(status === 'published' ? 'Published — learners have been notified' : 'Updated'); refresh(); }
  };
  const reorder = async (ids: string[]) => {
    await Promise.all(ids.map((id, i) => supabase.from('assessment_questions').update({ position: i }).eq('assessment_id', a.id).eq('question_id', id)));
    refresh();
  };
  const f = <K extends keyof A>(k: K, v: A[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/teach/assessments', label: 'Assessments' }} eyebrow={<span className="inline-flex items-center gap-2">{a.kind} <StatusBadge status={a.status} /></span>} title={a.title}
        actions={a.status === 'published' ? <Button variant="outline" onClick={() => setStatus('unpublished')}>Unpublish</Button> : <Button variant="success" leftIcon={<Send className="h-4 w-4" />} onClick={() => setStatus('published')}>Publish</Button>} />
      <Tabs value={params.get('tab') ?? 'questions'} onValueChange={(v) => setParams({ tab: v }, { replace: true })} tabs={[
        { value: 'questions', label: `Questions (${qs.length})`, content: (
          <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
            <Card>
              <CardHeader title="Questions" description={`${qs.length} questions · ${total} marks total`} />
              <CardBody>
                {qs.length ? (
                  <ol className="space-y-2">{qs.map((q, i) => (
                    <li key={q.question_id} className="flex items-start gap-3 rounded-xl border border-ink-200 p-3">
                      <span className="mt-0.5 w-6 text-center font-bold text-ink-400">{i + 1}</span>
                      <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium">{q.question?.prompt}</p><p className="mt-1 text-xs text-ink-500">{qtypeLabel(q.question?.type ?? '')}</p></div>
                      <label className="text-xs"><span className="sr-only">Marks</span><Input type="number" min={0.5} step={0.5} className="h-9 w-20" defaultValue={Number(q.marks_override ?? q.question?.marks ?? 1)} onBlur={async (e) => { await supabase.from('assessment_questions').update({ marks_override: Number(e.target.value) }).eq('assessment_id', a.id).eq('question_id', q.question_id); refresh(); }} /></label>
                      <div className="flex flex-col">
                        <button aria-label="Move up" disabled={i === 0} className="text-ink-400 disabled:opacity-30" onClick={() => { const ids = qs.map((x) => x.question_id); [ids[i], ids[i - 1]] = [ids[i - 1], ids[i]]; void reorder(ids); }}><ArrowUp className="h-4 w-4" /></button>
                        <button aria-label="Move down" disabled={i === qs.length - 1} className="text-ink-400 disabled:opacity-30" onClick={() => { const ids = qs.map((x) => x.question_id); [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]]; void reorder(ids); }}><ArrowDown className="h-4 w-4" /></button>
                      </div>
                      <button aria-label="Remove question" className="text-ink-400 hover:text-red-600" onClick={async () => { await supabase.from('assessment_questions').delete().eq('assessment_id', a.id).eq('question_id', q.question_id); refresh(); }}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}</ol>
                ) : <EmptyState title="No questions yet" description="Pick questions from your banks on the right." />}
              </CardBody>
            </Card>
            <div className="space-y-2">
              <p className="text-sm font-bold">Add from question banks</p>
              <BankQuestionPicker exclude={new Set(qs.map((q) => q.question_id))} onPick={async (ids) => {
                const { error } = await supabase.from('assessment_questions').insert(ids.map((id, i) => ({ assessment_id: a.id, question_id: id, position: qs.length + i })));
                if (error) toast.error('Could not add', errorMessage(error)); else refresh();
              }} />
              <Link to="/teach/banks" className="text-sm font-semibold text-brand-700">Write new questions →</Link>
            </div>
          </div>
        ) },
        { value: 'settings', label: 'Settings', content: (
          <Card className="max-w-3xl"><CardBody className="space-y-5">
            <Field label="Title"><Input value={form.title} onChange={(e) => f('title', e.target.value)} /></Field>
            <Field label="Instructions"><Textarea rows={4} value={form.instructions} onChange={(e) => f('instructions', e.target.value)} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Opens" hint="Leave empty to open immediately"><Input type="datetime-local" value={isoToLocalInput(form.opens_at)} onChange={(e) => f('opens_at', localInputToIso(e.target.value))} /></Field>
              <Field label="Closes"><Input type="datetime-local" value={isoToLocalInput(form.closes_at)} onChange={(e) => f('closes_at', localInputToIso(e.target.value))} /></Field>
              <Field label="Time limit (minutes)" hint="Empty = untimed. Enforced on the server."><Input type="number" min={1} max={600} value={form.duration_minutes ?? ''} onChange={(e) => f('duration_minutes', e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Pass mark (%)"><Input type="number" min={0} max={100} value={form.pass_mark_pct} onChange={(e) => f('pass_mark_pct', Number(e.target.value))} /></Field>
              <Field label="Attempts allowed"><Input type="number" min={1} max={50} value={form.max_attempts} onChange={(e) => f('max_attempts', Number(e.target.value))} /></Field>
              <Field label="Type"><Select value={form.kind} onChange={(e) => f('kind', e.target.value)}><option value="quiz">Quiz</option><option value="test">Test</option><option value="exam">Exam</option><option value="practice">Practice</option></Select></Field>
              <Field label="When can learners see results?"><Select value={form.results_visibility} onChange={(e) => f('results_visibility', e.target.value as A['results_visibility'])}><option value="immediate">Immediately after submitting</option><option value="after_close">After the assessment closes</option><option value="manual">When I release them</option></Select></Field>
            </div>
            <Checkbox label="Shuffle question order for each learner" checked={form.shuffle_questions} onChange={(e) => f('shuffle_questions', e.target.checked)} />
            <Checkbox label="Shuffle answer options" checked={form.shuffle_options} onChange={(e) => f('shuffle_options', e.target.checked)} />
            <Checkbox label="Show correct answers & explanations with results" checked={form.show_correct_answers} onChange={(e) => f('show_correct_answers', e.target.checked)} />
            <Alert tone="info">ProfJero Edu does not provide exam proctoring. Timers and attempt limits are enforced by the server.</Alert>
            <Button onClick={saveSettings}>Save settings</Button>
          </CardBody></Card>
        ) },
        { value: 'results', label: 'Results & marking', content: <Results assessment={a} onReleased={refresh} /> },
      ]} />
    </div>
  );
}

type Row = { attempt_id: string; user_id: string; learner_name: string; attempt_no: number; status: string; started_at: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; passed: boolean | null; pending_manual: boolean | null };

function Results({ assessment, onReleased }: { assessment: A; onReleased: () => void }) {
  const toast = useToast();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['assessment-results', assessment.id], queryFn: async () => unwrap(await supabase.rpc('assessment_results_overview', { p_assessment: assessment.id })) as Row[] });
  if (isLoading) return <LoadingBlock />;
  const rows = data ?? [];
  const done = rows.filter((r) => r.status !== 'in_progress');
  const avg = done.length ? Math.round(done.reduce((s, r) => s + Number(r.percentage ?? 0), 0) / done.length) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>{done.length} submitted</Badge><Badge tone="amber">{rows.filter((r) => r.pending_manual).length} need marking</Badge>{avg != null && <Badge tone="brand">Average {avg}%</Badge>}
        <span className="flex-1" />
        {assessment.results_visibility === 'manual' && (assessment.results_released ? <Badge tone="green">Results released</Badge> : <Button size="sm" variant="success" onClick={async () => {
          const { data: n, error } = await supabase.rpc('release_results', { p_assessment: assessment.id });
          if (error) toast.error('Could not release', error.message); else { toast.success(`Results released to ${n} learner(s)`); onReleased(); void refetch(); }
        }}>Release results</Button>)}
        <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => downloadCsv(`${assessment.title}-results.csv`, rows.map((r) => ({ learner: r.learner_name, attempt: r.attempt_no, status: r.status, submitted_at: r.submitted_at ?? '', score: r.score ?? '', max: r.max_score ?? '', percent: r.percentage ?? '', passed: r.passed ?? '' })))}>Export CSV</Button>
      </div>
      <DataTable rows={rows} rowKey={(r) => r.attempt_id} empty={<EmptyState title="No attempts yet" />} columns={[
        { key: 'n', header: 'Learner', primary: true, cell: (r) => r.learner_name },
        { key: 'a', header: 'Attempt', cell: (r) => r.attempt_no },
        { key: 's', header: 'Submitted', cell: (r) => (r.submitted_at ? fmtDateTime(r.submitted_at) : <Badge tone="brand">In progress</Badge>) },
        { key: 'sc', header: 'Score', cell: (r) => (r.score == null ? '—' : `${Number(r.score)}/${Number(r.max_score)} (${Math.round(Number(r.percentage))}%)`) },
        { key: 'r', header: 'Result', cell: (r) => (r.pending_manual ? <Badge tone="amber">Needs marking</Badge> : r.passed == null ? '—' : r.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Not passed</Badge>) },
        { key: 'x', header: '', cell: (r) => r.status !== 'in_progress' && <Link to={`/teach/attempts/${r.attempt_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><Eye className="h-4 w-4" />{r.pending_manual ? 'Mark' : 'Review'}</Link> },
      ]} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, FileText, Link2, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, isoToLocalInput, localInputToIso } from '@/lib/dates';
import { downloadCsv, errorMessage, safeExternalUrl } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { getSubmissionFileUrl } from '@/features/media/upload';
import { MediaPicker } from '@/features/media/MediaPicker';
import { useTeachingTargets } from '@/features/assessments/TeacherAssessments';
import { ASSIGNMENT_SELECT, type AssignmentRow } from './queries';

export function TeacherAssignments() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const targets = useTeachingTargets();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-assignments', targets.courseIds.join(), targets.classIds.join()],
    enabled: !targets.loading,
    queryFn: async () => {
      const ors = [targets.courseIds.length && `course_id.in.(${targets.courseIds.join(',')})`, targets.classIds.length && `class_id.in.(${targets.classIds.join(',')})`].filter(Boolean).join(',');
      if (!ors) return [] as AssignmentRow[];
      return unwrap(await supabase.from('assignments').select(ASSIGNMENT_SELECT).or(ors).order('created_at', { ascending: false })) as unknown as AssignmentRow[];
    },
  });
  const toMark = useQuery({ queryKey: ['submitted-counts'], queryFn: async () => unwrap(await supabase.from('assignment_submissions').select('assignment_id').eq('status', 'submitted')) });
  const n = (id: string) => (toMark.data ?? []).filter((x) => x.assignment_id === id).length;
  return (
    <div>
      <PageHeader title="Assignments" description="Set work, collect submissions and give feedback." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={!targets.options.length}>New assignment</Button>} />
      {isLoading || targets.loading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No assignments yet" />} columns={[
          { key: 't', header: 'Assignment', primary: true, cell: (r) => <Link to={`/teach/assignments/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'c', header: 'For', cell: (r) => r.course?.title ?? r.cls?.name },
          { key: 'd', header: 'Due', cell: (r) => (r.due_at ? fmtDateTime(r.due_at) : '—') },
          { key: 'm', header: 'To mark', cell: (r) => (n(r.id) ? <Badge tone="amber">{n(r.id)}</Badge> : '—') },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]} />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="New assignment" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={title.trim().length < 2} onClick={async () => {
        const [scope, id] = (target || targets.options[0]?.v || '').split(':');
        const { data: row, error } = await supabase.from('assignments').insert({ title: title.trim(), created_by: user!.id, course_id: scope === 'course' ? id : null, class_id: scope === 'class' ? id : null }).select('id').single();
        if (error) return toast.error('Could not create', error.message);
        nav(`/teach/assignments/${row.id}?tab=settings`);
      }}>Create</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="For"><Select value={target} onChange={(e) => setTarget(e.target.value)}>{targets.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select></Field>
        </div>
      </Dialog>
    </div>
  );
}

type Sub = { user_id: string; learner_name: string; submission_id: string | null; status: string; submitted_at: string | null; is_late: boolean; score: number | null; graded_at: string | null; file_count: number };
type Criterion = { id: string; title: string; description: string | null; max_points: number; position: number };

export function AssignmentManagePage() {
  const { assignmentId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const aQ = useQuery({ queryKey: ['assignment-edit', assignmentId], queryFn: async () => unwrap(await supabase.from('assignments').select(ASSIGNMENT_SELECT).eq('id', assignmentId!).maybeSingle()) as unknown as AssignmentRow | null });
  const subs = useQuery({ queryKey: ['assignment-subs', assignmentId], queryFn: async () => unwrap(await supabase.rpc('assignment_submissions_overview', { p_assignment: assignmentId! })) as Sub[] });
  const rubric = useQuery({ queryKey: ['rubric', assignmentId], queryFn: async () => unwrap(await supabase.from('rubric_criteria').select('*').eq('assignment_id', assignmentId!).order('position')) as Criterion[] });
  const [grading, setGrading] = useState<Sub | null>(null);
  if (aQ.isLoading) return <LoadingBlock />;
  const a = aQ.data;
  if (!a) return <EmptyState title="Assignment not found" />;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['assignment-edit', assignmentId] }); void qc.invalidateQueries({ queryKey: ['assignment-subs', assignmentId] }); void qc.invalidateQueries({ queryKey: ['teacher-assignments'] }); };
  const rows = subs.data ?? [];
  const counts = { submitted: rows.filter((r) => r.status === 'submitted').length, graded: rows.filter((r) => r.status === 'graded').length, missing: rows.filter((r) => r.status === 'missing' || r.status === 'draft').length, late: rows.filter((r) => r.is_late).length };
  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/teach/assignments', label: 'Assignments' }} eyebrow={a.course?.title ?? a.cls?.name} title={a.title}
        actions={a.status === 'published' ? <Button variant="outline" onClick={async () => { await supabase.from('assignments').update({ status: 'unpublished' }).eq('id', a.id); refresh(); }}>Unpublish</Button>
          : <Button variant="success" leftIcon={<Send className="h-4 w-4" />} onClick={async () => { const { error } = await supabase.from('assignments').update({ status: 'published' }).eq('id', a.id); if (error) toast.error('Could not publish', error.message); else { toast.success('Published — learners notified'); refresh(); } }}>Publish</Button>} />
      <Tabs defaultValue={new URLSearchParams(location.search).get('tab') ?? 'submissions'} tabs={[
        { value: 'submissions', label: `Submissions (${counts.submitted} to mark)`, content: (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2"><Badge tone="brand">{counts.submitted} to mark</Badge><Badge tone="green">{counts.graded} graded</Badge><Badge tone="red">{counts.missing} missing</Badge><Badge tone="amber">{counts.late} late</Badge>
              <span className="flex-1" /><Button size="sm" variant="outline" onClick={() => downloadCsv(`${a.title}-submissions.csv`, rows.map((r) => ({ learner: r.learner_name, status: r.status, submitted_at: r.submitted_at ?? '', late: r.is_late, score: r.score ?? '', max: a.max_marks })))}>Export CSV</Button></div>
            {subs.isLoading ? <LoadingBlock /> : (
              <DataTable rows={rows} rowKey={(r) => r.user_id} empty={<EmptyState title="No learners yet" />} columns={[
                { key: 'n', header: 'Learner', primary: true, cell: (r) => r.learner_name },
                { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
                { key: 'd', header: 'Submitted', cell: (r) => (r.submitted_at ? <>{fmtDateTime(r.submitted_at)}{r.is_late && <Badge tone="amber" className="ml-1">late</Badge>}</> : '—') },
                { key: 'sc', header: 'Score', cell: (r) => (r.score == null ? '—' : `${Number(r.score)}/${Number(a.max_marks)}`) },
                { key: 'x', header: '', cell: (r) => r.submission_id && r.status !== 'draft' ? <Button size="sm" variant={r.status === 'submitted' ? 'primary' : 'outline'} onClick={() => setGrading(r)}>{r.status === 'submitted' ? 'Mark' : 'View'}</Button> : null },
              ]} />
            )}
          </div>
        ) },
        { value: 'settings', label: 'Settings', content: <AssignmentSettings a={a} onSaved={refresh} /> },
        { value: 'rubric', label: 'Rubric', content: <RubricEditor assignmentId={a.id} criteria={rubric.data ?? []} onChange={() => void rubric.refetch()} /> },
      ]} />
      <GradeDialog sub={grading} assignment={a} criteria={rubric.data ?? []} onClose={() => { setGrading(null); refresh(); }} />
    </div>
  );
}

function AssignmentSettings({ a, onSaved }: { a: AssignmentRow; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(a);
  const [att, setAtt] = useState({ title: '', url: '' });
  useEffect(() => setF(a), [a]);
  const save = async () => {
    const { error } = await supabase.from('assignments').update({ title: f.title, instructions: f.instructions, due_at: f.due_at, allow_late: f.allow_late, max_marks: f.max_marks, submission_types: f.submission_types, attachments: f.attachments as never }).eq('id', a.id);
    if (error) toast.error('Could not save', error.message); else { toast.success('Saved'); onSaved(); }
  };
  const toggleType = (t: string) => setF({ ...f, submission_types: f.submission_types.includes(t) ? f.submission_types.filter((x) => x !== t) : [...f.submission_types, t] });
  return (
    <Card className="max-w-3xl"><CardBody className="space-y-5">
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Instructions"><Textarea rows={6} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Deadline"><Input type="datetime-local" value={isoToLocalInput(f.due_at)} onChange={(e) => setF({ ...f, due_at: localInputToIso(e.target.value) })} /></Field>
        <Field label="Maximum marks"><Input type="number" min={1} value={f.max_marks} onChange={(e) => setF({ ...f, max_marks: Number(e.target.value) })} /></Field>
      </div>
      <Checkbox label="Accept late submissions (marked as late)" checked={f.allow_late} onChange={(e) => setF({ ...f, allow_late: e.target.checked })} />
      <fieldset><legend className="text-sm font-semibold">Learners can submit</legend>
        <div className="mt-2 flex flex-wrap gap-4">{[['text', 'Written response'], ['link', 'A link'], ['file', 'Files']].map(([v, l]) => <Checkbox key={v} label={l} checked={f.submission_types.includes(v)} onChange={() => toggleType(v)} />)}</div>
      </fieldset>
      <div>
        <p className="text-sm font-semibold">Attachments for learners</p>
        <ul className="mt-2 space-y-1.5">{f.attachments.map((x, i) => <li key={i} className="flex items-center gap-2 text-sm"><Link2 className="h-4 w-4 text-ink-400" /><span className="flex-1 truncate">{x.title}</span><button aria-label="Remove attachment" onClick={() => setF({ ...f, attachments: f.attachments.filter((_, j) => j !== i) })} className="text-ink-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></li>)}</ul>
        <div className="mt-2 space-y-2">
          <MediaPicker kind="any" courseId={a.course_id ?? undefined} value={att.url} onChange={(u) => setAtt((x) => ({ ...x, url: u }))} label="Attach a file from your device" onUploaded={(_r, file) => setAtt((x) => ({ ...x, title: x.title || file.name }))} />
          <div className="flex gap-2"><Input placeholder="Attachment title" value={att.title} onChange={(e) => setAtt({ ...att, title: e.target.value })} aria-label="Attachment title" /><Button variant="outline" disabled={!att.title || !att.url.startsWith('https://')} onClick={() => { setF({ ...f, attachments: [...f.attachments, att] }); setAtt({ title: '', url: '' }); }}>Add</Button></div>
        </div>
      </div>
      <Button onClick={save} disabled={!f.submission_types.length}>Save settings</Button>
    </CardBody></Card>
  );
}

function RubricEditor({ assignmentId, criteria, onChange }: { assignmentId: string; criteria: Criterion[]; onChange: () => void }) {
  const toast = useToast();
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  const [p, setP] = useState(5);
  const total = criteria.reduce((s, c) => s + Number(c.max_points), 0);
  return (
    <Card className="max-w-3xl">
      <CardHeader title="Grading rubric" description={`Optional. Criteria add up to ${total} points — the final score is set by you.`} />
      <CardBody className="space-y-4">
        <ul className="space-y-2">{criteria.map((c) => (
          <li key={c.id} className="flex items-start gap-3 rounded-xl border border-ink-200 p-3"><div className="flex-1"><p className="font-semibold">{c.title}</p>{c.description && <p className="text-sm text-ink-500">{c.description}</p>}</div><Badge>{Number(c.max_points)} pts</Badge>
            <button aria-label="Remove criterion" className="text-ink-400 hover:text-red-600" onClick={async () => { await supabase.from('rubric_criteria').delete().eq('id', c.id); onChange(); }}><Trash2 className="h-4 w-4" /></button></li>
        ))}</ul>
        <div className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-[1fr_1fr_6rem_auto]">
          <Input placeholder="Criterion" value={t} onChange={(e) => setT(e.target.value)} aria-label="Criterion title" />
          <Input placeholder="What earns full points?" value={d} onChange={(e) => setD(e.target.value)} aria-label="Criterion description" />
          <Input type="number" min={1} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Points" />
          <Button disabled={!t.trim()} onClick={async () => { const { error } = await supabase.from('rubric_criteria').insert({ assignment_id: assignmentId, title: t.trim(), description: d || null, max_points: p, position: criteria.length }); if (error) toast.error('Could not add', error.message); else { setT(''); setD(''); onChange(); } }}>Add</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function GradeDialog({ sub, assignment, criteria, onClose }: { sub: Sub | null; assignment: AssignmentRow; criteria: Criterion[]; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const detail = useQuery({
    queryKey: ['submission-detail', sub?.submission_id], enabled: Boolean(sub?.submission_id),
    queryFn: async () => {
      const [s, files, g] = await Promise.all([
        supabase.from('assignment_submissions').select('id, text_response, link_url, status, submitted_at, is_late, revision').eq('id', sub!.submission_id!).single(),
        supabase.from('submission_files').select('id, filename, bytes').eq('submission_id', sub!.submission_id!),
        supabase.from('submission_grades').select('score, feedback, rubric_scores').eq('submission_id', sub!.submission_id!).maybeSingle(),
      ]);
      return { s: unwrap(s), files: unwrap(files), g: unwrap(g) };
    },
  });
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rs, setRs] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const g = detail.data?.g;
    setScore(g ? String(g.score) : '');
    setFeedback(g?.feedback ?? '');
    setRs((g?.rubric_scores as Record<string, number>) ?? {});
  }, [detail.data]);
  const rubricTotal = Object.values(rs).reduce((a, b) => a + Number(b || 0), 0);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('submission_grades').upsert({ submission_id: sub!.submission_id!, score: Number(score), feedback: feedback || null, rubric_scores: rs, graded_by: user!.id, released: true }, { onConflict: 'submission_id' });
    setBusy(false);
    if (error) toast.error('Could not save grade', errorMessage(error)); else { toast.success('Graded — learner notified'); onClose(); }
  };
  const returnWork = async () => {
    const { error } = await supabase.from('assignment_submissions').update({ status: 'returned' }).eq('id', sub!.submission_id!);
    if (error) toast.error('Could not return', error.message); else { toast.success('Returned for correction'); onClose(); }
  };
  return (
    <Dialog open={Boolean(sub)} onOpenChange={(o) => !o && onClose()} title={`${sub?.learner_name ?? ''} — ${assignment.title}`} size="xl">
      {detail.isLoading || !detail.data ? <LoadingBlock /> : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <p className="text-sm text-ink-500">Submitted {fmtDateTime(detail.data.s.submitted_at)}{detail.data.s.is_late && ' · late'} · revision {detail.data.s.revision}</p>
            {detail.data.s.text_response && <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-4 text-sm text-ink-800">{detail.data.s.text_response}</div>}
            {detail.data.s.link_url && <a href={safeExternalUrl(detail.data.s.link_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Link2 className="h-4 w-4" />Open submitted link</a>}
            {detail.data.files.map((f) => <button key={f.id} className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline" onClick={async () => { try { window.open(await getSubmissionFileUrl(f.id), '_blank', 'noopener'); } catch (e) { toast.error('Cannot open file', errorMessage(e)); } }}><FileText className="h-4 w-4" />{f.filename}</button>)}
            {!detail.data.s.text_response && !detail.data.s.link_url && !detail.data.files.length && <Alert tone="warning">This submission is empty.</Alert>}
          </div>
          <div className="space-y-4">
            {criteria.length > 0 && (
              <div className="space-y-2"><p className="text-sm font-bold">Rubric</p>{criteria.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-sm"><span className="flex-1">{c.title}</span><Input type="number" min={0} max={Number(c.max_points)} step={0.5} className="h-9 w-20" value={rs[c.id] ?? ''} onChange={(e) => setRs({ ...rs, [c.id]: Number(e.target.value) })} aria-label={`${c.title} points`} /><span className="w-12 text-ink-500">/ {Number(c.max_points)}</span></label>
              ))}<button className="text-xs font-semibold text-brand-700" onClick={() => setScore(String(rubricTotal))}>Use rubric total ({rubricTotal}) as score</button></div>
            )}
            <Field label={`Score (out of ${Number(assignment.max_marks)})`}><Input type="number" min={0} max={Number(assignment.max_marks)} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} /></Field>
            <Field label="Feedback"><Textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, and what to improve…" /></Field>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} disabled={score === '' || Number(score) > Number(assignment.max_marks)} onClick={save}>Save grade & feedback</Button>
              {detail.data.s.status === 'submitted' && <Button variant="outline" leftIcon={<Undo2 className="h-4 w-4" />} onClick={returnWork}>Return for correction</Button>}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

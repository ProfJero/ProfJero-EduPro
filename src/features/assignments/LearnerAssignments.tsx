import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ClipboardList, FileText, Link2, Paperclip, Send, Trash2, Undo2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, DataTable, EmptyState, Field, Input, LoadingBlock, PageHeader, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, fromNow } from '@/lib/dates';
import { errorMessage, safeExternalUrl } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { FileUploadButton } from '@/features/media/FileUploadButton';
import { getSubmissionFileUrl } from '@/features/media/upload';
import { isPending, useMyAssignments, type MyAssignment } from './queries';

export function LearnerAssignments() {
  const { data, isLoading } = useMyAssignments();
  if (isLoading) return <LoadingBlock />;
  const pending = (data ?? []).filter(isPending);
  const submitted = (data ?? []).filter((a) => a.submission?.status === 'submitted');
  const graded = (data ?? []).filter((a) => a.submission?.status === 'graded');
  const table = (rows: MyAssignment[]) => (
    <DataTable rows={rows} rowKey={(r) => r.id} caption="Assignments"
      empty={<EmptyState icon={<ClipboardList className="h-7 w-7" />} title="Nothing here" />}
      columns={[
        { key: 't', header: 'Assignment', primary: true, cell: (r) => <Link to={`/learn/assignments/${r.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{r.title}</Link> },
        { key: 'c', header: 'Course / class', cell: (r) => <span className="text-ink-600">{r.course?.title ?? r.cls?.name}</span> },
        { key: 'd', header: 'Due', cell: (r) => r.due_at ? <span className={new Date(r.due_at) < new Date() && isPending(r) ? 'font-semibold text-red-600' : ''}>{fmtDateTime(r.due_at)}</span> : '—' },
        { key: 's', header: 'Status', cell: (r) => r.grade ? <Badge tone="green">{Number(r.grade.score)}/{Number(r.max_marks)}</Badge> : <StatusBadge status={r.submission?.status ?? 'not started'} /> },
      ]} />
  );
  return (
    <div>
      <PageHeader title="Assignments" description="Submit your work, track deadlines and read your teacher's feedback." />
      <Tabs tabs={[
        { value: 'todo', label: 'To do', count: pending.length, content: table(pending) },
        { value: 'submitted', label: 'Submitted', count: submitted.length, content: table(submitted) },
        { value: 'graded', label: 'Graded', count: graded.length, content: table(graded) },
      ]} />
    </div>
  );
}

type FileRow = { id: string; filename: string; bytes: number | null; created_at: string };

export function AssignmentSubmitPage() {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useMyAssignments();
  const a = data?.find((x) => x.id === assignmentId);
  const rubric = useQuery({
    queryKey: ['rubric', assignmentId], enabled: Boolean(a),
    queryFn: async () => unwrap(await supabase.from('rubric_criteria').select('id, title, description, max_points').eq('assignment_id', assignmentId!).order('position')),
  });
  const files = useQuery({
    queryKey: ['submission-files', a?.submission?.id], enabled: Boolean(a?.submission?.id),
    queryFn: async () => unwrap(await supabase.from('submission_files').select('id, filename, bytes, created_at').eq('submission_id', a!.submission!.id).order('created_at')) as FileRow[],
  });
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  useEffect(() => {
    setText(a?.submission?.text_response ?? '');
    setLink(a?.submission?.link_url ?? '');
  }, [a?.submission?.id, a?.submission?.text_response, a?.submission?.link_url]);

  if (isLoading) return <LoadingBlock />;
  if (!a) return <EmptyState title="Assignment not available" description="It may not be published, or it isn't part of your courses." />;
  const sub = a.submission;
  const editable = !sub || sub.status === 'draft' || sub.status === 'returned';
  const late = a.due_at && new Date(a.due_at) < new Date();
  const closed = late && !a.allow_late;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['my-assignments'] });
    void qc.invalidateQueries({ queryKey: ['submission-files'] });
  };

  /** Creates or updates my submission (idempotent: unique per assignment+learner). */
  const save = async (status: 'draft' | 'submitted') => {
    if (link && !safeExternalUrl(link)) return toast.error('Check the link', 'Links must start with https://');
    setBusy(status === 'draft' ? 'draft' : 'submit');
    const patch = { text_response: text || null, link_url: link || null, status };
    const res = sub
      ? await supabase.from('assignment_submissions').update(patch).eq('id', sub.id).select('id').single()
      : await supabase.from('assignment_submissions').upsert({ assignment_id: a.id, user_id: user!.id, ...patch }, { onConflict: 'assignment_id,user_id' }).select('id').single();
    setBusy(null);
    if (res.error) return toast.error(status === 'submitted' ? 'Not submitted' : 'Not saved', errorMessage(res.error));
    toast.success(status === 'submitted' ? 'Work submitted' : 'Draft saved', status === 'submitted' ? 'Your teacher has been notified.' : undefined);
    refresh();
    return res.data.id;
  };

  const ensureDraft = async () => sub?.id ?? (await save('draft'));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader back={{ to: '/learn/assignments', label: 'Assignments' }} eyebrow={a.course?.title ?? a.cls?.name} title={a.title}
        actions={<StatusBadge status={sub?.status ?? 'not started'} />} />
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{a.due_at ? `Due ${fmtDateTime(a.due_at)} (${fromNow(a.due_at)})` : 'No deadline'}</span>
            <span>Max marks: <strong>{Number(a.max_marks)}</strong></span>
            <span>Submit as: {a.submission_types.join(', ')}</span>
          </div>
          <p className="whitespace-pre-wrap text-ink-800">{a.instructions || 'No instructions provided.'}</p>
          {a.attachments?.length > 0 && (
            <ul className="space-y-2">{a.attachments.map((f, i) => <li key={i}><a href={safeExternalUrl(f.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Paperclip className="h-4 w-4" />{f.title}</a></li>)}</ul>
          )}
        </CardBody>
      </Card>

      {a.grade && (
        <Card className="ring-2 ring-growth-500/30">
          <CardHeader title="Feedback from your teacher" description={`Marked ${fmtDateTime(a.grade.graded_at)}`} action={<span className="text-2xl font-extrabold text-growth-700">{Number(a.grade.score)}/{Number(a.max_marks)}</span>} />
          <CardBody className="space-y-4">
            {a.grade.feedback && <p className="whitespace-pre-wrap text-ink-800">{a.grade.feedback}</p>}
            {rubric.data?.length ? (
              <ul className="space-y-2">{rubric.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2.5 text-sm"><span><strong>{c.title}</strong>{c.description && <span className="block text-ink-500">{c.description}</span>}</span><span className="font-bold">{a.grade!.rubric_scores?.[c.id] ?? '—'} / {Number(c.max_points)}</span></li>
              ))}</ul>
            ) : null}
          </CardBody>
        </Card>
      )}
      {sub?.status === 'returned' && <Alert tone="warning" title="Returned for correction">Your teacher returned this work. Update it and submit again.</Alert>}
      {sub?.status === 'submitted' && <Alert tone="success" title="Submitted">Submitted {fmtDateTime(sub.submitted_at)}{sub.is_late && ' (late)'}. Your teacher will mark it soon.</Alert>}

      <Card>
        <CardHeader title="Your work" description={editable ? 'Save a draft any time. Submit when you are ready.' : 'Your submission'} />
        <CardBody className="space-y-5">
          {closed && editable && <Alert tone="error">The deadline has passed and late submissions are not accepted.</Alert>}
          {late && a.allow_late && editable && <Alert tone="warning">The deadline has passed. You can still submit, but it will be marked late.</Alert>}
          {a.submission_types.includes('text') && (
            <Field label="Written response"><Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} disabled={!editable} maxLength={50000} /></Field>
          )}
          {a.submission_types.includes('link') && (
            <Field label="Link to your work" hint="For example a Google Doc, GitHub repository or Replit project. Make sure your teacher can open it.">
              <Input type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={!editable} placeholder="https://" />
            </Field>
          )}
          {a.submission_types.includes('file') && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-800">Files</p>
              <ul className="mb-3 space-y-2">
                {(files.data ?? []).map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl border border-ink-200 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-ink-400" />
                    <button className="flex-1 truncate text-left font-medium text-brand-700 hover:underline" onClick={async () => { try { window.open(await getSubmissionFileUrl(f.id), '_blank', 'noopener'); } catch (e) { toast.error('Cannot open file', errorMessage(e)); } }}>{f.filename}</button>
                    {editable && <button aria-label={`Remove ${f.filename}`} className="text-ink-400 hover:text-red-600" onClick={async () => { const { error } = await supabase.from('submission_files').delete().eq('id', f.id); if (error) toast.error('Could not remove', error.message); refresh(); }}><Trash2 className="h-4 w-4" /></button>}
                  </li>
                ))}
              </ul>
              {editable && !closed && <FileUploadButton purpose="submission" ctx={{}} label="Attach a file" onUploaded={async (r, file) => {
                const sid = await ensureDraft();
                if (!sid) return;
                const { error } = await supabase.from('submission_files').insert({ submission_id: sid, public_id: r.public_id, resource_type: r.resource_type, delivery_type: 'authenticated', format: r.format ?? null, version: r.version, filename: file.name.slice(0, 200), bytes: r.bytes });
                if (error) toast.error('Could not attach file', error.message); else toast.success('File attached');
                refresh();
              }} />}
            </div>
          )}
          {editable && !closed && (
            <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              <Button variant="outline" loading={busy === 'draft'} onClick={() => save('draft')}>Save draft</Button>
              <Button loading={busy === 'submit'} leftIcon={<Send className="h-4 w-4" />} onClick={() => save('submitted')}>{sub?.status === 'returned' ? 'Resubmit' : 'Submit work'}</Button>
            </div>
          )}
          {!editable && (
            <div className="space-y-2 text-sm">
              {sub?.text_response && <p className="whitespace-pre-wrap rounded-xl bg-ink-50 p-4 text-ink-800">{sub.text_response}</p>}
              {sub?.link_url && <a href={safeExternalUrl(sub.link_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-brand-700"><Link2 className="h-4 w-4" />{sub.link_url}</a>}
              {sub?.status === 'submitted' && <p className="text-xs text-ink-500"><Undo2 className="mr-1 inline h-3 w-3" />Need to change something? Ask your teacher to return it for correction.</p>}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardCheck, Clock, Repeat, Target, Trophy } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, DataTable, EmptyState, LoadingBlock, PageHeader, Tabs, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import { assessmentWindow, useMyAssessments, ASSESSMENT_SELECT, type AssessmentRow, type MyAssessment } from './queries';

export function LearnerAssessments() {
  const { data, isLoading } = useMyAssessments();
  const [tab, setTab] = useState('todo');
  if (isLoading) return <LoadingBlock />;
  const todo = (data ?? []).filter((a) => assessmentWindow(a) !== 'closed' && !a.best?.passed && (a.attempts.length < a.max_attempts || a.open));
  const done = (data ?? []).filter((a) => !todo.includes(a));
  const table = (rows: MyAssessment[]) => (
    <DataTable rows={rows} rowKey={(r) => r.id} caption="Assessments"
      empty={<EmptyState icon={<ClipboardCheck className="h-7 w-7" />} title="Nothing here" description="Assessments from your courses and classes will appear here." />}
      columns={[
        { key: 't', header: 'Assessment', primary: true, cell: (r) => <Link to={`/learn/assessments/${r.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{r.title}</Link> },
        { key: 'c', header: 'Course / class', cell: (r) => <span className="text-ink-600">{r.course?.title ?? r.cls?.name}</span> },
        { key: 'k', header: 'Type', cell: (r) => <Badge>{r.kind}</Badge> },
        { key: 'w', header: 'Closes', cell: (r) => r.closes_at ? fmtDateTime(r.closes_at) : '—' },
        { key: 'a', header: 'Attempts', cell: (r) => `${r.attempts.length}/${r.max_attempts}` },
        { key: 's', header: 'Best', cell: (r) => r.best ? <Badge tone={r.best.passed ? 'green' : r.best.pending_manual ? 'brand' : 'amber'}>{r.best.pending_manual ? 'Marking' : `${Math.round(Number(r.best.percentage))}%`}</Badge> : r.open ? <Badge tone="brand">In progress</Badge> : <span className="text-ink-400">—</span> },
      ]} />
  );
  return (
    <div>
      <PageHeader title="Assessments" description="Quizzes, tests and exams from your courses and classes." />
      <Tabs value={tab} onValueChange={setTab} tabs={[{ value: 'todo', label: 'To do', count: todo.length, content: table(todo) }, { value: 'done', label: 'Completed & closed', count: done.length, content: table(done) }]} />
    </div>
  );
}

export function AssessmentStart() {
  const { assessmentId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const { data: a, isLoading } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: async () => unwrap(await supabase.from('assessments').select(ASSESSMENT_SELECT).eq('id', assessmentId!).maybeSingle()) as unknown as AssessmentRow | null,
  });
  const mine = useMyAssessments();
  const me = mine.data?.find((x) => x.id === assessmentId);
  const qCount = useQuery({ queryKey: ['assessment-qcount', assessmentId], queryFn: async () => (await supabase.from('assessment_questions').select('question_id', { count: 'exact', head: true }).eq('assessment_id', assessmentId!)).count });
  if (isLoading || mine.isLoading) return <LoadingBlock />;
  if (!a) return <EmptyState title="Assessment not available" description="It may not be published yet, or it isn't part of your courses." />;
  const win = assessmentWindow(a);
  const remaining = a.max_attempts - (me?.attempts.length ?? 0);
  const canStart = win === 'open' && (remaining > 0 || me?.open);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader back={{ to: '/learn/assessments', label: 'Assessments' }} eyebrow={a.course?.title ?? a.cls?.name} title={a.title} />
      <Card>
        <CardBody className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info icon={<Clock className="h-4 w-4" />} label="Time limit" value={a.duration_minutes ? `${a.duration_minutes} min` : 'None'} />
            <Info icon={<Target className="h-4 w-4" />} label="Pass mark" value={`${Number(a.pass_mark_pct)}%`} />
            <Info icon={<Repeat className="h-4 w-4" />} label="Attempts left" value={`${Math.max(remaining, 0)} of ${a.max_attempts}`} />
            <Info icon={<CalendarClock className="h-4 w-4" />} label="Closes" value={a.closes_at ? fmtDateTime(a.closes_at) : 'Open'} />
          </div>
          {a.instructions && <div><h2 className="font-bold">Instructions</h2><p className="mt-1 whitespace-pre-wrap text-ink-700">{a.instructions}</p></div>}
          {qCount.data != null && <p className="text-sm text-ink-500">{qCount.data} question{qCount.data === 1 ? '' : 's'} · your answers save automatically as you go.</p>}
          {a.duration_minutes && <Alert tone="warning">Once you start, the timer keeps running even if you close the page. Your attempt is submitted automatically when time runs out.</Alert>}
          {win === 'not_open' && <Alert tone="info">This assessment opens {fmtDateTime(a.opens_at)}.</Alert>}
          {win === 'closed' && <Alert tone="info">This assessment has closed.</Alert>}
          <div className="flex flex-wrap gap-3">
            {canStart && <Button size="lg" loading={starting} onClick={async () => {
              setStarting(true);
              const { data, error } = await supabase.rpc('start_attempt', { p_assessment: a.id });
              setStarting(false);
              if (error) toast.error('Could not start', errorMessage(error)); else nav(`/learn/assessments/attempt/${data}`);
            }}>{me?.open ? 'Resume attempt' : me?.attempts.length ? 'Start new attempt' : 'Start assessment'}</Button>}
          </div>
        </CardBody>
      </Card>
      {me && me.attempts.length > 0 && (
        <Card><CardBody>
          <h2 className="flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-sun-500" />Your attempts</h2>
          <ul className="mt-3 divide-y divide-ink-100">{me.attempts.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>Attempt {t.attempt_no} · {fmtDateTime(t.submitted_at ?? t.started_at)}</span>
              <Link to={`/learn/assessments/attempt/${t.id}`} className="font-semibold text-brand-700">{t.status === 'in_progress' ? 'Continue' : 'Review'}</Link>
            </li>
          ))}</ul>
        </CardBody></Card>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-ink-50 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">{icon}{label}</p><p className="mt-0.5 font-bold text-ink-900">{value}</p></div>;
}

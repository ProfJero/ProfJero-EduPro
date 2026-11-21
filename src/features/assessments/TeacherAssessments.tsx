import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Plus } from 'lucide-react';
import { Badge, Button, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses, useTeachingClasses } from '@/features/teachers/queries';
import { ASSESSMENT_SELECT, type AssessmentRow } from './queries';

/** Course/class picker values encoded as "course:<id>" or "class:<id>". */
export function useTeachingTargets() {
  const courses = useManagedCourses();
  const classes = useTeachingClasses();
  const options = [
    ...(courses.data ?? []).map((c) => ({ v: `course:${c.id}`, l: `Course · ${c.title}` })),
    ...(classes.data ?? []).map((c) => ({ v: `class:${c.id}`, l: `Class · ${c.name}${c.stream ? ` ${c.stream}` : ''} — ${c.school?.name ?? ''}` })),
  ];
  return { options, loading: courses.isLoading || classes.isLoading, courseIds: (courses.data ?? []).map((c) => c.id), classIds: (classes.data ?? []).map((c) => c.id) };
}

export function TeacherAssessments() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const targets = useTeachingTargets();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState('quiz');
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-assessments', targets.courseIds.join(), targets.classIds.join()],
    enabled: !targets.loading,
    queryFn: async () => {
      const ors = [targets.courseIds.length && `course_id.in.(${targets.courseIds.join(',')})`, targets.classIds.length && `class_id.in.(${targets.classIds.join(',')})`].filter(Boolean).join(',');
      if (!ors) return [] as AssessmentRow[];
      return unwrap(await supabase.from('assessments').select(ASSESSMENT_SELECT).or(ors).order('created_at', { ascending: false })) as unknown as AssessmentRow[];
    },
  });
  const pending = useQuery({ queryKey: ['pending-manual'], queryFn: async () => unwrap(await supabase.from('assessment_results').select('assessment_id').eq('pending_manual', true)) });
  const pendingBy = (id: string) => (pending.data ?? []).filter((p) => p.assessment_id === id).length;
  return (
    <div>
      <PageHeader title="Assessments" description="Quizzes, tests and exams with automatic and manual grading." actions={<><Link to="/teach/banks" className="self-center text-sm font-semibold text-brand-700">Question banks</Link><Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={!targets.options.length}>New assessment</Button></>} />
      {isLoading || targets.loading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState icon={<ClipboardCheck className="h-7 w-7" />} title="No assessments yet" description="Create a quiz or test for one of your courses or classes." />} columns={[
          { key: 't', header: 'Assessment', primary: true, cell: (r) => <Link to={`/teach/assessments/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'c', header: 'For', cell: (r) => r.course?.title ?? r.cls?.name },
          { key: 'k', header: 'Type', cell: (r) => <Badge>{r.kind}</Badge> },
          { key: 'cl', header: 'Closes', cell: (r) => (r.closes_at ? fmtDateTime(r.closes_at) : '—') },
          { key: 'p', header: 'To mark', cell: (r) => (pendingBy(r.id) ? <Badge tone="amber">{pendingBy(r.id)}</Badge> : '—') },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]} />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="New assessment" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={title.trim().length < 2} onClick={async () => {
        const [scope, id] = (target || targets.options[0]?.v || '').split(':');
        const { data: row, error } = await supabase.from('assessments').insert({ title: title.trim(), kind, created_by: user!.id, course_id: scope === 'course' ? id : null, class_id: scope === 'class' ? id : null }).select('id').single();
        if (error) return toast.error('Could not create', error.message);
        nav(`/teach/assessments/${row.id}`);
      }}>Create & add questions</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="For"><Select value={target} onChange={(e) => setTarget(e.target.value)}>{targets.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select></Field>
          <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="quiz">Quiz</option><option value="test">Test</option><option value="exam">Exam</option><option value="practice">Practice (doesn't count towards completion)</option></Select></Field>
        </div>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, HeartPulse, Plus, Send } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses, useTeachingClasses } from '@/features/teachers/queries';

export const PULSE_KINDS: Record<string, { label: string; question: string; scale: string[] }> = {
  understanding: { label: 'Understanding', question: 'How well did you understand today’s lesson?', scale: ['Lost', 'Confused', 'Getting there', 'Good', 'Got it!'] },
  confidence: { label: 'Confidence', question: 'How confident do you feel about this topic?', scale: ['Not at all', 'A little', 'Okay', 'Confident', 'Very confident'] },
  pace: { label: 'Pace', question: 'How is the pace of the lessons?', scale: ['Far too slow', 'A bit slow', 'Just right', 'A bit fast', 'Far too fast'] },
  mood: { label: 'Wellbeing', question: 'How are you feeling today?', scale: ['😞', '🙁', '😐', '🙂', '😄'] },
};
type Summary = { responses: number; average: number | null; distribution: Record<string, number>; comments: string[] };

/** Teacher view: run anonymous pulse checks and read the class mood. */
export function ClassPulsePage() {
  const { user } = useAuth();
  const classes = useTeachingClasses();
  const courses = useManagedCourses();
  const [open, setOpen] = useState(false);
  const checks = useQuery({
    queryKey: ['pulse-checks', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('pulse_checks').select('id, kind, question, class_id, course_id, closes_at, created_at, cls:school_classes(name), course:courses(title)').eq('created_by', user!.id).order('created_at', { ascending: false }).limit(30)) as unknown as
      { id: string; kind: string; question: string; class_id: string | null; course_id: string | null; closes_at: string | null; created_at: string; cls: { name: string } | null; course: { title: string } | null }[],
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="EduIntelligence" title="Class Pulse" description="Quick anonymous check-ins so you can see how the class really feels — understanding, confidence, pace and wellbeing. Individual answers are never shown."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New pulse check</Button>} />
      {checks.isLoading ? <LoadingBlock /> : checks.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">{checks.data.map((c) => <PulseResult key={c.id} check={c} />)}</div>
      ) : <EmptyState icon={<HeartPulse className="h-8 w-8" />} title="No pulse checks yet" description="Send one at the end of a lesson — it takes learners five seconds." action={<Button onClick={() => setOpen(true)}>Send a pulse check</Button>} />}
      <NewPulseDialog open={open} onOpenChange={setOpen} classes={(classes.data ?? []).map((c) => ({ id: c.id, name: c.name }))} courses={(courses.data ?? []).map((c) => ({ id: c.id, name: c.title }))} />
    </div>
  );
}

function PulseResult({ check }: { check: { id: string; kind: string; question: string; closes_at: string | null; created_at: string; cls: { name: string } | null; course: { title: string } | null } }) {
  const s = useQuery({ queryKey: ['pulse-summary', check.id], refetchInterval: 30_000, queryFn: async () => unwrap(await supabase.rpc('pulse_summary', { p_check: check.id })) as unknown as Summary });
  const meta = PULSE_KINDS[check.kind] ?? PULSE_KINDS.understanding;
  const max = Math.max(1, ...Object.values(s.data?.distribution ?? {}));
  const avg = s.data?.average != null ? Number(s.data.average) : null;
  const tone = avg == null ? 'text-ink-400' : check.kind === 'pace' ? (Math.abs(avg - 3) < 0.6 ? 'text-growth-600' : 'text-sun-500') : avg >= 3.8 ? 'text-growth-600' : avg >= 2.8 ? 'text-sun-500' : 'text-red-600';
  return (
    <Card>
      <CardHeader title={check.question} description={`${check.cls?.name ?? check.course?.title ?? ''} · ${fromNow(check.created_at)}`} action={<Badge>{meta.label}</Badge>} />
      <CardBody className="space-y-3">
        <div className="flex items-end gap-4">
          <div><p className={cn('text-4xl font-extrabold tabular-nums', tone)}>{avg?.toFixed(1) ?? '—'}</p><p className="text-xs text-ink-500">average of 5 · {s.data?.responses ?? 0} responses</p></div>
          <div className="flex flex-1 items-end gap-1.5" aria-label="Distribution">
            {[1, 2, 3, 4, 5].map((v) => { const n = s.data?.distribution?.[v] ?? 0; return (
              <div key={v} className="flex flex-1 flex-col items-center gap-1"><span className="text-xs font-bold">{n}</span><div className="w-full rounded-t-md bg-brand-500" style={{ height: `${(n / max) * 64 + 2}px` }} /><span className="truncate text-[0.65rem] text-ink-500" title={meta.scale[v - 1]}>{meta.scale[v - 1]}</span></div>
            ); })}
          </div>
        </div>
        {s.data?.comments.length ? <ul className="space-y-1.5 border-t border-ink-100 pt-3 text-sm">{s.data.comments.slice(0, 5).map((c, i) => <li key={i} className="rounded-lg bg-ink-50 px-3 py-1.5">“{c}”</li>)}</ul> : null}
      </CardBody>
    </Card>
  );
}

function NewPulseDialog({ open, onOpenChange, classes, courses }: { open: boolean; onOpenChange: (o: boolean) => void; classes: { id: string; name: string }[]; courses: { id: string; name: string }[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState('');
  const [kind, setKind] = useState('understanding');
  const [question, setQuestion] = useState(PULSE_KINDS.understanding.question);
  const [hours, setHours] = useState(24);
  const create = useMutation({
    mutationFn: async () => {
      const [t, id] = scope.split(':');
      return unwrap(await supabase.from('pulse_checks').insert({ created_by: user!.id, kind, question: question.trim(), class_id: t === 'class' ? id : null, course_id: t === 'course' ? id : null, closes_at: new Date(Date.now() + hours * 3_600_000).toISOString() }));
    },
    onSuccess: () => { onOpenChange(false); void qc.invalidateQueries({ queryKey: ['pulse-checks'] }); toast.success('Pulse check sent', 'Learners see it in their class or course.'); },
    onError: (e) => toast.error('Could not send', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New pulse check" footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!scope || question.trim().length < 3} loading={create.isPending} onClick={() => create.mutate()} leftIcon={<Send className="h-4 w-4" />}>Send</Button></>}>
      <div className="space-y-4">
        <Field label="Send to" required><Select value={scope} onChange={(e) => setScope(e.target.value)}><option value="">Choose…</option>
          {classes.length > 0 && <optgroup label="Classes">{classes.map((c) => <option key={c.id} value={`class:${c.id}`}>{c.name}</option>)}</optgroup>}
          {courses.length > 0 && <optgroup label="Courses">{courses.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.name}</option>)}</optgroup>}</Select></Field>
        <Field label="Type"><Select value={kind} onChange={(e) => { setKind(e.target.value); setQuestion(PULSE_KINDS[e.target.value].question); }}>{Object.entries(PULSE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Question"><Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} /></Field>
        <Field label="Open for"><Select value={hours} onChange={(e) => setHours(Number(e.target.value))}><option value={1}>1 hour</option><option value={24}>1 day</option><option value={72}>3 days</option><option value={168}>1 week</option></Select></Field>
      </div>
    </Dialog>
  );
}

/** Learner view: open pulse checks for a class or course. */
export function PulsePrompt({ classId, courseId }: { classId?: string; courseId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const checks = useQuery({
    queryKey: ['pulse-open', classId, courseId, user?.id], enabled: Boolean(user && (classId || courseId)),
    queryFn: async () => {
      let q = supabase.from('pulse_checks').select('id, kind, question, closes_at').gt('closes_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(3);
      q = classId ? q.eq('class_id', classId) : q.eq('course_id', courseId!);
      const list = unwrap(await q);
      if (!list.length) return [];
      const mine = unwrap(await supabase.from('pulse_responses').select('check_id').eq('user_id', user!.id).in('check_id', list.map((c) => c.id)));
      const done = new Set(mine.map((m) => m.check_id));
      return list.filter((c) => !done.has(c.id));
    },
  });
  const [comment, setComment] = useState('');
  const answer = useMutation({
    mutationFn: async (v: { id: string; value: number }) => unwrap(await supabase.from('pulse_responses').insert({ check_id: v.id, user_id: user!.id, value: v.value, comment: comment.trim() || null })),
    onSuccess: () => { setComment(''); toast.success('Thanks!', 'Your answer is anonymous.'); void qc.invalidateQueries({ queryKey: ['pulse-open'] }); },
    onError: (e) => toast.error('Could not send', errorMessage(e)),
  });
  const c = checks.data?.[0];
  if (!c) return null;
  const meta = PULSE_KINDS[c.kind] ?? PULSE_KINDS.understanding;
  return (
    <Card className="border-violet-200 bg-violet-50/50">
      <CardBody className="space-y-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-700"><Activity className="h-4 w-4" />Class Pulse · anonymous</p>
        <p className="font-semibold">{c.question}</p>
        <div className="grid grid-cols-5 gap-1.5">{meta.scale.map((label, i) => (
          <button key={i} disabled={answer.isPending} onClick={() => answer.mutate({ id: c.id, value: i + 1 })} className="rounded-xl border border-violet-200 bg-surface px-1 py-2 text-xs font-semibold hover:border-violet-500 hover:bg-violet-100">{label}</button>
        ))}</div>
        <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Anything to tell your teacher? (optional)" aria-label="Optional comment" />
      </CardBody>
    </Card>
  );
}

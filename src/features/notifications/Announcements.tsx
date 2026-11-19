import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pin, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses, useTeachingClasses } from '@/features/teachers/queries';

type Scope = 'platform' | 'school' | 'course' | 'class';

export function AnnouncementComposer({ scope, courseId, classId, schoolId, onPosted }: { scope: Scope; courseId?: string; classId?: string; schoolId?: string; onPosted?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><Megaphone className="h-5 w-5 text-brand-600" />New announcement</span>} description="Everyone in this audience gets an in-app notification." />
      <CardBody className="space-y-3">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></Field>
        <Field label="Message"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} /></Field>
        <Checkbox label="Pin to top" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <Button loading={busy} disabled={title.trim().length < 2 || !body.trim()} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.from('announcements').insert({ scope, course_id: courseId ?? null, class_id: classId ?? null, school_id: schoolId ?? null, title: title.trim(), body: body.trim(), is_pinned: pinned, author_id: user!.id });
          setBusy(false);
          if (error) return toast.error('Could not post', error.message);
          toast.success('Announcement posted');
          setTitle(''); setBody(''); setPinned(false);
          void qc.invalidateQueries({ queryKey: ['announcements'] });
          onPosted?.();
        }}>Post announcement</Button>
      </CardBody>
    </Card>
  );
}

export function AnnouncementList({ scope, id, manage }: { scope: Scope; id?: string; manage?: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['announcements', scope, id],
    queryFn: async () => {
      let q = supabase.from('announcements').select('id, title, body, is_pinned, published_at, author_id').eq('scope', scope).order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(50);
      if (scope === 'course') q = q.eq('course_id', id!);
      if (scope === 'class') q = q.eq('class_id', id!);
      if (scope === 'school') q = q.eq('school_id', id!);
      return unwrap(await q);
    },
  });
  if (isLoading) return <LoadingBlock rows={2} />;
  if (!data?.length) return <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements yet" />;
  return (
    <div className="space-y-3">{data.map((a) => (
      <article key={a.id} className="card p-5">
        <div className="flex items-start gap-2">
          {a.is_pinned && <Badge tone="brand" icon={<Pin className="h-3 w-3" />}>Pinned</Badge>}
          <h3 className="flex-1 font-bold">{a.title}</h3>
          {manage && <button aria-label="Delete announcement" className="text-ink-400 hover:text-red-600" onClick={async () => { await supabase.from('announcements').delete().eq('id', a.id); void qc.invalidateQueries({ queryKey: ['announcements'] }); }}><Trash2 className="h-4 w-4" /></button>}
        </div>
        <p className="text-xs text-ink-400">{fmtDateTime(a.published_at)}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{a.body}</p>
      </article>
    ))}</div>
  );
}

export function TeacherAnnouncements() {
  const courses = useManagedCourses();
  const classes = useTeachingClasses();
  const [target, setTarget] = useState('');
  const options = [...(courses.data ?? []).map((c) => ({ v: `course:${c.id}`, l: `Course · ${c.title}` })), ...(classes.data ?? []).map((c) => ({ v: `class:${c.id}`, l: `Class · ${c.name}${c.stream ? ` ${c.stream}` : ''} (${c.school?.name ?? ''})` }))];
  const t = target || options[0]?.v || '';
  const [scope, id] = t.split(':') as [Scope, string];
  if (courses.isLoading || classes.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-5">
      <PageHeader title="Announcements" description="Send updates to a course or a class you teach." />
      {options.length ? (
        <>
          <Select value={t} onChange={(e) => setTarget(e.target.value)} aria-label="Audience" className="max-w-xl">{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
          <div className="grid gap-5 xl:grid-cols-2">
            <AnnouncementComposer key={t} scope={scope} courseId={scope === 'course' ? id : undefined} classId={scope === 'class' ? id : undefined} />
            <AnnouncementList scope={scope} id={id} manage />
          </div>
        </>
      ) : <EmptyState title="No courses or classes yet" />}
    </div>
  );
}

export function SchoolAnnouncements() {
  const { schoolId } = useParams();
  return (
    <div className="space-y-5">
      <PageHeader title="School announcements" description="Reach every active member of your school." />
      <div className="grid gap-5 xl:grid-cols-2"><AnnouncementComposer scope="school" schoolId={schoolId} /><AnnouncementList scope="school" id={schoolId} manage /></div>
    </div>
  );
}

export function AdminAnnouncements() {
  return (
    <div className="space-y-5">
      <PageHeader title="Platform announcements" description="Sent to every active user on ProfJero Edu. Use sparingly." />
      <div className="grid gap-5 xl:grid-cols-2"><AnnouncementComposer scope="platform" /><AnnouncementList scope="platform" manage /></div>
    </div>
  );
}

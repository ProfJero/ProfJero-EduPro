import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarCheck, Check, Presentation, Users, Video } from 'lucide-react';
import { Avatar, Badge, Button, ButtonLink, Card, CardBody, CardHeader, EmptyState, Input, LoadingBlock, PageHeader, Select, Tabs, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useUpcomingSessions } from '@/features/learning/queries';
import { SessionCard } from '@/features/live/SessionCard';
import { AnnouncementComposer, AnnouncementList } from '@/features/notifications/Announcements';
import { ClassroomPanel, useRoomMembers } from './ClassroomPanel';
import { useClassInfo } from './ClassRoom';

export function TeacherClassPage() {
  const { classId } = useParams();
  const { data: cls, isLoading } = useClassInfo(classId);
  const sessions = useUpcomingSessions({ classId, days: 30 });
  if (isLoading) return <LoadingBlock />;
  if (!cls) return <EmptyState title="Class not found" description="You may not be assigned to this class." />;
  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/teach/classes', label: 'My classes' }} eyebrow={cls.school?.name} title={`${cls.name}${cls.stream ? ` · ${cls.stream}` : ''}`}
        actions={<ButtonLink to={`/teach/live?class=${cls.id}`} leftIcon={<Video className="h-4 w-4" />}>Schedule live class</ButtonLink>} />
      <Tabs tabs={[
        { value: 'room', label: <span className="inline-flex items-center gap-1.5"><Presentation className="h-4 w-4" />Classroom</span>, content: <ClassroomPanel type="class" roomId={cls.id} canModerate title={cls.name} /> },
        { value: 'roll', label: <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4" />Roll call</span>, content: <RollCall classId={cls.id} /> },
        { value: 'students', label: <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />Students</span>, content: <Roster classId={cls.id} /> },
        { value: 'courses', label: <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" />Subjects</span>, content: <ClassCourses classId={cls.id} /> },
        { value: 'live', label: 'Live classes', content: sessions.data?.length ? <div className="space-y-3">{sessions.data.map((s) => <SessionCard key={s.id} s={s} compact />)}</div> : <EmptyState title="No live classes scheduled" action={<ButtonLink to={`/teach/live?class=${cls.id}`}>Schedule one</ButtonLink>} /> },
        { value: 'news', label: 'Announcements', content: <div className="grid gap-5 xl:grid-cols-2"><AnnouncementComposer scope="class" classId={cls.id} /><AnnouncementList scope="class" id={cls.id} manage /></div> },
      ]} />
    </div>
  );
}

type Status = 'present' | 'late' | 'absent' | 'excused';
const STATUSES: { v: Status; label: string; cls: string }[] = [
  { v: 'present', label: 'Present', cls: 'bg-growth-600 text-white border-growth-600' },
  { v: 'late', label: 'Late', cls: 'bg-sun-500 text-white border-sun-500' },
  { v: 'absent', label: 'Absent', cls: 'bg-red-600 text-white border-red-600' },
  { v: 'excused', label: 'Excused', cls: 'bg-ink-600 text-white border-ink-600' },
];

/** Daily register — the classic roll call. */
export function RollCall({ classId }: { classId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const members = useRoomMembers('class', classId);
  const students = (members.data ?? []).filter((m) => m.member_role === 'learner');
  const existing = useQuery({ queryKey: ['attendance', classId, date], queryFn: async () => unwrap(await supabase.from('class_attendance').select('user_id, status, note').eq('class_id', classId).eq('attendance_date', date)) });
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setMarks(Object.fromEntries((existing.data ?? []).map((r) => [r.user_id, r.status as Status]))), [existing.data]);
  const counts = useMemo(() => STATUSES.map((s) => ({ ...s, n: Object.values(marks).filter((m) => m === s.v).length })), [marks]);
  if (members.isLoading) return <LoadingBlock />;
  return (
    <Card>
      <CardHeader title="Roll call" description="Mark the register for the day. Learners can see their own attendance." action={<Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="w-44" />} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.user_id, marks[s.user_id] ?? 'present'])))} leftIcon={<Check className="h-4 w-4" />}>Mark everyone else present</Button>
          {counts.map((c) => <Badge key={c.v}>{c.label}: {c.n}</Badge>)}
        </div>
        {students.length ? (
          <ul className="divide-y divide-ink-100">{students.map((s) => (
            <li key={s.user_id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Avatar name={s.name} src={s.avatar_url} size={34} />
              <span className="min-w-0 flex-1 font-medium">{s.name}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                {STATUSES.map((st) => (
                  <button key={st.v} role="radio" aria-checked={marks[s.user_id] === st.v} onClick={() => setMarks((m) => ({ ...m, [s.user_id]: st.v }))}
                    className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', marks[s.user_id] === st.v ? st.cls : 'border-ink-200 text-ink-600 hover:border-ink-300')}>{st.label}</button>
                ))}
              </div>
            </li>
          ))}</ul>
        ) : <EmptyState title="No students in this class yet" />}
        {students.length > 0 && <Button loading={busy} disabled={!Object.keys(marks).length} onClick={async () => {
          setBusy(true);
          const rows = Object.entries(marks).map(([user_id, status]) => ({ class_id: classId, user_id, attendance_date: date, status, marked_by: user!.id }));
          const { error } = await supabase.from('class_attendance').upsert(rows, { onConflict: 'class_id,user_id,attendance_date' });
          setBusy(false);
          if (error) toast.error('Register not saved', error.message); else { toast.success('Register saved'); void qc.invalidateQueries({ queryKey: ['attendance', classId] }); }
        }}>Save register</Button>}
      </CardBody>
    </Card>
  );
}

function Roster({ classId }: { classId: string }) {
  const { data, isLoading } = useRoomMembers('class', classId);
  if (isLoading) return <LoadingBlock />;
  return data?.length ? (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.map((m) => (
      <li key={m.user_id} className="card flex items-center gap-3 p-3"><Avatar name={m.name} src={m.avatar_url} size={40} /><span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>{m.member_role === 'teacher' && <Badge tone="green">Teacher</Badge>}</li>
    ))}</ul>
  ) : <EmptyState title="No one in this class yet" />;
}

function ClassCourses({ classId }: { classId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: cls } = useClassInfo(classId);
  const assigned = useQuery({ queryKey: ['class-courses', classId], queryFn: async () => unwrap(await supabase.from('class_courses').select('course:courses(id, title, status)').eq('class_id', classId)) as unknown as { course: { id: string; title: string; status: string } | null }[] });
  const available = useQuery({ queryKey: ['school-courses-for', cls?.school_id], enabled: Boolean(cls), queryFn: async () => unwrap(await supabase.from('courses').select('id, title').eq('school_id', cls!.school_id).in('status', ['published', 'draft'])) });
  const [pick, setPick] = useState('');
  const ids = new Set((assigned.data ?? []).map((a) => a.course?.id));
  return (
    <div className="space-y-4">
      {assigned.data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">{assigned.data.map((a) => a.course && <li key={a.course.id}><Link to={`/teach/courses/${a.course.id}`} className="card block p-4 hover:border-brand-300"><p className="font-bold">{a.course.title}</p><p className="text-xs capitalize text-ink-500">{a.course.status}</p></Link></li>)}</ul>
      ) : <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No subjects assigned" description="Assigning a course enrols every student in the class automatically." />}
      <Card><CardBody className="flex flex-col gap-2 sm:flex-row">
        <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Course to assign"><option value="">Assign a school course…</option>{available.data?.filter((c) => !ids.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        <Button disabled={!pick} onClick={async () => {
          const { error } = await supabase.from('class_courses').insert({ class_id: classId, course_id: pick, assigned_by: user!.id });
          if (error) toast.error('Could not assign', error.message); else { toast.success('Course assigned', 'Students were enrolled automatically.'); setPick(''); void qc.invalidateQueries({ queryKey: ['class-courses', classId] }); }
        }}>Assign</Button>
      </CardBody></Card>
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarCheck, Crown, Megaphone, Presentation, Users, Video } from 'lucide-react';
import { Badge, EmptyState, LoadingBlock, PageHeader, ProgressBar, Tabs } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useUpcomingSessions } from '@/features/learning/queries';
import { SessionCard } from '@/features/live/SessionCard';
import { AnnouncementComposer } from '@/features/notifications/Announcements';
import { PulsePrompt } from '@/features/intelligence/ClassPulse';
import { ClassroomPanel } from './ClassroomPanel';
import { ClassGroups, ClassProgress, JoinRequests, type ClassInfo } from './ClassManage';
import { RollCall } from './TeacherClass';

export function useClassInfo(classId?: string) {
  return useQuery({
    queryKey: ['class', classId],
    enabled: Boolean(classId),
    queryFn: async () => unwrap(await supabase.from('school_classes').select('id, name, stream, level, description, room_label, color, school_id, owner_id, subject, join_code, join_enabled, allow_guests, join_requires_approval, academic_year_id, school:schools(name)').eq('id', classId!).maybeSingle()) as unknown as ClassInfo | null,
  });
}

export function ClassAnnouncements({ classId }: { classId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['announcements', 'class', classId],
    queryFn: async () => unwrap(await supabase.from('announcements').select('id, title, body, is_pinned, published_at').eq('scope', 'class').eq('class_id', classId).order('published_at', { ascending: false }).limit(30)),
  });
  if (isLoading) return <LoadingBlock rows={2} />;
  return data?.length ? <div className="space-y-3">{data.map((a) => (
    <article key={a.id} className="card p-5"><div className="flex items-center gap-2">{a.is_pinned && <Badge tone="brand">Pinned</Badge>}<h3 className="font-bold">{a.title}</h3></div><p className="text-xs text-ink-400">{fmtDateTime(a.published_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{a.body}</p></article>
  ))}</div> : <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No class announcements" />;
}

export function ClassRoomPage() {
  const { classId } = useParams();
  const { user } = useAuth();
  const { data: cls, isLoading } = useClassInfo(classId);
  const courses = useQuery({ queryKey: ['class-learning', classId], enabled: Boolean(classId), queryFn: async () => unwrap(await supabase.rpc('class_learning', { p_class: classId! })) });
  const attendance = useQuery({
    queryKey: ['my-attendance', classId, user?.id],
    enabled: Boolean(classId && user),
    queryFn: async () => unwrap(await supabase.from('class_attendance').select('attendance_date, status, note').eq('class_id', classId!).eq('user_id', user!.id).order('attendance_date', { ascending: false }).limit(60)),
  });
  const sessions = useUpcomingSessions({ classId, days: 30 });
  const leader = useQuery({
    queryKey: ['my-class-leader', classId, user?.id], enabled: Boolean(classId && user),
    queryFn: async () => unwrap(await supabase.from('class_leaders').select('title, permissions').eq('class_id', classId!).eq('user_id', user!.id).maybeSingle()),
  });
  const can = (p: string) => Boolean(leader.data?.permissions.includes(p));
  if (isLoading) return <LoadingBlock />;
  if (!cls) return <EmptyState icon={<Presentation className="h-7 w-7" />} title="Class not found" />;
  const present = (attendance.data ?? []).filter((a) => a.status === 'present' || a.status === 'late').length;
  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/learn/classes', label: 'Classes' }} eyebrow={cls.school?.name ?? cls.subject ?? 'Class'} title={`${cls.name}${cls.stream ? ` · ${cls.stream}` : ''}`} description={cls.description ?? cls.room_label ?? undefined}
        actions={leader.data ? <Badge tone="amber" icon={<Crown className="h-3.5 w-3.5" />}>{leader.data.title}</Badge> : undefined} />
      <Tabs tabs={[
        { value: 'room', label: <span className="inline-flex items-center gap-1.5"><Presentation className="h-4 w-4" />Classroom</span>, content: <ClassroomPanel type="class" roomId={cls.id} canModerate={can('moderate_discussion') || can('pin_messages')} canBoard={can('post_board')} canPoll={can('create_polls')} title={cls.name} side={<PulsePrompt classId={cls.id} />} /> },
        { value: 'groups', label: <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />Study groups</span>, content: <ClassGroups classId={cls.id} /> },
        { value: 'live', label: <span className="inline-flex items-center gap-1.5"><Video className="h-4 w-4" />Live classes</span>, content: sessions.data?.length ? <div className="space-y-3">{sessions.data.map((s) => <SessionCard key={s.id} s={s} compact />)}</div> : <EmptyState title="No live classes scheduled" /> },
        { value: 'courses', label: <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" />Lessons</span>, content: courses.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">{courses.data.map((c) => (
            <Link key={c.course_id} to={`/learn/courses/${c.course_id}`} className="card group p-4 transition hover:-translate-y-0.5 hover:border-brand-300">
              <div className="flex items-center justify-between gap-2"><p className="font-bold group-hover:text-brand-700">{c.title}</p>{c.visibility === 'class' && <Badge tone="green">This class only</Badge>}</div>
              {c.short_description && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{c.short_description}</p>}
              <div className="mt-3 flex items-center gap-3"><ProgressBar value={c.my_progress ?? 0} className="flex-1" /><span className="text-xs font-semibold text-ink-500">{Math.round(Number(c.my_progress ?? 0))}% · {c.lessons} lessons</span></div>
            </Link>
          ))}</div>
        ) : <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No lessons yet" description="Your teacher hasn’t added lessons to this class yet." /> },
        { value: 'news', label: 'Announcements', content: <ClassAnnouncements classId={cls.id} /> },
        { value: 'attendance', label: <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4" />My attendance</span>, content: attendance.data?.length ? (
          <div className="card p-5">
            <p className="text-sm text-ink-600">Present or late on <strong>{present}</strong> of {attendance.data.length} recorded days.</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{attendance.data.map((a) => (
              <li key={a.attendance_date} className="rounded-lg border border-ink-100 p-2 text-center text-xs"><p className="font-semibold">{fmtDate(a.attendance_date, 'EEE d MMM')}</p><Badge tone={a.status === 'present' ? 'green' : a.status === 'late' ? 'amber' : a.status === 'excused' ? 'neutral' : 'red'}>{a.status}</Badge></li>
            ))}</ul>
          </div>
        ) : <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="No attendance recorded yet" /> },
        ...(leader.data ? [{ value: 'lead', label: <span className="inline-flex items-center gap-1.5"><Crown className="h-4 w-4" />Leader tools</span>, content: (
          <div className="space-y-5">
            {can('approve_join_requests') && <JoinRequests classId={cls.id} />}
            {can('take_attendance') && <RollCall classId={cls.id} />}
            {can('post_announcements') && <AnnouncementComposer scope="class" classId={cls.id} />}
            {can('view_progress') && <ClassProgress classId={cls.id} />}
            {!['approve_join_requests', 'take_attendance', 'post_announcements', 'view_progress'].some(can) && <EmptyState icon={<Crown className="h-6 w-6" />} title={leader.data.title} description="Your leadership tools for the board, discussion and polls are on the Classroom tab." />}
          </div>
        ) }] : []),
      ]} />
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

export type MyCourse = {
  id: string; course_id: string; status: string; progress_pct: number; source: string; last_lesson_id: string | null; last_activity_at: string | null; enrolled_at: string; completed_at: string | null;
  course: { id: string; slug: string; title: string; short_description: string; cover_url: string | null; level: string; estimated_hours: number | null; is_premium: boolean; subject: string | null; category: { name: string; slug: string; icon: string } | null } | null;
};

export function useMyCourses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-courses', user?.id],
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('course_enrolments')
      .select('id, course_id, status, progress_pct, source, last_lesson_id, last_activity_at, enrolled_at, completed_at, course:courses(id, slug, title, short_description, cover_url, level, estimated_hours, is_premium, subject, category:categories(name, slug, icon))')
      .eq('user_id', user!.id).order('last_activity_at', { ascending: false, nullsFirst: false })) as unknown as MyCourse[],
  });
}

export function useLessonProgress(courseId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['progress', courseId, user?.id],
    enabled: Boolean(courseId && user),
    queryFn: async () => unwrap(await supabase.from('lesson_progress').select('lesson_id, status, completed_at').eq('course_id', courseId!).eq('user_id', user!.id)),
  });
}

export type MyClass = { class_id: string; cls: { id: string; name: string; stream: string | null; level: string | null; color: string; school: { name: string } | null } | null };
export function useMyClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-classes', user?.id],
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('class_enrolments').select('class_id, cls:school_classes(id, name, stream, level, color, school:schools(name))').eq('user_id', user!.id).eq('status', 'active')) as unknown as MyClass[],
  });
}

export type LiveSessionRow = {
  id: string; title: string; description: string | null; provider: string; join_url: string; starts_at: string; duration_minutes: number; status: string;
  course_id: string | null; class_id: string | null; host_id: string; cancel_reason: string | null; recording_url: string | null; embed_in_app?: boolean;
  course: { title: string } | null; cls: { name: string } | null;
};
export const LIVE_SELECT = 'id, title, description, provider, join_url, starts_at, duration_minutes, status, embed_in_app, course_id, class_id, host_id, cancel_reason, recording_url, course:courses(title), cls:school_classes(name)';

/** Sessions visible to me (RLS restricts to my courses/classes). */
export function useUpcomingSessions(opts: { days?: number; courseId?: string; classId?: string; includePast?: boolean } = {}) {
  const { user } = useAuth();
  const { days = 14, courseId, classId, includePast } = opts;
  return useQuery({
    queryKey: ['live-sessions', user?.id, days, courseId, classId, includePast],
    enabled: Boolean(user),
    queryFn: async () => {
      let q = supabase.from('live_sessions').select(LIVE_SELECT).order('starts_at', { ascending: !includePast });
      const now = Date.now();
      if (!includePast) q = q.gte('starts_at', new Date(now - 3 * 3600_000).toISOString()).lte('starts_at', new Date(now + days * 86400_000).toISOString());
      if (courseId) q = q.eq('course_id', courseId);
      if (classId) q = q.eq('class_id', classId);
      return unwrap(await q.limit(100)) as unknown as LiveSessionRow[];
    },
    refetchInterval: 60_000,
  });
}

export function sessionPhase(s: Pick<LiveSessionRow, 'starts_at' | 'duration_minutes' | 'status'>, now = Date.now()) {
  if (s.status === 'cancelled') return 'cancelled' as const;
  const start = new Date(s.starts_at).getTime();
  const end = start + s.duration_minutes * 60_000;
  if (now > end || s.status === 'completed') return 'ended' as const;
  if (now >= start - 10 * 60_000) return 'live' as const;
  return 'upcoming' as const;
}

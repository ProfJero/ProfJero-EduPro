import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

export const COURSE_DETAIL_SELECT = '*, category:categories(id, name, slug, icon), school:schools(name)';

export function useCourse(by: { slug?: string; id?: string }) {
  return useQuery({
    queryKey: ['course', by.slug ?? by.id],
    enabled: Boolean(by.slug || by.id),
    queryFn: async () => {
      let q = supabase.from('courses').select(COURSE_DETAIL_SELECT);
      q = by.slug ? q.eq('slug', by.slug) : q.eq('id', by.id!);
      return unwrap(await q.maybeSingle());
    },
  });
}
export type CourseDetailRow = NonNullable<ReturnType<typeof useCourse>['data']>;

export type OutlineLesson = { id: string; title: string; summary: string | null; position: number; estimated_minutes: number | null; is_preview: boolean; status: string; completion_rule: string; module_id: string; quiz_assessment_id: string | null; assignment_id: string | null };
export type OutlineModule = { id: string; title: string; description: string | null; position: number; status: string; lessons: OutlineLesson[] };

export function useCourseOutline(courseId?: string) {
  return useQuery({
    queryKey: ['course-outline', courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const mods = unwrap(await supabase.from('course_modules').select('id, title, description, position, status').eq('course_id', courseId!).order('position'));
      const lessons = unwrap(await supabase.from('lessons')
        .select('id, title, summary, position, estimated_minutes, is_preview, status, completion_rule, module_id, quiz_assessment_id, assignment_id')
        .eq('course_id', courseId!).order('position'));
      return mods.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id) })) as OutlineModule[];
    },
  });
}

export function useMyEnrolment(courseId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['enrolment', courseId, user?.id],
    enabled: Boolean(courseId && user),
    queryFn: async () => unwrap(await supabase.from('course_enrolments').select('*').eq('course_id', courseId!).eq('user_id', user!.id).maybeSingle()),
  });
}

export function useEnrol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => unwrap(await supabase.rpc('enrol_in_course', { p_course: courseId })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['enrolment'] });
      void qc.invalidateQueries({ queryKey: ['my-courses'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCourseStats(courseId?: string) {
  return useQuery({
    queryKey: ['course-stats', courseId],
    enabled: Boolean(courseId),
    queryFn: async () => unwrap(await supabase.rpc('course_public_stats', { p_course: courseId! })) as { lessons: number; modules: number; learners: number; minutes: number } | null,
  });
}

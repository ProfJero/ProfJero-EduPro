import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

export type ManagedCourse = { id: string; slug: string; title: string; status: string; visibility: string; school_id: string | null; owner_id: string; cover_url: string | null; updated_at: string; is_premium: boolean; school: { name: string } | null };
export type TeachingClass = { id: string; name: string; stream: string | null; level: string | null; color: string; school_id: string | null; school: { name: string } | null };

/** Courses I own or co-teach (plus, for school admins, their school's courses). */
export function useManagedCourses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['managed-courses', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [own, co] = await Promise.all([
        supabase.from('courses').select('id, slug, title, status, visibility, school_id, owner_id, cover_url, updated_at, is_premium, school:schools(name)').eq('owner_id', user!.id),
        supabase.from('course_instructors').select('course:courses(id, slug, title, status, visibility, school_id, owner_id, cover_url, updated_at, is_premium, school:schools(name))').eq('user_id', user!.id),
      ]);
      const list = [...(unwrap(own) as unknown as ManagedCourse[]), ...(unwrap(co) as unknown as { course: ManagedCourse | null }[]).map((x) => x.course).filter(Boolean) as ManagedCourse[]];
      const seen = new Set<string>();
      return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
  });
}

/** Classes where I'm a class/subject teacher. */
export function useTeachingClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teaching-classes', user?.id],
    enabled: Boolean(user),
    queryFn: async () => (unwrap(await supabase.from('class_teachers').select('is_class_teacher, subject, cls:school_classes(id, name, stream, level, color, school_id, school:schools(name))').eq('user_id', user!.id)) as unknown as { is_class_teacher: boolean; subject: string | null; cls: TeachingClass | null }[])
      .filter((x) => x.cls).map((x) => ({ ...x.cls!, is_class_teacher: x.is_class_teacher, subject: x.subject })),
  });
}

export function useTeachingRooms() {
  const c = useManagedCourses();
  const k = useTeachingClasses();
  return { data: { courses: c.data ?? [], classes: k.data ?? [] }, isLoading: c.isLoading || k.isLoading };
}

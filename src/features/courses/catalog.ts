import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';

export type CourseCardData = {
  id: string; slug: string; title: string; short_description: string; cover_url: string | null; level: string;
  estimated_hours: number | null; is_premium: boolean; subject: string | null; status?: string;
  category: { name: string; slug: string; icon: string } | null;
};
export type InstructorCard = { course_id: string; user_id: string; name: string; headline: string | null; avatar_url: string | null; role: string };

export const COURSE_CARD_SELECT = 'id, slug, title, short_description, cover_url, level, estimated_hours, is_premium, subject, status, category:categories(name, slug, icon)';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: 10 * 60_000,
    queryFn: async () => unwrap(await supabase.from('categories').select('id, name, slug, icon, description').eq('is_active', true).order('sort_order')),
  });
}

export function useCatalog(opts: { search?: string; category?: string; level?: string; page?: number; pageSize?: number }) {
  const { search = '', category = '', level = '', page = 0, pageSize = 12 } = opts;
  return useQuery({
    queryKey: ['catalog', search, category, level, page],
    queryFn: async () => {
      let q = supabase.from('courses').select(COURSE_CARD_SELECT + (category ? ', cat:categories!inner(slug)' : ''), { count: 'exact' })
        .eq('status', 'published').eq('visibility', 'public').order('published_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (search.trim()) q = q.or(`title.ilike.%${search.trim().replace(/[%,()]/g, ' ')}%,short_description.ilike.%${search.trim().replace(/[%,()]/g, ' ')}%`);
      if (category) q = q.eq('cat.slug', category);
      if (level) q = q.eq('level', level as 'beginner');
      const res = await q;
      if (res.error) throw new Error(res.error.message);
      return { rows: (res.data ?? []) as unknown as CourseCardData[], count: res.count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

export function useInstructorCards(courseIds: string[]) {
  return useQuery({
    queryKey: ['instructor-cards', [...courseIds].sort().join(',')],
    enabled: courseIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => (unwrap(await supabase.rpc('course_instructor_cards', { p_course_ids: courseIds })) ?? []) as InstructorCard[],
  });
}

export const levelLabel: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all_levels: 'All levels' };

import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

export type AssessmentRow = {
  id: string; title: string; instructions: string; kind: string; course_id: string | null; class_id: string | null; opens_at: string | null; closes_at: string | null;
  duration_minutes: number | null; pass_mark_pct: number; max_attempts: number; results_visibility: string; status: string; created_by: string;
  course: { title: string } | null; cls: { name: string } | null;
};
export const ASSESSMENT_SELECT = 'id, title, instructions, kind, course_id, class_id, opens_at, closes_at, duration_minutes, pass_mark_pct, max_attempts, results_visibility, status, created_by, course:courses(title), cls:school_classes(name)';

export function useMyAssessments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-assessments', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [a, t, r] = await Promise.all([
        supabase.from('assessments').select(ASSESSMENT_SELECT).eq('status', 'published').order('closes_at', { ascending: true, nullsFirst: false }),
        supabase.from('assessment_attempts').select('id, assessment_id, status, attempt_no, started_at, submitted_at, deadline_at').eq('user_id', user!.id).order('started_at', { ascending: false }),
        supabase.from('assessment_results').select('attempt_id, assessment_id, score, max_score, percentage, passed, pending_manual').eq('user_id', user!.id),
      ]);
      const attempts = unwrap(t);
      const results = unwrap(r);
      return (unwrap(a) as unknown as AssessmentRow[]).filter((x) => x.created_by !== user!.id).map((x) => {
        const mine = attempts.filter((y) => y.assessment_id === x.id);
        const res = results.filter((y) => y.assessment_id === x.id);
        const best = res.reduce<(typeof res)[number] | null>((b, y) => (!b || Number(y.percentage) > Number(b.percentage) ? y : b), null);
        return { ...x, attempts: mine, open: mine.find((y) => y.status === 'in_progress') ?? null, best };
      });
    },
  });
}
export type MyAssessment = NonNullable<ReturnType<typeof useMyAssessments>['data']>[number];

export function assessmentWindow(a: Pick<AssessmentRow, 'opens_at' | 'closes_at'>, now = Date.now()) {
  if (a.opens_at && new Date(a.opens_at).getTime() > now) return 'not_open' as const;
  if (a.closes_at && new Date(a.closes_at).getTime() <= now) return 'closed' as const;
  return 'open' as const;
}

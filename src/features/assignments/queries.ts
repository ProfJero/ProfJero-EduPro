import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

export type AssignmentRow = {
  id: string; title: string; instructions: string; due_at: string | null; allow_late: boolean; max_marks: number; submission_types: string[];
  attachments: { title: string; url: string }[]; status: string; course_id: string | null; class_id: string | null; created_by: string; created_at: string;
  course: { title: string } | null; cls: { name: string } | null;
};
export type SubmissionRow = { id: string; assignment_id: string; status: string; text_response: string | null; link_url: string | null; submitted_at: string | null; is_late: boolean; revision: number; updated_at: string };
export type GradeRow = { submission_id: string; score: number; feedback: string | null; rubric_scores: Record<string, number>; graded_at: string };
export const ASSIGNMENT_SELECT = 'id, title, instructions, due_at, allow_late, max_marks, submission_types, attachments, status, course_id, class_id, created_by, created_at, course:courses(title), cls:school_classes(name)';

export function useMyAssignments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-assignments', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [a, s] = await Promise.all([
        supabase.from('assignments').select(ASSIGNMENT_SELECT).eq('status', 'published').order('due_at', { ascending: true, nullsFirst: false }),
        supabase.from('assignment_submissions').select('id, assignment_id, status, text_response, link_url, submitted_at, is_late, revision, updated_at').eq('user_id', user!.id),
      ]);
      const assignments = (unwrap(a) as unknown as AssignmentRow[]).filter((x) => x.created_by !== user!.id);
      const subs = unwrap(s) as SubmissionRow[];
      const g = subs.length ? unwrap(await supabase.from('submission_grades').select('submission_id, score, feedback, rubric_scores, graded_at').in('submission_id', subs.map((x) => x.id))) as GradeRow[] : [];
      return assignments.map((x) => {
        const sub = subs.find((y) => y.assignment_id === x.id) ?? null;
        return { ...x, submission: sub, grade: sub ? g.find((y) => y.submission_id === sub.id) ?? null : null };
      });
    },
  });
}
export type MyAssignment = NonNullable<ReturnType<typeof useMyAssignments>['data']>[number];
export const isPending = (a: MyAssignment) => !a.submission || a.submission.status === 'draft' || a.submission.status === 'returned';

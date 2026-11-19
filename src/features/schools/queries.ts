import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';

export function useSchool(schoolId?: string) {
  return useQuery({ queryKey: ['school', schoolId], enabled: Boolean(schoolId), queryFn: async () => unwrap(await supabase.from('schools').select('*').eq('id', schoolId!).maybeSingle()) });
}
export type Person = { membership_id: string; user_id: string; full_name: string; email: string | null; avatar_url: string | null; role: string; status: string; student_number: string | null; classes: string[]; joined_at: string };
export function useSchoolPeople(schoolId?: string, role?: 'student' | 'teacher' | 'school_admin') {
  return useQuery({ queryKey: ['school-people', schoolId, role], enabled: Boolean(schoolId), queryFn: async () => unwrap(await supabase.rpc('school_people', { p_school: schoolId!, p_role: role as never })) as Person[] });
}
export type SchoolClass = { id: string; name: string; stream: string | null; level: string | null; color: string; academic_year_id: string | null; room_label: string | null; description: string | null; is_archived: boolean };
export function useSchoolClasses(schoolId?: string) {
  return useQuery({ queryKey: ['school-classes', schoolId], enabled: Boolean(schoolId), queryFn: async () => unwrap(await supabase.from('school_classes').select('id, name, stream, level, color, academic_year_id, room_label, description, is_archived').eq('school_id', schoolId!).order('name')) as SchoolClass[] });
}
export function useInvitations(schoolId?: string) {
  return useQuery({ queryKey: ['school-invitations', schoolId], enabled: Boolean(schoolId), queryFn: async () => unwrap(await supabase.from('school_invitations').select('id, email, full_name, role, status, created_at, expires_at, class_id').eq('school_id', schoolId!).eq('status', 'pending').order('created_at', { ascending: false })) });
}

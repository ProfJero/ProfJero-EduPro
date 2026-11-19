import type { Tables } from '@/lib/supabase';

export type AppRole = 'learner' | 'teacher' | 'school_admin' | 'platform_admin' | 'owner' | 'guardian';
export type SchoolCtx = { school_id: string; name: string; slug: string; status: string; logo_url: string | null; roles: string[] | null };
export type MyContext = {
  user_id: string;
  roles: AppRole[];
  schools: SchoolCtx[];
  school_applications: { school_id: string; name: string; status: string; created_at: string }[];
  teaches_classes: boolean;
  pending_invitations: number;
  entitlements: Record<string, { enabled: boolean; limit: number | null; plans: string[] }>;
  is_edupro: boolean;
};
export type Profile = Tables<'profiles'>;

export type Workspace =
  | { kind: 'learner'; key: 'learner'; label: string; home: string }
  | { kind: 'teacher'; key: 'teacher'; label: string; home: string }
  | { kind: 'school'; key: string; label: string; home: string; schoolId: string }
  | { kind: 'admin'; key: 'admin'; label: string; home: string };

export function deriveWorkspaces(ctx: MyContext | null | undefined): Workspace[] {
  const ws: Workspace[] = [{ kind: 'learner', key: 'learner', label: 'Learning', home: '/learn' }];
  if (!ctx) return ws;
  const roles = new Set(ctx.roles);
  const schoolTeacher = ctx.schools.some((s) => s.roles?.includes('teacher') || s.roles?.includes('school_admin'));
  if (roles.has('teacher') || roles.has('platform_admin') || roles.has('owner') || schoolTeacher || ctx.teaches_classes) {
    ws.push({ kind: 'teacher', key: 'teacher', label: 'Teaching', home: '/teach' });
  }
  for (const s of ctx.schools) {
    if (s.roles?.includes('school_admin')) ws.push({ kind: 'school', key: `school:${s.school_id}`, label: s.name, home: `/school/${s.school_id}`, schoolId: s.school_id });
  }
  if (roles.has('platform_admin') || roles.has('owner')) ws.push({ kind: 'admin', key: 'admin', label: 'Platform console', home: '/admin' });
  return ws;
}

export function hasFeature(ctx: MyContext | null | undefined, key: string) {
  return Boolean(ctx?.entitlements?.[key]?.enabled);
}

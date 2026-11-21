import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Award, BookOpen, Building2, ClipboardCheck, Crown, GraduationCap, LifeBuoy, Presentation, Users } from 'lucide-react';
import { Alert, Card, CardBody, CardHeader, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fromNow } from '@/lib/dates';

type O = Record<string, number> & { signups_by_week: { week: string; count: number }[] };

export function AdminHome() {
  const { data: o, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: async () => unwrap(await supabase.rpc('admin_overview')) as unknown as O });
  const audit = useQuery({ queryKey: ['audit-recent'], queryFn: async () => unwrap(await supabase.from('audit_logs').select('id, action, entity_type, entity_id, created_at').order('created_at', { ascending: false }).limit(8)) });
  if (isLoading || !o) return <LoadingBlock />;
  const max = Math.max(1, ...o.signups_by_week.map((w) => w.count));
  const todo = [
    o.schools_pending && { to: '/admin/schools', text: `${o.schools_pending} school application(s) waiting for review` },
    o.courses_in_review && { to: '/admin/courses', text: `${o.courses_in_review} course(s) submitted for review` },
    o.pending_instructors && { to: '/admin/teachers', text: `${o.pending_instructors} instructor application(s)` },
    o.open_tickets && { to: '/admin/support', text: `${o.open_tickets} open support ticket(s)` },
  ].filter(Boolean) as { to: string; text: string }[];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Platform console" title="ProfJero Edu at a glance" description="Live figures from the database — nothing here is estimated." />
      {todo.length > 0 && <Alert tone="warning" title="Needs your attention"><ul className="mt-1 list-disc pl-5">{todo.map((t) => <li key={t.to}><Link to={t.to} className="font-semibold underline">{t.text}</Link></li>)}</ul></Alert>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Registered users" value={o.users} hint={`+${o.new_users_30d} in 30 days`} icon={<Users className="h-5 w-5" />} to="/admin/users" />
        <StatCard label="Active learners (30d)" value={o.active_learners_30d} icon={<Activity className="h-5 w-5" />} tone="violet" />
        <StatCard label="Teachers" value={o.teachers} icon={<Presentation className="h-5 w-5" />} tone="green" to="/admin/teachers" />
        <StatCard label="Schools" value={o.schools_approved} hint={`${o.schools_pending} pending`} icon={<Building2 className="h-5 w-5" />} tone="amber" to="/admin/schools" />
        <StatCard label="Published courses" value={o.courses_published} icon={<BookOpen className="h-5 w-5" />} to="/admin/courses" />
        <StatCard label="Enrolments" value={o.enrolments} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label="Completions" value={o.completions} icon={<Award className="h-5 w-5" />} tone="green" />
        <StatCard label="Assessment attempts (30d)" value={o.attempts_30d} icon={<ClipboardCheck className="h-5 w-5" />} tone="violet" />
        <StatCard label="EduPro subscriptions" value={o.edupro_active} icon={<Crown className="h-5 w-5" />} tone="amber" to="/admin/subscriptions" />
        <StatCard label="Open tickets" value={o.open_tickets} icon={<LifeBuoy className="h-5 w-5" />} tone="navy" to="/admin/support" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="New registrations per week" description="Last 12 weeks" /><CardBody>
          {o.signups_by_week.length ? <div className="flex h-40 items-end gap-2" role="img" aria-label="Weekly registrations chart">{o.signups_by_week.map((w) => <div key={w.week} className="flex flex-1 flex-col items-center gap-1"><span className="text-xs font-semibold">{w.count}</span><div className="w-full rounded-t bg-brand-600" style={{ height: `${(100 * w.count) / max}%` }} /><span className="text-[0.6rem] text-ink-400">{fmtDate(w.week, 'd MMM')}</span></div>)}</div> : <p className="text-sm text-ink-500">No registrations yet.</p>}
        </CardBody></Card>
        <Card><CardHeader title="Recent administrative activity" action={<Link to="/admin/audit" className="text-sm font-semibold text-brand-700">Audit log</Link>} /><CardBody>
          <ul className="space-y-2 text-sm">{(audit.data ?? []).map((a) => <li key={a.id} className="flex justify-between gap-3"><span className="font-medium">{a.action}</span><span className="text-ink-400">{fromNow(a.created_at)}</span></li>)}</ul>
          {!audit.data?.length && <p className="text-sm text-ink-500">No activity yet.</p>}
        </CardBody></Card>
      </div>
      <p className="text-xs text-ink-400">Storage and bandwidth usage are tracked in the Cloudinary dashboard (free tier limits apply).</p>
    </div>
  );
}

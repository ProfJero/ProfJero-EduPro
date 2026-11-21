import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Award, BookOpen, Building2, Crown, Gauge, GraduationCap, LifeBuoy, MessageCircle, Presentation, Settings, Sparkles, Swords, Users } from 'lucide-react';
import { Alert, Card, CardBody, CardHeader, LoadingBlock, PageHeader, Select, StatCard } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

type O = Record<string, number> & { signups_by_week: { week: string; count: number }[] };
type Day = { day: string; signups: number; active_learners: number; lessons_completed: number; submissions: number; attempts: number; ai_requests: number; messages: number; arena_plays: number; notifications: number };
const SERIES: { key: keyof Day; label: string; color: string }[] = [
  { key: 'active_learners', label: 'Active learners', color: 'var(--color-brand-500)' }, { key: 'signups', label: 'Sign-ups', color: 'var(--color-growth-500)' },
  { key: 'lessons_completed', label: 'Lessons completed', color: '#14b8a6' }, { key: 'messages', label: 'Discussion messages', color: '#f59f0b' },
  { key: 'attempts', label: 'Assessment attempts', color: '#8b5cf6' }, { key: 'arena_plays', label: 'Arena plays', color: '#e11d48' },
  { key: 'ai_requests', label: 'AI requests', color: '#6366f1' }, { key: 'submissions', label: 'Assignments submitted', color: '#0ea5e9' },
];

export function AdminHome() {
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<keyof Day>('active_learners');
  const { data: o, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: async () => unwrap(await supabase.rpc('admin_overview')) as unknown as O });
  const daily = useQuery({ queryKey: ['owner-daily', days], queryFn: async () => unwrap(await supabase.rpc('owner_daily_stats', { p_days: days })) as unknown as Day[] });
  const audit = useQuery({ queryKey: ['audit-recent'], queryFn: async () => unwrap(await supabase.from('audit_logs').select('id, action, entity_type, created_at').order('created_at', { ascending: false }).limit(8)) });
  if (isLoading || !o) return <LoadingBlock />;
  const d = daily.data ?? [];
  const today = d[d.length - 1];
  const sum = (k: keyof Day) => d.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const max = Math.max(1, ...d.map((r) => Number(r[series] ?? 0)));
  const s = SERIES.find((x) => x.key === series)!;
  const todo = [
    o.schools_pending && { to: '/admin/schools', text: `${o.schools_pending} school application(s) waiting` },
    o.courses_in_review && { to: '/admin/courses', text: `${o.courses_in_review} course(s) waiting for review` },
    o.pending_instructors && { to: '/admin/teachers', text: `${o.pending_instructors} teacher application(s)` },
    o.open_tickets && { to: '/admin/support', text: `${o.open_tickets} open support ticket(s)` },
  ].filter(Boolean) as { to: string; text: string }[];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Owner console" title="Running ProfJero Edu" description="Daily operations, growth and what needs your attention. Figures come straight from the database."
        actions={<div className="flex gap-2"><Link to="/admin/monitor" className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-semibold hover:bg-ink-50"><Gauge className="h-4 w-4" />System monitor</Link><Link to="/admin/settings" className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-semibold hover:bg-ink-50"><Settings className="h-4 w-4" />System controls</Link></div>} />
      {todo.length > 0 && <Alert tone="warning" title="Needs your attention"><ul className="mt-1 list-disc pl-5">{todo.map((t) => <li key={t.to}><Link to={t.to} className="font-semibold underline">{t.text}</Link></li>)}</ul></Alert>}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-400">Today</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <StatCard label="Active learners" value={today?.active_learners ?? 0} icon={<Activity className="h-5 w-5" />} />
          <StatCard label="New sign-ups" value={today?.signups ?? 0} icon={<Users className="h-5 w-5" />} tone="green" />
          <StatCard label="Lessons completed" value={today?.lessons_completed ?? 0} icon={<BookOpen className="h-5 w-5" />} tone="violet" />
          <StatCard label="Messages" value={today?.messages ?? 0} icon={<MessageCircle className="h-5 w-5" />} tone="amber" />
          <StatCard label="Arena plays" value={today?.arena_plays ?? 0} icon={<Swords className="h-5 w-5" />} tone="navy" />
          <StatCard label="AI requests" value={today?.ai_requests ?? 0} icon={<Sparkles className="h-5 w-5" />} tone="violet" />
        </div>
      </section>
      <Card>
        <CardHeader title="Daily activity" description={`${s.label}: ${sum(series).toLocaleString()} in the last ${days} days`}
          action={<div className="flex flex-wrap gap-2"><Select value={series} onChange={(e) => setSeries(e.target.value as keyof Day)} className="w-auto py-1.5 text-sm" aria-label="Metric">{SERIES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto py-1.5 text-sm" aria-label="Period"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></Select></div>} />
        <CardBody>
          {daily.isLoading ? <LoadingBlock rows={2} /> : (
            <div className="flex h-48 items-end gap-[2px]" role="img" aria-label={`${s.label} per day`}>
              {d.map((r) => { const v = Number(r[series] ?? 0); return (
                <div key={r.day} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className="w-full rounded-t transition-all group-hover:opacity-80" style={{ height: `${(100 * v) / max}%`, minHeight: v ? 2 : 0, background: s.color }} />
                  <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-950 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white group-hover:block">{fmtDate(r.day, 'd MMM')}: {v}</span>
                </div>
              ); })}
            </div>
          )}
          <div className="mt-1 flex justify-between text-[0.65rem] text-ink-400">{d.length > 0 && <><span>{fmtDate(d[0].day, 'd MMM')}</span><span>{fmtDate(d[d.length - 1].day, 'd MMM')}</span></>}</div>
        </CardBody>
      </Card>
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-400">Platform totals</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
          <StatCard label="Registered users" value={o.users} hint={`+${o.new_users_30d} in 30 days`} icon={<Users className="h-5 w-5" />} to="/admin/users" />
          <StatCard label="Active learners (30d)" value={o.active_learners_30d} icon={<Activity className="h-5 w-5" />} tone="violet" />
          <StatCard label="Teachers" value={o.teachers} icon={<Presentation className="h-5 w-5" />} tone="green" to="/admin/teachers" />
          <StatCard label="Schools" value={o.schools_approved} hint={`${o.schools_pending} pending`} icon={<Building2 className="h-5 w-5" />} tone="amber" to="/admin/schools" />
          <StatCard label="Published courses" value={o.courses_published} icon={<BookOpen className="h-5 w-5" />} to="/admin/courses" />
          <StatCard label="Enrolments" value={o.enrolments} icon={<GraduationCap className="h-5 w-5" />} />
          <StatCard label="Completions" value={o.completions} icon={<Award className="h-5 w-5" />} tone="green" />
          <StatCard label="EduPro subscriptions" value={o.edupro_active} icon={<Crown className="h-5 w-5" />} tone="amber" to="/admin/subscriptions" />
          <StatCard label="Open tickets" value={o.open_tickets} icon={<LifeBuoy className="h-5 w-5" />} tone="navy" to="/admin/support" />
        </div>
      </section>
      <Card><CardHeader title="Recent administrative activity" action={<Link to="/admin/audit" className="text-sm font-semibold text-brand-700">Audit log</Link>} /><CardBody>
        <ul className="space-y-2 text-sm">{(audit.data ?? []).map((a) => <li key={a.id} className={cn('flex justify-between gap-3')}><span className="font-medium">{a.action}</span><span className="text-ink-400">{fromNow(a.created_at)}</span></li>)}</ul>
        {!audit.data?.length && <p className="text-sm text-ink-500">No activity yet.</p>}
      </CardBody></Card>
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, Bug, CheckCircle2, Database, Gauge, Play, Sparkles, Trash2, Users, Wrench } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, ProgressBar, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { env } from '@/lib/env';
import { fmtDateTime, fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';

type Monitor = {
  checked_at: string; database_bytes: number; free_tier: { database_bytes: number; mau: number; realtime_connections: number; egress_gb: number; storage_bytes: number };
  auth_users: number; mau_30d: number; active_7d: number; online_15m: number; storage_bytes: number; push_subscriptions: number; connections: number;
  tables: { name: string; bytes: number; rows: number }[]; cron: { job: string; schedule: string; active: boolean; last_run: string | null; failures_24h: number }[];
  push_24h: { sent: number; failed: number }; errors_today: number; notifications_7d: number; ai_requests_today: number;
};
const mb = (b: number) => (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 2 : 1);

/** On-demand monitoring: nothing runs until the owner presses "Run check". */
export function AdminMonitor() {
  const toast = useToast();
  const qc = useQueryClient();
  const [run, setRun] = useState(0);
  const mon = useQuery({ queryKey: ['owner-monitor', run], enabled: run > 0, staleTime: Infinity, gcTime: 10 * 60_000, queryFn: async () => unwrap(await supabase.rpc('owner_system_monitor')) as unknown as Monitor });
  const api = useQuery({ queryKey: ['owner-monitor-api', run], enabled: run > 0 && Boolean(env.apiBase), staleTime: Infinity, retry: false,
    queryFn: async () => { const t0 = performance.now(); const r = await fetch(`${env.apiBase}/api/health`); return { ok: r.ok, ms: Math.round(performance.now() - t0), features: ((await r.json()) as { features: Record<string, boolean> }).features }; } });
  const errors = useQuery({ queryKey: ['owner-errors', run], enabled: run > 0, staleTime: Infinity, queryFn: async () => unwrap(await supabase.from('app_errors').select('*').order('last_seen_at', { ascending: false }).limit(25)) });
  const house = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('owner_housekeeping')) as unknown as Record<string, number>,
    onSuccess: (r) => { toast.success('Housekeeping done', `Removed ${r.old_notifications} old read notifications, ${r.stale_attempts} stale attempts, ${r.http_log} log rows.`); setRun((x) => x + 1); },
    onError: (e) => toast.error('Failed', errorMessage(e)),
  });
  const clearErrors = useMutation({ mutationFn: async () => unwrap(await supabase.from('app_errors').delete().gte('day', '2000-01-01')), onSuccess: () => void qc.invalidateQueries({ queryKey: ['owner-errors'] }) });
  const m = mon.data;
  const meter = (label: string, used: number, limit: number, fmt: (n: number) => string, icon: React.ReactNode) => {
    const pct = Math.min(100, (100 * used) / limit);
    return (
      <Card><CardBody>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-600">{icon}{label}</div>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(used)} <span className="text-sm font-semibold text-ink-400">/ {fmt(limit)}</span></p>
        <ProgressBar value={pct} tone={pct > 80 ? 'amber' : 'green'} className="mt-2" />
        <p className={cn('mt-1 text-xs', pct > 80 ? 'font-semibold text-sun-700' : 'text-ink-500')}>{pct.toFixed(1)}% of the free tier</p>
      </CardBody></Card>
    );
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Owner console" title="System monitor" description="Runs only when you press the button, so it never uses your free-tier limits in the background."
        actions={<div className="flex gap-2"><Button leftIcon={<Play className="h-4 w-4" />} loading={mon.isFetching} onClick={() => setRun((x) => x + 1)}>{run ? 'Run again' : 'Run check'}</Button>
          <Button variant="secondary" leftIcon={<Wrench className="h-4 w-4" />} loading={house.isPending} onClick={() => house.mutate()}>Housekeeping</Button></div>} />
      {!run && <EmptyState icon={<Gauge className="h-8 w-8" />} title="Ready when you are" description="Press “Run check” to measure database size, users, background jobs, push delivery, errors and the API." />}
      {mon.error && <Alert tone="error">{errorMessage(mon.error)}</Alert>}
      {m && (<>
        <p className="text-xs text-ink-500">Checked {fmtDateTime(m.checked_at)}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {meter('Database size', m.database_bytes, m.free_tier.database_bytes, (n) => `${mb(n)} MB`, <Database className="h-4 w-4" />)}
          {meter('Monthly active users', m.mau_30d, m.free_tier.mau, (n) => n.toLocaleString(), <Users className="h-4 w-4" />)}
          {meter('File storage (Supabase)', m.storage_bytes, m.free_tier.storage_bytes, (n) => `${mb(n)} MB`, <Database className="h-4 w-4" />)}
          <Card><CardBody>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-600"><Activity className="h-4 w-4" />Right now</div>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{m.online_15m} <span className="text-sm font-semibold text-ink-400">online (15 min)</span></p>
            <p className="text-xs text-ink-500">{m.active_7d} active this week · {m.auth_users} accounts · {m.connections} DB connections</p>
            <p className="mt-1 text-xs text-ink-500">Realtime limit: {m.free_tier.realtime_connections} simultaneous connections</p>
          </CardBody></Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card><CardHeader title="Background jobs" /><CardBody className="space-y-2 text-sm">
            {m.cron.map((c) => <div key={c.job} className="flex items-center gap-2">{c.failures_24h ? <AlertTriangle className="h-4 w-4 text-sun-700" /> : <CheckCircle2 className="h-4 w-4 text-growth-600" />}<span className="flex-1 font-medium">{c.job}</span><span className="text-xs text-ink-500">{c.last_run ? fromNow(c.last_run) : 'never'}{c.failures_24h ? ` · ${c.failures_24h} failed` : ''}</span></div>)}
            {!m.cron.length && <p className="text-ink-500">No scheduled jobs.</p>}
          </CardBody></Card>
          <Card><CardHeader title="Notifications & push (24 h)" /><CardBody className="space-y-1 text-sm">
            <p><b>{m.push_24h.sent}</b> push deliveries OK · <b className={m.push_24h.failed ? 'text-sun-700' : ''}>{m.push_24h.failed}</b> failed</p>
            <p>{m.push_subscriptions} devices subscribed</p><p>{m.notifications_7d} in-app notifications this week</p>
          </CardBody></Card>
          <Card><CardHeader title="API & AI" /><CardBody className="space-y-1 text-sm">
            {api.data ? <><p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />API reachable · {api.data.ms} ms</p>
              <div className="flex flex-wrap gap-1">{Object.entries(api.data.features).map(([k, v]) => <Badge key={k} tone={v ? 'green' : 'neutral'}>{k}</Badge>)}</div></> : api.error ? <p className="text-red-700">API unreachable</p> : <p className="text-ink-500">Checking…</p>}
            <p className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-violet-600" />{m.ai_requests_today} AI requests today</p>
          </CardBody></Card>
        </div>
        <Card><CardHeader title="Largest tables" description="Row counts are Postgres estimates." /><CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm"><thead className="bg-ink-50 text-left"><tr><th className="px-3 py-2">Table</th><th className="px-3 py-2 text-right">Rows</th><th className="px-3 py-2 text-right">Size</th></tr></thead>
            <tbody>{m.tables.map((t) => <tr key={t.name} className="border-t border-ink-100"><td className="px-3 py-1.5 font-mono text-xs">{t.name}</td><td className="px-3 py-1.5 text-right tabular-nums">{t.rows.toLocaleString()}</td><td className="px-3 py-1.5 text-right tabular-nums">{mb(t.bytes)} MB</td></tr>)}</tbody></table>
        </CardBody></Card>
        <Card><CardHeader title={<span className="inline-flex items-center gap-2"><Bug className="h-5 w-5 text-red-600" />Errors reported by browsers</span>} description={`${m.errors_today} today. Identical errors are grouped per day.`}
          action={errors.data?.length ? <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => clearErrors.mutate()}>Clear</Button> : undefined} /><CardBody>
          {errors.data?.length ? <ul className="space-y-2">{errors.data.map((e) => (
            <li key={e.fingerprint + e.day} className="rounded-xl border border-ink-200 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone="red">{e.count}×</Badge><span className="font-mono text-sm font-semibold">{e.message}</span></div>
              <p className="mt-1 text-xs text-ink-500">{e.path} · {fromNow(e.last_seen_at)} · {e.day}</p>
              {e.stack && <details className="mt-1"><summary className="cursor-pointer text-xs font-semibold text-ink-500">Stack</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[0.7rem] text-ink-600">{e.stack}</pre></details>}</li>
          ))}</ul> : <p className="flex items-center gap-2 text-sm text-ink-500"><CheckCircle2 className="h-4 w-4 text-growth-600" />No errors reported.</p>}
        </CardBody></Card>
        <Alert tone="info" title="Other limits">Bandwidth (5 GB egress/month on Supabase Free) and Cloudflare/Cloudinary usage are shown in those dashboards. ProfJero Edu keeps traffic low: lessons cache offline, images are compressed, and polling stops in low-data mode.</Alert>
      </>)}
    </div>
  );
}

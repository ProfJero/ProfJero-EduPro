import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Search } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, DataTable, EmptyState, Input, LoadingBlock, PageHeader, StatusBadge, Tabs, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { GrantDialog, useAdminUsers, type AdminUser } from '@/features/administration/AdminUsers';

type Plan = { id: string; code: string; name: string; tier: string; scope: string; price_label: string | null; is_active: boolean; is_default: boolean; description: string | null };
type Feature = { key: string; name: string; kind: string };
type PF = { plan_id: string; feature_key: string; enabled: boolean; limit_value: number | null };

export function AdminSubscriptions() {
  return (
    <div>
      <PageHeader title="Edu & EduPro" description="Plans, features and limits are managed here — never hard-coded. Grant EduPro to individuals, teachers or whole schools for pilots." />
      <Tabs tabs={[
        { value: 'subs', label: 'Subscriptions', content: <Subscriptions /> },
        { value: 'grant', label: 'Grant access', content: <GrantPicker /> },
        { value: 'plans', label: 'Plans & features', content: <PlanMatrix /> },
      ]} />
    </div>
  );
}

function Subscriptions() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['subscriptions'], queryFn: async () => unwrap(await supabase.from('subscriptions').select('id, status, source, starts_at, ends_at, notes, user_id, school_id, plan:plans(name, tier), school:schools(name)').order('created_at', { ascending: false }).limit(300)) as unknown as { id: string; status: string; source: string; starts_at: string; ends_at: string | null; notes: string | null; user_id: string | null; school_id: string | null; plan: { name: string; tier: string } | null; school: { name: string } | null }[] });
  if (isLoading) return <LoadingBlock />;
  return <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState icon={<Crown className="h-7 w-7" />} title="No subscriptions yet" description="Grant EduPro from the “Grant access” tab, the Users page, or the Schools page." />} columns={[
    { key: 'p', header: 'Plan', primary: true, cell: (r) => <span className="inline-flex items-center gap-2">{r.plan?.tier === 'edupro' && <Crown className="h-4 w-4 text-sun-500" />}{r.plan?.name}</span> },
    { key: 'w', header: 'Holder', cell: (r) => r.school?.name ?? <span className="font-mono text-xs">user {r.user_id?.slice(0, 8)}</span> },
    { key: 'src', header: 'Source', cell: (r) => <Badge>{r.source}</Badge> },
    { key: 'd', header: 'Period', cell: (r) => `${fmtDate(r.starts_at)} – ${r.ends_at ? fmtDate(r.ends_at) : 'open'}` },
    { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'x', header: '', cell: (r) => r.status === 'active' && <Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.rpc('revoke_subscription', { p_subscription: r.id, p_reason: null as never }); if (error) toast.error('Failed', error.message); else { toast.success('Access revoked'); void qc.invalidateQueries({ queryKey: ['subscriptions'] }); } }}>Revoke</Button> },
  ]} />;
}

function GrantPicker() {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const { data, isFetching } = useAdminUsers(search);
  const [target, setTarget] = useState<AdminUser | null>(null);
  return (
    <Card><CardHeader title="Grant EduPro to a person" description="For schools, use the Schools page." /><CardBody className="space-y-4">
      <form className="flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(term.trim()); }}><Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name or email" aria-label="Find user" /><Button type="submit" loading={isFetching} leftIcon={<Search className="h-4 w-4" />}>Find</Button></form>
      {search && <ul className="divide-y divide-ink-100">{(data ?? []).map((u) => <li key={u.user_id} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1"><strong>{u.full_name}</strong> <span className="text-ink-500">{u.email}</span></span><Button size="sm" variant="secondary" onClick={() => setTarget(u)}>Grant</Button></li>)}</ul>}
      <GrantDialog target={target ? { user: target } : null} onClose={() => setTarget(null)} />
    </CardBody></Card>
  );
}

function PlanMatrix() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['plan-matrix'], queryFn: async () => {
    const [p, f, pf] = await Promise.all([supabase.from('plans').select('*').order('sort_order'), supabase.from('features').select('*').order('sort_order'), supabase.from('plan_features').select('*')]);
    return { plans: unwrap(p) as Plan[], features: unwrap(f) as Feature[], pf: unwrap(pf) as PF[] };
  } });
  if (isLoading || !data) return <LoadingBlock />;
  const cell = (plan: string, key: string) => data.pf.find((x) => x.plan_id === plan && x.feature_key === key);
  const save = async (plan_id: string, feature_key: string, enabled: boolean, limit_value: number | null) => {
    const { error } = await supabase.from('plan_features').upsert({ plan_id, feature_key, enabled, limit_value }, { onConflict: 'plan_id,feature_key' });
    if (error) toast.error('Not saved', error.message); else { void qc.invalidateQueries({ queryKey: ['plan-matrix'] }); void qc.invalidateQueries({ queryKey: ['my-context'] }); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Limits: leave empty for unlimited. Changes apply immediately to everyone on that plan. Free plans should stay genuinely useful.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead><tr className="border-b border-ink-100 text-left"><th className="p-3">Feature</th>{data.plans.map((p) => <th key={p.id} className="p-3"><span className="block font-bold">{p.name}</span><span className="text-xs font-normal text-ink-500">{p.scope}{p.is_default && ' · default'}</span></th>)}</tr></thead>
          <tbody>{data.features.map((f) => (
            <tr key={f.key} className="border-b border-ink-100 align-top">
              <td className="p-3"><span className="font-semibold">{f.name}</span><span className="block text-xs text-ink-400">{f.key}</span></td>
              {data.plans.map((p) => {
                const c = cell(p.id, f.key);
                return (
                  <td key={p.id} className="p-3">
                    <Checkbox label="" aria-label={`${f.name} on ${p.name}`} checked={Boolean(c?.enabled)} onChange={(e) => save(p.id, f.key, e.target.checked, c?.limit_value ?? null)} />
                    {f.kind === 'limit' && c?.enabled && <Input type="number" min={0} className="mt-1 h-8 w-24" defaultValue={c.limit_value ?? ''} placeholder="∞" aria-label={`${f.name} limit on ${p.name}`} onBlur={(e) => save(p.id, f.key, true, e.target.value === '' ? null : Number(e.target.value))} />}
                  </td>
                );
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-3">{data.plans.map((p) => (
        <Card key={p.id}><CardBody className="space-y-2">
          <p className="font-bold">{p.name}</p>
          <Input defaultValue={p.price_label ?? ''} aria-label={`${p.name} price label`} placeholder="Price label" onBlur={async (e) => { await supabase.from('plans').update({ price_label: e.target.value || null }).eq('id', p.id); void qc.invalidateQueries({ queryKey: ['plan-matrix'] }); }} />
          <Checkbox label="Active" checked={p.is_active} onChange={async (e) => { await supabase.from('plans').update({ is_active: e.target.checked }).eq('id', p.id); void qc.invalidateQueries({ queryKey: ['plan-matrix'] }); }} />
        </CardBody></Card>
      ))}</div>
    </div>
  );
}

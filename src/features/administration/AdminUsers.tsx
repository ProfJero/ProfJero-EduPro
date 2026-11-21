import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, MoreVertical, Search, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Button, Checkbox, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, Menu, MenuContent, MenuItem, MenuTrigger, PageHeader, Select, StatusBadge, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fromNow, localInputToIso } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';

export type AdminUser = { user_id: string; email: string; full_name: string; status: string; roles: string[]; email_confirmed: boolean; created_at: string; last_sign_in_at: string | null; total_count: number };
const ROLES = ['learner', 'teacher', 'school_admin', 'guardian', 'platform_admin', 'owner'];
const PAGE = 25;

export function useAdminUsers(search: string, page = 0) {
  return useQuery({ queryKey: ['admin-users', search, page], queryFn: async () => unwrap(await supabase.rpc('admin_list_users', { p_search: (search || null) as never, p_limit: PAGE, p_offset: page * PAGE })) as AdminUser[], placeholderData: (p) => p });
}

export function AdminUsers() {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useAdminUsers(search, page);
  const [roles, setRoles] = useState<AdminUser | null>(null);
  const [grant, setGrant] = useState<AdminUser | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const total = data?.[0]?.total_count ?? 0;
  const setStatus = async (u: AdminUser, status: 'active' | 'suspended') => {
    const { error } = await supabase.rpc('set_user_status', { p_user: u.user_id, p_status: status, p_reason: null as never });
    if (error) toast.error('Could not update', error.message); else { toast.success(status === 'suspended' ? 'Account suspended' : 'Account reactivated'); void qc.invalidateQueries({ queryKey: ['admin-users'] }); }
  };
  return (
    <div>
      <PageHeader title="Users" description="Search accounts, manage roles, suspend or reactivate, and grant EduPro." />
      <form className="mb-4 flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(term.trim()); }}>
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name or email" aria-label="Search users" /><Button type="submit" leftIcon={<Search className="h-4 w-4" />}>Search</Button>
      </form>
      {isLoading ? <LoadingBlock /> : (
        <>
          <DataTable rows={data ?? []} rowKey={(r) => r.user_id} empty={<EmptyState title="No users found" />} columns={[
            { key: 'n', header: 'User', primary: true, cell: (r) => <span className="inline-flex items-center gap-2"><Avatar name={r.full_name || r.email} size={30} /><span><span className="block font-semibold">{r.full_name || '—'}</span><span className="block text-xs text-ink-500">{r.email}</span></span></span> },
            { key: 'r', header: 'Roles', cell: (r) => <div className="flex flex-wrap justify-end gap-1 md:justify-start">{r.roles.map((x) => <Badge key={x} tone={x === 'owner' || x === 'platform_admin' ? 'navy' : x === 'learner' ? 'neutral' : 'brand'}>{x.replace('_', ' ')}</Badge>)}</div> },
            { key: 'v', header: 'Verified', cell: (r) => (r.email_confirmed ? 'Yes' : <Badge tone="amber">No</Badge>) },
            { key: 'j', header: 'Joined', cell: (r) => fmtDate(r.created_at) },
            { key: 'l', header: 'Last sign-in', cell: (r) => (r.last_sign_in_at ? fromNow(r.last_sign_in_at) : 'Never') },
            { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'x', header: '', cell: (r) => (
              <Menu>
                <MenuTrigger className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${r.email}`}><MoreVertical className="h-4 w-4" /></MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<ShieldCheck className="h-4 w-4" />} onSelect={() => setRoles(r)}>Manage roles</MenuItem>
                  <MenuItem icon={<Crown className="h-4 w-4" />} onSelect={() => setGrant(r)}>Grant EduPro</MenuItem>
                  {r.status === 'active' ? <MenuItem danger onSelect={() => setStatus(r, 'suspended')}>Suspend account</MenuItem> : <MenuItem onSelect={() => setStatus(r, 'active')}>Reactivate account</MenuItem>}
                </MenuContent>
              </Menu>
            ) },
          ]} />
          {total > PAGE && <div className="mt-4 flex items-center justify-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm text-ink-500">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}</span><Button variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</Button></div>}
        </>
      )}
      <RolesDialog user={roles} onClose={() => { setRoles(null); void qc.invalidateQueries({ queryKey: ['admin-users'] }); }} />
      <GrantDialog target={grant ? { user: grant } : null} onClose={() => setGrant(null)} />
    </div>
  );
}

function RolesDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { context } = useAuth();
  const toast = useToast();
  const isOwner = context?.roles.includes('owner');
  const [set, setSet] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const current = new Set(user?.roles ?? []);
  useEffect(() => setSet(new Set(user?.roles ?? [])), [user]);
  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => { if (!o) onClose(); }} title={`Roles — ${user?.full_name || user?.email || ''}`} description="Changes are recorded in the audit log. Only the owner can manage administrator roles."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={async () => {
        setBusy(true);
        const ops = ROLES.filter((r) => set.has(r) !== current.has(r));
        for (const r of ops) {
          const { error } = await supabase.rpc('set_user_role', { p_user: user!.user_id, p_role: r as 'teacher', p_grant: set.has(r) });
          if (error) { toast.error(`Could not change ${r}`, errorMessage(error)); break; }
        }
        setBusy(false);
        toast.success('Roles updated');
        onClose();
      }}>Save roles</Button></>}>
      <div className="space-y-3">
        {ROLES.map((r) => (
          <Checkbox key={r} label={r.replace('_', ' ')} checked={set.has(r)} disabled={r === 'learner' || ((r === 'owner' || r === 'platform_admin') && !isOwner)}
            description={{ learner: 'Every account', teacher: 'Independent instructor — can create courses', school_admin: 'Normally granted by approving a school', guardian: 'Future: parent/guardian', platform_admin: 'Full platform console access', owner: 'Platform owner' }[r]}
            onChange={(e) => setSet((s) => { const n = new Set(s); if (e.target.checked) n.add(r); else n.delete(r); return n; })} />
        ))}
      </div>
    </Dialog>
  );
}

export function GrantDialog({ target, onClose }: { target: { user?: AdminUser; schoolId?: string; schoolName?: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const plans = useQuery({ queryKey: ['plans-all'], queryFn: async () => unwrap(await supabase.from('plans').select('code, name, scope, tier').eq('is_active', true).order('sort_order')) });
  const isSchool = Boolean(target?.schoolId);
  const options = (plans.data ?? []).filter((p) => p.tier === 'edupro' && (isSchool ? p.scope === 'school' : p.scope !== 'school'));
  const [plan, setPlan] = useState('');
  const [ends, setEnds] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('pilot');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()} title={`Grant EduPro — ${target?.user?.full_name || target?.user?.email || target?.schoolName || ''}`} description="For pilots and controlled access. No payment is taken."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={async () => {
        setBusy(true);
        const { error } = await supabase.rpc('grant_subscription', { p_plan_code: plan || options[0]?.code, p_user: (target?.user?.user_id ?? null) as never, p_school: (target?.schoolId ?? null) as never, p_ends_at: (localInputToIso(ends) ?? null) as never, p_notes: (notes || null) as never, p_source: source });
        setBusy(false);
        if (error) return toast.error('Could not grant', errorMessage(error));
        toast.success('EduPro granted');
        void qc.invalidateQueries({ queryKey: ['subscriptions'] });
        onClose();
      }}>Grant access</Button></>}>
      <div className="space-y-4">
        <Field label="Plan"><Select value={plan} onChange={(e) => setPlan(e.target.value)}>{options.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label="Ends" hint="Leave empty for no end date"><Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></Field>
        <Field label="Source"><Select value={source} onChange={(e) => setSource(e.target.value)}><option value="pilot">Pilot</option><option value="manual">Manual</option></Select></Field>
        <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

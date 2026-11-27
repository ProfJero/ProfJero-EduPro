import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Plus, Search, Shuffle, Trash2, UserMinus, Users, UsersRound } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, Checkbox, ConfirmDialog, Dialog, EmptyState, Field, Input, LoadingBlock, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, errorMessage } from '@/lib/utils';
import { CreateGroupDialog } from '@/features/connect/ConnectHub';
import { matchesSearch, useRoster, useSections } from './Roster';

type Group = { id: string; name: string; topic: string | null; visibility: string; max_members: number; members: { user_id: string; role: string }[] };

export function useClassGroups(classId: string) {
  return useQuery({
    queryKey: ['class-groups', classId],
    queryFn: async () => unwrap(await supabase.from('study_groups').select('id, name, topic, visibility, max_members, members:study_group_members(user_id, role)').eq('class_id', classId).order('created_at')) as unknown as Group[],
  });
}

/** Teachers and class leaders with "manage study groups" organise every group in the class. */
export function GroupManager({ classId, isTeacher }: { classId: string; canManage?: boolean; isTeacher: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const groups = useClassGroups(classId);
  const roster = useRoster(classId);
  const sections = useSections(classId);
  const [creating, setCreating] = useState(false);
  const [split, setSplit] = useState(false);
  const [del, setDel] = useState<Group | null>(null);
  const [q, setQ] = useState('');
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['class-groups', classId] }); void qc.invalidateQueries({ queryKey: ['class-roster', classId] }); };
  const assign = useMutation({
    mutationFn: async (v: { group: string; user: string; role?: 'member' | 'leader' }) => unwrap(await supabase.rpc('assign_group_member', { p_group: v.group, p_user: v.user, p_role: v.role ?? 'member' })),
    onSuccess: refresh, onError: (e) => toast.error('Could not update the group', errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (v: { group: string; user: string }) => unwrap(await supabase.from('study_group_members').delete().eq('group_id', v.group).eq('user_id', v.user)),
    onSuccess: refresh, onError: (e) => toast.error('Could not remove', errorMessage(e)),
  });
  const drop = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('study_groups').delete().eq('id', id)),
    onSuccess: () => { setDel(null); refresh(); toast.success('Group deleted'); }, onError: (e) => toast.error('Could not delete', errorMessage(e)),
  });
  const people = useMemo(() => new Map((roster.data ?? []).map((r) => [r.user_id, r])), [roster.data]);
  const grouped = new Set((groups.data ?? []).flatMap((g) => g.members.map((m) => m.user_id)));
  const unassigned = (roster.data ?? []).filter((r) => !grouped.has(r.user_id));
  const hit = (uid: string) => q.trim() !== '' && matchesSearch(people.get(uid) ?? { full_name: '' }, q);
  if (groups.isLoading || roster.isLoading) return <LoadingBlock />;
  const list = groups.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <p className="flex-1 text-sm text-ink-600"><b>{list.length}</b> group{list.length === 1 ? '' : 's'} · <b>{grouped.size}</b> of {roster.data?.length ?? 0} students in a group · each learner can be in <b>one group</b> in this class.</p>
        <div className="flex flex-wrap gap-2">
          {isTeacher && <Button variant="secondary" leftIcon={<Shuffle className="h-4 w-4" />} onClick={() => setSplit(true)} disabled={!unassigned.length}>Auto-create groups</Button>}
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New group</Button>
        </div>
      </div>
      <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student’s group…" aria-label="Find a student" className="pl-9" /></div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((g) => (
          <Card key={g.id} className={cn(g.members.some((m) => hit(m.user_id)) && 'ring-2 ring-brand-400')}>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-growth-50 text-growth-700"><UsersRound className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><Link to={`/connect/groups/${g.id}`} className="block truncate font-bold hover:text-brand-700">{g.name}</Link>
                  <p className="text-xs text-ink-500">{g.members.length}/{g.max_members} members{g.topic ? ` · ${g.topic}` : ''}</p></div>
                <button onClick={() => setDel(g)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${g.name}`}><Trash2 className="h-4 w-4" /></button>
              </div>
              {g.members.length ? (
                <ul className="space-y-1.5">{g.members.sort((a, b) => (a.role === 'leader' ? -1 : 0) - (b.role === 'leader' ? -1 : 0)).map((m) => {
                  const p = people.get(m.user_id);
                  return (
                    <li key={m.user_id} className={cn('flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 text-sm', hit(m.user_id) ? 'bg-brand-50' : 'hover:bg-ink-50')}>
                      <Avatar name={p?.full_name} src={p?.avatar_url} size={26} />
                      <span className="min-w-0 flex-1 truncate font-medium">{p?.full_name ?? 'Teacher'}</span>
                      {m.role === 'leader' && <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>Leader</Badge>}
                      {p && <div className="flex items-center gap-1">
                        <button onClick={() => assign.mutate({ group: g.id, user: m.user_id, role: m.role === 'leader' ? 'member' : 'leader' })} className="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">{m.role === 'leader' ? 'Unset leader' : 'Make leader'}</button>
                        {list.length > 1 && <select value="" onChange={(e) => e.target.value && assign.mutate({ group: e.target.value, user: m.user_id })} aria-label={`Move ${p.full_name}`} className="rounded-lg border border-ink-200 bg-surface px-1 py-0.5 text-xs">
                          <option value="">Move…</option>{list.filter((x) => x.id !== g.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
                        <button onClick={() => remove.mutate({ group: g.id, user: m.user_id })} className="rounded p-1 text-ink-400 hover:text-red-600" aria-label={`Remove ${p.full_name} from ${g.name}`}><UserMinus className="h-3.5 w-3.5" /></button>
                      </div>}
                    </li>
                  );
                })}</ul>
              ) : <p className="text-sm text-ink-500">No members yet.</p>}
              {unassigned.length > 0 && g.members.length < g.max_members && (
                <select value="" onChange={(e) => e.target.value && assign.mutate({ group: g.id, user: e.target.value })} aria-label={`Add a student to ${g.name}`} className="w-full rounded-xl border border-dashed border-ink-300 bg-surface px-3 py-2 text-sm text-ink-600">
                  <option value="">+ Add a student…</option>{unassigned.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}{r.section_name ? ` (${r.section_name})` : ''}</option>)}
                </select>
              )}
            </CardBody>
          </Card>
        ))}
        <Card className="border-dashed">
          <CardBody className="space-y-2">
            <p className="flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-ink-500" />Not in a group · {unassigned.length}</p>
            {unassigned.length ? (
              <ul className="max-h-80 space-y-1 overflow-y-auto">{unassigned.map((r) => (
                <li key={r.user_id} className={cn('flex items-center gap-2 rounded-xl px-2 py-1 text-sm', hit(r.user_id) && 'bg-brand-50')}>
                  <Avatar name={r.full_name} src={r.avatar_url} size={24} /><span className="min-w-0 flex-1 truncate">{r.full_name}{r.section_name && <span className="text-xs text-ink-400"> · {r.section_name}</span>}</span>
                  {list.length > 0 && <select value="" onChange={(e) => e.target.value && assign.mutate({ group: e.target.value, user: r.user_id })} aria-label={`Put ${r.full_name} in a group`} className="rounded-lg border border-ink-200 bg-surface px-1 py-0.5 text-xs">
                    <option value="">Add to…</option>{list.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
                </li>
              ))}</ul>
            ) : <p className="text-sm text-ink-500">Everyone is in a group. 🎉</p>}
          </CardBody>
        </Card>
      </div>
      {!list.length && <EmptyState icon={<UsersRound className="h-7 w-7" />} title="No groups yet" description="Create groups yourself, or let ProfJero Edu split the class into balanced groups." />}
      <CreateGroupDialog open={creating} onOpenChange={setCreating} defaultClass={classId} stay onCreated={refresh} />
      <AutoSplitDialog open={split} onOpenChange={setSplit} classId={classId} unassigned={unassigned.length} hasSections={(sections.data?.length ?? 0) > 0} onDone={refresh} />
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.name}?`} description="Its members, chat and live classes will be removed. Members can then join another group." confirmLabel="Delete group" tone="danger" loading={drop.isPending} onConfirm={() => del && drop.mutate(del.id)} />
    </div>
  );
}

function AutoSplitDialog({ open, onOpenChange, classId, unassigned, hasSections, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; classId: string; unassigned: number; hasSections: boolean; onDone: () => void }) {
  const toast = useToast();
  const [n, setN] = useState(4);
  const [prefix, setPrefix] = useState('Group');
  const [bySection, setBySection] = useState(false);
  const run = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('auto_group_class', { p_class: classId, p_groups: n, p_prefix: prefix, p_by_section: bySection })) as number,
    onSuccess: (count) => { onOpenChange(false); onDone(); toast.success(`${count} students placed in groups`, 'Open a group to choose its leader.'); },
    onError: (e) => toast.error('Could not create groups', errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Auto-create groups" description={`Randomly and evenly places the ${unassigned} student${unassigned === 1 ? '' : 's'} who are not yet in a group.`}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={run.isPending} onClick={() => run.mutate()} leftIcon={<Shuffle className="h-4 w-4" />}>Create groups</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Number of groups"><Input type="number" min={1} max={40} value={n} onChange={(e) => setN(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} /></Field>
          <Field label="Name groups"><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={40} placeholder="Group" /></Field>
        </div>
        <p className="text-sm text-ink-500">About {Math.ceil(unassigned / Math.max(1, n))} students per group. Groups are named “{prefix || 'Group'} 1”, “{prefix || 'Group'} 2”…</p>
        {hasSections && <Checkbox label="Keep each school class together" description="Creates this many groups for every school class (e.g. General Arts A2, Science B2)." checked={bySection} onChange={(e) => setBySection(e.target.checked)} />}
        {!unassigned && <Alert tone="info">Everyone is already in a group.</Alert>}
      </div>
    </Dialog>
  );
}

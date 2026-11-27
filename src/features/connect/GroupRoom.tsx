import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, LogOut, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingBlock, PageHeader, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { ClassroomPanel, useRoomMembers } from '@/features/classroom/ClassroomPanel';
import { GroupLive } from './GroupLive';

export function GroupRoom() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const g = useQuery({
    queryKey: ['study-group', groupId],
    queryFn: async () => unwrap(await supabase.from('study_groups').select('*, cls:school_classes(name), course:courses(title), members:study_group_members(user_id, role, joined_at)').eq('id', groupId!).single()) as unknown as {
      id: string; name: string; description: string | null; topic: string | null; visibility: string; max_members: number; class_id: string | null; course_id: string | null; created_by: string;
      cls: { name: string } | null; course: { title: string } | null; members: { user_id: string; role: string; joined_at: string }[] },
  });
  const scopeType = g.data?.class_id ? 'class' : 'course';
  const scopeMembers = useRoomMembers(scopeType, g.data?.class_id ?? g.data?.course_id ?? undefined);
  const [adding, setAdding] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['study-group', groupId] });
  const join = useMutation({ mutationFn: async (uid?: string) => unwrap(await supabase.rpc('join_study_group', { p_group: groupId!, p_user: uid })), onSuccess: () => { setAdding(''); void invalidate(); }, onError: (e) => toast.error('Could not add', errorMessage(e)) });
  const leave = useMutation({ mutationFn: async (uid: string) => unwrap(await supabase.from('study_group_members').delete().eq('group_id', groupId!).eq('user_id', uid)), onSuccess: (_d, uid) => { if (uid === user?.id) nav('/connect'); else void invalidate(); }, onError: (e) => toast.error('Could not remove', errorMessage(e)) });
  const promote = useMutation({ mutationFn: async (v: { uid: string; role: string }) => unwrap(await supabase.from('study_group_members').update({ role: v.role }).eq('group_id', groupId!).eq('user_id', v.uid)), onSuccess: () => void invalidate(), onError: (e) => toast.error('Could not update', errorMessage(e)) });
  if (g.isLoading) return <LoadingBlock />;
  if (g.error || !g.data) return <ErrorState error={g.error ?? new Error('Group not found')} />;
  const grp = g.data;
  const me = grp.members.find((m) => m.user_id === user?.id);
  const names = new Map((scopeMembers.data ?? []).map((m) => [m.user_id, m]));
  const isLeader = me?.role === 'leader' || grp.created_by === user?.id || names.get(user?.id ?? '')?.member_role === 'teacher';
  const candidates = (scopeMembers.data ?? []).filter((m) => !grp.members.some((x) => x.user_id === m.user_id));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Study group · ${grp.cls?.name ?? grp.course?.title ?? ''}`} title={grp.name} description={grp.topic ? `Topic: ${grp.topic}` : grp.description ?? undefined} back={{ to: '/connect', label: 'EduConnect' }}
        actions={me ? <Button variant="ghost" leftIcon={<LogOut className="h-4 w-4" />} onClick={() => leave.mutate(user!.id)}>Leave group</Button> : grp.visibility === 'open' ? <Button onClick={() => join.mutate(undefined)} loading={join.isPending}>Join group</Button> : undefined} />
      {!me && grp.class_id && <p className="text-sm text-ink-500">You can be in one group per class. To join this one, leave your current group first.</p>}
      <ClassroomPanel type="group" roomId={grp.id} canModerate={isLeader} title={grp.name}
        side={(
          <div className="space-y-4">
          {(me || isLeader) && <GroupLive groupId={grp.id} groupName={grp.name} canManage={isLeader} />}
          <Card>
            <CardHeader title="Members" description={`${grp.members.length} of ${grp.max_members}`} />
            <CardBody className="space-y-3">
              <ul className="space-y-2">{grp.members.map((m) => { const p = names.get(m.user_id); return (
                <li key={m.user_id} className="flex items-center gap-2 text-sm">
                  <Avatar name={p?.name} src={p?.avatar_url} size={28} /><span className="flex-1 truncate font-medium">{p?.name ?? 'Member'}{m.user_id === user?.id && ' (you)'}</span>
                  {m.role === 'leader' && <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>Leader</Badge>}
                  {isLeader && m.user_id !== user?.id && <>
                    <button className="text-xs font-semibold text-brand-700" onClick={() => promote.mutate({ uid: m.user_id, role: m.role === 'leader' ? 'member' : 'leader' })}>{m.role === 'leader' ? 'Demote' : 'Make leader'}</button>
                    <button className="text-xs font-semibold text-red-600" onClick={() => leave.mutate(m.user_id)}>Remove</button>
                  </>}
                </li>); })}</ul>
              {isLeader && candidates.length > 0 && grp.members.length < grp.max_members && (
                <div className="flex gap-2"><Select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add a classmate"><option value="">Add a classmate…</option>{candidates.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}</Select>
                  <Button size="sm" disabled={!adding} onClick={() => join.mutate(adding)} aria-label="Add member"><UserPlus className="h-4 w-4" /></Button></div>
              )}
            </CardBody>
          </Card>
          </div>
        )} />
    </div>
  );
}

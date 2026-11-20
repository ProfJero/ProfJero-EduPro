import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MailOpen } from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';

export function InvitationsPage() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['my-invitations'], queryFn: async () => unwrap(await supabase.rpc('my_invitations')) });
  const classInv = useQuery({ queryKey: ['my-class-invitations'], queryFn: async () => unwrap(await supabase.rpc('my_class_invitations')) });
  const respondClass = async (id: string, accept: boolean) => {
    const { data: classId, error } = await supabase.rpc('respond_class_invitation', { p_invitation: id, p_accept: accept });
    if (error) return toast.error('Could not respond', error.message);
    toast.success(accept ? 'You joined the class' : 'Invitation declined');
    void qc.invalidateQueries({ queryKey: ['my-class-invitations'] });
    void qc.invalidateQueries({ queryKey: ['my-classes'] });
    if (accept && classId) window.location.assign(`/learn/classes/${classId}`);
  };
  const respond = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc('respond_invitation', { p_invitation: id, p_accept: accept });
    if (error) return toast.error('Could not respond', error.message);
    toast.success(accept ? 'Invitation accepted' : 'Invitation declined');
    void qc.invalidateQueries({ queryKey: ['my-invitations'] });
    await refresh();
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Invitations" description="Schools and teachers invite you using your email address." />
      {classInv.data && classInv.data.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-400">Class invitations</h2>
          {classInv.data.map((i) => (
            <Card key={i.id}><CardBody className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1"><p className="font-bold">{i.class_name}</p><p className="text-sm text-ink-500">From {i.teacher} · {fmtDate(i.created_at)}</p></div>
              <Button variant="outline" onClick={() => respondClass(i.id, false)}>Decline</Button>
              <Button onClick={() => respondClass(i.id, true)}>Join class</Button>
            </CardBody></Card>
          ))}
        </div>
      )}
      {(data?.length || !classInv.data?.length) ? <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-400">School invitations</h2> : null}
      {isLoading ? <LoadingBlock /> : !data?.length && classInv.data?.length ? null : data?.length ? (
        <div className="space-y-3">{data.map((i) => (
          <Card key={i.id}><CardBody className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1"><p className="font-bold">{i.school_name}</p><p className="text-sm text-ink-500">Join as <Badge tone="brand">{i.role.replace('_', ' ')}</Badge>{i.class_name && <> in {i.class_name}</>} · expires {fmtDate(i.expires_at)}</p></div>
            <Button variant="outline" onClick={() => respond(i.id, false)}>Decline</Button>
            <Button onClick={() => respond(i.id, true)}>Accept</Button>
          </CardBody></Card>
        ))}</div>
      ) : <EmptyState icon={<MailOpen className="h-7 w-7" />} title="No pending invitations" description="If your school says they invited you, check that they used the same email address as your account." />}
    </div>
  );
}

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
  const respond = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc('respond_invitation', { p_invitation: id, p_accept: accept });
    if (error) return toast.error('Could not respond', error.message);
    toast.success(accept ? 'Invitation accepted' : 'Invitation declined');
    void qc.invalidateQueries({ queryKey: ['my-invitations'] });
    await refresh();
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="School invitations" description="Schools invite you using your email address. Accept to join their classes." />
      {isLoading ? <LoadingBlock /> : data?.length ? (
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

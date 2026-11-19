import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LifeBuoy, Lock, Plus } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';

type Ticket = { id: string; user_id: string; subject: string; category: string; description: string; status: string; priority: string; assigned_to: string | null; created_at: string; updated_at: string };
const CATS = ['general', 'account', 'course', 'technical', 'school', 'billing', 'safety', 'other'];

export function SupportList() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'mine', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('support_tickets').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false })) as Ticket[],
  });
  return (
    <div>
      <PageHeader title="Help & support" description="Ask for help with your account, a course, your school or anything else." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New request</Button>} />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState icon={<LifeBuoy className="h-7 w-7" />} title="No support requests" description="Need a hand? Open a request and the ProfJero team will reply here." action={<Button onClick={() => setOpen(true)}>New request</Button>} />}
          columns={[
            { key: 's', header: 'Subject', primary: true, cell: (r) => <Link to={`/support/${r.id}`} className="font-semibold hover:text-brand-700">{r.subject}</Link> },
            { key: 'c', header: 'Category', cell: (r) => <span className="capitalize">{r.category}</span> },
            { key: 'st', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'u', header: 'Updated', cell: (r) => fromNow(r.updated_at) },
          ]} />
      )}
      <NewTicketDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

const ticketSchema = z.object({ subject: z.string().trim().min(3).max(160), category: z.string(), description: z.string().trim().min(10, 'Describe the issue in at least 10 characters').max(5000) });
function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof ticketSchema>>({ resolver: zodResolver(ticketSchema), defaultValues: { category: 'general' } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New support request">
      <form className="space-y-4" onSubmit={handleSubmit(async (v) => {
        const { error } = await supabase.from('support_tickets').insert({ ...v, user_id: user!.id });
        if (error) return toast.error('Could not submit', error.message);
        toast.success('Request sent', 'We will reply here and notify you.');
        reset();
        onOpenChange(false);
        void qc.invalidateQueries({ queryKey: ['tickets'] });
      })}>
        <Field label="Subject" error={errors.subject?.message}><Input {...register('subject')} /></Field>
        <Field label="Category"><Select {...register('category')}>{CATS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</Select></Field>
        <Field label="Describe the issue" error={errors.description?.message}><Textarea rows={5} {...register('description')} /></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={isSubmitting}>Submit</Button></div>
      </form>
    </Dialog>
  );
}

export function SupportTicketPage() {
  const { ticketId } = useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const t = useQuery({ queryKey: ['ticket', ticketId], queryFn: async () => unwrap(await supabase.from('support_tickets').select('*').eq('id', ticketId!).maybeSingle()) as Ticket | null });
  const replies = useQuery({ queryKey: ['ticket-replies', ticketId], queryFn: async () => unwrap(await supabase.from('support_replies').select('id, author_id, body, is_internal, created_at').eq('ticket_id', ticketId!).order('created_at')) });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['ticket', ticketId] }); void qc.invalidateQueries({ queryKey: ['ticket-replies', ticketId] }); void qc.invalidateQueries({ queryKey: ['tickets'] }); };
  const send = useMutation({
    mutationFn: async () => unwrap(await supabase.from('support_replies').insert({ ticket_id: ticketId!, author_id: user!.id, body: body.trim(), is_internal: isAdmin && internal })),
    onSuccess: () => { setBody(''); refresh(); },
    onError: (e) => toast.error('Reply failed', errorMessage(e)),
  });
  const setStatus = async (status: string) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', ticketId!);
    if (error) toast.error('Could not update', error.message); else refresh();
  };
  if (t.isLoading) return <LoadingBlock />;
  if (!t.data) return <EmptyState title="Request not found" />;
  const ticket = t.data;
  const mine = ticket.user_id === user?.id;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader back={{ to: isAdmin && !mine ? '/admin/support' : '/support', label: 'Support' }} title={ticket.subject} description={`${ticket.category} · opened ${fmtDateTime(ticket.created_at)}`} actions={<StatusBadge status={ticket.status} />} />
      {isAdmin && !mine && (
        <Card><CardBody className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block font-semibold">Status</span><Select value={ticket.status} onChange={(e) => setStatus(e.target.value)}>{['open', 'in_progress', 'awaiting_user', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select></label>
          <label className="text-sm"><span className="mb-1 block font-semibold">Priority</span><Select value={ticket.priority} onChange={async (e) => { await supabase.from('support_tickets').update({ priority: e.target.value }).eq('id', ticket.id); refresh(); }}>{['low', 'normal', 'high', 'urgent'].map((s) => <option key={s}>{s}</option>)}</Select></label>
          <Button variant="outline" size="sm" onClick={async () => { await supabase.from('support_tickets').update({ assigned_to: user!.id, status: ticket.status === 'open' ? 'in_progress' : ticket.status }).eq('id', ticket.id); refresh(); }}>{ticket.assigned_to === user?.id ? 'Assigned to you' : 'Assign to me'}</Button>
        </CardBody></Card>
      )}
      <Card><CardBody><p className="whitespace-pre-wrap text-ink-800">{ticket.description}</p></CardBody></Card>
      <ul className="space-y-3">
        {(replies.data ?? []).map((r) => (
          <li key={r.id} className={cn('flex gap-3', r.author_id === user?.id && 'flex-row-reverse')}>
            <Avatar name={r.author_id === ticket.user_id ? 'You' : 'ProfJero Support'} size={32} />
            <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 text-sm', r.is_internal ? 'border border-dashed border-sun-400 bg-sun-50' : r.author_id === user?.id ? 'bg-brand-600 text-white' : 'bg-white shadow-sm')}>
              {r.is_internal && <p className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-sun-700"><Lock className="h-3 w-3" />Internal note</p>}
              <p className="whitespace-pre-wrap">{r.body}</p>
              <p className={cn('mt-1 text-xs', r.author_id === user?.id && !r.is_internal ? 'text-white/70' : 'text-ink-400')}>{fromNow(r.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
      {ticket.status === 'closed' && mine ? (
        <Alert tone="info" title="This request is closed" action={<Button size="sm" variant="outline" onClick={() => setStatus('open')}>Reopen</Button>}>Reopen it if you still need help.</Alert>
      ) : (
        <Card><CardBody className="space-y-3">
          <label htmlFor="reply" className="sr-only">Reply</label>
          <Textarea id="reply" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isAdmin && !mine ? <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-sun-500" />Internal note (not visible to the user)</label> : mine && ticket.status !== 'closed' ? <button className="text-sm font-semibold text-ink-500 hover:text-ink-800" onClick={() => setStatus('closed')}>Close request</button> : <span />}
            <Button loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>Send</Button>
          </div>
        </CardBody></Card>
      )}
    </div>
  );
}

export function AdminSupport() {
  const [status, setStatus] = useState('active');
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'admin', status],
    queryFn: async () => {
      let q = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(200);
      if (status === 'active') q = q.in('status', ['open', 'in_progress', 'awaiting_user']);
      else if (status !== 'all') q = q.eq('status', status);
      return unwrap(await q) as Ticket[];
    },
  });
  return (
    <div>
      <PageHeader title="Support tickets" actions={<Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter" className="w-44"><option value="active">Active</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option></Select>} />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState title="No tickets" />} columns={[
          { key: 's', header: 'Subject', primary: true, cell: (r) => <Link to={`/support/${r.id}`} className="font-semibold hover:text-brand-700">{r.subject}</Link> },
          { key: 'c', header: 'Category', cell: (r) => <span className="capitalize">{r.category}</span> },
          { key: 'p', header: 'Priority', cell: (r) => <Badge tone={r.priority === 'urgent' ? 'red' : r.priority === 'high' ? 'amber' : 'neutral'}>{r.priority}</Badge> },
          { key: 'st', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'u', header: 'Updated', cell: (r) => fromNow(r.updated_at) },
        ]} />
      )}
    </div>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/dates';

export function AdminInbox() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['contact-inbox'], queryFn: async () => unwrap(await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200)) });
  return (
    <div>
      <PageHeader title="Contact inbox" description="Messages from the public contact form. Reply from your email client." />
      {isLoading ? <LoadingBlock /> : data?.length ? (
        <div className="space-y-3">{data.map((m) => (
          <Card key={m.id} className={m.status === 'new' ? 'ring-1 ring-brand-200' : ''}><CardBody className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><strong>{m.name}</strong><a href={`mailto:${m.email}`} className="text-sm text-brand-700 underline">{m.email}</a><Badge>{m.topic}</Badge>{m.status === 'new' && <Badge tone="brand">New</Badge>}<span className="ml-auto text-xs text-ink-400">{fmtDateTime(m.created_at)}</span></div>
            <p className="whitespace-pre-wrap text-sm text-ink-700">{m.message}</p>
            {m.status === 'new' && <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('contact_messages').update({ status: 'handled' }).eq('id', m.id); void qc.invalidateQueries({ queryKey: ['contact-inbox'] }); }}>Mark handled</Button>}
          </CardBody></Card>
        ))}</div>
      ) : <EmptyState icon={<Inbox className="h-7 w-7" />} title="No messages" />}
    </div>
  );
}

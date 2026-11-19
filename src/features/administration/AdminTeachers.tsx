import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Presentation } from 'lucide-react';
import { Button, Card, CardBody, Dialog, EmptyState, Field, LoadingBlock, PageHeader, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { AdminUsersTable } from './AdminTeachersTable';

export function AdminTeachers() {
  const qc = useQueryClient();
  const toast = useToast();
  const apps = useQuery({ queryKey: ['instructor-apps-admin'], queryFn: async () => unwrap(await supabase.from('instructor_applications').select('*').order('created_at', { ascending: false })) });
  const [review, setReview] = useState<{ id: string; approve: boolean } | null>(null);
  const [notes, setNotes] = useState('');
  const pending = (apps.data ?? []).filter((a) => a.status === 'pending');
  return (
    <div>
      <PageHeader title="Teachers" description="Review independent instructor applications. School teachers are managed by their schools." />
      <Tabs tabs={[
        { value: 'apps', label: 'Applications', count: pending.length, content: apps.isLoading ? <LoadingBlock /> : (apps.data?.length ? (
          <div className="space-y-3">{apps.data.map((a) => (
            <Card key={a.id}><CardBody className="space-y-2">
              <div className="flex items-center gap-3"><p className="flex-1 font-bold">{a.expertise}</p><StatusBadge status={a.status} /></div>
              <p className="text-xs text-ink-500">Applied {fmtDate(a.created_at)} · user {a.user_id.slice(0, 8)}</p>
              <p className="whitespace-pre-wrap text-sm text-ink-700">{a.motivation}</p>
              {a.portfolio_url && <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-700 underline">Portfolio</a>}
              {a.status === 'pending' && <div className="flex gap-2 pt-1"><Button size="sm" variant="success" onClick={() => { setNotes(''); setReview({ id: a.id, approve: true }); }}>Approve</Button><Button size="sm" variant="outline" onClick={() => { setNotes(''); setReview({ id: a.id, approve: false }); }}>Decline</Button></div>}
            </CardBody></Card>
          ))}</div>
        ) : <EmptyState icon={<Presentation className="h-7 w-7" />} title="No applications" />) },
        { value: 'list', label: 'Instructors', content: <AdminUsersTable role="teacher" /> },
      ]} />
      <Dialog open={Boolean(review)} onOpenChange={(o) => !o && setReview(null)} title={review?.approve ? 'Approve instructor' : 'Decline application'} size="sm"
        footer={<><Button variant="outline" onClick={() => setReview(null)}>Cancel</Button><Button variant={review?.approve ? 'success' : 'danger'} onClick={async () => {
          const { error } = await supabase.rpc('review_instructor_application', { p_application: review!.id, p_approve: review!.approve, p_notes: (notes || null) as never });
          if (error) return toast.error('Failed', error.message);
          toast.success('Done — applicant notified'); setReview(null); void qc.invalidateQueries({ queryKey: ['instructor-apps-admin'] });
        }}>Confirm</Button></>}>
        <Field label="Note to the applicant (optional)"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Dialog>
    </div>
  );
}

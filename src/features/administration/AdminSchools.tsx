import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Crown } from 'lucide-react';
import { Badge, Button, Card, CardBody, Dialog, EmptyState, Field, LoadingBlock, PageHeader, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap, type Tables } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { GrantDialog } from './AdminUsers';

export function AdminSchools() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['admin-schools'], queryFn: async () => unwrap(await supabase.from('schools').select('*').order('created_at', { ascending: false })) });
  const [review, setReview] = useState<{ s: Tables<'schools'>; approve: boolean } | null>(null);
  const [notes, setNotes] = useState('');
  const [grant, setGrant] = useState<Tables<'schools'> | null>(null);
  if (isLoading) return <LoadingBlock />;
  const by = (st: string) => (data ?? []).filter((s) => s.status === st);
  const list = (rows: Tables<'schools'>[]) => rows.length ? (
    <div className="space-y-3">{rows.map((s) => (
      <Card key={s.id}><CardBody className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1"><p className="text-lg font-bold">{s.name}</p><p className="text-sm text-ink-500">{s.institution_type.toUpperCase()} · {[s.city, s.region, s.country_code].filter(Boolean).join(', ')} · applied {fmtDate(s.created_at)}</p></div>
          <StatusBadge status={s.status} />
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-ink-500">Email: </dt><dd className="inline">{s.contact_email}</dd></div>
          {s.contact_phone && <div><dt className="inline text-ink-500">Phone: </dt><dd className="inline">{s.contact_phone}</dd></div>}
          {s.website && <div><dt className="inline text-ink-500">Website: </dt><dd className="inline"><a href={s.website} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">{s.website}</a></dd></div>}
          {s.applicant_role && <div><dt className="inline text-ink-500">Applicant role: </dt><dd className="inline">{s.applicant_role}</dd></div>}
          {s.estimated_learners != null && <div><dt className="inline text-ink-500">Learners: </dt><dd className="inline">~{s.estimated_learners}</dd></div>}
        </dl>
        {s.application_notes && <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{s.application_notes}</p>}
        {s.review_notes && <p className="text-sm text-ink-500">Review notes: {s.review_notes}</p>}
        <div className="flex flex-wrap gap-2">
          {s.status === 'pending' && <><Button size="sm" variant="success" onClick={() => { setNotes(''); setReview({ s, approve: true }); }}>Approve</Button><Button size="sm" variant="outline" onClick={() => { setNotes(''); setReview({ s, approve: false }); }}>Reject</Button></>}
          {s.status === 'approved' && <><Button size="sm" variant="outline" onClick={async () => { const { error } = await supabase.rpc('set_school_status', { p_school: s.id, p_status: 'suspended' }); if (error) toast.error('Failed', error.message); else void qc.invalidateQueries({ queryKey: ['admin-schools'] }); }}>Suspend</Button><Button size="sm" variant="secondary" leftIcon={<Crown className="h-4 w-4" />} onClick={() => setGrant(s)}>Grant EduPro for Schools</Button></>}
          {(s.status === 'suspended' || s.status === 'rejected') && <Button size="sm" variant="outline" onClick={async () => { const { error } = await supabase.rpc(s.status === 'rejected' ? 'review_school' : 'set_school_status', s.status === 'rejected' ? { p_school: s.id, p_approve: true } as never : { p_school: s.id, p_status: 'approved' } as never); if (error) toast.error('Failed', error.message); else void qc.invalidateQueries({ queryKey: ['admin-schools'] }); }}>{s.status === 'rejected' ? 'Approve after all' : 'Reinstate'}</Button>}
        </div>
      </CardBody></Card>
    ))}</div>
  ) : <EmptyState icon={<Building2 className="h-7 w-7" />} title="Nothing here" />;
  return (
    <div>
      <PageHeader title="Schools" description="Verify institutions before granting school workspaces. Approval makes the applicant the school's administrator." />
      <Tabs tabs={[
        { value: 'pending', label: 'Pending', count: by('pending').length, content: list(by('pending')) },
        { value: 'approved', label: 'Approved', count: by('approved').length, content: list(by('approved')) },
        { value: 'other', label: 'Rejected & suspended', count: by('rejected').length + by('suspended').length, content: list([...by('rejected'), ...by('suspended')]) },
      ]} />
      <Dialog open={Boolean(review)} onOpenChange={(o) => !o && setReview(null)} title={`${review?.approve ? 'Approve' : 'Reject'} ${review?.s.name ?? ''}`} size="sm"
        footer={<><Button variant="outline" onClick={() => setReview(null)}>Cancel</Button><Button variant={review?.approve ? 'success' : 'danger'} onClick={async () => {
          const { error } = await supabase.rpc('review_school', { p_school: review!.s.id, p_approve: review!.approve, p_notes: (notes || null) as never });
          if (error) return toast.error('Failed', error.message);
          toast.success(review!.approve ? 'School approved — applicant notified' : 'Application rejected');
          setReview(null);
          void qc.invalidateQueries({ queryKey: ['admin-schools'] });
        }}>{review?.approve ? 'Approve school' : 'Reject application'}</Button></>}>
        <Field label={review?.approve ? 'Message to the applicant (optional)' : 'Reason (sent to the applicant)'}><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {review?.approve && <p className="mt-3 text-sm text-ink-500"><Badge tone="green">Effect</Badge> The applicant becomes the school administrator and gets a school workspace.</p>}
      </Dialog>
      <GrantDialog target={grant ? { schoolId: grant.id, schoolName: grant.name } : null} onClose={() => setGrant(null)} />
    </div>
  );
}

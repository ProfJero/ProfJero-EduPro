import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, StatusBadge, Tabs, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { providerName } from '@/features/live/providers';

export function AdminAssessments() {
  const a = useQuery({ queryKey: ['admin-assessments'], queryFn: async () => unwrap(await supabase.from('assessments').select('id, title, kind, status, closes_at, course:courses(title), cls:school_classes(name)').order('created_at', { ascending: false }).limit(300)) as unknown as { id: string; title: string; kind: string; status: string; closes_at: string | null; course: { title: string } | null; cls: { name: string } | null }[] });
  const s = useQuery({ queryKey: ['admin-assignments'], queryFn: async () => unwrap(await supabase.from('assignments').select('id, title, status, due_at, course:courses(title), cls:school_classes(name)').order('created_at', { ascending: false }).limit(300)) as unknown as { id: string; title: string; status: string; due_at: string | null; course: { title: string } | null; cls: { name: string } | null }[] });
  return (
    <div>
      <PageHeader title="Assessments & assignments" description="Platform-wide overview. Open any item to inspect results and submissions." />
      <Tabs tabs={[
        { value: 'a', label: 'Assessments', count: a.data?.length, content: a.isLoading ? <LoadingBlock /> : <DataTable rows={a.data ?? []} rowKey={(r) => r.id} empty={<EmptyState title="None yet" />} columns={[
          { key: 't', header: 'Title', primary: true, cell: (r) => <Link to={`/teach/assessments/${r.id}?tab=results`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'c', header: 'For', cell: (r) => r.course?.title ?? r.cls?.name }, { key: 'k', header: 'Type', cell: (r) => <Badge>{r.kind}</Badge> },
          { key: 'cl', header: 'Closes', cell: (r) => (r.closes_at ? fmtDateTime(r.closes_at) : '—') }, { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]} /> },
        { value: 's', label: 'Assignments', count: s.data?.length, content: s.isLoading ? <LoadingBlock /> : <DataTable rows={s.data ?? []} rowKey={(r) => r.id} empty={<EmptyState title="None yet" />} columns={[
          { key: 't', header: 'Title', primary: true, cell: (r) => <Link to={`/teach/assignments/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
          { key: 'c', header: 'For', cell: (r) => r.course?.title ?? r.cls?.name }, { key: 'd', header: 'Due', cell: (r) => (r.due_at ? fmtDateTime(r.due_at) : '—') }, { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]} /> },
      ]} />
    </div>
  );
}

export function AdminCertificates() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [revoke, setRevoke] = useState<{ id: string; serial: string } | null>(null);
  const [reason, setReason] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin-certs', q], queryFn: async () => {
    let qq = supabase.from('certificates').select('id, serial, learner_name, course_title, issuer_name, completed_on, status').order('issued_at', { ascending: false }).limit(200);
    if (q.trim()) qq = qq.or(`serial.ilike.%${q.trim().replace(/[%,()]/g, '')}%,learner_name.ilike.%${q.trim().replace(/[%,()]/g, '')}%`);
    return unwrap(await qq);
  } });
  return (
    <div>
      <PageHeader title="Certificates" description="Every certificate issued on the platform. Revocation is recorded and shown on the public verification page." />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by reference or learner" aria-label="Search certificates" className="mb-4 max-w-sm" />
      {isLoading ? <LoadingBlock /> : <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState title="No certificates yet" />} columns={[
        { key: 's', header: 'Reference', primary: true, cell: (r) => <Link to={`/verify/${r.serial}`} className="font-mono text-sm hover:text-brand-700">{r.serial}</Link> },
        { key: 'l', header: 'Learner', cell: (r) => r.learner_name }, { key: 'c', header: 'Course', cell: (r) => r.course_title },
        { key: 'd', header: 'Completed', cell: (r) => fmtDate(r.completed_on) }, { key: 'st', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        { key: 'x', header: '', cell: (r) => r.status === 'valid' && <Button size="sm" variant="ghost" onClick={() => { setReason(''); setRevoke(r); }}>Revoke</Button> },
      ]} />}
      <Dialog open={Boolean(revoke)} onOpenChange={(o) => !o && setRevoke(null)} title={`Revoke ${revoke?.serial}?`} size="sm"
        footer={<><Button variant="outline" onClick={() => setRevoke(null)}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} onClick={async () => {
          const { error } = await supabase.from('certificates').update({ status: 'revoked', revoked_reason: reason }).eq('id', revoke!.id);
          if (error) toast.error('Failed', error.message); else { toast.success('Certificate revoked'); setRevoke(null); void qc.invalidateQueries({ queryKey: ['admin-certs'] }); }
        }}>Revoke</Button></>}>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Dialog>
    </div>
  );
}

export function AdminLive() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-live'], queryFn: async () => unwrap(await supabase.from('live_sessions').select('id, title, provider, starts_at, duration_minutes, status, course:courses(title), cls:school_classes(name)').order('starts_at', { ascending: false }).limit(300)) as unknown as { id: string; title: string; provider: string; starts_at: string; duration_minutes: number; status: string; course: { title: string } | null; cls: { name: string } | null }[] });
  return (
    <div>
      <PageHeader title="Live classes" description="All scheduled sessions across the platform." />
      {isLoading ? <LoadingBlock /> : <DataTable rows={data ?? []} rowKey={(r) => r.id} empty={<EmptyState title="No sessions yet" />} columns={[
        { key: 't', header: 'Session', primary: true, cell: (r) => <Link to={`/learn/live/${r.id}`} className="font-semibold hover:text-brand-700">{r.title}</Link> },
        { key: 'c', header: 'For', cell: (r) => r.course?.title ?? r.cls?.name }, { key: 'p', header: 'Provider', cell: (r) => providerName(r.provider) },
        { key: 'w', header: 'When', cell: (r) => fmtDateTime(r.starts_at) }, { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      ]} />}
    </div>
  );
}

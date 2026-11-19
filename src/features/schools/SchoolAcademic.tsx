import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Star } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { useAcademicYears } from './SchoolClasses';

export function SchoolAcademic() {
  const { schoolId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const years = useAcademicYears(schoolId);
  const terms = useQuery({ queryKey: ['academic-terms', schoolId], queryFn: async () => unwrap(await supabase.from('academic_terms').select('id, name, starts_on, ends_on, is_current, academic_year_id').eq('school_id', schoolId!).order('starts_on')) });
  const [y, setY] = useState({ name: '', starts_on: '', ends_on: '' });
  const [t, setT] = useState<Record<string, { name: string; starts_on: string; ends_on: string }>>({});
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['academic-years', schoolId] }); void qc.invalidateQueries({ queryKey: ['academic-terms', schoolId] }); };
  const act = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; if (error) toast.error('Action failed', /ends_on|check/i.test(error.message) ? 'The end date must be after the start date.' : error.message); else { toast.success(ok); refresh(); } };
  const makeCurrent = async (table: 'academic_years' | 'academic_terms', id: string) => {
    await supabase.from(table).update({ is_current: false }).eq('school_id', schoolId!).eq('is_current', true);
    await act(supabase.from(table).update({ is_current: true }).eq('id', id), 'Marked as current');
  };
  if (years.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      <PageHeader title="Academic structure" description="Academic years and terms (or semesters) organise classes, reports and attendance." />
      <Card><CardHeader title="Add academic year" /><CardBody className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="Name"><Input value={y.name} onChange={(e) => setY({ ...y, name: e.target.value })} placeholder="2026/2027" /></Field>
        <Field label="Starts"><Input type="date" value={y.starts_on} onChange={(e) => setY({ ...y, starts_on: e.target.value })} /></Field>
        <Field label="Ends"><Input type="date" value={y.ends_on} onChange={(e) => setY({ ...y, ends_on: e.target.value })} /></Field>
        <Button className="self-end" leftIcon={<Plus className="h-4 w-4" />} disabled={!y.name || !y.starts_on || !y.ends_on} onClick={() => { void act(supabase.from('academic_years').insert({ school_id: schoolId!, ...y, is_current: !years.data?.length }), 'Academic year added'); setY({ name: '', starts_on: '', ends_on: '' }); }}>Add</Button>
      </CardBody></Card>
      {years.data?.length ? years.data.map((yr) => (
        <Card key={yr.id}>
          <CardHeader title={<span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 text-brand-600" />{yr.name}{yr.is_current && <Badge tone="green">Current</Badge>}</span>} description={`${fmtDate(yr.starts_on)} – ${fmtDate(yr.ends_on)}`}
            action={!yr.is_current && <Button size="sm" variant="outline" leftIcon={<Star className="h-4 w-4" />} onClick={() => makeCurrent('academic_years', yr.id)}>Make current</Button>} />
          <CardBody className="space-y-3">
            <ul className="divide-y divide-ink-100">{(terms.data ?? []).filter((x) => x.academic_year_id === yr.id).map((tm) => (
              <li key={tm.id} className="flex flex-wrap items-center gap-3 py-2 text-sm"><span className="font-semibold">{tm.name}</span><span className="text-ink-500">{fmtDate(tm.starts_on)} – {fmtDate(tm.ends_on)}</span>{tm.is_current ? <Badge tone="green">Current term</Badge> : <button className="text-xs font-semibold text-brand-700" onClick={() => makeCurrent('academic_terms', tm.id)}>Make current</button>}</li>
            ))}</ul>
            <div className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input aria-label="Term name" placeholder="Term 1 / Semester 1" value={t[yr.id]?.name ?? ''} onChange={(e) => setT({ ...t, [yr.id]: { ...(t[yr.id] ?? { starts_on: '', ends_on: '' }), name: e.target.value } })} />
              <Input aria-label="Term start" type="date" value={t[yr.id]?.starts_on ?? ''} onChange={(e) => setT({ ...t, [yr.id]: { ...(t[yr.id] ?? { name: '', ends_on: '' }), starts_on: e.target.value } })} />
              <Input aria-label="Term end" type="date" value={t[yr.id]?.ends_on ?? ''} onChange={(e) => setT({ ...t, [yr.id]: { ...(t[yr.id] ?? { name: '', starts_on: '' }), ends_on: e.target.value } })} />
              <Button size="sm" disabled={!t[yr.id]?.name || !t[yr.id]?.starts_on || !t[yr.id]?.ends_on} onClick={() => { void act(supabase.from('academic_terms').insert({ school_id: schoolId!, academic_year_id: yr.id, ...t[yr.id] }), 'Term added'); setT({ ...t, [yr.id]: { name: '', starts_on: '', ends_on: '' } }); }}>Add term</Button>
            </div>
          </CardBody>
        </Card>
      )) : <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No academic years yet" description="Add the current academic year to get started." />}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownAZ, Crown, Download, GraduationCap, Pencil, Plus, School, Search, Trash2, Users, X } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Input, LoadingBlock, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useRoomMembers } from './ClassroomPanel';

export type RosterRow = {
  user_id: string; full_name: string; display_name: string | null; avatar_url: string | null; section_id: string | null; section_name: string | null;
  group_id: string | null; group_name: string | null; group_role: string | null; leader_title: string | null; joined_at: string; last_seen_at: string | null; is_guest: boolean;
};
export type Section = { id: string; name: string; position: number };

export function useSections(classId?: string) {
  return useQuery({
    queryKey: ['class-sections', classId], enabled: Boolean(classId), staleTime: 60_000,
    queryFn: async () => unwrap(await supabase.from('class_sections').select('id, name, position').eq('class_id', classId!).order('position').order('name')) as Section[],
  });
}
export function useRoster(classId?: string, enabled = true) {
  return useQuery({
    queryKey: ['class-roster', classId], enabled: Boolean(classId) && enabled, staleTime: 30_000,
    queryFn: async () => (unwrap(await supabase.rpc('class_roster', { p_class: classId! })) ?? []) as RosterRow[],
  });
}

/** Search + section filter shared by the register, roll call and score entry. */
export function matchesSearch(r: { full_name: string; display_name?: string | null }, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return r.full_name.toLowerCase().includes(s) || (r.display_name ?? '').toLowerCase().includes(s);
}

type Sort = 'name' | 'name-desc' | 'newest' | 'oldest' | 'active' | 'section';
const SORTS: { v: Sort; label: string }[] = [
  { v: 'name', label: 'Name (A–Z)' }, { v: 'name-desc', label: 'Name (Z–A)' }, { v: 'section', label: 'School class' },
  { v: 'newest', label: 'Newest members' }, { v: 'oldest', label: 'First to join' }, { v: 'active', label: 'Recently active' },
];

function csv(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
export function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const blob = new Blob(['﻿' + csv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** The class register: every learner with their official name, school class, group and activity. */
export function ClassRoster({ classId, className, canEdit }: { classId: string; className: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const roster = useRoster(classId);
  const sections = useSections(classId);
  const members = useRoomMembers('class', classId);
  const [q, setQ] = useState('');
  const [section, setSection] = useState('all');
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<Sort>('name');
  const setSec = useMutation({
    mutationFn: async (v: { user: string; section: string | null }) => unwrap(await supabase.rpc('set_class_section', { p_class: classId, p_section: v.section as string, p_user: v.user })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['class-roster', classId] }),
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  const rows = useMemo(() => roster.data ?? [], [roster.data]);
  const groups = useMemo(() => [...new Map(rows.filter((r) => r.group_id).map((r) => [r.group_id!, r.group_name!])).entries()], [rows]);
  const shown = useMemo(() => {
    const list = rows.filter((r) => matchesSearch(r, q)
      && (section === 'all' || (section === 'none' ? !r.section_id : r.section_id === section))
      && (group === 'all' || (group === 'none' ? !r.group_id : group === 'leaders' ? Boolean(r.leader_title || r.group_role === 'leader') : r.group_id === group)));
    const by = (a: RosterRow, b: RosterRow) => a.full_name.localeCompare(b.full_name);
    return list.sort((a, b) => {
      switch (sort) {
        case 'name-desc': return -by(a, b);
        case 'newest': return b.joined_at.localeCompare(a.joined_at);
        case 'oldest': return a.joined_at.localeCompare(b.joined_at);
        case 'active': return (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? '');
        case 'section': return (a.section_name ?? '~').localeCompare(b.section_name ?? '~') || by(a, b);
        default: return by(a, b);
      }
    });
  }, [rows, q, section, group, sort]);
  const teachers = (members.data ?? []).filter((m) => m.member_role === 'teacher');
  const counts = (sections.data ?? []).map((s) => ({ ...s, n: rows.filter((r) => r.section_id === s.id).length }));
  const unsorted = rows.filter((r) => !r.section_id).length;
  if (roster.isLoading) return <LoadingBlock />;
  if (roster.error) return <Alert tone="error">{errorMessage(roster.error)}</Alert>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="card flex items-center gap-4 p-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Users className="h-6 w-6" /></span>
          <div><p className="text-3xl font-extrabold leading-none" data-testid="student-total">{rows.length}</p><p className="text-sm text-ink-500">student{rows.length === 1 ? '' : 's'} in {className}</p></div>
        </div>
        <div className="card flex flex-wrap items-center gap-2 p-4">
          <button onClick={() => setSection('all')} className={chip(section === 'all')}>All · {rows.length}</button>
          {counts.map((s) => <button key={s.id} onClick={() => setSection(s.id)} className={chip(section === s.id)}><School className="h-3.5 w-3.5" />{s.name} · {s.n}</button>)}
          {counts.length > 0 && unsorted > 0 && <button onClick={() => setSection('none')} className={chip(section === 'none')}>Not chosen · {unsorted}</button>}
          {!counts.length && <p className="text-sm text-ink-500">Tip: add the school classes your learners come from (e.g. General Arts A2, Science B2) in <b>School classes</b> below, then filter by them here.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or nickname…" aria-label="Search students" className="pl-9" />
          {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700" aria-label="Clear search"><X className="h-4 w-4" /></button>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <Select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Filter by school class" className="lg:w-44">
            <option value="all">All school classes</option>{(sections.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="none">Not chosen yet</option>
          </Select>
          <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by group" className="lg:w-44">
            <option value="all">Any group</option><option value="none">Not in a group</option><option value="leaders">Leaders only</option>
            {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="col-span-2 sm:col-span-1 lg:w-44">{SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</Select>
        </div>
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv(`${className.replace(/[^\w]+/g, '-')}-students.csv`, [
          ['Full name', 'Display name', 'School class', 'Group', 'Leader', 'Joined', 'Last active'],
          ...shown.map((r) => [r.full_name, r.display_name, r.section_name, r.group_name, r.leader_title, fmtDate(r.joined_at), r.last_seen_at ? fmtDate(r.last_seen_at) : '']),
        ])}>Export</Button>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-ink-500"><ArrowDownAZ className="h-4 w-4" />Showing <b className="text-ink-800">{shown.length}</b> of {rows.length}. Names are learners’ official full names; nicknames appear underneath.</p>

      {shown.length ? (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-surface">
          {shown.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
              <Avatar name={r.full_name} src={r.avatar_url} size={40} />
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-semibold">{r.full_name}{r.is_guest && <Badge className="ml-2">Guest</Badge>}</p>
                <p className="truncate text-xs text-ink-500">{r.display_name && r.display_name !== r.full_name ? <>Goes by <b>{r.display_name}</b> · </> : null}Joined {fmtDate(r.joined_at)}{r.last_seen_at ? ` · active ${fromNow(r.last_seen_at)}` : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.leader_title && <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>{r.leader_title}</Badge>}
                {r.group_name && <Badge tone={r.group_role === 'leader' ? 'green' : 'neutral'}>{r.group_name}{r.group_role === 'leader' ? ' · leader' : ''}</Badge>}
              </div>
              {canEdit && (sections.data?.length ?? 0) > 0 ? (
                <Select value={r.section_id ?? ''} onChange={(e) => setSec.mutate({ user: r.user_id, section: e.target.value || null })} aria-label={`School class for ${r.full_name}`} className="h-9 w-full py-1 text-sm sm:w-44">
                  <option value="">No school class</option>{sections.data!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              ) : r.section_name ? <Badge tone="brand" icon={<School className="h-3 w-3" />}>{r.section_name}</Badge> : null}
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Users className="h-7 w-7" />} title={rows.length ? 'No students match' : 'No students yet'} description={rows.length ? 'Try another name or clear the filters.' : 'Share your join code so learners can join.'} />}

      {teachers.length > 0 && <p className="flex flex-wrap items-center gap-2 text-sm text-ink-500"><GraduationCap className="h-4 w-4" />Teachers: {teachers.map((t) => <Badge key={t.user_id} tone="green">{t.name}</Badge>)}</p>}
    </div>
  );
}

const chip = (on: boolean) => cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-ink-700 hover:border-brand-300');

/** Teachers list the real school classes that make up this class. */
export function SectionsManager({ classId, askSection }: { classId: string; askSection: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useSections(classId);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['class-sections', classId] }); void qc.invalidateQueries({ queryKey: ['class-roster', classId] }); };
  const add = useMutation({
    mutationFn: async () => {
      const names = name.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      const start = sections.data?.length ?? 0;
      return unwrap(await supabase.from('class_sections').insert(names.map((n, i) => ({ class_id: classId, name: n.slice(0, 60), position: start + i }))));
    },
    onSuccess: () => { setName(''); refresh(); toast.success('School classes added', 'Learners will be asked which one they are in.'); },
    onError: (e) => toast.error('Could not add', /duplicate/.test(errorMessage(e)) ? 'That school class is already listed.' : errorMessage(e)),
  });
  const rename = useMutation({ mutationFn: async () => unwrap(await supabase.from('class_sections').update({ name: edit!.name.trim() }).eq('id', edit!.id)), onSuccess: () => { setEdit(null); refresh(); }, onError: (e) => toast.error('Not saved', errorMessage(e)) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await supabase.from('class_sections').delete().eq('id', id)), onSuccess: refresh });
  const ask = useMutation({ mutationFn: async (v: boolean) => unwrap(await supabase.from('school_classes').update({ ask_section: v }).eq('id', classId)), onSuccess: () => void qc.invalidateQueries({ queryKey: ['class', classId] }) });
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><School className="h-5 w-5 text-brand-600" />School classes</span>}
        description="Your learners may come from different classes at school — for example General Arts A2, Science B2 and Science B3. List them here; each learner picks theirs, and you can filter, take the register and enter scores by school class." />
      <CardBody className="space-y-4">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. General Arts A2, Science B2, Science B3" aria-label="School class names" maxLength={300} />
          <Button type="submit" disabled={!name.trim()} loading={add.isPending} leftIcon={<Plus className="h-4 w-4" />}>Add</Button>
        </form>
        <p className="text-xs text-ink-500">Tip: add several at once by separating them with commas.</p>
        {sections.data?.length ? (
          <ul className="flex flex-wrap gap-2">{sections.data.map((s) => (
            <li key={s.id} className="flex items-center gap-1 rounded-full border border-ink-200 bg-surface py-1 pl-3 pr-1 text-sm font-semibold">
              {edit?.id === s.id ? (
                <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); rename.mutate(); }}>
                  <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={60} className="w-36 rounded border border-ink-200 bg-surface px-2 py-0.5 text-sm" aria-label="New name" />
                  <Button size="sm" type="submit" loading={rename.isPending}>Save</Button>
                </form>
              ) : <>
                <School className="h-3.5 w-3.5 text-brand-600" />{s.name}
                <button onClick={() => setEdit({ id: s.id, name: s.name })} className="rounded-full p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700" aria-label={`Rename ${s.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm(`Remove ${s.name}? Learners in it will need to choose again.`)) remove.mutate(s.id); }} className="rounded-full p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${s.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </>}
            </li>
          ))}</ul>
        ) : <p className="text-sm text-ink-500">No school classes listed yet.</p>}
        <Checkbox label="Ask learners which school class they are in" description="They see a quick question at the top of the class until they answer." checked={askSection} onChange={(e) => ask.mutate(e.target.checked)} />
      </CardBody>
    </Card>
  );
}

/** Learner side: pick (or change) your school class. */
export function SectionPicker({ classId, ask }: { classId: string; ask: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useSections(classId);
  const mine = useQuery({ queryKey: ['my-section', classId], queryFn: async () => unwrap(await supabase.rpc('my_class_section', { p_class: classId })) as string | null });
  const [changing, setChanging] = useState(false);
  const pick = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('set_class_section', { p_class: classId, p_section: id })),
    onSuccess: () => { setChanging(false); void qc.invalidateQueries({ queryKey: ['my-section', classId] }); toast.success('Saved', 'Your teacher can now see your school class.'); },
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  if (!sections.data?.length || mine.isLoading) return null;
  const current = sections.data.find((s) => s.id === mine.data);
  if (current && !changing) {
    return <p className="flex flex-wrap items-center gap-2 text-sm text-ink-600"><School className="h-4 w-4 text-brand-600" />Your school class: <b>{current.name}</b><button onClick={() => setChanging(true)} className="font-semibold text-brand-700 underline">Change</button></p>;
  }
  if (!current && !ask && !changing) return null;
  return (
    <div className="card animate-[fade-up_0.3s_ease-out] border-brand-200 bg-brand-50/60 p-4 sm:p-5" role="group" aria-labelledby="pick-section">
      <p id="pick-section" className="flex items-center gap-2 font-bold"><School className="h-5 w-5 text-brand-600" />Which class are you in at school?</p>
      <p className="mt-1 text-sm text-ink-600">This helps your teacher take the register and share scores for your class.</p>
      <div className="mt-3 flex flex-wrap gap-2">{sections.data.map((s) => (
        <Button key={s.id} variant={s.id === mine.data ? 'primary' : 'secondary'} loading={pick.isPending && pick.variables === s.id} onClick={() => pick.mutate(s.id)}>{s.name}</Button>
      ))}{changing && <Button variant="ghost" onClick={() => setChanging(false)}>Cancel</Button>}</div>
    </div>
  );
}

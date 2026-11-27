import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ClipboardList, ClipboardPaste, Download, EyeOff, Lock, Pencil, Plus, Search, Send, Trash2, Trophy } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, Checkbox, ConfirmDialog, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, ProgressBar, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { downloadCsv, matchesSearch, useRoster, useSections, type RosterRow } from '@/features/classroom/Roster';

export type Sheet = { id: string; class_id: string; section_id: string | null; title: string; description: string | null; category: string; max_score: number;
  status: 'draft' | 'released'; show_class_stats: boolean; released_at: string | null; created_at: string };
type Entry = { user_id: string; score: number | null; absent: boolean; remark: string | null };

const CATEGORIES = [
  { v: 'exam', label: 'Exam' }, { v: 'test', label: 'Class test' }, { v: 'quiz', label: 'Quiz' }, { v: 'assignment', label: 'Assignment' },
  { v: 'project', label: 'Project' }, { v: 'practical', label: 'Practical' }, { v: 'other', label: 'Other' },
];
const TITLE_IDEAS = ['Mid-Sem Exams', 'End of Term Exams', 'Class Test 1', 'Mock Exams', 'Project Work', 'Practical Assessment'];
const pct = (s: number | null, max: number) => (s == null ? null : Math.round((Number(s) / Number(max)) * 1000) / 10);

function useSheets(classId: string) {
  return useQuery({
    queryKey: ['score-sheets', classId],
    queryFn: async () => unwrap(await supabase.from('score_sheets').select('id, class_id, section_id, title, description, category, max_score, status, show_class_stats, released_at, created_at, entries:score_entries(score, absent)').eq('class_id', classId).order('created_at', { ascending: false })) as unknown as (Sheet & { entries: { score: number | null; absent: boolean }[] })[],
  });
}

/** Teacher: titled score sheets for the class (e.g. "Mid-Sem Exams"). */
export function ScoreSheets({ classId, className }: { classId: string; className: string }) {
  const [params, setParams] = useSearchParams();
  const sheets = useSheets(classId);
  const sections = useSections(classId);
  const roster = useRoster(classId);
  const [editing, setEditing] = useState<Sheet | 'new' | null>(null);
  const open = params.get('sheet');
  const setOpen = (id: string | null) => setParams((p) => { if (id) p.set('sheet', id); else p.delete('sheet'); return p; }, { replace: true });
  const current = sheets.data?.find((s) => s.id === open);
  if (sheets.isLoading) return <LoadingBlock />;
  if (current) return <ScoreEntry sheet={current} className={className} roster={roster.data ?? []} sectionName={sections.data?.find((s) => s.id === current.section_id)?.name} onBack={() => setOpen(null)} onEdit={() => setEditing(current)} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-600">Record exam and test scores and share them <b>privately</b> — each student sees only their own score, and is notified when you release it.</p>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>New score sheet</Button>
      </div>
      {sheets.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sheets.data.map((s) => {
          const done = s.entries.filter((e) => e.score != null || e.absent).length;
          const scored = s.entries.filter((e) => e.score != null).map((e) => Number(e.score));
          const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
          const total = s.section_id ? (roster.data ?? []).filter((r) => r.section_id === s.section_id).length : roster.data?.length ?? 0;
          return (
            <button key={s.id} onClick={() => setOpen(s.id)} className="card p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300">
              <div className="flex items-start gap-2"><p className="min-w-0 flex-1 font-bold">{s.title}</p>{s.status === 'released' ? <Badge tone="green" icon={<Send className="h-3 w-3" />}>Released</Badge> : <Badge icon={<Lock className="h-3 w-3" />}>Draft</Badge>}</div>
              <p className="mt-1 text-xs text-ink-500">{CATEGORIES.find((c) => c.v === s.category)?.label} · out of {Number(s.max_score)}{s.section_id ? ` · ${sections.data?.find((x) => x.id === s.section_id)?.name ?? ''}` : ''} · {fmtDate(s.created_at)}</p>
              <div className="mt-3 flex items-center gap-2"><ProgressBar value={total ? (done / total) * 100 : 0} className="flex-1" /><span className="text-xs font-semibold text-ink-600">{done}/{total} entered</span></div>
              {avg != null && <p className="mt-2 text-sm text-ink-600">Average <b>{Math.round(avg * 10) / 10}</b> ({pct(avg, s.max_score)}%)</p>}
            </button>
          );
        })}</div>
      ) : <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No score sheets yet" description="Create one for your mid-semester exams, class tests or projects." action={<Button onClick={() => setEditing('new')}>Create a score sheet</Button>} />}
      <SheetDialog classId={classId} sheet={editing} onClose={(id) => { setEditing(null); if (id) setOpen(id); }} sections={sections.data ?? []} />
    </div>
  );
}

function SheetDialog({ classId, sheet, onClose, sections }: { classId: string; sheet: Sheet | 'new' | null; onClose: (openId?: string) => void; sections: { id: string; name: string }[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = sheet === 'new';
  const [f, setF] = useState({ title: '', category: 'exam', max_score: '100', section_id: '', show_class_stats: false, description: '' });
  useEffect(() => {
    if (sheet && sheet !== 'new') setF({ title: sheet.title, category: sheet.category, max_score: String(Number(sheet.max_score)), section_id: sheet.section_id ?? '', show_class_stats: sheet.show_class_stats, description: sheet.description ?? '' });
    else if (sheet === 'new') setF({ title: '', category: 'exam', max_score: '100', section_id: '', show_class_stats: false, description: '' });
  }, [sheet]);
  const save = useMutation({
    mutationFn: async () => {
      const row = { title: f.title.trim(), category: f.category, max_score: Number(f.max_score), section_id: f.section_id || null, show_class_stats: f.show_class_stats, description: f.description.trim() || null };
      if (isNew) return unwrap(await supabase.from('score_sheets').insert({ ...row, class_id: classId, created_by: user!.id }).select('id').single());
      return unwrap(await supabase.from('score_sheets').update(row).eq('id', (sheet as Sheet).id).select('id').single());
    },
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['score-sheets', classId] }); onClose(isNew ? r.id : undefined); toast.success(isNew ? 'Score sheet created' : 'Saved', isNew ? 'Now type in the scores. They stay private until you release them.' : undefined); },
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  const max = Number(f.max_score);
  return (
    <Dialog open={Boolean(sheet)} onOpenChange={(o) => !o && onClose()} title={isNew ? 'New score sheet' : 'Score sheet settings'}
      footer={<><Button variant="secondary" onClick={() => onClose()}>Cancel</Button><Button disabled={f.title.trim().length < 2 || !(max > 0 && max <= 10000)} loading={save.isPending} onClick={() => save.mutate()}>{isNew ? 'Create & enter scores' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <Field label="Title" required hint="What students will see, e.g. “Mid-Sem Exams”."><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} list="score-titles" autoFocus /></Field>
        <datalist id="score-titles">{TITLE_IDEAS.map((t) => <option key={t} value={t} />)}</datalist>
        <div className="flex flex-wrap gap-1.5">{TITLE_IDEAS.map((t) => <button key={t} type="button" onClick={() => setF({ ...f, title: t })} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 hover:border-brand-300">{t}</button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select></Field>
          <Field label="Marked out of" required><Input type="number" inputMode="decimal" min={1} max={10000} value={f.max_score} onChange={(e) => setF({ ...f, max_score: e.target.value })} /></Field>
        </div>
        {sections.length > 0 && <Field label="For" hint="Choose a school class if only some students wrote this."><Select value={f.section_id} onChange={(e) => setF({ ...f, section_id: e.target.value })}><option value="">Everyone in the class</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name} only</option>)}</Select></Field>}
        <Field label="Note to students (optional)"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={1000} /></Field>
        <Checkbox label="Show students the class average and highest score" description="Names and other students’ scores are never shown." checked={f.show_class_stats} onChange={(e) => setF({ ...f, show_class_stats: e.target.checked })} />
      </div>
    </Dialog>
  );
}

type SaveState = 'saving' | 'saved' | 'error';

function ScoreEntry({ sheet, className, roster, sectionName, onBack, onEdit }: { sheet: Sheet; className: string; roster: RosterRow[]; sectionName?: string; onBack: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useSections(sheet.class_id);
  const entries = useQuery({ queryKey: ['score-entries', sheet.id], queryFn: async () => unwrap(await supabase.from('score_entries').select('user_id, score, absent, remark').eq('sheet_id', sheet.id)) as Entry[] });
  const [draft, setDraft] = useState<Record<string, { score: string; absent: boolean; remark: string }>>({});
  const [state, setState] = useState<Record<string, SaveState>>({});
  const [q, setQ] = useState('');
  const [section, setSection] = useState(sheet.section_id ?? 'all');
  const [sort, setSort] = useState<'name' | 'high' | 'low' | 'missing'>('name');
  const [paste, setPaste] = useState(false);
  const [confirm, setConfirm] = useState<'release' | 'unrelease' | 'delete' | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const max = Number(sheet.max_score);

  useEffect(() => {
    setDraft(Object.fromEntries((entries.data ?? []).map((e) => [e.user_id, { score: e.score == null ? '' : String(Number(e.score)), absent: e.absent, remark: e.remark ?? '' }])));
  }, [entries.data]);

  const students = useMemo(() => roster.filter((r) => !sheet.section_id || r.section_id === sheet.section_id), [roster, sheet.section_id]);
  const val = (uid: string) => draft[uid] ?? { score: '', absent: false, remark: '' };
  const num = (uid: string) => { const v = val(uid).score.trim(); return v === '' ? null : Number(v); };
  const shown = useMemo(() => {
    const list = students.filter((r) => matchesSearch(r, q) && (section === 'all' || (section === 'none' ? !r.section_id : r.section_id === section)));
    return list.sort((a, b) => {
      if (sort === 'high') return (num(b.user_id) ?? -1) - (num(a.user_id) ?? -1);
      if (sort === 'low') return (num(a.user_id) ?? 1e9) - (num(b.user_id) ?? 1e9);
      if (sort === 'missing') return Number(num(a.user_id) != null || val(a.user_id).absent) - Number(num(b.user_id) != null || val(b.user_id).absent) || a.full_name.localeCompare(b.full_name);
      return a.full_name.localeCompare(b.full_name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, q, section, sort, sort === 'name' ? null : draft]);

  const saveRow = async (uid: string, next = val(uid)) => {
    const s = next.score.trim();
    const n = s === '' ? null : Number(s);
    if (n != null && (Number.isNaN(n) || n < 0 || n > max)) { setState((m) => ({ ...m, [uid]: 'error' })); return; }
    const prev = entries.data?.find((e) => e.user_id === uid);
    if (prev && (prev.score == null ? null : Number(prev.score)) === n && prev.absent === next.absent && (prev.remark ?? '') === next.remark.trim()) return;
    if (!prev && n == null && !next.absent && !next.remark.trim()) return;
    setState((m) => ({ ...m, [uid]: 'saving' }));
    const { error } = await supabase.from('score_entries').upsert({ sheet_id: sheet.id, user_id: uid, score: next.absent ? null : n, absent: next.absent, remark: next.remark.trim() || null }, { onConflict: 'sheet_id,user_id' });
    setState((m) => ({ ...m, [uid]: error ? 'error' : 'saved' }));
    if (error) toast.error('Score not saved', error.message);
    else void qc.invalidateQueries({ queryKey: ['score-entries', sheet.id] });
  };
  const focusRow = (i: number) => { const r = shown[i]; if (r) { const el = inputs.current[r.user_id]; el?.focus(); el?.select(); } };

  const scored = students.map((r) => num(r.user_id)).filter((n): n is number => n != null && !Number.isNaN(n));
  const done = students.filter((r) => num(r.user_id) != null || val(r.user_id).absent).length;
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const passMark = max / 2;
  const status = useMutation({
    mutationFn: async (s: 'released' | 'draft') => unwrap(await supabase.from('score_sheets').update({ status: s }).eq('id', sheet.id)),
    onSuccess: (_d, s) => { setConfirm(null); void qc.invalidateQueries({ queryKey: ['score-sheets', sheet.class_id] }); toast.success(s === 'released' ? 'Scores released' : 'Scores hidden again', s === 'released' ? 'Each student was notified privately.' : undefined); },
    onError: (e) => toast.error('Could not update', errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: async () => unwrap(await supabase.from('score_sheets').delete().eq('id', sheet.id)),
    onSuccess: () => { setConfirm(null); void qc.invalidateQueries({ queryKey: ['score-sheets', sheet.class_id] }); onBack(); },
  });

  if (entries.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <PageHeader title={sheet.title}
        eyebrow={`${className}${sectionName ? ` · ${sectionName}` : ''} · out of ${max}`}
        description={sheet.status === 'released' ? `Released ${sheet.released_at ? fmtDate(sheet.released_at) : ''} — students can see their own score. Changes you make now are shared too.` : 'Draft — only you can see these scores until you release them.'}
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>Back</Button>
          <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={onEdit}>Settings</Button>
          {sheet.status === 'released'
            ? <Button variant="secondary" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => setConfirm('unrelease')}>Hide from students</Button>
            : <Button leftIcon={<Send className="h-4 w-4" />} disabled={!done} onClick={() => setConfirm('release')}>Release to students</Button>}
        </div>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entered" value={`${done}/${students.length}`} />
        <Stat label="Average" value={avg == null ? '—' : `${Math.round(avg * 10) / 10} (${pct(avg, max)}%)`} />
        <Stat label="Highest / lowest" value={scored.length ? `${Math.max(...scored)} / ${Math.min(...scored)}` : '—'} />
        <Stat label={`At least half (${passMark})`} value={scored.length ? `${scored.filter((s) => s >= passMark).length}` : '—'} />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a student’s name to find them…" aria-label="Find a student" className="pl-9"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRow(0); } }} /></div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {!sheet.section_id && (sections.data?.length ?? 0) > 0 && <Select value={section} onChange={(e) => setSection(e.target.value)} aria-label="School class" className="sm:w-44"><option value="all">All school classes</option>{sections.data!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="none">Not chosen</option></Select>}
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Order" className="sm:w-40"><option value="name">Name (A–Z)</option><option value="missing">Not entered first</option><option value="high">Highest first</option><option value="low">Lowest first</option></Select>
          <Button variant="secondary" leftIcon={<ClipboardPaste className="h-4 w-4" />} onClick={() => setPaste(true)}>Paste</Button>
          <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv(`${sheet.title.replace(/[^\w]+/g, '-')}.csv`, [
            ['Full name', 'School class', `Score (out of ${max})`, 'Percent', 'Absent', 'Remark'],
            ...students.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((r) => [r.full_name, r.section_name, num(r.user_id), pct(num(r.user_id), max), val(r.user_id).absent ? 'yes' : '', val(r.user_id).remark]),
          ])}>Export</Button>
        </div>
      </div>
      <p className="text-xs text-ink-500">Tip: type a score and press <kbd className="rounded border border-ink-200 px-1">Enter</kbd> to jump to the next student. Scores save automatically.</p>

      {students.length ? (
        <ol className="overflow-hidden rounded-2xl border border-ink-100 bg-surface" data-no-contrast>
          {shown.map((r, i) => {
            const v = val(r.user_id);
            const n = num(r.user_id);
            const bad = n != null && (Number.isNaN(n) || n < 0 || n > max);
            const p = bad ? null : pct(n, max);
            return (
              <li key={r.user_id} className={cn('grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-ink-100 px-3 py-2.5 last:border-0 sm:grid-cols-[2rem_1fr_7rem_4rem_auto_minmax(8rem,14rem)_1.5rem] sm:px-4', i % 2 && 'bg-ink-50/40')}>
                <span className="hidden text-xs font-semibold text-ink-400 sm:block">{i + 1}</span>
                <div className="min-w-0"><p className="truncate font-semibold">{r.full_name}</p>{(r.section_name || r.display_name) && <p className="truncate text-xs text-ink-500">{r.section_name}{r.section_name && r.display_name ? ' · ' : ''}{r.display_name ? `“${r.display_name}”` : ''}</p>}</div>
                <div className="flex items-center gap-1">
                  <input ref={(el) => { inputs.current[r.user_id] = el; }} value={v.absent ? '' : v.score} disabled={v.absent} inputMode="decimal" aria-label={`Score for ${r.full_name}`} placeholder={v.absent ? 'Absent' : '–'}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.user_id]: { ...v, score: e.target.value.replace(/[^\d.]/g, '') } }))}
                    onBlur={() => void saveRow(r.user_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); void saveRow(r.user_id); focusRow(i + 1); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); void saveRow(r.user_id); focusRow(i - 1); }
                    }}
                    className={cn('h-10 w-20 rounded-xl border bg-surface px-2 text-center text-lg font-bold tabular-nums focus:outline-none focus:ring-2', bad ? 'border-red-400 text-red-700 focus:ring-red-200' : 'border-ink-200 focus:border-brand-500 focus:ring-brand-200')} />
                  <span className="text-xs text-ink-400">/{max}</span>
                </div>
                <span className={cn('hidden text-sm font-semibold tabular-nums sm:block', p == null ? 'text-ink-300' : p >= 50 ? 'text-growth-700' : 'text-red-700')}>{p == null ? '' : `${p}%`}</span>
                <label className="col-span-2 flex items-center gap-1.5 text-xs font-medium text-ink-600 sm:col-span-1"><input type="checkbox" checked={v.absent} className="h-4 w-4 accent-brand-600"
                  onChange={(e) => { const next = { ...v, absent: e.target.checked }; setDraft((d) => ({ ...d, [r.user_id]: next })); void saveRow(r.user_id, next); }} />Absent</label>
                <input value={v.remark} onChange={(e) => setDraft((d) => ({ ...d, [r.user_id]: { ...v, remark: e.target.value } }))} onBlur={() => void saveRow(r.user_id)} maxLength={300}
                  placeholder="Remark (optional)" aria-label={`Remark for ${r.full_name}`} className="col-span-2 h-9 rounded-lg border border-ink-200 bg-surface px-2 text-sm sm:col-span-1" />
                <span className="hidden sm:block" aria-live="polite">{state[r.user_id] === 'saved' ? <Check className="h-4 w-4 text-growth-600" aria-label="Saved" /> : state[r.user_id] === 'saving' ? <span className="block h-3 w-3 animate-pulse rounded-full bg-brand-400" aria-label="Saving" /> : state[r.user_id] === 'error' ? <span className="text-xs font-bold text-red-600" aria-label="Not saved">!</span> : null}</span>
                {bad && <p className="col-span-2 text-xs font-semibold text-red-600 sm:col-span-7">Enter a number from 0 to {max}.</p>}
              </li>
            );
          })}
          {!shown.length && <li className="p-6 text-center text-sm text-ink-500">No students match “{q}”.</li>}
        </ol>
      ) : <EmptyState title="No students to score" description={sheet.section_id ? 'No one has chosen this school class yet.' : 'Students appear here once they join the class.'} />}

      <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('delete')}>Delete this score sheet</Button>

      <PasteDialog open={paste} onOpenChange={setPaste} students={shown} max={max} onApply={async (rows) => {
        for (const [uid, score] of rows) {
          const next = { ...val(uid), score: String(score), absent: false };
          setDraft((d) => ({ ...d, [uid]: next }));
          await saveRow(uid, next);
        }
        toast.success(`${rows.length} scores filled in`);
      }} />
      <ConfirmDialog open={confirm === 'release'} onOpenChange={(o) => !o && setConfirm(null)} title={`Release “${sheet.title}”?`} confirmLabel="Release scores" loading={status.isPending} onConfirm={() => status.mutate('released')}
        description={`${done} student${done === 1 ? '' : 's'} will be notified privately and can see only their own score.${done < students.length ? ` ${students.length - done} without a score will not see this sheet yet.` : ''}`} />
      <ConfirmDialog open={confirm === 'unrelease'} onOpenChange={(o) => !o && setConfirm(null)} title="Hide these scores from students?" confirmLabel="Hide scores" loading={status.isPending} onConfirm={() => status.mutate('draft')} description="Students will no longer see this score sheet until you release it again." />
      <ConfirmDialog open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this score sheet?" tone="danger" confirmLabel="Delete" loading={del.isPending} onConfirm={() => del.mutate()} description="All scores on it will be permanently removed." />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card p-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-1 text-lg font-extrabold tabular-nums">{value}</p></div>;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

/** Paste a column of scores (in the order shown) or "Name, score" lines copied from Excel/Sheets. */
function PasteDialog({ open, onOpenChange, students, max, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; students: RosterRow[]; max: number; onApply: (rows: [string, number][]) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const matched: [string, number][] = [];
    const problems: string[] = [];
    const onlyNumbers = lines.every((l) => /^\d+(\.\d+)?$/.test(l));
    lines.forEach((line, i) => {
      if (onlyNumbers) {
        const s = students[i];
        if (!s) problems.push(`Line ${i + 1}: more scores than students`);
        else if (Number(line) > max) problems.push(`${s.full_name}: ${line} is above ${max}`);
        else matched.push([s.user_id, Number(line)]);
        return;
      }
      const m = line.match(/^(.*?)[\t,;:]+\s*(\d+(?:\.\d+)?)\s*$/);
      if (!m) { problems.push(`Line ${i + 1}: “${line}” — expected a name and a score`); return; }
      const name = norm(m[1]);
      const hits = students.filter((s) => norm(s.full_name) === name || norm(s.display_name ?? '') === name);
      const loose = hits.length ? hits : students.filter((s) => norm(s.full_name).includes(name) || name.includes(norm(s.full_name)) || norm(s.full_name).split(' ').every((w) => name.includes(w)));
      if (loose.length !== 1) problems.push(`${m[1]}: ${loose.length ? 'more than one student matches' : 'no student with this name'}`);
      else if (Number(m[2]) > max) problems.push(`${m[1]}: ${m[2]} is above ${max}`);
      else matched.push([loose[0].user_id, Number(m[2])]);
    });
    return { matched, problems, onlyNumbers };
  }, [text, students, max]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Paste scores" description="Copy from Excel, Google Sheets or WhatsApp and paste here."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!parsed.matched.length} loading={busy} onClick={async () => { setBusy(true); await onApply(parsed.matched); setBusy(false); setText(''); onOpenChange(false); }}>Fill in {parsed.matched.length} score{parsed.matched.length === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-600">Either one score per line, in the same order as the list on screen, <b>or</b> a name and score on each line (e.g. <code>Kofi Appiah, 42</code>).</p>
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Kofi Appiah\t42\nAma Serwaa\t37'} aria-label="Pasted scores" className="font-mono text-sm" />
        {text && <p className="text-sm text-growth-700">{parsed.matched.length} matched{parsed.onlyNumbers ? ' in list order' : ' by name'}.</p>}
        {parsed.problems.length > 0 && <Alert tone="warning" title="Check these lines"><ul className="list-disc pl-5 text-sm">{parsed.problems.slice(0, 10).map((p) => <li key={p}>{p}</li>)}</ul></Alert>}
      </div>
    </Dialog>
  );
}

type MyScore = { sheet_id: string; title: string; category: string; description: string | null; class_id: string; class_name: string; max_score: number; score: number | null; absent: boolean;
  remark: string | null; released_at: string; class_average: number | null; class_highest: number | null; entries: number | null };

/** Learner: your released scores (only yours). */
export function MyScores({ classId }: { classId?: string }) {
  const q = useQuery({ queryKey: ['my-scores'], queryFn: async () => (unwrap(await supabase.rpc('my_scores')) ?? []) as MyScore[] });
  if (q.isLoading) return <LoadingBlock />;
  const rows = (q.data ?? []).filter((r) => !classId || r.class_id === classId);
  if (!rows.length) return <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No scores yet" description="When your teacher releases exam or test scores, they appear here. Only you can see them." />;
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm text-ink-500"><Lock className="h-4 w-4" />Only you and your teachers can see these scores.</p>
      <div className="grid gap-3 md:grid-cols-2">{rows.map((r) => {
        const p = pct(r.score, r.max_score);
        return (
          <Card key={r.sheet_id}><CardBody>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{r.title}</p>
                <p className="text-xs text-ink-500">{!classId && `${r.class_name} · `}{CATEGORIES.find((c) => c.v === r.category)?.label} · {fmtDate(r.released_at)}</p>
              </div>
              {p != null && p >= 80 && <Trophy className="h-6 w-6 text-sun-500" aria-label="Excellent" />}
            </div>
            {r.absent ? <p className="mt-3 text-lg font-bold text-ink-600">Marked absent</p> : (
              <div className="mt-3 flex items-end gap-3">
                <p className="text-4xl font-extrabold tabular-nums leading-none">{Number(r.score)}<span className="text-lg font-bold text-ink-400">/{Number(r.max_score)}</span></p>
                <Badge tone={p != null && p >= 50 ? 'green' : 'red'}>{p}%</Badge>
              </div>
            )}
            {p != null && <ProgressBar value={p} tone={p >= 50 ? 'green' : 'amber'} className="mt-3" />}
            {r.remark && <p className="mt-3 rounded-xl bg-ink-50 p-3 text-sm text-ink-700"><b>Teacher’s remark:</b> {r.remark}</p>}
            {r.description && <p className="mt-2 text-sm text-ink-600">{r.description}</p>}
            {r.class_average != null && <p className="mt-2 text-xs text-ink-500">Class average {Number(r.class_average)} · highest {Number(r.class_highest)} · {r.entries} scored</p>}
          </CardBody></Card>
        );
      })}</div>
    </div>
  );
}

export function MyScoresPage() {
  return <div><PageHeader title="My scores" description="Exam and test scores your teachers have shared with you privately." /><MyScores /></div>;
}

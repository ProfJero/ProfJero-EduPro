import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { BookOpen, Bus, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, FileText, PartyPopper, PencilRuler, Bell, Sun as SunIcon, Video, XCircle, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardBody, Checkbox, Dialog, Field, Input, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtTime, localInputToIso } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useManagedCourses, useTeachingClasses } from '@/features/teachers/queries';

const KIND: Record<string, { icon: typeof Video; cls: string; label: string }> = {
  live: { icon: Video, cls: 'bg-brand-100 text-brand-800', label: 'Live class' },
  assignment: { icon: FileText, cls: 'bg-sun-100 text-sun-700', label: 'Assignment due' },
  assessment: { icon: ClipboardCheck, cls: 'bg-violet-100 text-violet-700', label: 'Assessment' },
  'event:lesson': { icon: BookOpen, cls: 'bg-growth-100 text-growth-700', label: 'Lesson' },
  'event:test': { icon: PencilRuler, cls: 'bg-red-100 text-red-700', label: 'Test / exam' },
  'event:revision': { icon: BookOpen, cls: 'bg-teal-100 text-teal-700', label: 'Revision' },
  'event:deadline': { icon: FileText, cls: 'bg-orange-100 text-orange-700', label: 'Deadline' },
  'event:event': { icon: PartyPopper, cls: 'bg-pink-100 text-pink-700', label: 'Event' },
  'event:trip': { icon: Bus, cls: 'bg-sky-100 text-sky-700', label: 'Trip' },
  'event:holiday': { icon: SunIcon, cls: 'bg-amber-100 text-amber-700', label: 'Holiday' },
  'event:reminder': { icon: Bell, cls: 'bg-ink-100 text-ink-700', label: 'Reminder' },
};
const EVENT_KINDS = Object.entries(KIND).filter(([k]) => k.startsWith('event:')).map(([k, v]) => [k.slice(6), v.label] as const);

export function CalendarPage() {
  const [params] = useSearchParams();
  const initial = params.get('d') ? new Date(`${params.get('d')}T12:00:00`) : new Date();
  const [month, setMonth] = useState(() => startOfMonth(initial));
  const [selected, setSelected] = useState(() => initial);
  const [creating, setCreating] = useState(false);
  const { workspaces } = useAuth();
  const teaches = workspaces.some((w) => w.kind === 'teacher');
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const events = useQuery({
    queryKey: ['calendar', from.toISOString()],
    queryFn: async () => unwrap(await supabase.rpc('my_calendar', { p_from: from.toISOString(), p_to: addDays(to, 1).toISOString() })),
  });
  const days = useMemo(() => { const out: Date[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }, [from.getTime(), to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = (d: Date) => (events.data ?? []).filter((e) => isSameDay(new Date(e.starts_at), d));
  const dayEvents = on(selected);
  const ics = () => {
    const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
    const stamp = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const body = (events.data ?? []).map((e) => `BEGIN:VEVENT\r\nUID:${e.kind}-${e.id}@profjero-edu\r\nDTSTAMP:${stamp(new Date().toISOString())}\r\nDTSTART:${stamp(e.starts_at)}\r\nDTEND:${stamp(e.ends_at ?? e.starts_at)}\r\nSUMMARY:${esc(e.title)}\r\nDESCRIPTION:${esc(`${KIND[e.kind]?.label ?? e.kind} · ${e.context ?? ''}`)}\r\nEND:VEVENT`).join('\r\n');
    const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ProfJero Edu//Calendar//EN\r\n${body}\r\nEND:VCALENDAR`], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `profjero-${format(month, 'yyyy-MM')}.ics`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Lessons, tests, live classes, deadlines and events from all your classes and courses." actions={<>
        {teaches && <Button leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>Schedule</Button>}
        <Button variant="secondary" onClick={ics} disabled={!events.data?.length}>Export (.ics)</Button></>} />
      {creating && <ScheduleDialog date={selected} onClose={() => setCreating(false)} />}
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card><CardBody>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>Today</Button>
              <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button></div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 text-sm">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="bg-ink-50 py-1.5 text-center text-xs font-bold uppercase text-ink-500">{d}</div>)}
            {days.map((d) => { const list = on(d); return (
              <button key={d.toISOString()} onClick={() => setSelected(d)} aria-pressed={isSameDay(d, selected)} aria-label={`${format(d, 'd MMMM')}, ${list.length} events`}
                className={cn('min-h-[4.5rem] bg-surface p-1.5 text-left align-top transition hover:bg-brand-50/50', !isSameMonth(d, month) && 'text-ink-300', isSameDay(d, selected) && 'ring-2 ring-inset ring-brand-500')}>
                <span className={cn('inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold', isSameDay(d, new Date()) && 'bg-brand-600 text-white')}>{format(d, 'd')}</span>
                <div className="mt-0.5 space-y-0.5">{list.slice(0, 2).map((e) => <span key={e.kind + e.id} className={cn('block truncate rounded px-1 text-[0.65rem] font-semibold', KIND[e.kind]?.cls)}>{e.title}</span>)}{list.length > 2 && <span className="block text-[0.65rem] text-ink-500">+{list.length - 2} more</span>}</div>
              </button>
            ); })}
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <h2 className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5 text-brand-600" />{format(selected, 'EEEE d MMMM')}</h2>
          {dayEvents.length ? <ul className="mt-3 space-y-2">{dayEvents.map((e) => { const k = KIND[e.kind] ?? KIND.live; return (
            <li key={e.kind + e.id} className="group relative"><EventActions e={e} /><Link to={e.link ?? '/calendar'} className={cn('flex gap-3 rounded-xl border border-ink-200 p-3 hover:border-brand-300', e.status === 'cancelled' && 'opacity-60 line-through')}>
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', k.cls)}><k.icon className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block truncate font-semibold">{e.title}</span><span className="text-xs text-ink-500">{fmtTime(e.starts_at)} · {e.context}</span>{e.status && e.status !== 'scheduled' && <Badge className="ml-1">{e.status}</Badge>}</span>
            </Link></li>
          ); })}</ul> : <p className="mt-3 text-sm text-ink-500">Nothing scheduled.</p>}
          <div className="mt-5 space-y-1 border-t border-ink-100 pt-3 text-xs">{Object.values(KIND).map((k) => <p key={k.label} className="flex items-center gap-2"><span className={cn('h-3 w-3 rounded', k.cls)} />{k.label}</p>)}</div>
        </CardBody></Card>
      </div>
    </div>
  );
}

function EventActions({ e }: { e: { kind: string; id: string; status: string | null } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const mine = useQuery({ queryKey: ['event-own', e.id], enabled: e.kind.startsWith('event:') && Boolean(user), staleTime: 60_000,
    queryFn: async () => (unwrap(await supabase.from('class_events').select('created_by').eq('id', e.id).maybeSingle()))?.created_by === user!.id });
  const act = useMutation({
    mutationFn: async (what: 'cancel' | 'delete') => what === 'cancel' ? unwrap(await supabase.from('class_events').update({ is_cancelled: true }).eq('id', e.id)) : unwrap(await supabase.from('class_events').delete().eq('id', e.id)),
    onSuccess: (_d, w) => { toast.success(w === 'cancel' ? 'Event cancelled — members notified' : 'Event deleted'); void qc.invalidateQueries({ queryKey: ['calendar'] }); },
    onError: (err) => toast.error('Could not update', errorMessage(err)),
  });
  if (!mine.data) return null;
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
      {e.status !== 'cancelled' && <button className="rounded-lg bg-surface p-1 text-ink-500 shadow hover:text-sun-700" title="Cancel event" onClick={() => act.mutate('cancel')}><XCircle className="h-4 w-4" /></button>}
      <button className="rounded-lg bg-surface p-1 text-ink-500 shadow hover:text-red-600" title="Delete" onClick={() => act.mutate('delete')}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function ScheduleDialog({ date, onClose }: { date: Date; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const classes = useTeachingClasses();
  const courses = useManagedCourses();
  const day = format(date, 'yyyy-MM-dd');
  const [f, setF] = useState({ title: '', kind: 'lesson', scope: '', day, start: '08:00', end: '09:00', allDay: false, location: '', description: '', remind: 60, repeat: 1 });
  const save = useMutation({
    mutationFn: async () => {
      const [t, id] = f.scope.split(':');
      if (!id) throw new Error('Choose a class or course.');
      if (f.title.trim().length < 2) throw new Error('Add a title.');
      const rows = Array.from({ length: f.repeat }, (_, i) => {
        const d = addDays(new Date(`${f.day}T00:00:00`), i * 7);
        const ds = format(d, 'yyyy-MM-dd');
        return {
          title: f.title.trim(), kind: f.kind, description: f.description.trim() || null, location: f.location.trim() || null, created_by: user!.id,
          class_id: t === 'class' ? id : null, course_id: t === 'course' ? id : null, all_day: f.allDay, remind_minutes: f.remind,
          starts_at: localInputToIso(`${ds}T${f.allDay ? '00:00' : f.start}`)!, ends_at: f.allDay ? null : localInputToIso(`${ds}T${f.end}`),
        };
      });
      unwrap(await supabase.from('class_events').insert(rows));
    },
    onSuccess: () => { toast.success(f.repeat > 1 ? `${f.repeat} weekly events scheduled` : 'Scheduled', 'Members were notified and will get a reminder.'); void qc.invalidateQueries({ queryKey: ['calendar'] }); onClose(); },
    onError: (e) => toast.error('Could not schedule', errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Schedule for your class" description="Members see it in their calendar and get notified."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()} leftIcon={<CalendarPlus className="h-4 w-4" />}>Schedule & notify</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} placeholder="Chemistry practical: titration" /></Field>
          <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{EVENT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        </div>
        <Field label="For" required><Select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}><option value="">Choose…</option>
          {(classes.data ?? []).length > 0 && <optgroup label="Classes">{classes.data!.map((c) => <option key={c.id} value={`class:${c.id}`}>{c.name}</option>)}</optgroup>}
          {(courses.data ?? []).length > 0 && <optgroup label="Courses">{courses.data!.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.title}</option>)}</optgroup>}
        </Select></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><Input type="date" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
          {!f.allDay && <><Field label="Starts"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field><Field label="Ends"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field></>}
        </div>
        <Checkbox label="All day" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Where (optional)"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={140} placeholder="Science lab / Online" /></Field>
          <Field label="Reminder"><Select value={f.remind} onChange={(e) => setF({ ...f, remind: Number(e.target.value) })}><option value={0}>No reminder</option><option value={15}>15 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></Select></Field>
          <Field label="Repeat weekly"><Select value={f.repeat} onChange={(e) => setF({ ...f, repeat: Number(e.target.value) })}>{[1, 2, 4, 6, 8, 12, 14].map((n) => <option key={n} value={n}>{n === 1 ? 'Does not repeat' : `${n} weeks`}</option>)}</Select></Field>
        </div>
        <Field label="Notes for learners"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} placeholder="Bring your lab coat and calculators." /></Field>
      </div>
    </Dialog>
  );
}

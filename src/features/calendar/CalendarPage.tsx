import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Video } from 'lucide-react';
import { Badge, Button, Card, CardBody, PageHeader } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

const KIND: Record<string, { icon: typeof Video; cls: string; label: string }> = {
  live: { icon: Video, cls: 'bg-brand-100 text-brand-800', label: 'Live class' },
  assignment: { icon: FileText, cls: 'bg-sun-100 text-sun-700', label: 'Assignment due' },
  assessment: { icon: ClipboardCheck, cls: 'bg-violet-100 text-violet-700', label: 'Assessment' },
};

export function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
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
      <PageHeader title="Calendar" description="Live classes, assignment deadlines and assessments from all your courses and classes." actions={<Button variant="secondary" onClick={ics} disabled={!events.data?.length}>Export (.ics)</Button>} />
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
            <li key={e.kind + e.id}><Link to={e.link} className="flex gap-3 rounded-xl border border-ink-200 p-3 hover:border-brand-300">
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

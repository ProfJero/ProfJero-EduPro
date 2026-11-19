import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ExternalLink, PlayCircle, Video } from 'lucide-react';
import { Badge, Button, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { dayLabel, fmtTime, tzAbbrev } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { sessionPhase, type LiveSessionRow } from '@/features/learning/queries';
import { providerName } from './providers';

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useJoinSession() {
  const toast = useToast();
  return async (id: string) => {
    // Open the window synchronously (popup blockers), then navigate it.
    const w = window.open('about:blank', '_blank');
    if (w) w.opener = null;
    const { data, error } = await supabase.rpc('join_live_session', { p_session: id });
    if (error || !data) {
      w?.close();
      toast.error('Could not join', errorMessage(error));
      return;
    }
    if (w) w.location.href = data as string;
    else window.location.href = data as string;
  };
}

export function countdown(ms: number) {
  if (ms <= 0) return 'now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h} h ${m % 60} min`;
  return `in ${Math.floor(h / 24)} days`;
}

/** Timetable row — "period" style like a school day. */
export function SessionCard({ s, compact, manage }: { s: LiveSessionRow; compact?: boolean; manage?: React.ReactNode }) {
  const now = useNow();
  const phase = sessionPhase(s, now);
  const join = useJoinSession();
  const start = new Date(s.starts_at).getTime();
  return (
    <div className={cn('flex items-center gap-4 rounded-2xl border bg-white p-4 transition', phase === 'live' ? 'border-growth-500/60 shadow-[0_0_0_4px_rgb(22_163_106/0.08)]' : 'border-ink-200', phase === 'cancelled' && 'opacity-60')}>
      <div className={cn('flex w-16 shrink-0 flex-col items-center rounded-xl py-2 text-center', phase === 'live' ? 'bg-growth-600 text-white' : 'bg-ink-50 text-ink-800')}>
        <span className="text-[0.65rem] font-bold uppercase tracking-wide opacity-80">{dayLabel(s.starts_at)}</span>
        <span className="text-lg font-extrabold leading-tight">{fmtTime(s.starts_at)}</span>
        <span className="text-[0.6rem] opacity-70">{tzAbbrev()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {phase === 'live' && <Badge tone="green" icon={<span className="live-dot h-1.5 w-1.5 rounded-full bg-growth-500" />}>Live now</Badge>}
          {phase === 'cancelled' && <Badge tone="red">Cancelled</Badge>}
          {phase === 'ended' && <Badge>Ended</Badge>}
          <span className="text-xs font-medium text-ink-400">{providerName(s.provider)} · {s.duration_minutes} min</span>
        </div>
        <Link to={`/learn/live/${s.id}`} className="mt-0.5 block truncate font-bold text-ink-900 hover:text-brand-700">{s.title}</Link>
        {!compact && <p className="truncate text-sm text-ink-500">{s.course?.title ?? s.cls?.name}</p>}
        {phase === 'upcoming' && <p className="text-xs text-ink-500"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />Starts {countdown(start - now)}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {manage}
        {phase === 'live' && <Button size="sm" variant="success" leftIcon={<Video className="h-4 w-4" />} onClick={() => join(s.id)}>Join class</Button>}
        {phase === 'ended' && s.recording_url && <a href={s.recording_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><PlayCircle className="h-4 w-4" />Recording</a>}
        {phase === 'upcoming' && !manage && <Link to={`/learn/live/${s.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Details<ExternalLink className="h-3.5 w-3.5" /></Link>}
      </div>
    </div>
  );
}

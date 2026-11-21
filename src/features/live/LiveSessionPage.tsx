import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, Video, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, tzAbbrev } from '@/lib/dates';
import { LIVE_SELECT, sessionPhase, type LiveSessionRow } from '@/features/learning/queries';
import { useAuth } from '@/features/authentication/AuthProvider';
import { ClassroomPanel } from '@/features/classroom/ClassroomPanel';
import { countdown, useJoinSession, useNow } from './SessionCard';
import { providerName } from './providers';
import { JitsiRoom } from './JitsiRoom';

export function LiveSessionPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const now = useNow(15_000);
  const join = useJoinSession();
  const [inRoom, setInRoom] = useState(false);
  const { data: s, isLoading } = useQuery({
    queryKey: ['live-session', sessionId],
    queryFn: async () => unwrap(await supabase.from('live_sessions').select(LIVE_SELECT + ', agenda').eq('id', sessionId!).maybeSingle()) as unknown as (LiveSessionRow & { agenda: string | null; embed_in_app: boolean }) | null,
  });
  if (isLoading) return <LoadingBlock />;
  if (!s) return <EmptyState icon={<Video className="h-7 w-7" />} title="Session not found" description="It may have been removed, or you are not part of this class." />;
  const phase = sessionPhase(s, now);
  const isHost = s.host_id === user?.id;
  const inApp = s.provider === 'jitsi' && s.embed_in_app;
  const enterRoom = async () => {
    const { error } = await supabase.rpc('join_live_session', { p_session: s.id });
    if (!error) setInRoom(true);
  };
  return (
    <div className="space-y-6">
      <PageHeader back={{ to: '/learn/classes', label: 'Classes & timetable' }} eyebrow={`${providerName(s.provider)} · live class`} title={s.title} description={s.course?.title ?? s.cls?.name} />
      <Card className="overflow-hidden">
        <div className="board-surface flex flex-col gap-5 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            {phase === 'live' && <Badge tone="green" icon={<span className="live-dot h-2 w-2 rounded-full bg-growth-500" />}>Class in session</Badge>}
            {phase === 'cancelled' && <Badge tone="red">Cancelled</Badge>}
            <p className="flex items-center gap-2 text-white/85"><CalendarDays className="h-4 w-4" />{fmtDateTime(s.starts_at)} {tzAbbrev()}</p>
            <p className="flex items-center gap-2 text-white/85"><Clock className="h-4 w-4" />{s.duration_minutes} minutes{phase === 'upcoming' && ` · starts ${countdown(new Date(s.starts_at).getTime() - now)}`}</p>
          </div>
          {phase !== 'cancelled' && phase !== 'ended' && (
            inApp ? (
              <Button size="lg" className="bg-surface text-board-900 hover:bg-growth-50" leftIcon={<Video className="h-5 w-5" />} onClick={() => void enterRoom()} disabled={inRoom}>
                {inRoom ? 'You are in class' : isHost ? 'Start class here' : 'Enter the classroom'}
              </Button>
            ) : (
            <Button size="lg" className="bg-surface text-board-900 hover:bg-growth-50" leftIcon={<Video className="h-5 w-5" />} onClick={() => join(s.id)}>
              {isHost ? 'Open meeting' : phase === 'live' ? 'Join class now' : 'Open meeting link'}
            </Button>
            )
          )}
        </div>
        <CardBody className="space-y-4">
          {phase === 'cancelled' && <Alert tone="error" title="This session was cancelled">{s.cancel_reason}</Alert>}
          {phase === 'upcoming' && <Alert tone="info">You will get a reminder before class starts. Joining within 30 minutes of the start records your attendance.</Alert>}
          {s.description && <p className="whitespace-pre-wrap text-ink-700">{s.description}</p>}
          {s.agenda && <div><h2 className="font-bold">Agenda</h2><p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{s.agenda}</p></div>}
          {s.recording_url && <a className="inline-flex items-center gap-2 font-semibold text-brand-700" href={s.recording_url} target="_blank" rel="noopener noreferrer"><XCircle className="hidden" />Watch the recording</a>}
          <p className="text-xs text-ink-400">{inApp ? 'This class runs inside ProfJero Edu using Jitsi. Video is not recorded by ProfJero Edu.' : `Live classes happen on ${providerName(s.provider)}. ProfJero Edu does not record or host the video.`}</p>
        </CardBody>
      </Card>
      {inRoom && <JitsiRoom sessionId={s.id} joinUrl={s.join_url} title={s.title} onLeave={() => setInRoom(false)} />}
      <ClassroomPanel type="session" roomId={s.id} canModerate={isHost} title="Session chat" />
    </div>
  );
}

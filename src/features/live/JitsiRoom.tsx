import { useEffect, useRef, useState } from 'react';
import { Maximize2, PhoneOff } from 'lucide-react';
import { Alert, Button, Spinner } from '@/components/ui';
import { env } from '@/lib/env';
import { useAuth } from '@/features/authentication/AuthProvider';
import { errorMessage } from '@/lib/utils';
import { liveApi } from './liveApi';

type JitsiApi = { dispose: () => void; addListener: (e: string, fn: () => void) => void };
type JitsiCtor = new (domain: string, opts: Record<string, unknown>) => JitsiApi;
const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
  if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => { scripts.delete(src); rej(new Error('Could not load the meeting. Check your connection.')); }; document.head.appendChild(s); }));
  return scripts.get(src)!;
}
/** Extract the room name from a meet.jit.si / 8x8.vc link. */
export function jitsiRoomFromUrl(url: string) {
  try { const u = new URL(url); return decodeURIComponent(u.pathname.replace(/^\//, '').split('/').pop() ?? ''); } catch { return ''; }
}

/** In-platform Jitsi classroom via the official IFrame API (JaaS when configured). */
export function JitsiRoom({ sessionId, joinUrl, title, onLeave }: { sessionId: string; joinUrl: string; title: string; onLeave: () => void }) {
  const { profile, user } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testServer, setTestServer] = useState(false);
  useEffect(() => {
    let api: JitsiApi | null = null; let dead = false;
    (async () => {
      let cfg: { domain: string; room: string; jwt: string | null; moderator: boolean } = { domain: 'meet.jit.si', room: jitsiRoomFromUrl(joinUrl), jwt: null, moderator: false };
      if (env.apiBase) { try { cfg = await liveApi(`/api/live/jitsi-token?session=${sessionId}`); } catch { /* fall back to the public server */ } }
      if (!cfg.jwt) setTestServer(true);
      await loadScript(`https://${cfg.domain}/${cfg.jwt && cfg.domain === '8x8.vc' ? `${cfg.room.split('/')[0]}/` : ''}external_api.js`);
      if (dead || !box.current) return;
      const Ctor = (window as unknown as { JitsiMeetExternalAPI: JitsiCtor }).JitsiMeetExternalAPI;
      api = new Ctor(cfg.domain, {
        roomName: cfg.room, parentNode: box.current, width: '100%', height: '100%', jwt: cfg.jwt ?? undefined,
        userInfo: { displayName: profile?.display_name || profile?.full_name || 'Learner', email: profile?.is_guest ? undefined : user?.email },
        configOverwrite: { prejoinConfig: { enabled: true }, disableDeepLinking: true, startWithAudioMuted: !cfg.moderator, subject: title },
        interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false, MOBILE_APP_PROMO: false },
      });
      api.addListener('readyToClose', onLeave);
      setLoading(false);
    })().catch((e) => { setErr(errorMessage(e)); setLoading(false); });
    return () => { dead = true; api?.dispose(); };
  }, [sessionId, joinUrl, title]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-2">
      {testServer && <Alert tone="info">This class uses the free public Jitsi server, which is meant for short test calls. Ask your administrator to enable Jitsi as a Service for long classes.</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      <div className="relative h-[70vh] min-h-[24rem] overflow-hidden rounded-2xl bg-ink-950" ref={box}>
        {loading && <div className="absolute inset-0 grid place-items-center text-white"><Spinner /></div>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" leftIcon={<Maximize2 className="h-4 w-4" />} onClick={() => box.current?.requestFullscreen?.()}>Full screen</Button>
        <Button variant="danger" size="sm" leftIcon={<PhoneOff className="h-4 w-4" />} onClick={onLeave}>Leave class</Button>
      </div>
    </div>
  );
}

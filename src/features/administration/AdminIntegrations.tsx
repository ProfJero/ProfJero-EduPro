import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, Plug, RefreshCw } from 'lucide-react';
import { Alert, Button, Card, CardBody, PageHeader } from '@/components/ui';
import { env } from '@/lib/env';

type Health = { ok: boolean; features: Record<string, boolean> };
const ITEMS: { key: string; name: string; what: string; secrets: string }[] = [
  { key: 'supabase', name: 'Supabase connection', what: 'Lets the API verify signed-in users and call secure database functions.', secrets: 'SUPABASE_URL, SUPABASE_ANON_KEY (vars)' },
  { key: 'worker_secret', name: 'Database ↔ API shared secret', what: 'Authenticates push dispatch and the provider token vault.', secrets: 'WORKER_SECRET (also stored in private.app_config)' },
  { key: 'cloudinary', name: 'Cloudinary uploads', what: 'Device uploads for images, video, audio and documents.', secrets: 'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (on the Pages project) + VITE_CLOUDINARY_CLOUD_NAME' },
  { key: 'ai', name: 'AI Companion & Resource Studio', what: 'Claude-powered tutoring and teacher resource drafting.', secrets: 'ANTHROPIC_API_KEY' },
  { key: 'push', name: 'Push notifications', what: 'Notifications delivered while the app is closed.', secrets: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT' },
  { key: 'zoom', name: 'Zoom meetings', what: 'Teachers connect Zoom and create meetings from ProfJero Edu.', secrets: 'ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET' },
  { key: 'google', name: 'Google Meet', what: 'Teachers connect Google Calendar to create Meet links.', secrets: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET' },
  { key: 'jaas', name: 'Jitsi (JaaS) in-app classroom', what: 'Production Jitsi meetings embedded in the platform. Without it, the free meet.jit.si server is used for short test calls.', secrets: 'JAAS_APP_ID, JAAS_KID, JAAS_PRIVATE_KEY' },
  { key: 'code_runner', name: 'Server code runner', what: 'Runs C, C++, Java, Go, Rust and more in Code Lab (Python, JavaScript, SQL and web run in the browser).', secrets: 'JUDGE0_URL (+ JUDGE0_KEY)' },
];

export function AdminIntegrations() {
  const h = useQuery({
    queryKey: ['api-health'], enabled: Boolean(env.apiBase), retry: false,
    queryFn: async () => { const r = await fetch(`${env.apiBase}/api/health`); if (!r.ok) throw new Error(`API returned ${r.status}`); return (await r.json()) as Health; },
  });
  const site = useQuery({ queryKey: ['site-health'], retry: false, queryFn: async () => { const r = await fetch('/api/health'); return r.ok ? ((await r.json()) as { cloudinary?: boolean }) : {}; } });
  const features: Record<string, boolean> = { ...(h.data?.features ?? {}), cloudinary: Boolean(site.data?.cloudinary) };
  return (
    <div className="space-y-5">
      <PageHeader title="Integrations" description="Status of the ProfJero Edu API worker and the services it connects to. Secrets are set on the Cloudflare Worker — never in the website code."
        actions={<Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => { void h.refetch(); void site.refetch(); }} loading={h.isFetching}>Check again</Button>} />
      {!env.apiBase ? <Alert tone="warning">VITE_API_BASE is not set, so the site can’t reach the API worker.</Alert>
        : h.error ? <Alert tone="error" title="API unreachable">{(h.error as Error).message} — {env.apiBase}</Alert>
        : <Alert tone="info">API worker: <code className="font-mono">{env.apiBase}</code></Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((i) => { const on = Boolean(features[i.key]); return (
          <Card key={i.key}><CardBody className="flex gap-3">
            {on ? <CheckCircle2 className="h-6 w-6 shrink-0 text-growth-600" /> : <CircleDashed className="h-6 w-6 shrink-0 text-ink-300" />}
            <div className="min-w-0"><p className="font-bold">{i.name} <span className={on ? 'text-growth-700' : 'text-ink-400'}>· {on ? 'Configured' : 'Not configured'}</span></p>
              <p className="text-sm text-ink-600">{i.what}</p><p className="mt-1 text-xs text-ink-500"><Plug className="mr-1 inline h-3 w-3" />{i.secrets}</p></div>
          </CardBody></Card>
        ); })}
      </div>
      <p className="text-sm text-ink-500">To add a secret: Cloudflare dashboard → Workers &amp; Pages → profjero-edu-api → Settings → Variables and secrets (type “Secret”). See docs/INTEGRATIONS.md.</p>
    </div>
  );
}

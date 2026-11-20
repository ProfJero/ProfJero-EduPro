import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2, Unplug } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, useToast } from '@/components/ui';
import { env } from '@/lib/env';
import { fromNow } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import { liveApi, providerSlug, type Connections } from './liveApi';

const LIST = [
  { id: 'zoom', name: 'Zoom', text: 'Create Zoom meetings for your live classes without leaving ProfJero Edu.' },
  { id: 'google_meet', name: 'Google Meet', text: 'Create Google Meet links through your Google Calendar.' },
] as const;

export function ProviderConnections() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['provider-connections'], enabled: Boolean(env.apiBase), retry: false, queryFn: () => liveApi<Connections>('/api/live/connections') });
  const connect = useMutation({
    mutationFn: async (p: string) => (await liveApi<{ url: string }>(`/api/live/${providerSlug(p)}/oauth/start`)).url,
    onSuccess: (url) => { window.location.href = url; },
    onError: (e) => toast.error('Could not start the connection', errorMessage(e)),
  });
  const disconnect = useMutation({
    mutationFn: (p: string) => liveApi(`/api/live/${providerSlug(p)}/disconnect`, { method: 'POST', body: {} }),
    onSuccess: () => { toast.success('Disconnected'); void qc.invalidateQueries({ queryKey: ['provider-connections'] }); },
    onError: (e) => toast.error('Could not disconnect', errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader title="Meeting apps" description="Connect your own Zoom or Google account to create live-class meetings automatically. Your tokens are stored encrypted on the server — never in your browser." />
      <CardBody className="space-y-4">
        {!env.apiBase && <Alert tone="warning">The API service isn’t configured, so app connections are unavailable. You can still paste meeting links.</Alert>}
        {q.error && <Alert tone="error">{errorMessage(q.error)}</Alert>}
        {LIST.map((p) => {
          const conn = q.data?.connected.find((c) => c.provider === p.id);
          const available = q.data?.available[p.id as 'zoom' | 'google_meet'];
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">{p.name}{conn && <Badge tone="green" icon={<CheckCircle2 className="h-3 w-3" />}>Connected</Badge>}</p>
                <p className="text-sm text-ink-500">{conn ? `${conn.account_email ?? 'Account'} · connected ${fromNow(conn.connected_at)}` : p.text}</p>
                {q.data && !available && <p className="mt-1 text-xs text-ink-400">Not enabled by the platform administrator yet.</p>}
              </div>
              {conn ? <Button variant="ghost" leftIcon={<Unplug className="h-4 w-4" />} loading={disconnect.isPending} onClick={() => disconnect.mutate(p.id)}>Disconnect</Button>
                : <Button variant="secondary" leftIcon={<Link2 className="h-4 w-4" />} disabled={!available} loading={connect.isPending && connect.variables === p.id} onClick={() => connect.mutate(p.id)}>Connect</Button>}
            </div>
          );
        })}
        <p className="text-xs text-ink-500">Jitsi needs no account — choose “Jitsi Meet” when scheduling and tick “Hold the class inside ProfJero Edu”.</p>
      </CardBody>
    </Card>
  );
}

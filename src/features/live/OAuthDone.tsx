import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ButtonLink, Card, CardBody, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/utils';
import { liveApi } from './liveApi';

/** OAuth redirect target: exchanges the authorisation code via the API worker. */
export function OAuthDone() {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const [state, setState] = useState<{ status: 'working' | 'ok' | 'error'; message?: string }>({ status: 'working' });
  const ran = useRef(false);
  const name = provider === 'zoom' ? 'Zoom' : 'Google';
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get('code');
    const st = params.get('state');
    if (params.get('error') || !code || !st) { setState({ status: 'error', message: params.get('error_description') ?? params.get('error') ?? 'The connection was cancelled.' }); return; }
    liveApi<{ email?: string }>(`/api/live/${provider}/oauth/exchange`, { body: { code, state: st } })
      .then((r) => setState({ status: 'ok', message: r.email ? `Connected as ${r.email}.` : undefined }))
      .catch((e) => setState({ status: 'error', message: errorMessage(e) }));
    window.history.replaceState(null, '', window.location.pathname);
  }, [params, provider]);
  return (
    <div className="mx-auto max-w-md py-10">
      <Card><CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        {state.status === 'working' ? <><Spinner /><p>Connecting {name}…</p></> : state.status === 'ok' ? (
          <><CheckCircle2 className="h-12 w-12 text-growth-600" /><h1 className="text-xl font-extrabold">{name} connected</h1><p className="text-ink-600">{state.message} You can now create meetings when scheduling a live class.</p></>
        ) : (<><XCircle className="h-12 w-12 text-red-600" /><h1 className="text-xl font-extrabold">Couldn’t connect {name}</h1><p className="text-ink-600">{state.message}</p></>)}
        {state.status !== 'working' && <div className="mt-2 flex gap-2"><ButtonLink to="/settings?tab=apps" variant="secondary">Back to settings</ButtonLink><ButtonLink to="/teach/live">Live classes</ButtonLink></div>}
      </CardBody></Card>
    </div>
  );
}

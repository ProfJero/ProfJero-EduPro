/**
 * ProfJero Edu API worker (profjero-edu-api).
 * AI Companion & Resource Studio, Web Push dispatch, live-class providers
 * (Zoom, Google Meet, Jitsi/JaaS), server code execution and the Code Lab
 * preview sandbox. All privileged credentials live here as Worker secrets.
 */
import type { Env } from './env';
import { aiReady, chat, studio } from './ai';
import { codeReady, runCode } from './code';
import { labRunner } from './labRunner';
import { connections, createMeeting, disconnect, googleReady, jaasReady, jitsiToken, oauthExchange, oauthStart, zoomReady } from './live';
import { dispatch, pushReady } from './push';
import { HttpError, getUser, json } from './util';

function allowedOrigin(req: Request, env: Env) {
  const origin = req.headers.get('origin') ?? '';
  const list = (env.ALLOWED_ORIGINS || `${env.APP_URL || 'https://profjero-edupro.pages.dev'},http://localhost:5173,http://localhost:4173,http://localhost:8788`).split(',').map((s) => s.trim().replace(/\/$/, ''));
  if (list.includes(origin)) return origin;
  // Cloudflare Pages preview deployments of this project
  if (/^https:\/\/[a-z0-9-]+\.profjero-edupro\.pages\.dev$/.test(origin)) return origin;
  return null;
}
function withCors(res: Response, origin: string | null) {
  if (!origin) return res;
  const h = new Headers(res.headers);
  h.set('access-control-allow-origin', origin);
  h.set('vary', 'origin');
  h.set('access-control-allow-headers', 'authorization, content-type');
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  h.set('access-control-max-age', '86400');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function health(env: Env) {
  return json({
    ok: true, service: 'profjero-edu-api',
    features: {
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY), worker_secret: Boolean(env.WORKER_SECRET), ai: aiReady(env), push: pushReady(env),
      zoom: zoomReady(env), google: googleReady(env), jaas: jaasReady(env), code_runner: codeReady(env),
    },
  });
}

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  if (p === '/' || p === '/api/health') return health(env);
  if (p === '/lab-runner') return labRunner(env);
  if (p === '/api/push/dispatch' && req.method === 'POST') return dispatch(req, env);

  const user = await getUser(req, env);
  if (!user) return json({ error: 'Please sign in again.' }, 401);

  if (p === '/api/ai/chat' && req.method === 'POST') {
    const r = await chat(req, env, user);
    if (r instanceof Response) return r;
    ctx.waitUntil(r.work);
    return r.response;
  }
  if (p === '/api/ai/studio' && req.method === 'POST') return studio(req, env, user);
  if (p === '/api/code/run' && req.method === 'POST') return runCode(req, env, user);
  if (p === '/api/live/connections' && req.method === 'GET') return connections(env, user);
  if (p === '/api/live/jitsi-token' && req.method === 'GET') return jitsiToken(url, env, user);
  const m = /^\/api\/live\/(zoom|google)\/(oauth\/start|oauth\/exchange|meetings|disconnect)$/.exec(p);
  if (m) {
    const provider = m[1] as 'zoom' | 'google';
    if (m[2] === 'oauth/start' && req.method === 'GET') return oauthStart(env, user, provider);
    if (m[2] === 'oauth/exchange' && req.method === 'POST') return oauthExchange(req, env, user, provider);
    if (m[2] === 'meetings' && req.method === 'POST') return createMeeting(req, env, user, provider);
    if (m[2] === 'disconnect' && req.method === 'POST') return disconnect(env, user, provider);
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = allowedOrigin(req, env);
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: origin ? 204 : 403 }), origin);
    try {
      return withCors(await route(req, env, ctx), origin);
    } catch (e) {
      if (e instanceof HttpError) return withCors(json({ error: e.message }, e.status), origin);
      console.error('api error', e);
      return withCors(json({ error: 'Server error' }, 500), origin);
    }
  },
};

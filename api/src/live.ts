/**
 * Live classes: Zoom and Google Meet OAuth (per-teacher), meeting creation,
 * and Jitsi (JaaS) JWTs for the in-platform classroom. Tokens are stored in
 * the database vault (private schema) via worker-secret-gated RPCs.
 */
import type { Env } from './env';
import { HttpError, UUID, b64url, body, enc, hmac, json, rest, rpc, safeEqual, unb64url, type User } from './util';

type Provider = 'zoom' | 'google';
const DB_PROVIDER: Record<Provider, string> = { zoom: 'zoom', google: 'google_meet' };
const appUrl = (env: Env) => (env.APP_URL || 'https://profjero-edupro.pages.dev').replace(/\/$/, '');
const redirectUri = (env: Env, p: Provider) => `${appUrl(env)}/integrations/${p}/done`;
export const zoomReady = (env: Env) => Boolean(env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET && env.WORKER_SECRET);
export const googleReady = (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.WORKER_SECRET);
export const jaasReady = (env: Env) => Boolean(env.JAAS_APP_ID && env.JAAS_KID && env.JAAS_PRIVATE_KEY);
const ready = (env: Env, p: Provider) => (p === 'zoom' ? zoomReady(env) : googleReady(env));

async function signState(env: Env, uid: string, p: Provider) {
  const payload = b64url(enc.encode(JSON.stringify({ u: uid, p, e: Date.now() + 10 * 60_000, n: b64url(crypto.getRandomValues(new Uint8Array(9))) })));
  return `${payload}.${b64url(await hmac(env.WORKER_SECRET!, payload))}`;
}
async function verifyState(env: Env, state: string, uid: string, p: Provider) {
  const [payload, sig] = state.split('.');
  if (!payload || !sig || !safeEqual(sig, b64url(await hmac(env.WORKER_SECRET!, payload)))) return false;
  const s = JSON.parse(new TextDecoder().decode(unb64url(payload))) as { u: string; p: string; e: number };
  return s.u === uid && s.p === p && s.e > Date.now();
}

export async function oauthStart(env: Env, user: User, p: Provider) {
  if (!ready(env, p)) return json({ error: `${p === 'zoom' ? 'Zoom' : 'Google Meet'} is not enabled by the administrator yet.` }, 503);
  if (user.is_anonymous) return json({ error: 'Guests cannot connect apps.' }, 403);
  const state = await signState(env, user.id, p);
  const u = p === 'zoom'
    ? new URL('https://zoom.us/oauth/authorize')
    : new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', p === 'zoom' ? env.ZOOM_CLIENT_ID! : env.GOOGLE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', redirectUri(env, p));
  u.searchParams.set('state', state);
  if (p === 'google') {
    u.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/calendar.events');
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('include_granted_scopes', 'true');
  }
  return json({ url: u.toString() });
}

type TokenSet = { access_token: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string };
async function tokenRequest(env: Env, p: Provider, params: Record<string, string>): Promise<TokenSet> {
  const form = new URLSearchParams(params);
  let r: Response;
  if (p === 'zoom') {
    r = await fetch('https://zoom.us/oauth/token', { method: 'POST', headers: { authorization: `Basic ${btoa(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  } else {
    form.set('client_id', env.GOOGLE_CLIENT_ID!); form.set('client_secret', env.GOOGLE_CLIENT_SECRET!);
    r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  }
  const j = (await r.json().catch(() => ({}))) as TokenSet & { error?: string; error_description?: string; reason?: string };
  if (!r.ok || !j.access_token) throw new HttpError(400, `The ${p === 'zoom' ? 'Zoom' : 'Google'} sign-in did not complete (${j.error_description ?? j.reason ?? j.error ?? r.status}).`);
  return j;
}

async function store(env: Env, user: User, p: Provider, t: TokenSet, email: string | null) {
  const r = await rpc(env, user.token, 'provider_store_tokens', {
    p_secret: env.WORKER_SECRET, p_provider: DB_PROVIDER[p], p_access: t.access_token, p_refresh: t.refresh_token ?? null,
    p_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(), p_email: email, p_scopes: (t.scope ?? '').split(/[ ,]+/).filter(Boolean),
  });
  if (!r.ok) throw new HttpError(500, 'Could not save the connection.');
}

export async function oauthExchange(req: Request, env: Env, user: User, p: Provider) {
  if (!ready(env, p)) return json({ error: 'This app is not enabled.' }, 503);
  const b = await body<{ code?: string; state?: string }>(req);
  if (!b.code || !b.state || !(await verifyState(env, b.state, user.id, p))) return json({ error: 'This connection link has expired. Please try again from Settings.' }, 400);
  const t = await tokenRequest(env, p, { grant_type: 'authorization_code', code: b.code, redirect_uri: redirectUri(env, p) });
  let email: string | null = null;
  if (p === 'zoom') {
    const me = await fetch('https://api.zoom.us/v2/users/me', { headers: { authorization: `Bearer ${t.access_token}` } });
    if (me.ok) email = ((await me.json()) as { email?: string }).email ?? null;
  } else if (t.id_token) {
    try { email = (JSON.parse(new TextDecoder().decode(unb64url(t.id_token.split('.')[1]))) as { email?: string }).email ?? null; } catch { /* ignore */ }
  }
  await store(env, user, p, t, email);
  return json({ connected: true, email });
}

export async function connections(env: Env, user: User) {
  const r = await rest<{ provider: string; account_email: string | null; connected_at: string }[]>(env, user.token, 'provider_connections?status=eq.connected&select=provider,account_email,connected_at');
  return json({ available: { zoom: zoomReady(env), google_meet: googleReady(env), jaas: jaasReady(env) }, connected: r.ok ? r.data : [] });
}

export async function disconnect(env: Env, user: User, p: Provider) {
  await rest(env, user.token, `provider_connections?provider=eq.${DB_PROVIDER[p]}&user_id=eq.${user.id}`, { method: 'DELETE' });
  return json({ ok: true });
}

async function accessToken(env: Env, user: User, p: Provider) {
  const r = await rpc<{ access_token: string; refresh_token: string | null; expires_at: string | null; email: string | null } | null>(env, user.token, 'provider_get_tokens', { p_secret: env.WORKER_SECRET, p_provider: DB_PROVIDER[p] });
  if (!r.ok || !r.data) throw new HttpError(409, `Connect your ${p === 'zoom' ? 'Zoom' : 'Google'} account first (Settings → Apps).`);
  const t = r.data;
  if (t.expires_at && new Date(t.expires_at).getTime() > Date.now() + 60_000) return t.access_token;
  if (!t.refresh_token) throw new HttpError(409, 'Your connection expired. Reconnect in Settings → Apps.');
  const fresh = await tokenRequest(env, p, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  await store(env, user, p, { ...fresh, refresh_token: fresh.refresh_token ?? t.refresh_token }, t.email);
  return fresh.access_token;
}

export async function createMeeting(req: Request, env: Env, user: User, p: Provider) {
  if (!ready(env, p)) return json({ error: 'This app is not enabled.' }, 503);
  const b = await body<{ title?: string; starts_at?: string; duration_minutes?: number; agenda?: string }>(req);
  const title = (b.title ?? '').trim().slice(0, 200);
  const start = b.starts_at ? new Date(b.starts_at) : null;
  const minutes = Math.min(Math.max(Number(b.duration_minutes) || 60, 5), 600);
  if (!title || !start || Number.isNaN(start.getTime())) return json({ error: 'Add a title and start time.' }, 400);
  const token = await accessToken(env, user, p);
  if (p === 'zoom') {
    const r = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ topic: title, type: 2, start_time: start.toISOString().replace(/\.\d{3}Z$/, 'Z'), duration: minutes, agenda: (b.agenda ?? '').slice(0, 2000), settings: { join_before_host: false, waiting_room: true, mute_upon_entry: true } }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: number; join_url?: string; message?: string };
    if (!r.ok || !j.join_url) return json({ error: `Zoom could not create the meeting (${j.message ?? r.status}).` }, 502);
    return json({ join_url: j.join_url, meeting_id: String(j.id) });
  }
  const end = new Date(start.getTime() + minutes * 60_000);
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary: title, description: (b.agenda ?? '').slice(0, 4000), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; hangoutLink?: string; error?: { message?: string } };
  if (!r.ok || !j.hangoutLink) return json({ error: `Google could not create the Meet link (${j.error?.message ?? r.status}).` }, 502);
  return json({ join_url: j.hangoutLink, meeting_id: j.id });
}

// ---------------------------------------------------------------------------
// Jitsi
// ---------------------------------------------------------------------------
function pemToPkcs8(pem: string) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function jitsiToken(url: URL, env: Env, user: User) {
  const sessionId = url.searchParams.get('session') ?? '';
  if (!UUID.test(sessionId)) return json({ error: 'Invalid session' }, 400);
  const [role, sess, prof] = await Promise.all([
    rpc<string | null>(env, user.token, 'session_role', { p_session: sessionId }),
    rest<{ join_url: string; title: string; provider: string }[]>(env, user.token, `live_sessions?id=eq.${sessionId}&select=join_url,title,provider`),
    rest<{ full_name: string | null; display_name: string | null; avatar_url: string | null }[]>(env, user.token, `profiles?id=eq.${user.id}&select=full_name,display_name,avatar_url`),
  ]);
  if (!role.ok || !role.data || !sess.ok || !sess.data?.[0]) return json({ error: 'You are not part of this class.' }, 403);
  let room = '';
  try { room = decodeURIComponent(new URL(sess.data[0].join_url).pathname.split('/').filter(Boolean).pop() ?? ''); } catch { /* ignore */ }
  room = room.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120) || `ProfJeroEdu-${sessionId}`;
  const moderator = role.data === 'host';
  if (!jaasReady(env)) return json({ domain: 'meet.jit.si', room, jwt: null, moderator });
  const now = Math.floor(Date.now() / 1000);
  const p = prof.data?.[0];
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', kid: env.JAAS_KID, typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({
    aud: 'jitsi', iss: 'chat', sub: env.JAAS_APP_ID, room, nbf: now - 10, exp: now + 4 * 3600,
    context: { user: { id: user.id, name: p?.display_name || p?.full_name || 'Learner', avatar: p?.avatar_url ?? '', email: user.is_anonymous ? '' : user.email ?? '', moderator: moderator ? 'true' : 'false' },
      features: { livestreaming: 'false', recording: 'false', transcription: 'false', 'outbound-call': 'false' } },
  })));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(env.JAAS_PRIVATE_KEY!), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claims}`));
  return json({ domain: '8x8.vc', room: `${env.JAAS_APP_ID}/${room}`, jwt: `${head}.${claims}.${b64url(sig)}`, moderator });
}

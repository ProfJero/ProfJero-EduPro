/**
 * ProfJero Edu — Cloudflare Pages advanced-mode worker.
 * Serves the SPA (env.ASSETS) and the trusted server API under /api/*.
 * Secrets (Cloudinary API secret) live only here, as Cloudflare secrets.
 */
import { privateDownloadUrl, signParams } from './cloudinary';

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  ALLOWED_ORIGINS?: string; // comma separated, optional
  GOOGLE_CLIENT_ID?: string;
  ZOOM_CLIENT_ID?: string;
  API_URL?: string; // the profjero-edu-api worker origin
}

type Purpose = 'avatar' | 'course_media' | 'submission';
const ROOT = 'profjero-edu';
const FORMATS: Record<Purpose, string> = {
  avatar: 'jpg,jpeg,png,webp',
  course_media: 'jpg,jpeg,png,webp,gif,svg,mp4,webm,mp3,m4a,pdf',
  submission: 'jpg,jpeg,png,webp,pdf,doc,docx,ppt,pptx,xls,xlsx,txt,zip,py,ipynb,csv',
};
const MAX_MB: Record<Purpose, number> = { avatar: 2, course_media: 50, submission: 10 };

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

function cloudinaryReady(env: Env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

async function getUser(req: Request, env: Env): Promise<{ id: string; token: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string };
  return u.id ? { id: u.id, token } : null;
}

/** Calls PostgREST as the user, so database RLS decides what they may see. */
async function asUser<T>(env: Env, token: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY!, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = (await r.json().catch(() => null)) as T;
  return { ok: r.ok, status: r.status, data };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signUpload(req: Request, env: Env) {
  if (!cloudinaryReady(env)) return json({ error: 'File uploads are not configured on this server.' }, 503);
  const user = await getUser(req, env);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { purpose?: Purpose; course_id?: string; size?: number; filename?: string };
  const purpose = body.purpose;
  if (!purpose || !(purpose in FORMATS)) return json({ error: 'Unknown upload purpose' }, 400);
  if (typeof body.size === 'number' && body.size > MAX_MB[purpose] * 1024 * 1024) return json({ error: `File is too large (max ${MAX_MB[purpose]} MB).` }, 413);

  let folder: string;
  let type = 'upload';
  if (purpose === 'avatar') {
    folder = `${ROOT}/avatars/${user.id}`;
  } else if (purpose === 'submission') {
    folder = `${ROOT}/submissions/${user.id}`; // RLS on submission_files requires this prefix
    type = 'authenticated'; // never publicly reachable
  } else {
    if (body.course_id && !UUID.test(body.course_id)) return json({ error: 'Invalid course' }, 400);
    const perm = await asUser<{ can_create_courses: boolean; can_manage_course: boolean | null }>(env, user.token, 'rpc/media_permissions', { method: 'POST', body: JSON.stringify({ p_course: body.course_id ?? null }) });
    if (!perm.ok) return json({ error: 'Permission check failed' }, 403);
    const allowed = body.course_id ? perm.data.can_manage_course : perm.data.can_create_courses;
    if (!allowed) return json({ error: 'You cannot upload media for this course.' }, 403);
    folder = `${ROOT}/courses/${body.course_id ?? `drafts/${user.id}`}`;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, type, allowed_formats: FORMATS[purpose] };
  const signature = await signParams(params, env.CLOUDINARY_API_SECRET!);
  return json({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, timestamp, signature, folder, type, allowed_formats: FORMATS[purpose], resource_type: 'auto' });
}

async function submissionUrl(req: Request, env: Env) {
  if (!cloudinaryReady(env)) return json({ error: 'File storage is not configured on this server.' }, 503);
  const user = await getUser(req, env);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const { file_id } = (await req.json().catch(() => ({}))) as { file_id?: string };
  if (!file_id || !UUID.test(file_id)) return json({ error: 'Invalid file' }, 400);
  // RLS: only the learner who owns the submission or its graders can read this row.
  const r = await asUser<{ public_id: string; resource_type: string; format: string | null; delivery_type: string }[]>(env, user.token, `submission_files?id=eq.${file_id}&select=public_id,resource_type,format,delivery_type`);
  if (!r.ok || !r.data?.length) return json({ error: 'File not found' }, 404);
  const f = r.data[0];
  const url = await privateDownloadUrl({ cloud: env.CLOUDINARY_CLOUD_NAME!, apiKey: env.CLOUDINARY_API_KEY!, secret: env.CLOUDINARY_API_SECRET!, publicId: f.public_id, resourceType: f.resource_type, format: f.format, type: f.delivery_type, ttlSeconds: 300 });
  return json({ url, expires_in: 300 });
}

function health(env: Env) {
  return json({
    ok: true,
    service: 'profjero-edu-api',
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    cloudinary: cloudinaryReady(env),
    live_providers: { manual: true, jitsi_link: true, google_meet_oauth: Boolean(env.GOOGLE_CLIENT_ID), zoom_oauth: Boolean(env.ZOOM_CLIENT_ID) },
  });
}

function securityHeaders(res: Response, env: Env, isHtml: boolean): Response {
  const h = new Headers(res.headers);
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('x-frame-options', 'DENY');
  h.set('permissions-policy', 'camera=(self "https://meet.jit.si" "https://8x8.vc"), microphone=(self "https://meet.jit.si" "https://8x8.vc"), display-capture=(self "https://meet.jit.si" "https://8x8.vc"), fullscreen=(self "https://meet.jit.si" "https://8x8.vc"), geolocation=(), payment=()');
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  if (isHtml) {
    const sbUrl = env.SUPABASE_URL ? new URL(env.SUPABASE_URL) : null;
    const sb = sbUrl ? sbUrl.origin : 'https://*.supabase.co';
    const sbWs = sbUrl ? `${sbUrl.protocol === 'https:' ? 'wss' : 'ws'}://${sbUrl.host}` : 'wss://*.supabase.co';
    const secure = !sbUrl || sbUrl.protocol === 'https:';
    const api = (() => { try { return new URL(env.API_URL || 'https://profjero-edu-api.profjerodigitalstudio.workers.dev').origin; } catch { return ''; } })();
    const cdn = 'https://cdn.jsdelivr.net';
    const jitsi = 'https://meet.jit.si https://8x8.vc';
    h.set('content-security-policy', [
      "default-src 'self'",
      `script-src 'self' 'wasm-unsafe-eval' ${cdn} ${jitsi}`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${cdn}`,
      `font-src 'self' data: https://fonts.gstatic.com ${cdn}`,
      "img-src 'self' data: blob: https:",
      "media-src 'self' https://res.cloudinary.com https:",
      `connect-src 'self' ${sb} ${sbWs} https://api.cloudinary.com https://res.cloudinary.com https://fonts.googleapis.com https://fonts.gstatic.com ${cdn} ${api}`,
      `frame-src ${api} ${jitsi} https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://docs.google.com https://phet.colorado.edu https://www.geogebra.org https://www.desmos.com https://trinket.io https://codepen.io https://replit.com https://onecompiler.com https://www.canva.com https://h5p.org https://scratch.mit.edu`,
      `worker-src 'self' blob: ${cdn}`,
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(secure ? ['upgrade-insecure-requests'] : []),
    ].join('; '));
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
        if (url.pathname === '/api/health' && req.method === 'GET') return health(env);
        if (url.pathname === '/api/media/sign' && req.method === 'POST') return await signUpload(req, env);
        if (url.pathname === '/api/media/submission-url' && req.method === 'POST') return await submissionUrl(req, env);
        return json({ error: 'Not found' }, 404);
      } catch (e) {
        console.error('api error', e);
        return json({ error: 'Server error' }, 500);
      }
    }
    const res = await env.ASSETS.fetch(req);
    const isHtml = (res.headers.get('content-type') ?? '').includes('text/html');
    const out = securityHeaders(res, env, isHtml);
    if (url.pathname.startsWith('/assets/')) out.headers.set('cache-control', 'public, max-age=31536000, immutable');
    else if (isHtml || url.pathname === '/sw.js' || url.pathname.endsWith('.webmanifest')) out.headers.set('cache-control', 'no-cache');
    return out;
  },
};

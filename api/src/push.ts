/**
 * Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payload encryption
 * (RFC 8188 / RFC 8291), implemented with Web Crypto only.
 */
import type { Env } from './env';
import { b64url, enc, json, rpc, safeEqual, unb64url } from './util';

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

function concat(...parts: Uint8Array<ArrayBuffer>[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmacSha256(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** Encrypts a payload for one subscription (aes128gcm content coding). */
export async function encryptPayload(payload: Uint8Array<ArrayBuffer>, p256dh: string, authSecret: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = unb64url(p256dh);
  const auth = unb64url(authSecret);
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, local.privateKey, 256));
  const prkKey = await hmacSha256(auth, ecdh);
  const ikm = (await hmacSha256(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
  const prk = await hmacSha256(salt, ikm);
  const cek = (await hmacSha256(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmacSha256(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

const jwtCache = new Map<string, { jwt: string; exp: number }>();
async function vapidJwt(env: Env, audience: string) {
  const hit = jwtCache.get(audience);
  const now = Math.floor(Date.now() / 1000);
  if (hit && hit.exp - 600 > now) return hit.jwt;
  const jwk = JSON.parse(env.VAPID_PRIVATE_KEY!) as JsonWebKey;
  const key = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const exp = now + 12 * 3600;
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: audience, exp, sub: env.VAPID_SUBJECT || env.APP_URL || 'https://profjero-edupro.pages.dev' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  const jwt = `${head}.${claims}.${b64url(sig)}`;
  jwtCache.set(audience, { jwt, exp });
  return jwt;
}

export async function sendPush(env: Env, sub: Sub, data: unknown): Promise<number> {
  const url = new URL(sub.endpoint);
  if (url.protocol !== 'https:') return 400;
  const bodyBytes = await encryptPayload(enc.encode(JSON.stringify(data)), sub.keys.p256dh, sub.keys.auth);
  const jwt = await vapidJwt(env, url.origin);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'normal', authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}` },
    body: bodyBytes,
  });
  return r.status;
}

export const pushReady = (env: Env) => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.WORKER_SECRET);

/** Called by the database (pg_net) after a notification is inserted. */
export async function dispatch(req: Request, env: Env) {
  const secret = req.headers.get('x-worker-secret') ?? '';
  if (!env.WORKER_SECRET || !safeEqual(secret, env.WORKER_SECRET)) return json({ error: 'Forbidden' }, 403);
  if (!pushReady(env)) return json({ error: 'Push is not configured' }, 503);
  const b = (await req.json()) as { subscriptions?: Sub[]; notification?: { id: string; title: string; body: string; link: string; type: string } };
  const subs = (b.subscriptions ?? []).slice(0, 20);
  const n = b.notification;
  if (!n) return json({ error: 'Missing notification' }, 400);
  const gone: string[] = [];
  const results = await Promise.all(subs.map(async (s) => {
    try {
      const status = await sendPush(env, s, { id: n.id, title: n.title, body: n.body, link: n.link, type: n.type, tag: n.id });
      if (status === 404 || status === 410) gone.push(s.endpoint);
      return status;
    } catch { return 0; }
  }));
  if (gone.length) await rpc(env, null, 'push_prune', { p_secret: env.WORKER_SECRET, p_endpoints: gone });
  return json({ sent: results.filter((s) => s >= 200 && s < 300).length, pruned: gone.length });
}

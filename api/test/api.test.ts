import { describe, expect, it } from 'vitest';
import { encryptPayload } from '../src/push';
import { b64url, unb64url } from '../src/util';
import { parse, evaluate } from '../../src/features/lab/math/expr';

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const te = new TextEncoder();

describe('web push aes128gcm (RFC 8291)', () => {
  it('produces a payload the browser side can decrypt', async () => {
    // "Browser" subscription keys
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const uaPub = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const msg = JSON.stringify({ title: 'New assignment', body: 'Due Friday', link: '/learn' });
    const out = await encryptPayload(te.encode(msg), b64url(uaPub), b64url(auth));

    // Decrypt as a user agent would
    const salt = out.slice(0, 16);
    const idlen = out[20];
    const asPub = out.slice(21, 21 + idlen);
    const cipher = out.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
    const prkKey = await hmac(auth, ecdh);
    const ikm = (await hmac(prkKey, cat(te.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])) as Uint8Array<ArrayBuffer>)).slice(0, 32);
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, cat(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])) as Uint8Array<ArrayBuffer>)).slice(0, 16);
    const nonce = (await hmac(prk, cat(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])) as Uint8Array<ArrayBuffer>)).slice(0, 12);
    const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cipher));
    expect(plain[plain.length - 1]).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(msg);
    expect(Array.from(out.slice(16, 20))).toEqual([0, 0, 16, 0]);
  });
  it('base64url round-trips', () => {
    const b = crypto.getRandomValues(new Uint8Array(33));
    expect(Array.from(unb64url(b64url(b)))).toEqual(Array.from(b));
  });
});

describe('Math Lab expression parser', () => {
  const ev = (s: string, x = 0) => evaluate(parse(s), { x, a: 2, b: 3 });
  it('handles precedence, powers and unary minus', () => {
    expect(ev('2 + 3 * 4')).toBe(14);
    expect(ev('-2^2')).toBe(-4);
    expect(ev('2^3^2')).toBe(512);
  });
  it('supports implicit multiplication and functions', () => {
    expect(ev('2x', 5)).toBe(10);
    expect(ev('3(x+1)', 1)).toBe(6);
    expect(ev('ab')).toBe(6);
    expect(ev('sqrt(16) + abs(-3)')).toBe(7);
    expect(ev('sin(pi/2)')).toBeCloseTo(1);
  });
  it('rejects unsafe or invalid input', () => {
    expect(() => ev('alert(1)')).toThrow(); // never evaluated as code: unknown variables
    expect(() => parse('2 +')).toThrow();
    expect(() => parse('x; y')).toThrow();
  });
});

describe('VAPID key formats', () => {
  it('signs with a raw base64url private key (web-push format)', async () => {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = new Uint8Array((await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer);
    const { sendPush } = await import('../src/push');
    const seen: { auth?: string } = {};
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_u: string, init: RequestInit) => { seen.auth = (init.headers as Record<string, string>).authorization; return new Response(null, { status: 201 }); }) as typeof fetch;
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const uaPub = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer);
    const status = await sendPush({ VAPID_PUBLIC_KEY: b64url(pub), VAPID_PRIVATE_KEY: jwk.d! }, { endpoint: 'https://push.example.test/abc', keys: { p256dh: b64url(uaPub), auth: b64url(crypto.getRandomValues(new Uint8Array(16))) } }, { title: 'x' });
    globalThis.fetch = orig;
    expect(status).toBe(201);
    const jwt = /t=([^,]+)/.exec(seen.auth ?? '')![1];
    const [h, c, sig] = jwt.split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, unb64url(sig), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(unb64url(c))).aud).toBe('https://push.example.test');
  });
});

describe('Circuit Builder solver (nodal analysis)', () => {
  it('series: 6 V across two 12 Ω bulbs gives ≈0.25 A', async () => {
    const { solve, PRESETS } = await import('../../src/features/lab/science/CircuitBuilder');
    const r = solve(PRESETS.series);
    expect(Math.abs(r['h-2-2'].i)).toBeCloseTo(6 / 24, 2); // ammeter
    expect(Math.abs(r['h-1-0'].dv)).toBeCloseTo(3, 1); // each bulb gets half
  });
  it('parallel: two 12 Ω bulbs draw ≈1 A in total, each gets the full 6 V', async () => {
    const { solve, PRESETS } = await import('../../src/features/lab/science/CircuitBuilder');
    const r = solve(PRESETS.parallel);
    expect(Math.abs(r['h-0-2'].i)).toBeCloseTo(1, 1);
    expect(Math.abs(r['v-1-0'].dv)).toBeGreaterThan(5.8); // small drop across the cell's internal resistance
  });
  it('an open switch stops the current', async () => {
    const { solve, PRESETS } = await import('../../src/features/lab/science/CircuitBuilder');
    const p = { ...PRESETS.series, 'v-3-0': { kind: 'switch' as const, value: 0, on: false } };
    expect(Math.abs(solve(p)['h-2-2'].i)).toBeLessThan(1e-6);
  });
});

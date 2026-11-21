import { env } from './env';
import { supabase } from './supabase';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushConfigured = () => Boolean(env.vapidPublicKey);
export const isIos = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
/** iPhone/iPad only allow web push for apps added to the Home Screen. */
export const needsInstallForPush = () => isIos() && !isStandalone();
export type PushState = 'on' | 'off' | 'blocked' | 'unsupported' | 'unconfigured' | 'install';

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('The app is still installing its offline service. Reload the page and try again.')), 15000));
  return Promise.race([ready, timeout]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return needsInstallForPush() ? 'install' : 'unsupported';
  if (!pushConfigured()) return 'unconfigured';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sign in first');
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: data.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200), last_used_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

async function subscribe(reg: ServiceWorkerRegistration) {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(env.vapidPublicKey) });
}

/** Ask permission, subscribe this device and store the subscription for the signed-in user. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported' | 'unconfigured' | 'install'> {
  if (!pushSupported()) return needsInstallForPush() ? 'install' : 'unsupported';
  if (!pushConfigured()) return 'unconfigured';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  await save(await subscribe(await registration()));
  return 'granted';
}

/**
 * Keeps this device linked to whoever is signed in: if notifications were
 * already allowed, (re)subscribe and store the subscription for this user.
 */
export async function syncPush() {
  if (!pushSupported() || !pushConfigured() || Notification.permission !== 'granted') return;
  try {
    await save(await subscribe(await registration()));
  } catch { /* best effort */ }
}

/** Remove this device's subscription (turning off, or signing out). */
export async function disablePush(opts: { keepBrowserSubscription?: boolean } = {}) {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  if (!opts.keepBrowserSubscription) await sub.unsubscribe();
}

export async function sendTestPush() {
  const { error } = await supabase.rpc('send_test_notification' as never);
  if (error) throw new Error(error.message);
}

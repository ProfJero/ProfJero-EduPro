import { env } from './env';
import { supabase } from './supabase';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushConfigured = () => Boolean(env.vapidPublicKey);

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe this device and store the subscription for the signed-in user. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported' | 'unconfigured'> {
  if (!pushSupported()) return 'unsupported';
  if (!pushConfigured()) return 'unconfigured';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(env.vapidPublicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sign in first');
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: data.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
  return 'granted';
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

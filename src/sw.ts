/// <reference lib="webworker" />
/* ProfJero Edu service worker: app-shell precache, offline-friendly runtime
   caching (labs, fonts, public media) and Web Push notifications. Private API
   responses are never cached here. */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Hashed app chunks: immutable.
registerRoute(({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
  new CacheFirst({ cacheName: 'app-chunks', plugins: [new ExpirationPlugin({ maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 60 })] }));
// Lab engines (Monaco editor, Pyodide, sql.js, Emmet) from the CDN — versioned URLs, so cache-first lets labs run offline.
registerRoute(({ url }) => url.hostname === 'cdn.jsdelivr.net',
  new CacheFirst({ cacheName: 'lab-engines', plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 })] }));
registerRoute(({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 20 })] }));
// Public Cloudinary media only (never authenticated/private assets).
registerRoute(({ url }) => url.hostname === 'res.cloudinary.com' && url.pathname.includes('/upload/'),
  new CacheFirst({ cacheName: 'public-media', plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 })] }));

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

type PushData = { title?: string; body?: string; link?: string; id?: string; type?: string };
self.addEventListener('push', (event) => {
  let d: PushData;
  try {
    d = event.data?.json() as PushData;
  } catch {
    d = { title: 'ProfJero Edu', body: event.data?.text() };
  }
  event.waitUntil(self.registration.showNotification(d.title || 'ProfJero Edu', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.id,
    data: { link: d.link || '/notifications' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string })?.link || '/notifications';
  const target = new URL(link, self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        await (c as WindowClient).navigate(target).catch(() => undefined);
        return (c as WindowClient).focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

// Minimal service worker: caches the static app shell for fast repeat loads and an offline page.
// Dashboard, booking and API responses are never cached (they contain personal data).
const CACHE = 'doddo-shell-v3';
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest'];
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  // Cache each file on its own, so one missing file cannot stop the worker from installing.
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.allSettled([...SHELL, OFFLINE].map((url) => c.add(url))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/booking') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/account')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith('/_astro/') || SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
  }
});

// Web Push: show the alert, and open the related page when it is tapped.
self.addEventListener('push', (event) => {
  let data = { title: 'Doddo', body: 'You have a new update.', url: '/notifications' };
  try { data = { ...data, ...event.data.json() }; } catch (e) { /* plain text or empty payload */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.url,
    renotify: true,
    data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        await client.navigate(url).catch(() => {});
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});

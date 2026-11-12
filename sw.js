const V = 'shift-v4';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // network-first for schedule data and shell so updates arrive; fall back to cache offline
  e.respondWith(fetch(r).then(res => {
    if (res.ok && (u.origin === location.origin || u.host.includes('gstatic') || u.host.includes('googleapis'))) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true })));
});

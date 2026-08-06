const CACHE_NAME = 'ersenbox-v10';
const STATIC_ASSETS = ['./', './index.html'];
const CACHE_HOSTS = ['cdn.jsdelivr.net','quran.islam-db.com','raw.githubusercontent.com','cdn.islamic.network','fonts.googleapis.com','fonts.gstatic.com','api.qrserver.com'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    if (CACHE_HOSTS.some((h) => url.includes(h))) {
        e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).then((response) => {
            if (response && (response.ok || response.type === 'opaque')) { const copy = response.clone(); caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)); }
            return response;
        }).catch(() => caches.match('./index.html'))));
        return;
    }
    if (url.includes('api.alquran.cloud')) {
        e.respondWith(fetch(e.request).then((response) => {
            if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)); }
            return response;
        }).catch(() => caches.match(e.request)));
        return;
    }
    e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
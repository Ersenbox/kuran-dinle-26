/* Ersenbox Service Worker - v12 (DÜZELTILMIŞ) */
/* Offline/Online çalışması optimize edildi + PWA install desteği */

const CACHE_NAME = 'ersenbox-v12';
const STATIC_ASSETS = ['./', './index.html', './manifest.json', './sw.js'];
const CACHE_HOSTS = [
  'cdn.jsdelivr.net',
  'quran.islam-db.com',
  'raw.githubusercontent.com',
  'cdn.islamic.network',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'api.qrserver.com'
];

// Cache duration: 24 saat
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Kurulu veriler (başlangıçta cache'e konacak - QURAN_DATA hepsi)
const STARTUP_CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@quran-center/quran-text@latest/dist/data/quran-chapters.json',
  'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => {
      // Statik assets'i ekle
      c.addAll(STATIC_ASSETS);
      // Bazı startup dosyalarını pre-cache et (non-blocking)
      STARTUP_CACHE_URLS.forEach(url => {
        fetch(url).then(r => r.ok && c.put(url, r)).catch(() => {});
      });
      return Promise.resolve();
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  const method = e.request.method;

  // POST/PUT/DELETE istekleri cache'leme
  if (method !== 'GET') {
    e.respondWith(fetch(e.request));
    return;
  }

  /* 1) ANA SAYFA (HTML Navigation): Network-first + fallback cache */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Başarılı response'u cache'e kaydet
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => {
          // Network başarısız - cache'ten dön
          return caches.match('./index.html')
            .then((r) => r || caches.match('./'))
            .catch(() => {
              // Son çare: basit offline sayfası
              return new Response(
                '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:sans-serif;padding:20px;text-align:center"><h2>📡 Bağlantı Yok</h2><p>Lütfen internet bağlantısını kontrol edin veya daha önce yüklenen sayfayı açmayı deneyin.</p></body></html>',
                { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
        })
    );
    return;
  }

  /* 2) CDN'ler (Font, Ses, Resim): Cache-first + Network fallback */
  if (CACHE_HOSTS.some((h) => url.includes(h))) {
    e.respondWith(
      caches.match(e.request)
        .then((cached) => {
          // Cache'ten varsa dön
          if (cached) return cached;
          
          // Yoksa network'ten al ve cache'e kaydet
          return fetch(e.request)
            .then((response) => {
              if (response && (response.ok || response.type === 'opaque')) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
              }
              return response;
            })
            .catch(() => {
              // Network başarısız, cached de yok - 503 dön
              return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
            });
        })
    );
    return;
  }

  /* 3) Quran API (api.alquran.cloud): Network-first + Cache fallback */
  if (url.includes('api.alquran.cloud')) {
    e.respondWith(
      fetch(e.request, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined })
        .then((response) => {
          // Başarılı response cache'e kaydet
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Network başarısız - cache'ten dön
          return caches.match(e.request)
            .then((r) => {
              if (r) return r;
              // Cache de yoksa - JSON error response dön
              return new Response(
                JSON.stringify({ 
                  code: 503, 
                  status: 'offline', 
                  data: null,
                  message: 'Offline mod - İnternet bağlantısını kontrol edin'
                }),
                { 
                  status: 503, 
                  headers: { 'Content-Type': 'application/json; charset=utf-8' } 
                }
              );
            });
        })
    );
    return;
  }

  /* 4) Aynı origin diğer istekler (JS, CSS, vb): Cache-first */
  e.respondWith(
    caches.match(e.request)
      .then((cached) => {
        if (cached) return cached;
        
        return fetch(e.request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
            }
            return response;
          })
          .catch(() => new Response(null, { status: 503, statusText: 'offline' }));
      })
  );
});

// Arka plan sync (optional - gelecekte push notifications için)
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-quran-data') {
    e.waitUntil(
      fetch('https://api.alquran.cloud/v1/quran/en.yusufali')
        .then(r => r.json())
        .then(data => {
          return caches.open(CACHE_NAME).then(c => {
            c.put('quran-data-complete', new Response(JSON.stringify(data)));
          });
        })
        .catch(() => console.log('[SW Sync] Quran data sync failed - offline'))
    );
  }
});

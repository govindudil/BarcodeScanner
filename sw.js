const CACHE_NAME = 'barcode-scanner-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for app shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls — network only (product data should always be fresh)
  if (
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('openbeautyfacts.org') ||
    url.hostname.includes('openlibrary.org') ||
    url.hostname.includes('upcitemdb.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN resources — cache-first
  if (url.hostname.includes('unpkg.com') || url.hostname.includes('cdn.')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App shell — cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

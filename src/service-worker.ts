/**
 * Service Worker — offline-first asset caching.
 *
 * Strategy: stale-while-revalidate for HTML; cache-first for all other
 * static assets.  WebSocket upgrade requests are never intercepted.
 *
 * Registered by src/main.tsx on initial page load.
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'cartographers-v1';

// ---------------------------------------------------------------------------
// Install — pre-cache the SPA shell
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting()),
  );
});

// ---------------------------------------------------------------------------
// Activate — remove stale caches from previous versions
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Fetch — serve from cache, update in background
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  // Only handle GET requests; skip WebSocket upgrades.
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).pathname.startsWith('/ws/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // Cache successful same-origin responses; skip opaque cross-origin.
          if (response.ok && response.type !== 'opaque') {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Offline and nothing cached → minimal error response.
          return cached ?? new Response('Offline', { status: 503 });
        });

      // Return cached version immediately while updating in background.
      return cached ?? networkFetch;
    }),
  );
});

export {}; // Ensure TypeScript treats this as a module

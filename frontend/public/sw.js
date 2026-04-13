// Noxis AI Service Worker - Lightweight PWA support
const CACHE_NAME = 'noxis-ai-v2';
const LITE_CACHE = 'noxis-lite-v2';

// Assets to cache for offline support
const LITE_ASSETS = [
  '/lite/',
  '/lite/index.html',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/manifest.json'
];

// Install event - cache lite assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(LITE_CACHE).then((cache) => {
      return cache.addAll(LITE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== LITE_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests
  if (url.pathname.startsWith('/api/')) return;
  
  // For Lite UI assets, use cache-first strategy
  if (url.pathname.startsWith('/lite/') || LITE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Update cache in background
          fetch(event.request).then((response) => {
            if (response.ok) {
              caches.open(LITE_CACHE).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(LITE_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // For other requests, network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Offline fallback for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/lite/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

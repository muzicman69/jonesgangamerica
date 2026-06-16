// Diamond Live — Service Worker
// Caches the app shell so it loads instantly and works offline

const CACHE = 'diamond-live-v1';

// Files to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache first, fall back to network
// Network-first for LiveKit/API calls (always needs fresh data)
// Cache-first for app shell files
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for:
  // - LiveKit WebSocket connections
  // - Anthropic API calls
  // - External CDN scripts (LiveKit SDK, fonts)
  const networkOnly = [
    'livekit.cloud',
    'anthropic.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ];
  if (networkOnly.some(h => url.hostname.includes(h))) {
    return; // let browser handle normally
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful GET responses for app files
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html')); // offline fallback
    })
  );
});

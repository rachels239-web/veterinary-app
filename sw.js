// Service worker: makes VetApp work with no signal, without ever serving a
// stale dose when the network is available.
//
// Strategy is network-first with a cache fallback. A calculator that quietly
// serves last week's numbers is worse than one that takes an extra moment to
// load, so freshness wins whenever there is a connection.
//
// Bump CACHE_VERSION whenever the file list changes.

const CACHE_VERSION = 'vetapp-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './src/ui/app.js',
  './src/ui/dom.js',
  './src/ui/components.js',
  './src/ui/screens/fluids.js',
  './src/ui/screens/cri.js',
  './src/ui/screens/emergency.js',
  './src/ui/screens/nutrition.js',
  './src/ui/screens/tools.js',
  './src/ui/screens/history.js',
  './src/core/format.js',
  './src/core/units.js',
  './src/core/safety.js',
  './src/core/state.js',
  './src/core/history.js',
  './src/calc/fluids.js',
  './src/calc/cri.js',
  './src/calc/recover.js',
  './src/calc/nutrition.js',
  './src/calc/transfusion.js',
  './src/calc/converters.js',
  './src/data/aaha.js',
  './src/data/concentrations.js',
  './src/data/cri-drugs.js',
  './src/data/cri-protocols.js',
  './src/data/recover2024.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // Individual failures must not abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // A navigation with nothing cached still needs a shell to boot from.
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});

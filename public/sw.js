// Offline support: the page is fetched fresh when online (so updates arrive),
// and everything is cached so the game still opens with no connection.
const CACHE = 'delve-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // The update check must always hit the network.
  if (url.pathname.endsWith('/version.json')) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (isPage) {
        try {
          const res = await fetch(req, { cache: 'no-store' });
          cache.put(req, res.clone());
          return res;
        } catch {
          return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./')) || Response.error();
        }
      }
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })(),
  );
});

/* Fitness service worker: Web Push reminders + a cache of the app's own files.
 *
 * Speed: pages and their CSS/JS/images are kept on the phone, so opening
 * Fitness doesn't wait on the network. Your data is never cached here: requests
 * to Supabase (another origin) go straight to the network, untouched.
 *
 * - App files with a ?v= version (CSS, JS) and images: cache first. A new
 *   deploy changes the ?v=, so new files are fetched; older copies of the same
 *   file are dropped.
 * - Pages: shown from the cache at once, refreshed in the background. When
 *   page-loading.js sees a newer build in /version.json it reloads with
 *   ?_b=<build>; those loads go to the network first, so updates still land
 *   within seconds.
 * - /version.json and this file: always from the network.
 */
const CACHE = 'fitness-app-v1';
const PAGES = ['/', '/log.html', '/history.html', '/challenges.html', '/share.html', '/settings.html'];
const NEVER = new Set(['/version.json', '/fitness-push-sw.js']);

const pageKey = (url) => (url.pathname === '/index.html' ? '/' : url.pathname);
const isPage = (req, url) => req.mode === 'navigate' || PAGES.includes(url.pathname) || url.pathname === '/index.html';
const isAsset = (url) => /\.(css|js|svg|png|webp|jpg|jpeg|ico|webmanifest|woff2?|wasm|tflite|binarypb|data)$/i.test(url.pathname);

// Local files a page links to (stylesheets, scripts, icons, manifest).
function assetsIn(html) {
  const out = new Set();
  const re = /(?:href|src)="(\/[^"#]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = new URL(m[1], self.location.origin);
    if (isAsset(u) && !NEVER.has(u.pathname)) out.add(u.pathname + u.search);
  }
  return [...out];
}

// Keep one version of each file: drop cached copies whose path matches but ?v= differs.
async function keepOnly(cache, urls) {
  const want = new Map(urls.map((s) => { const u = new URL(s, self.location.origin); return [u.pathname, u.search]; }));
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    if (want.has(u.pathname) && want.get(u.pathname) !== u.search) await cache.delete(req);
  }
}

async function cachePage(cache, key, response) {
  const html = await response.clone().text();
  await cache.put(key, response.clone());
  const assets = assetsIn(html);
  await Promise.all(assets.map(async (a) => {
    if (await cache.match(a)) return;
    try { const r = await fetch(a, { credentials: 'same-origin' }); if (r.ok) await cache.put(a, r); } catch (_) {}
  }));
  await keepOnly(cache, assets);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PAGES.map(async (p) => {
      try { const r = await fetch(p, { cache: 'no-cache' }); if (r.ok) await cachePage(cache, p, r); } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('fitness-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NEVER.has(url.pathname)) return; // Supabase etc. untouched

  if (isPage(req, url)) {
    const key = pageKey(url);
    const fresh = url.searchParams.has('_b');
    // Page from the network; caching it (and its files) happens after the response is handed over.
    const network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => {
      if (r.ok && r.type === 'basic') {
        const copy = r.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cachePage(cache, key, copy)).catch(() => {}));
      }
      return r;
    });
    event.waitUntil(network.then(() => {}, () => {}));
    event.respondWith((async () => {
      const cached = await caches.match(key);
      if (cached && !fresh) return cached;            // instant; the fetch above refreshes it for next time
      try { return await network; } catch (e) { if (cached) return cached; throw e; }
    })());
    return;
  }

  if (isAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok && r.type === 'basic') event.waitUntil(cache.put(req, r.clone()));
      return r;
    })());
  }
});

/* ---------- Web Push (unchanged) ---------- */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = typeof data.title === 'string' ? data.title : 'Fitness Tracker';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : 'Your daily wellness reminder.',
    icon: '/fitness-icon-192.png',
    badge: '/fitness-icon.svg',
    tag: typeof data.tag === 'string' ? data.tag : 'fitness-reminder',
    data: { url: 'https://fitness.oalfawzan.sa/' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith('https://fitness.oalfawzan.sa/')) return client.focus();
    }
    return self.clients.openWindow('https://fitness.oalfawzan.sa/');
  })());
});

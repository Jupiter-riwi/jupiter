// Apex Vision — service worker for the mobile seller PWA only.
// Registered exclusively from Apex Vision Vendedor.html / landing.html (see the
// mobile-gated registration script in those files); the desktop admin console
// never registers this and is unaffected.
//
// Strategy:
//  - App shell (HTML/CSS/JS/JSX/fonts/icons): cache-first, refreshed in the
//    background (stale-while-revalidate) so installs work offline and update
//    quietly on the next visit.
//  - Everything else (API calls, auth, live/websocket traffic, Stripe, etc.):
//    untouched — the SW never intercepts it, so live evaluation always hits
//    the network directly.
const CACHE_VERSION = 'apex-seller-v1';
const APP_SHELL = [
  'Apex Vision Vendedor.html',
  'styles.css',
  'styles-seller.css',
  'api-client.js',
  'i18n.js',
  'particles.js',
  'seller-home.jsx',
  'seller-record.jsx',
  'seller-results.jsx',
  'seller-live.jsx',
  'seller-billing.jsx',
  'seller-app.jsx',
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIC_EXT = /\.(?:css|jsx?|png|jpe?g|svg|webp|woff2?|ico)$/i;

function isAppShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith('/seller') || url.pathname.endsWith('Vendedor.html') || url.pathname === '/' ) return true;
  return STATIC_EXT.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never touch POST/PUT/etc (auth, billing, live uploads)

  const url = new URL(req.url);
  if (!isAppShellRequest(url)) return; // let the browser handle API/live/cross-origin traffic normally

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })
  );
});

/* Brillo Travel service worker (HANDOFF §7).
   Cache-first for the app shell; API calls are never cached (data lives in
   IndexedDB). A new version waits until the person taps Update; it never
   skips waiting on its own. The cache is named brillo-<env>-<version>, and
   this env's worker only deletes its own old caches (staging and prod share
   one origin). VERSION must match js/config.js and CHANGELOG.md. */
var VERSION = '0.4.6';
var ENV = /\/brillo-travel\//.test(self.location.pathname) ? 'prod' : 'staging';
var PREFIX = 'brillo-' + ENV + '-';
var CACHE = PREFIX + VERSION;
var SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/config.js', './js/parse.js', './js/time.js', './js/store.js', './js/api.js', './js/sync.js',
  './js/links.js', './js/geo.js', './js/model.js', './js/budget.js', './js/ui/dom.js', './js/ui/parts.js', './js/ui/today.js',
  './js/ui/trip.js', './js/ui/lists.js', './js/ui/budget.js', './js/ui/nearby.js', './js/ui/cards.js', './js/ui/info.js', './js/ui/settings.js', './js/ui/cheer.js', './js/app.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './art/couple.jpg', './art/jordan.jpg', './art/lindsay.jpg', './art/penny.jpg'
];

self.addEventListener('install', function (e) {
  // cache:'reload' skips the browser and Pages CDN caches, so a new version never
  // precaches the previous version's files (F5).
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).catch(function () {
        return req.mode === 'navigate' ? c.match('./index.html') : Response.error();
      });
    });
  }));
});

self.addEventListener('message', function (e) {
  var msg = e.data || {};
  if (msg.type === 'skipWaiting') self.skipWaiting();          // only after the person taps Update
  if (msg.type === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

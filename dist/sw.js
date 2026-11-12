// Bump the version when the bundled app shell changes.
const prefix = 'yosan-drive-shell-';
const cacheName = prefix + '1';
const shell = [
  './index.html', './style.css', './app.js', './routes.js', './demo.js', './pwa.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch.png',
].map(path => new URL(path, self.registration.scope).href);
const files = new Set(shell);
const home = shell[0];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(shell.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(home).pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(home)) ?? fetch(request)));
  } else if (files.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(request)) ?? fetch(request)));
  }
});

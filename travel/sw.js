// App shell cache + Android share-target receiver.
const VERSION = 'wayfinder-v2';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/parse.js',
  'js/media.js',
  'js/plan.js',
  'js/services.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== 'wayfinder-share') await caches.delete(k);
    await self.clients.claim();
  })());
});

// The share sheet POSTs multipart form data here. Park it in a cache the page reads on load.
async function receiveShare(request) {
  const form = await request.formData();
  const files = form.getAll('media').filter(f => f && typeof f !== 'string' && f.size);
  const cache = await caches.open('wayfinder-share');
  await cache.put('share/meta', new Response(JSON.stringify({
    title: form.get('title') || '',
    text: form.get('text') || '',
    url: form.get('url') || '',
    files: files.length,
  }), { headers: { 'content-type': 'application/json' } }));
  await Promise.all(files.map((f, i) => cache.put(`share/file-${i}`, new Response(f, {
    headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || '') },
  }))));
  return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith(receiveShare(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Network first so deploys show up straight away; cache when offline.
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(VERSION)).put(e.request, res.clone());
      return res;
    } catch {
      return (await caches.match(e.request, { ignoreSearch: true })) || caches.match('index.html');
    }
  })());
});

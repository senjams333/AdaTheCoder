/* Ada The Coder on phones and tablets: keeps the app ON THE DEVICE, like the Windows app on a computer.
 * The first time (with internet) the app's screens, Python and pictures are saved here; lessons, themes and
 * videos are saved as they are used. After that the app opens and runs without internet; with internet it
 * fetches new lessons and licences again (the newest wins).
 * Registered by the /learn page. Change VERSION to make every device fetch the app afresh. */
const VERSION = 'ada-v1';
const APP = `${VERSION}-app`;          // the app itself: screens, Python, pages
const DATA = `${VERSION}-data`;        // the family's themes, lessons, licences (newest from the website)
const MEDIA = `${VERSION}-media`;      // pictures and lesson videos

const PRECACHE = [
  '/learn', '/learn.webmanifest', '/learn/py-worker.js', '/learn/explain.py',
  '/pyodide/pyodide.js', '/pyodide/pyodide.asm.js', '/pyodide/pyodide.asm.wasm', '/pyodide/python_stdlib.zip',
  '/pyodide/pyodide-lock.json', '/appweb/app.zip', '/appweb/manifest.json',
  '/icons/ada-192.png', '/icons/ada-512.png', '/img/ada.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => undefined)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* the website first (newest), the saved copy when there's no internet */
async function networkFirst(req, cacheName, key = req) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone()).catch(() => undefined);
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

/* the saved copy first (fast, offline); fetched and saved the first time */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => undefined);
  return res;
}

/* lesson videos: played from the device once saved; the first time they play from the website while the whole
 * file is saved in the background (video players ask for parts of the file, which can't be saved as such) */
async function video(e) {
  const req = e.request;
  const url = req.url;
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(url, { ignoreVary: true });
  if (hit) {
    const range = req.headers.get('range');
    if (!range) return hit;
    const buf = await hit.arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
  }
  e.waitUntil(fetch(url).then((res) => (res.ok && res.status === 200 ? cache.put(url, res) : undefined)).catch(() => undefined));
  return fetch(req);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                               // log-in, licences, payments: always the website
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/api/')) {                                    // themes, lessons, home screen, the family's licences
    if (/^\/api\/(v3\/courses|v1\/announcement|account\/app-login|v3\/licences|site)\b/.test(p)) e.respondWith(networkFirst(req, DATA));
    return;
  }
  if (p.startsWith('/media/videos/')) { e.respondWith(video(e)); return; }
  if (p.startsWith('/media/') || p.startsWith('/appweb/assets/') || p.startsWith('/img/') || p.startsWith('/icons/')) {
    e.respondWith(cacheFirst(req, MEDIA)); return;
  }
  if (p.startsWith('/_next/static/') || p.startsWith('/pyodide/')) { e.respondWith(cacheFirst(req, APP)); return; }
  if (p.startsWith('/appweb/') || p.startsWith('/learn/') || p === '/learn.webmanifest') { e.respondWith(networkFirst(req, APP)); return; }
  if (req.mode === 'navigate' && (p === '/learn' || p === '/login')) {
    e.respondWith(networkFirst(req, APP, p)); return;
  }
});

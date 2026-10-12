// Decrypts the talk's files on request. The key lives in IndexedDB, put there by index.html after the password check.
const BASE = new URL('./', self.registration.scope).pathname;
const DECK = BASE + 'd/';
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mp3: 'audio/mpeg', m4a: 'audio/mp4',
  pdf: 'application/pdf', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2',
};
const big = new Map();   // last decrypted media files, so video range requests don't decrypt again

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

function getKey() {
  return new Promise(res => {
    const r = indexedDB.open('fresh-talk', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onerror = () => res(null);
    r.onsuccess = () => {
      const g = r.result.transaction('k').objectStore('k').get('key');
      g.onsuccess = () => res(g.result || null);
      g.onerror = () => res(null);
    };
  });
}

async function nameFor(path) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function plainFor(path, key) {
  if (big.has(path)) return big.get(path);
  const r = await fetch(BASE + 'enc/' + await nameFor(path) + '.bin');
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)));
  if (plain.length > 1e6) {
    big.set(path, plain);
    if (big.size > 3) big.delete(big.keys().next().value);
  }
  return plain;
}

async function serve(req, url) {
  let path = decodeURIComponent(url.pathname.slice(DECK.length));
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const key = await getKey();
  if (!key) return Response.redirect(BASE, 302);
  let plain;
  try { plain = await plainFor(path, key); } catch (_) { return Response.redirect(BASE + '?locked', 302); }
  if (!plain) return new Response('Not found', { status: 404 });
  const type = TYPES[path.split('.').pop().toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m) {
    let s = m[1] ? +m[1] : plain.length - +m[2];
    let e = m[1] && m[2] ? +m[2] : plain.length - 1;
    e = Math.min(e, plain.length - 1);
    return new Response(plain.slice(s, e + 1), { status: 206, headers: {
      'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${plain.length}`,
      'Content-Length': String(e - s + 1), 'Accept-Ranges': 'bytes' } });
  }
  return new Response(plain, { headers: { 'Content-Type': type, 'Content-Length': String(plain.length), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin && url.pathname.startsWith(DECK)) e.respondWith(serve(e.request, url));
});

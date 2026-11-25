// Service Worker: ทำให้ติดตั้งเป็นแอปได้ และเปิดหน้าแอปได้เร็ว/เปิดได้แม้เน็ตหลุดชั่วคราว
// ข้อมูลสต็อก (/api/...) จะดึงจากเซิร์ฟเวอร์เสมอ ไม่เก็บแคช
const VERSION = 'v11';
const SHELL = `shell-${VERSION}`;
const CDN = `cdn-${VERSION}`;
const SHELL_FILES = ['./', './index.html', './config.js', './assets/app.css', './assets/app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== CDN).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (/\.supabase\.co$/.test(url.hostname)) return;            // API บน Supabase: ไม่แคช
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/api/')) return;               // ข้อมูลจริง: ไม่แคช
    // หน้าแอป: ใช้ของใหม่จากเซิร์ฟเวอร์ก่อน ถ้าออฟไลน์ใช้ของในแคช
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
    return;
  }

  // ไลบรารีจาก CDN / ฟอนต์ / โลโก้: ใช้แคชก่อน (เวอร์ชันถูกล็อกไว้ใน URL)
  if (/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|i\.postimg\.cc/.test(url.hostname)) {
    e.respondWith(caches.open(CDN).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});

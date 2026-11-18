// Офлайн-кэш. VERSION обновляется scripts/release.sh — тогда телефон скачивает новую версию.
const VERSION = '0.6.0';
const CACHE = 'ritm-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/ui.js', 'js/logic.js', 'js/rest.js', 'js/theme.js', 'js/version.js', 'js/categories.js',
  'js/views/today.js', 'js/views/habits.js', 'js/views/goals.js', 'js/views/gym.js', 'js/views/body.js', 'js/views/settings.js', 'js/views/stats.js',
  'js/sync.js', 'js/syncdata.js', 'js/firebase-config.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ritm-') && k !== CACHE && k !== 'ritm-firebase' && !k.startsWith('ritm-v-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Библиотека Firebase (у каждой версии свой адрес): берём из кэша, чтобы облако
  // подключалось и без сети, а данные ушли, когда сеть появится.
  if (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open('ritm-firebase').then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Архивные версии в /v/… обслуживаются своими файлами, не трогаем их.
  if (url.href.startsWith(self.registration.scope + 'v/')) return;
  if (url.pathname.endsWith('versions.json')) return;
  // Сначала сеть (чтобы сразу видеть обновления), при офлайне — кэш.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

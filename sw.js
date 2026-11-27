// Офлайн-помощник «Табеля» (iOS).
// Свои файлы — «сначала сеть»: с интернетом всегда свежая версия, без интернета — последняя сохранённая.
// Чужие файлы (шрифты, библиотека Excel, распознавание текста) — «сначала сохранённое»: после первого
// использования работают без сети. Сохраняются только удачные ответы (ошибка сайта в кэш не попадает). Смены и настройки здесь не хранятся — только файлы приложения.
// Имена всех кэшей iOS-версии начинаются с wc-ios- : на этом же сайте живёт Android-версия (tabel-*), её кэши не трогаем.
const PREFIX = 'wc-ios-';
const CACHE = PREFIX + 'v23';
const CORE = ['./', './index.html', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // чужие файлы: сохранённая копия, иначе сеть (и сохраняем на будущее).
    // Запрашиваем в режиме cors, чтобы видеть код ответа: «непрозрачный» ответ мог оказаться ошибкой
    // и остался бы в кэше до следующей версии. Все наши CDN (jsdelivr, cdnjs, Google Fonts) отдают cors.
    e.respondWith(
      caches.match(req).then(hit => {
        if (hit) return hit;
        return fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' })).then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }, () => fetch(req)); // cors не вышел — отдаём как раньше, но без сохранения
      })
    );
    return;
  }
  // проверка обновлений должна честно увидеть «нет сети» — мимо кэша
  if (url.searchParams.has('check')) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic' && !res.redirected) {
        const copy = res.clone();
        // страница сохраняется под одним адресом — без служебных меток ?v=…
        caches.open(CACHE).then(c => c.put(isPage ? './index.html' : url.pathname, copy));
      }
      return res;
    }).catch(() =>
      (isPage ? caches.match('./index.html') : caches.match(req, { ignoreSearch: true }))
        .then(hit => hit || Response.error())
    )
  );
});

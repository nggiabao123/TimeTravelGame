const CACHE_NAME = 'time-traveler-v1.0';

// Bỏ qua chờ đợi, kích hoạt ngay khi cài đặt xong
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Xóa sạch toàn bộ cache cũ khi có phiên bản mới
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Chỉ can thiệp các request GET; bỏ qua hoàn toàn Firebase, Google APIs và chrome-extension
  if (
    request.method !== 'GET' ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  const isCoreCode = /\.(html|js|css)($|\?)/i.test(url.pathname) || url.pathname.endsWith('/');

  if (isCoreCode) {
    // 2. Chiến lược Network-First cho HTML, JS, CSS
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(request)) // Khi mất mạng mới lấy từ Cache
    );
  } else {
    // 3. Tài nguyên đa phương tiện (ảnh, âm thanh): Ưu tiên Cache để tăng tốc, nếu chưa có thì tải từ mạng
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
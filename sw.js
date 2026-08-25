// Service Worker حداقلی برای «مصی دانلودر» - فقط برای برآورده‌کردن شرط نصب PWA
// (مرورگرهایی مثل کروم بدون یک SW با fetch handler، دکمه‌ی نصب را نشان نمی‌دهند).
// عمداً محتوای صوتی/تصویری یا درخواست‌های API را کش نمی‌کند تا همیشه آخرین
// نسخه و جدیدترین لینک‌های دانلود از سرور گرفته شوند.

const SHELL_CACHE = 'mosi-shell-v1';
const SHELL_URL = './';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.add(SHELL_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // فقط صفحه‌ی اصلی را از کش سرو کن (برای کارکرد آفلاین حداقلی)؛
  // بقیه‌ی درخواست‌ها (API، فایل صوتی، تصویر) مستقیم به شبکه می‌روند.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(SHELL_URL))
    );
  }
});

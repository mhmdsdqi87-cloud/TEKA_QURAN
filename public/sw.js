/**
 * سرویس‌ورکر حافظ — نسخهٔ محافظه‌کار
 * هدف: نصب‌شدنی بودن روی اندروید کروم + سرعت بیشتر بازدیدهای مجدد
 * استراتژی:
 *  - /api/* → همیشه شبکه (دادهٔ قرآن و آمار هرگز از کش نمی‌آید)
 *  - فایل‌های استاتیک Next (_next/static) و تصاویر → کش‌اول با به‌روزرسانی پس‌زمینه
 *  - بقیه (صفحهٔ HTML) → شبکه‌اول با فالبک کش
 */
const CACHE = "hafez-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API → همیشه شبکه
  if (url.pathname.startsWith("/api/")) return;

  // فایل‌های استاتیک هش‌دار Next و آیکون‌ها → کش‌اول
  if (url.pathname.startsWith("/_next/static") || /\.(png|svg|webp|ico|woff2?|mp3|js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) {
          // به‌روزرسانی پس‌زمینه
          fetch(req)
            .then((res) => {
              if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            })
            .catch(() => undefined);
          return hit;
        }
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // صفحات → شبکه‌اول با فالبک کش (آفلاین ملایم)
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
  );
});

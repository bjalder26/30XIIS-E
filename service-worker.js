const CACHE_NAME = "30XIIS-E-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./index.css",
  "./index.js"
];

// Install: cache files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch: serve cached content if offline
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

const CACHE_NAME = "so-mandiri-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/db.js",
  "./js/scanner.js",
  "./js/sync.js",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/html5-qrcode",
  "https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});


// Word Complet — service worker for the GitHub Pages build.
// Cache-first for the static shell; OpenAI requests are always network-only
// (never cached) so predictions stay fresh and the key isn't persisted.

const CACHE_VERSION = "wc-pages-v1";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./api-client.js",
  "./config.js",
  "./word-pools.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept OpenAI calls.
  if (url.origin.includes("openai.com")) return;

  // Same-origin GETs only.
  if (req.method !== "GET" || url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((fresh) => {
          if (fresh && fresh.ok) caches.open(CACHE_VERSION).then((c) => c.put(req, fresh.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((fresh) => {
        if (fresh && fresh.ok) {
          const copy = fresh.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return fresh;
      }).catch(() => cached);
    })
  );
});

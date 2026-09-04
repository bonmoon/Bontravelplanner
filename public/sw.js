const CACHE = "travel-card-studio-v10";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/app-icon.svg", "./assets/bontrip-home.png", "./assets/bontrip-travel.png", "./assets/bontrip-map.png", "./assets/bontrip-food.png", "./assets/bontrip-ledger.png", "./assets/paws-and-passport.mp3"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || caches.match("./index.html"))),
  );
});

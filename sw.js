const CACHE = "travel-card-studio-v19";
const SHELL = ["./","./index.html","./manifest.webmanifest","./icons/app-icon.svg","./assets/bontrip-food.png","./assets/bontrip-home.png","./assets/bontrip-ledger.png","./assets/bontrip-map.png","./assets/bontrip-travel.png","./assets/breakfast-croissant.png","./assets/index-BbRMekFL.css","./assets/index-DzDK6JPX.js","./assets/paws-and-passport.mp3","./assets/pdf.worker.min-Dswkl-cV.mjs","./assets/src-CBkgg4e7.js","./assets/sticker-smile.png","./assets/ticketFiles-D3WPG8qm.js","./assets/travel-assistant-avatar.png"];

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

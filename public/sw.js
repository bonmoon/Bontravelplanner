const CACHE = "travel-card-studio-v24";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon-v22.png", "./assets/bontrip-travel.png"];
const isImage = request => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(request.url);
const valid = (request, response) => response?.ok && (!isImage(request) || response.headers.get("content-type")?.startsWith("image/"));
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("travel-card-studio-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: isImage(request) });
    if (isImage(request) && valid(request, cached)) return cached;
    try {
      const response = await fetch(request);
      if (valid(request, response)) { try { await cache.put(request, response.clone()); } catch { /* Storage pressure must not break a successful response. */ } return response; }
      if (valid(request, cached)) return cached;
      return response;
    } catch {
      if (valid(request, cached)) return cached;
      if (request.mode === "navigate") return await cache.match("./index.html") || Response.error();
      return Response.error();
    }
  })());
});

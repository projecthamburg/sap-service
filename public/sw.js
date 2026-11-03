// Cache only this application's public shell. Authentication, research, files and GPS are never cached.
const CACHE = "sap-service-map-shell-v1";
const root = new URL("./", self.location.href);
const shell = [
  "./",
  "./index.html",
  "./site-config.json",
  "./brand/map-app-192.png",
  "./brand/map-app-512.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(shell.map((path) => new URL(path, root).href))
      )
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("sap-service-map-shell-") && key !== CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== root.origin ||
    !url.pathname.startsWith(root.pathname) ||
    request.headers.has("Authorization")
  )
    return;
  const path = url.pathname.slice(root.pathname.length);
  const publicAsset =
    /^(?:src|admin|fonts|brand)\//.test(path) ||
    ["site-config.json", "index.html", "manifest.webmanifest", ""].includes(
      path
    );
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(new URL("./index.html", root), copy));
          }
          return response;
        })
        .catch(() => caches.match(new URL("./index.html", root)))
    );
    return;
  }
  if (!publicAsset) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type !== "opaque") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const app = windows.find(
          (window) =>
            new URL(window.url).origin === root.origin &&
            new URL(window.url).pathname.startsWith(root.pathname)
        );
        return app
          ? app.focus()
          : clients.openWindow(
              new URL("./?workspace=maps#/en/admin/maps", root).href
            );
      })
  );
});

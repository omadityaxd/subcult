/* subcult service worker: offline shell + static assets, and web push (alerts). */

const VERSION = "v1"
const SHELL = `subcult-shell-${VERSION}`
const STATIC = `subcult-static-${VERSION}`
const OFFLINE_URLS = ["/", "/manifest.webmanifest", "/icons/192"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("subcult-") && key !== SHELL && key !== STATIC)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone())
              return response
            }),
        ),
      ),
    )
    return
  }

  // Pages: always the network (personal, fresh); the cached shell only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === "/") {
            const copy = response.clone()
            caches.open(SHELL).then((cache) => cache.put("/", copy))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/")),
        ),
    )
  }
})

self.addEventListener("push", (event) => {
  let data = { title: "subcult", body: "", url: "/notifications" }
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) }
  } catch {
    // A malformed payload still shows something rather than nothing.
  }
  // Only our own paths or https links are opened on tap.
  const url =
    typeof data.url === "string" && /^(\/|https:\/\/)/.test(data.url) ? data.url : "/notifications"
  event.waitUntil(
    self.registration.showNotification(String(data.title).slice(0, 80), {
      body: String(data.body).slice(0, 200),
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url },
      tag: "subcult-daily",
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url =
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open && url.startsWith("/")) {
        return open.focus().then(() => open.navigate(url))
      }
      return self.clients.openWindow(url)
    }),
  )
})

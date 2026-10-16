/* subcult service worker: web push (alerts). Offline caching lands with the PWA work. */

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = { title: "subcult", body: "", url: "/notifications" }
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) }
  } catch {
    // A malformed payload still shows something rather than nothing.
  }
  // Only our own paths or https links are opened on tap.
  const url = typeof data.url === "string" && /^(\/|https:\/\/)/.test(data.url) ? data.url : "/notifications"
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
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/"
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

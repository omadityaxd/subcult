"use client"

import { track } from "@/lib/analytics"

/**
 * Push on this device. iOS only allows web push in a Home Screen web app
 * (16.4+), and every browser wants the permission request to come straight
 * from a tap, so `enablePush` must be called in a click handler.
 */
export type PushState =
  | "unsupported"
  /** iPhone/iPad in Safari: install to the Home Screen first. */
  | "needs-install"
  | "off"
  | "on"
  | "blocked"

const SW_URL = "/sw.js"

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported"
  if (isIos() && !isStandalone()) return "needs-install"
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported"
  }
  if (Notification.permission === "denied") return "blocked"
  if (Notification.permission !== "granted") return "off"
  const registration = await navigator.serviceWorker.getRegistration(SW_URL)
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? "on" : "off"
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Ask (from a tap), subscribe, and register the device with the account. */
export async function enablePush(vapidPublicKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off"
  const registration = await navigator.serviceWorker.register(SW_URL)
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  })
  // Save the person's zone with the first opt-in, so quiet hours mean their night.
  await fetch("/api/alerts/prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  }).catch(() => undefined)
  if (response.ok) track("alert_opt_in")
  return response.ok ? "on" : "off"
}

export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL)
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined)
    await subscription.unsubscribe()
  }
  return "off"
}

/** Fired after a meaningful action (a grail hunt, a follow): the moment to offer push. */
export const MEANINGFUL_ACTION_EVENT = "subcult:meaningful-action"

export function announceMeaningfulAction(reason: "grail" | "follow"): void {
  window.dispatchEvent(new CustomEvent(MEANINGFUL_ACTION_EVENT, { detail: { reason } }))
}

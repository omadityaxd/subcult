import "server-only"
import webpush, { WebPushError } from "web-push"
import type { AlertsRepository } from "@/db/alerts-repository"
import { env, siteUrl } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"

let configured = false

function configure(): boolean {
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false
  if (!configured) {
    // The VAPID subject must be https: or mailto:, so local dev uses a placeholder origin.
    const subject = siteUrl.startsWith("https://") ? siteUrl : "https://localhost"
    webpush.setVapidDetails(subject, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
    configured = true
  }
  return true
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

/**
 * Sends one push to each of the person's devices. Endpoints the push
 * service says are gone (404/410) are deleted. Returns how many arrived.
 */
export async function sendPush(
  repo: AlertsRepository,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!configure()) return 0
  const subs = await repo.subscriptionsOf(userId)
  let delivered = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 12 * 3600, urgency: "normal" },
      )
      delivered += 1
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        await repo.deletePushSubscription(sub.endpoint)
      } else {
        log.warn("push.failed", { error: errorMessage(error) })
      }
    }
  }
  return delivered
}

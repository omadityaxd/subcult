import { alertsContext } from "@/lib/alerts/route-guard"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"

/** GET /api/notifications → the center's items and the unread count (for the bell). */
export async function GET(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: false })
  if (ctx instanceof Response) return ctx
  try {
    const [items, unread] = await Promise.all([
      ctx.repo.list(ctx.viewer.id),
      ctx.repo.unreadCount(ctx.viewer.id),
    ])
    return apiOk({
      unread,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url,
        imageUrl: n.imageUrl,
        createdAt: n.createdAt.toISOString(),
        read: n.readAt !== null,
      })),
    })
  } catch (error) {
    log.error("notifications.read_failed", { error: errorMessage(error) })
    return apiError("couldn't load notifications", 500, "failed")
  }
}

/** POST /api/notifications → mark everything read (opening the center does this). */
export async function POST(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: true })
  if (ctx instanceof Response) return ctx
  await ctx.repo.markAllRead(ctx.viewer.id)
  return apiOk({ unread: 0 })
}

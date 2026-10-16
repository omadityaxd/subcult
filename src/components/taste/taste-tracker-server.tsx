import { getViewer } from "@/lib/supabase/server"
import { TasteTracker } from "./taste-tracker"

/** Reads the session (request-time), so it renders inside a Suspense boundary. */
export async function TasteTrackerForViewer() {
  const viewer = await getViewer()
  return <TasteTracker signedIn={viewer !== null} />
}

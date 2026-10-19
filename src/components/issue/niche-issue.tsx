import { connection } from "next/server"
import { errorMessage, log } from "@/lib/log"
import type { TodayEdition } from "@/lib/today/edition"
import { buildNicheIssue } from "@/lib/today/server"
import { IssueSection } from "./issue-sections"

/**
 * A niche page as "the <niche> issue": the same sections as Today (Tea,
 * Fit, Grail, Sound, Scene) scoped to this one scene. The niche hero is
 * its cover.
 */
export async function NicheIssue({ slug }: { slug: string }) {
  await connection()
  let edition: TodayEdition | null = null
  try {
    edition = await buildNicheIssue(slug)
  } catch (error) {
    log.warn("niche_issue.failed", { slug, error: errorMessage(error) })
  }
  if (!edition || edition.sections.length === 0) return null
  return (
    <div data-testid="niche-issue" className="mb-16 space-y-16">
      {edition.sections.map((section, i) => (
        <IssueSection key={section.id} section={section} index={i + 1} now={edition.generatedAt} />
      ))}
    </div>
  )
}

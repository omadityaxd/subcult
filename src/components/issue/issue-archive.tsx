"use client"

import { ArrowUpRight } from "lucide-react"
import { useState } from "react"
import { SectionHeader } from "@/components/ds/section-header"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { type IssueRecord, formatIssueNo } from "@/lib/today/issues"
import { useIssueArchive } from "@/lib/today/issue-store"

const fullDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/** Me → Your issues: every past issue on this device, as a shelf of covers. */
export function IssueArchive() {
  const { issues } = useIssueArchive()
  const [open, setOpen] = useState<IssueRecord | null>(null)
  if (issues.length === 0) return null
  return (
    <section>
      <SectionHeader overline={`${issues.length} so far`} title="Your issues" />
      <ul className="-mx-(--gutter) no-scrollbar flex gap-3 overflow-x-auto px-(--gutter)">
        {issues.map((issue) => (
          <li key={issue.day} className="w-32 shrink-0">
            <button type="button" onClick={() => setOpen(issue)} className="block w-full text-left">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                {issue.coverImage ? (
                  <MediaImage src={issue.coverImage} alt="" sizes="128px" />
                ) : null}
                <span className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/50 to-black/70 p-2 text-white">
                  <span className="text-[10px] font-semibold tracking-[0.15em] uppercase">
                    No. {formatIssueNo(issue.no)}
                  </span>
                  <span className="line-clamp-3 font-serif text-footnote leading-tight italic">
                    {issue.headline}
                  </span>
                </span>
              </span>
              <span className="mt-1 block text-caption text-muted-foreground">
                {fullDate(issue.day)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <ResponsiveSheet
          open
          onOpenChange={(next) => (next ? undefined : setOpen(null))}
          title={`Issue No. ${formatIssueNo(open.no)}`}
          description={fullDate(open.day)}
        >
          <p className="font-serif text-title-2 italic">{open.headline}</p>
          {open.lines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-callout text-muted-foreground">
              {open.lines.map((line) => (
                <li key={line}>— {line}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 space-y-5">
            {open.sections
              .filter((section) => section.stories.length > 0)
              .map((section) => (
                <div key={section.id}>
                  <p className="text-caption font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                    {section.title}
                  </p>
                  <ul className="mt-1 divide-y divide-border">
                    {section.stories.map((story) => (
                      <li key={story.url + story.title}>
                        <a
                          href={story.url}
                          target={story.url.startsWith("http") ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 py-2 text-callout"
                        >
                          <span className="min-w-0 truncate">{story.title}</span>
                          <ArrowUpRight aria-hidden className="size-4 shrink-0 text-subtle" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </ResponsiveSheet>
      ) : null}
    </section>
  )
}

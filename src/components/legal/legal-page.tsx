import type { ReactNode } from "react"
import { LegalLinks } from "@/components/shell/legal-links"
import { Screen } from "@/components/shell/screen"
import { env } from "@/lib/env"

/** Shared frame for the privacy, terms and content pages: readable, plain, dated. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  /** The date this text last changed, e.g. "21 October 2026". */
  updated: string
  children: ReactNode
}) {
  return (
    <Screen>
      <article className="container-page max-w-2xl py-10 md:py-16">
        <p className="font-serif text-[30px] leading-none italic">subcult</p>
        <h1 className="mt-6 font-serif text-display leading-none italic">{title}</h1>
        <p className="mt-3 text-footnote text-muted-foreground">Last updated {updated}</p>
        <div className="legal mt-10 space-y-8 text-callout leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-title-2 [&_h2]:italic [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
          {children}
        </div>
        <p className="mt-12 border-t border-border pt-6 text-callout text-muted-foreground">
          Questions:{" "}
          {env.CONTACT_EMAIL ? (
            <a href={`mailto:${env.CONTACT_EMAIL}`} className="underline underline-offset-2">
              {env.CONTACT_EMAIL}
            </a>
          ) : (
            "use the report button on any fit."
          )}
        </p>
        <LegalLinks className="mt-6" />
      </article>
    </Screen>
  )
}

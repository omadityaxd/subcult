import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Content and copyright policy",
  description:
    "Where subcult's content comes from, how it's credited, and how to get something taken down.",
}

export default function ContentPolicyPage() {
  return (
    <LegalPage title="Content and copyright" updated="21 October 2026">
      <p>
        subcult points at culture made by other people. This page explains where it comes from, how
        we credit it, and how to ask us to take something down.
      </p>

      <section>
        <h2>Where things come from</h2>
        <ul>
          <li>
            <strong>Headlines:</strong> titles and links from news sites, via Google News and
            publishers&apos; feeds. Tapping one opens the original.
          </li>
          <li>
            <strong>Music:</strong> 30-second previews from Apple, with a link to the song;
            Spotify&apos;s own player for everything else.
          </li>
          <li>
            <strong>Videos:</strong> YouTube&apos;s player, so views and credit stay with the
            creator.
          </li>
          <li>
            <strong>Moodboards:</strong> images from Are.na, Unsplash and Pexels, credited to their
            source and photographer.
          </li>
          <li>
            <strong>Listings:</strong> live eBay listings, linked to the seller&apos;s page.
          </li>
          <li>
            <strong>Fits:</strong> photos posted by people on subcult, who confirm they have the
            right to share them.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t re-host videos or full songs.</li>
          <li>We don&apos;t make up headlines, quotes, numbers or listings.</li>
          <li>We don&apos;t sell other people&apos;s images.</li>
        </ul>
      </section>

      <section>
        <h2>Taking something down</h2>
        <p>
          If something on subcult is yours and you want it removed, tell us what it is (a link or a
          screenshot is enough), that you own it or act for the owner, and how to reach you. Fits
          can also be reported from the fit itself (&quot;stolen photo&quot;). We remove infringing
          content quickly.
        </p>
        <p>
          Content that lives on another service (a YouTube video, an Are.na block, a news story) is
          best removed at its source; once it&apos;s gone there, it disappears from subcult too.
        </p>
      </section>

      <section>
        <h2>Related</h2>
        <p>
          The rules for what people can post are in the <Link href="/terms">Terms</Link>. How we
          handle your data is in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/legal/legal-page"
import { AUTO_HIDE_REPORTS, REPORT_REASONS } from "@/lib/fits/schema"

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The rules for using subcult: who it's for, what you can post, and what happens if something breaks them.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="21 October 2026">
      <p>
        By using subcult you agree to these terms. They&apos;re short on purpose. If you don&apos;t
        agree, please don&apos;t use the app.
      </p>

      <section>
        <h2>Who it&apos;s for</h2>
        <p>
          You need to be 13 or older to make an account. One account per person, and you&apos;re
          responsible for what happens on it.
        </p>
      </section>

      <section>
        <h2>What you post</h2>
        <ul>
          <li>Post fits you took or have the right to share.</li>
          <li>
            You keep ownership of your photos. You let us show them in the app while they&apos;re
            up.
          </li>
          <li>Delete a fit any time; delete your account and every fit goes with it.</li>
        </ul>
      </section>

      <section>
        <h2>Not allowed</h2>
        <ul>
          <li>
            Nudity, sexual content, or anything sexual involving minors (reported to the
            authorities).
          </li>
          <li>
            Harassment, hate, threats, or posting someone else&apos;s photo without their say.
          </li>
          <li>Spam, scams, impersonation, or selling counterfeits.</li>
          <li>
            Rating people&apos;s looks, or content that pushes self-harm or dangerous body change.
          </li>
        </ul>
      </section>

      <section>
        <h2>What subcult never shows</h2>
        <p>
          Some topics stay out of every feed, search and generated niche, whatever their source:
        </p>
        <ul>
          <li>appearance rating and &quot;hardmaxxing&quot; culture;</li>
          <li>bonesmashing;</li>
          <li>steroids, PEDs and SARMs;</li>
          <li>blackpill and incel content;</li>
          <li>in glow-up niches, cosmetic surgery promotion and extreme dieting.</li>
        </ul>
      </section>

      <section>
        <h2>Reporting and takedowns</h2>
        <p>
          Every fit has a report button ({REPORT_REASONS.join(", ")}). Every report is reviewed. A
          fit reported by {AUTO_HIDE_REPORTS} different established accounts is hidden straight away
          until we review it. We remove what breaks these rules and may remove accounts that keep
          doing it. For copyright, see the <Link href="/content-policy">Content policy</Link>.
        </p>
      </section>

      <section>
        <h2>Other people&apos;s content</h2>
        <p>
          Headlines, videos, music previews, listings and moodboard images come from their
          publishers (news sites, YouTube, Spotify, Apple, eBay, Are.na, Unsplash, Pexels) and stay
          theirs. We link and credit them; their own terms apply when you use them. Listings and
          prices are the sellers&apos;; we don&apos;t sell anything ourselves.
        </p>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          subcult is free and provided as it is. Features can change, and we can&apos;t promise
          it&apos;s always available or error-free. As far as the law allows, we&apos;re not liable
          for losses from using it. You can stop using it and delete your account at any time.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If these terms change in a way that matters, we&apos;ll tell you in the app before it
          takes effect. Your data is covered by the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  )
}

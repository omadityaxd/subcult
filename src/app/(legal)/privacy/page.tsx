import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What subcult collects, why, who else touches it, and how to delete it.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="21 October 2026">
      <p>
        subcult is a daily magazine for your subculture. This page says, in plain words, what we
        collect, why, who else handles it, and how to take it back. We don&apos;t sell your data and
        we don&apos;t show ads.
      </p>

      <section>
        <h2>Without an account</h2>
        <p>You can read everything as a guest. On your device only, we keep:</p>
        <ul>
          <li>
            your taste profile: what you play, save, open, skip and pick in the vibe check, used to
            order your issue;
          </li>
          <li>your saves, your issue archive, your votes and recent searches.</li>
        </ul>
        <p>
          A few small cookies help the server build your issue before the page loads: a summary of
          your taste (<code>sc_taste</code>), your time zone (<code>sc_tz</code>), your last visit (
          <code>sc_prev</code>), your issue number (<code>sc_issue</code>) and, if a friend invited
          you, their invite (<code>sc_invite</code>). No advertising cookies.
        </p>
      </section>

      <section>
        <h2>With an account</h2>
        <ul>
          <li>
            <strong>Sign-in:</strong> your email address (or, with Google, the email, name and
            picture Google shares). We use the email to sign you in; it&apos;s never shown to
            anyone.
          </li>
          <li>
            <strong>Profile:</strong> your handle (public), whether your profile is public or
            friends-only, and, only if you turn it on, what you&apos;re listening to.
          </li>
          <li>
            <strong>Taste:</strong> your taste profile is synced to your account so it follows you
            between devices.
          </li>
          <li>
            <strong>Fits:</strong> photos you post, their captions and tags. We remove all location
            and camera data (EXIF, GPS) from every photo before storing it.
          </li>
          <li>
            <strong>Activity:</strong> likes, saves, follows, blocks, Cop or Drop votes, reports you
            make.
          </li>
          <li>
            <strong>Alerts:</strong> if you turn on push, your browser&apos;s push address, your
            alert settings, time zone and grail hunts.
          </li>
        </ul>
      </section>

      <section>
        <h2>Analytics and errors</h2>
        <p>
          We count how the app is used (for example &quot;opened today&apos;s issue&quot;,
          &quot;finished the vibe check&quot;) and record errors so we can fix them, through
          PostHog. Events carry counts and niche names, never what you type. We don&apos;t record
          sessions and we don&apos;t link these events to your account. PostHog may see your IP
          address to estimate your country.
        </p>
      </section>

      <section>
        <h2>Who else handles data</h2>
        <ul>
          <li>Supabase: sign-in, the database and fit photos.</li>
          <li>Vercel: hosting and server logs.</li>
          <li>Upstash: caching and rate limits (keyed by IP address, kept briefly).</li>
          <li>PostHog: analytics and error reports.</li>
          <li>
            Spotify, YouTube and Apple: only when you play their content; their players follow their
            own privacy policies.
          </li>
          <li>
            Anthropic: public images from moodboard sources are sent for tagging. Your fit photos
            are not.
          </li>
          <li>eBay, Grailed, Depop and stores: only if you follow a link to them.</li>
        </ul>
      </section>

      <section>
        <h2>Your controls</h2>
        <ul>
          <li>
            <strong>Download everything:</strong> Me → Your data → Download. You get a file with
            everything tied to your account.
          </li>
          <li>
            <strong>Delete everything:</strong> Me → Your data → Delete my account. It removes your
            account, taste profile, fits and their photos, likes, saves, follows, votes and alerts,
            straight away. It can&apos;t be undone.
          </li>
          <li>
            <strong>On this device:</strong> clearing your browser&apos;s site data removes what the
            app keeps locally.
          </li>
          <li>Push alerts can be turned off any time in Me → Alerts or your browser.</li>
        </ul>
      </section>

      <section>
        <h2>Age</h2>
        <p>
          subcult is for people 13 and older. If you believe someone younger has an account, tell us
          and we&apos;ll delete it.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes in a way that matters, we&apos;ll say so in the app before it takes
          effect. See also the <Link href="/terms">Terms</Link> and the{" "}
          <Link href="/content-policy">Content policy</Link>.
        </p>
      </section>
    </LegalPage>
  )
}

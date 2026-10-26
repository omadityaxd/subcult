import { UserRound } from "lucide-react"
import Link from "next/link"
import { connection } from "next/server"
import { SectionHeader } from "@/components/ds/section-header"
import { FitGrid } from "@/components/fits/fit-tile"
import { myFits } from "@/lib/fits/server"
import { postingEnabled } from "@/lib/supabase/admin"
import { authEnabled, getViewer } from "@/lib/supabase/server"
import { HandleForm } from "@/app/(tabs)/fits/new/handle-form"
import { SignOutButton } from "@/components/me/sign-out-button"

/** Me: who you are, your fits and the fits you saved; or the way in. */
export async function AccountSection() {
  await connection()
  const viewer = authEnabled ? await getViewer() : null
  if (!viewer) {
    return (
      <section className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full border border-border-strong text-muted-foreground">
          <UserRound aria-hidden className="size-7" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-headline font-semibold">Guest</p>
          <p className="text-callout text-muted-foreground">
            {authEnabled
              ? "Sign in to post fits, like and save them."
              : "Saves stay on this device."}
          </p>
        </div>
        {authEnabled ? (
          <Link
            href="/login?next=/me"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-foreground px-4 text-footnote font-semibold text-background"
          >
            Sign in
          </Link>
        ) : null}
      </section>
    )
  }

  const { profile, posted, saved } = await myFits(viewer)
  return (
    <div className="space-y-12">
      <section id="account" className="scroll-mt-20 space-y-5">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-foreground font-serif text-title-2 text-background italic">
            {(profile?.handle ?? viewer.email ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-headline font-semibold">
              {profile ? `@${profile.handle}` : "No handle yet"}
            </p>
            <p className="text-callout text-muted-foreground">
              {posted.length} {posted.length === 1 ? "fit" : "fits"}
            </p>
          </div>
          <SignOutButton />
        </div>
        {/* The one place to pick a handle (fits, friends and invites all wait on it). */}
        {profile ? null : (
          <HandleForm intro="Pick your handle: friends find you by it and your fits are credited to it." />
        )}
      </section>

      {postingEnabled() ? (
        <Link
          href="/fits/new"
          className="flex h-12 items-center justify-center rounded-full bg-foreground text-callout font-semibold text-background"
        >
          Post your fit
        </Link>
      ) : null}

      {posted.length > 0 ? (
        <section>
          <SectionHeader title="Your fits" />
          <FitGrid fits={posted} signedIn />
        </section>
      ) : null}
      {saved.length > 0 ? (
        <section>
          <SectionHeader title="Saved fits" />
          <FitGrid fits={saved} signedIn />
        </section>
      ) : null}
    </div>
  )
}

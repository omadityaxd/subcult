"use client"

import { useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabase/client"

const callbackUrl = (next: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

/** Google or a magic link. Both land on /auth/callback, which sets the session cookie. */
export function LoginForm({
  supabaseUrl,
  publishableKey,
  next,
  error,
}: {
  supabaseUrl: string
  publishableKey: string
  next: string
  error: string | null
}) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")
  const [message, setMessage] = useState<string | null>(
    error ? "That sign-in link didn't work. Try again." : null,
  )
  const supabase = () => getSupabaseBrowser(supabaseUrl, publishableKey)

  async function google() {
    setMessage(null)
    const { error: oauthError } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(next) },
    })
    if (oauthError) setMessage("Google sign-in isn't available right now.")
  }

  async function magicLink(event: React.FormEvent) {
    event.preventDefault()
    setState("sending")
    setMessage(null)
    const { error: otpError } = await supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(next) },
    })
    if (otpError) {
      setState("failed")
      setMessage("Couldn't send the link. Check the address and try again.")
    } else {
      setState("sent")
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <button
        type="button"
        onClick={() => void google()}
        className="h-12 w-full rounded-full bg-foreground text-callout font-semibold text-background active:scale-[0.99]"
      >
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-caption text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      {state === "sent" ? (
        <p role="status" className="rounded-2xl bg-muted p-4 text-callout">
          Check {email}: the sign-in link is on its way.
        </p>
      ) : (
        <form onSubmit={(event) => void magicLink(event)} className="space-y-3">
          <label className="block">
            <span className="text-footnote font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-border-strong bg-transparent px-4 text-body outline-none focus:border-foreground"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={state === "sending"}
            className="h-12 w-full rounded-full border border-border-strong text-callout font-semibold hover:bg-muted disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {message ? (
        <p role="alert" className="text-footnote text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}

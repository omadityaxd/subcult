import { Bell, Newspaper, Sparkles } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { Screen } from "@/components/shell/screen"
import { env } from "@/lib/env"
import { safeNext } from "@/lib/auth/redirect"
import { LoginCollage } from "./login-collage"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

/** What signing in gets you. No numbers until they're real and meaningful. */
const VALUE_PROPS = [
  {
    icon: Newspaper,
    title: "A new issue every day",
    body: "Your scenes' tea, fits, grails and sounds, numbered and kept.",
  },
  {
    icon: Bell,
    title: "Grail alerts",
    body: "Hunt a piece once; hear when it's listed.",
  },
  {
    icon: Sparkles,
    title: "Vibe match",
    body: "See how close your taste is to your friends'.",
  },
] as const

/** Split screen: today's real issue on one side, sign-in (or browse as a guest) on the other. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Screen withTabBar={false} className="min-h-dvh md:grid md:grid-cols-2">
      <div className="md:sticky md:top-0 md:h-dvh">
        <Suspense fallback={<div className="h-[26rem] animate-pulse bg-muted md:h-full" />}>
          <LoginCollage />
        </Suspense>
      </div>
      <div className="flex items-center justify-center px-6 py-10 md:px-12">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-title-1 italic">Get your issue</h1>
          <p className="mt-2 text-callout text-muted-foreground">
            Sign in to keep your issues, post fits and find your friends. Browsing stays open to
            everyone.
          </p>
          <Suspense fallback={null}>
            <Form searchParams={searchParams} />
          </Suspense>
          <ul className="mt-10 space-y-4 border-t border-border pt-6">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border-strong">
                  <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-callout font-semibold">{title}</span>
                  <span className="block text-footnote text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Screen>
  )
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  await connection()
  const params = await searchParams
  const next = safeNext(typeof params.next === "string" ? params.next : null, "/")
  const error = typeof params.error === "string" ? params.error : null
  const guest = (
    <Link
      href={next}
      className="mt-4 block text-center text-footnote font-medium text-muted-foreground underline-offset-2 hover:underline"
    >
      Continue as guest
    </Link>
  )
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return (
      <>
        <p className="mt-8 text-callout text-muted-foreground">
          Sign-in isn&apos;t available here.
        </p>
        {guest}
      </>
    )
  }
  return (
    <>
      <LoginForm
        supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL}
        publishableKey={env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
        next={next}
        error={error}
      />
      {guest}
    </>
  )
}

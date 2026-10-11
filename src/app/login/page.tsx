import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { Screen } from "@/components/shell/screen"
import { env } from "@/lib/env"
import { safeNext } from "@/lib/auth/redirect"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Screen withTabBar={false} className="grid place-items-center px-6">
      <div className="w-full max-w-sm py-16">
        <Link href="/" className="font-serif text-[30px] leading-none italic">
          subcult
        </Link>
        <h1 className="mt-8 font-serif text-title-1 italic">Post your fits</h1>
        <p className="mt-2 text-callout text-muted-foreground">
          Sign in to post fits, like and save them, and get a profile. Browsing stays open to
          everyone.
        </p>
        <Suspense fallback={null}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </Screen>
  )
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  await connection()
  const params = await searchParams
  const next = safeNext(typeof params.next === "string" ? params.next : null)
  const error = typeof params.error === "string" ? params.error : null
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return (
      <p className="mt-8 text-callout text-muted-foreground">Sign-in isn&apos;t available here.</p>
    )
  }
  return (
    <LoginForm
      supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL}
      publishableKey={env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
      next={next}
      error={error}
    />
  )
}

import type { ReactNode } from "react"

/**
 * Mobile: the app is the viewport. Desktop: the same app sits in a phone-width
 * column over a soft, blurred brand glow, so it never looks like a stretched website.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 hidden overflow-hidden md:block"
      >
        <div className="bg-brand-violet/35 absolute -top-40 -left-32 size-[36rem] rounded-full blur-[140px]" />
        <div className="bg-brand-pink/25 absolute top-1/3 -right-40 size-[32rem] rounded-full blur-[140px]" />
        <div className="bg-brand-lime/15 absolute -bottom-48 left-1/4 size-[30rem] rounded-full blur-[140px]" />
      </div>
      <div className="relative mx-auto min-h-dvh w-full max-w-(--column-width) bg-background md:border-x md:shadow-[0_0_120px_rgb(0_0_0/0.45)]">
        {children}
      </div>
    </div>
  )
}

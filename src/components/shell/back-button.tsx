import { ChevronLeft } from "lucide-react"
import Link from "next/link"

interface BackButtonProps {
  href: string
  label: string
}

/** iOS-style "‹ Back" that plays the reverse (nav-back) slide. */
export function BackButton({ href, label }: BackButtonProps) {
  return (
    <Link
      href={href}
      transitionTypes={["nav-back"]}
      className="-ml-2 flex items-center gap-0.5 rounded-full py-1 pr-2 text-[17px] text-niche"
    >
      <ChevronLeft aria-hidden className="size-7" strokeWidth={2.2} />
      <span>{label}</span>
    </Link>
  )
}

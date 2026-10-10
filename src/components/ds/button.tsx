import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export const buttonStyles = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap transition-[transform,background-color,opacity] duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:stroke-[1.5]",
  {
    variants: {
      variant: {
        primary: "bg-foreground text-background hover:opacity-90",
        secondary: "bg-muted text-foreground hover:bg-border-strong",
        ghost: "text-foreground hover:bg-muted",
        accent: "bg-niche text-niche-foreground hover:opacity-90",
        outline: "border border-border-strong text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-8 rounded-full px-3.5 text-footnote",
        md: "h-10 rounded-full px-5 text-callout",
        lg: "h-12 rounded-full px-6 text-body",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
)

type ButtonVariants = VariantProps<typeof buttonStyles>

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonVariants) {
  return (
    <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />
  )
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & ButtonVariants) {
  return <Link className={cn(buttonStyles({ variant, size }), className)} {...props} />
}

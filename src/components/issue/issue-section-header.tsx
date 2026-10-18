/**
 * Consistent section openers: "01 / The Tea" with a small-caps kicker and,
 * when the section is personalized, one line saying why (instead of a
 * label above every card).
 */
export function IssueSectionHeader({
  index,
  title,
  kicker,
  reason,
  id,
}: {
  index: number
  title: string
  kicker: string
  reason?: string | null
  id: string
}) {
  return (
    <header className="mb-5 border-t border-foreground/80 pt-3">
      <p className="flex items-baseline justify-between gap-3 text-caption font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        <span>
          {String(index).padStart(2, "0")} / {kicker}
        </span>
      </p>
      <h3 id={id} className="mt-1 font-serif text-[36px] leading-none italic md:text-[48px]">
        {title}
      </h3>
      {reason ? <p className="mt-2 text-footnote text-muted-foreground">{reason}</p> : null}
    </header>
  )
}

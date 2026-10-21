/**
 * At or under this many items a masonry grid would leave orphan columns:
 * show a wide editorial layout instead (components/niche/feed/few-cards).
 * Lives outside the client component so server components read the number,
 * not a client reference.
 */
export const FEW_CARDS = 2

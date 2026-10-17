import { Music2 } from "lucide-react"
import { CdnImage } from "@/components/ds/cdn-image"
import type { StoryMusic } from "@/lib/music/story-music"

/**
 * Instagram-style music sticker: what's playing, linked to Spotify. The Apple
 * Music link sits right next to it because the audio is an iTunes preview
 * (Apple's terms: previews must be shown near a store link).
 */
export function MusicSticker({ music, playing }: { music: StoryMusic; playing: boolean }) {
  return (
    <div>
      <a
        href={music.spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${music.title} by ${music.artist}, open in Spotify`}
        className="flex w-fit max-w-full min-w-0 items-center gap-2.5 rounded-2xl bg-black/40 p-1.5 pr-4 backdrop-blur-md transition-colors hover:bg-black/55"
      >
        <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-white/10">
          {music.artworkUrl ? (
            <CdnImage src={music.artworkUrl} alt="" fill sizes="36px" className="object-cover" />
          ) : (
            <Music2 aria-hidden className="m-2 size-5" strokeWidth={1.5} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-footnote font-semibold">
            <Equalizer playing={playing} />
            <span className="truncate">{music.title}</span>
          </span>
          <span className="block truncate text-caption text-white/70">{music.artist}</span>
        </span>
      </a>
      {music.appleUrl ? (
        <a
          href={music.appleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 ml-1.5 inline-block text-caption text-white/60 underline-offset-2 hover:text-white hover:underline"
        >
          Preview via Apple Music
        </a>
      ) : null}
    </div>
  )
}

/** Three bars that bounce while audio plays (still when paused or reduced motion). */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span aria-hidden className="flex h-3 shrink-0 items-end gap-[2px]">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="eq-bar w-[2px] rounded-full bg-current"
          style={{
            animationDelay: `${bar * 160}ms`,
            animationPlayState: playing ? "running" : "paused",
          }}
        />
      ))}
    </span>
  )
}

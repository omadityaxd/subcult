import { describe, expect, it, vi } from "vitest"
import { type AudioTrack, createAudioEngine } from "./engine"
import { createMediaCoordinator } from "./media-coordinator"

class FakeAudio {
  src = ""
  loop = false
  muted = false
  currentTime = 0
  duration = 30
  crossOrigin: string | null = null
  preload = ""
  paused = true
  play = vi.fn(async () => {
    this.paused = false
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  addEventListener() {}
}

/** An embedded player (Spotify embed, YouTube, the Spotify SDK) as the coordinator sees it. */
class FakeEmbed {
  playing = false
  constructor(
    readonly id: string,
    private readonly coordinator: ReturnType<typeof createMediaCoordinator>,
  ) {
    coordinator.register(id, { pause: () => this.pause() })
  }
  start() {
    this.playing = true
    this.coordinator.started(this.id)
  }
  pause() {
    this.playing = false
    this.coordinator.stopped(this.id)
  }
}

const track = (id: string): AudioTrack => ({
  id,
  src: `https://audio-ssl.itunes.apple.com/${id}.m4a`,
  title: id,
  artist: "Che",
})

function setup() {
  const elements: FakeAudio[] = []
  const engine = createAudioEngine({
    createAudio: () => {
      const element = new FakeAudio()
      elements.push(element)
      return element as unknown as HTMLAudioElement
    },
    createContext: () => null,
    storage: null,
    mediaSession: null,
    setTimer: (run) => run(), // fades complete at once
  })
  const coordinator = createMediaCoordinator(() => engine)
  const embeds = ["spotify-embed", "youtube-reel", "spotify-sdk"].map(
    (id) => new FakeEmbed(id, coordinator),
  )
  /** Every source that is making sound right now. */
  const audible = () => [
    ...elements
      .filter((e) => !e.paused && !e.src.startsWith("data:"))
      .map((e) => `engine:${e.src.split("/").pop()}`),
    ...embeds.filter((e) => e.playing).map((e) => e.id),
  ]
  return { engine, coordinator, embeds, audible }
}

describe("one source of sound at a time", () => {
  it("starting any source silences every other one", async () => {
    const { engine, embeds, audible, coordinator } = setup()
    const [spotifyEmbed, youtube, sdk] = embeds as [FakeEmbed, FakeEmbed, FakeEmbed]
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

    engine.playQueue([track("sound-row"), track("next")], 0, { owner: "player" })
    await settle()
    expect(audible()).toEqual(["engine:sound-row.m4a"])

    spotifyEmbed.start() // no preview: Spotify's player in a sheet
    expect(audible()).toEqual(["spotify-embed"])

    youtube.start() // a reel unmuted
    expect(audible()).toEqual(["youtube-reel"])

    engine.play(track("vibe-card"), { owner: "preview" }) // a vibe check sound card
    await settle()
    expect(audible()).toEqual(["engine:vibe-card.m4a"])

    engine.play(track("story"), { owner: "story", loop: true }) // a story opens
    await settle()
    expect(audible()).toEqual(["engine:story.m4a"])

    sdk.start() // Spotify Connect full song
    expect(audible()).toEqual(["spotify-sdk"])
    expect(coordinator.isAnythingPlaying()).toBe(true)

    engine.playQueue([track("artist-sheet")], 0, { owner: "player" })
    await settle()
    expect(audible()).toEqual(["engine:artist-sheet.m4a"])
  })

  it("knows when nothing is playing (autoplay may start) and when something is", async () => {
    const { engine, embeds, coordinator } = setup()
    expect(coordinator.isAnythingPlaying()).toBe(false)
    embeds[0]!.start()
    expect(coordinator.isAnythingPlaying()).toBe(true)
    embeds[0]!.pause()
    expect(coordinator.isAnythingPlaying()).toBe(false)
    engine.play(track("a"), { owner: "player" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(coordinator.isAnythingPlaying()).toBe(true)
  })

  it("a closed embed no longer counts as playing", () => {
    const { embeds, coordinator } = setup()
    const unregister = coordinator.register("sheet-embed", { pause: () => undefined })
    coordinator.started("sheet-embed")
    expect(coordinator.isAnythingPlaying()).toBe(true)
    unregister()
    expect(coordinator.isAnythingPlaying()).toBe(false)
    expect(embeds.every((e) => !e.playing)).toBe(true)
  })
})

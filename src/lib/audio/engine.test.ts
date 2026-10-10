import { describe, expect, it, vi } from "vitest"
import { type AudioTrack, MUTED_STORAGE_KEY, createAudioEngine } from "./engine"

class FakeAudio {
  src = ""
  loop = false
  muted = false
  currentTime = 0
  crossOrigin: string | null = null
  preload = ""
  paused = true
  play = vi.fn(async () => {
    this.paused = false
  })
  pause = vi.fn(() => {
    this.paused = true
  })
}

function setup({ storage = new Map<string, string>() } = {}) {
  const elements: FakeAudio[] = []
  const timers: (() => void)[] = []
  const engine = createAudioEngine({
    createAudio: () => {
      const element = new FakeAudio()
      elements.push(element)
      return element as unknown as HTMLAudioElement
    },
    createContext: () => null, // jsdom-free: exercise the no-Web-Audio path
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
    },
    setTimer: (run) => timers.push(run),
  })
  return { engine, elements, timers, storage }
}

const track = (id: string): AudioTrack => ({
  id,
  src: `https://audio-ssl.itunes.apple.com/${id}.m4a`,
  title: id,
  artist: "Che",
})

describe("audio engine", () => {
  it("unlocks both decks inside the gesture with a silent clip", () => {
    const { engine, elements } = setup()
    engine.unlock()
    expect(elements).toHaveLength(2)
    for (const element of elements) {
      expect(element.play).toHaveBeenCalledTimes(1)
      expect(element.src.startsWith("data:audio/wav")).toBe(true)
      expect(element.crossOrigin).toBe("anonymous")
    }
  })

  it("plays on one deck and switches decks for the next track", () => {
    const { engine, elements } = setup()
    engine.play(track("a"), { owner: "story", loop: true })
    const [first, second] = elements
    expect(second.src).toContain("a.m4a")
    expect(second.loop).toBe(true)
    expect(engine.getState()).toMatchObject({ playing: true, owner: "story" })

    engine.play(track("b"), { owner: "story" })
    expect(first.src).toContain("b.m4a")
    expect(second.pause).toHaveBeenCalled() // no Web Audio → hard switch, old deck stops
    expect(engine.getState().track?.id).toBe("b")
  })

  it("hands over between owners: the newest play() wins", () => {
    const { engine } = setup()
    engine.play(track("story-song"), { owner: "story" })
    engine.play(track("player-song"), { owner: "player" })
    expect(engine.getState()).toMatchObject({ owner: "player", playing: true })
    engine.stop("story") // a closing story mustn't stop the player's track
    expect(engine.getState().track?.id).toBe("player-song")
  })

  it("pauses, resumes and stops", () => {
    const { engine, elements } = setup()
    engine.play(track("a"), { owner: "story" })
    engine.pause()
    expect(engine.getState().playing).toBe(false)
    expect(elements[1].pause).toHaveBeenCalled()
    engine.resume()
    expect(engine.getState().playing).toBe(true)
    engine.stop("story")
    expect(engine.getState()).toMatchObject({ track: null, owner: null, playing: false })
  })

  it("replaying the current track resumes instead of restarting", () => {
    const { engine, elements } = setup()
    engine.play(track("a"), { owner: "story" })
    engine.pause()
    engine.play(track("a"), { owner: "story" })
    expect(elements[1].play).toHaveBeenCalledTimes(2)
    expect(elements[0].src).toBe("") // never switched decks
  })

  it("remembers the mute preference and starts muted next time", () => {
    const { engine, storage } = setup()
    engine.play(track("a"), { owner: "story" })
    engine.setMuted(true)
    expect(storage.get(MUTED_STORAGE_KEY)).toBe("1")
    const next = setup({ storage })
    expect(next.engine.getState().muted).toBe(true)
    next.engine.play(track("b"), { owner: "story" })
    expect(next.elements.every((element) => element.muted)).toBe(true)
  })

  it("notifies subscribers on every state change", () => {
    const { engine } = setup()
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)
    engine.play(track("a"), { owner: "story" })
    engine.pause()
    unsubscribe()
    engine.resume()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

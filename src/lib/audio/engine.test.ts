import { describe, expect, it, vi } from "vitest"
import {
  type AudioTrack,
  type MediaSessionLike,
  MUTED_STORAGE_KEY,
  createAudioEngine,
} from "./engine"

class FakeAudio {
  src = ""
  loop = false
  muted = false
  currentTime = 0
  duration = 30
  crossOrigin: string | null = null
  preload = ""
  paused = true
  private handlers = new Map<string, (() => void)[]>()
  play = vi.fn(async () => {
    this.paused = false
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  addEventListener(type: string, handler: () => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler])
  }
  fire(type: string) {
    this.handlers.get(type)?.forEach((handler) => handler())
  }
}

function fakeSession() {
  const handlers = new Map<string, MediaSessionActionHandler | null>()
  const session: MediaSessionLike & { handlers: typeof handlers } = {
    metadata: null,
    playbackState: "none",
    handlers,
    setActionHandler: (action, handler) => void handlers.set(action, handler),
    setPositionState: vi.fn(),
  }
  return session
}

function setup({ storage = new Map<string, string>() } = {}) {
  const elements: FakeAudio[] = []
  const session = fakeSession()
  const engine = createAudioEngine({
    createAudio: () => {
      const element = new FakeAudio()
      elements.push(element)
      return element as unknown as HTMLAudioElement
    },
    createContext: () => null, // exercise the no-Web-Audio path
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
    },
    mediaSession: session,
    createMetadata: (init) => init as unknown as MediaMetadata,
    setTimer: () => undefined,
  })
  /** The element currently holding the given track. */
  const holding = (id: string) => elements.find((element) => element.src.includes(`${id}.m4a`))
  return { engine, elements, storage, session, holding }
}

const track = (id: string): AudioTrack => ({
  id,
  src: `https://audio-ssl.itunes.apple.com/${id}.m4a`,
  title: `Song ${id}`,
  artist: "Che",
  artworkUrl: `https://is1-ssl.mzstatic.com/${id}.jpg`,
})
const QUEUE = [track("a"), track("b"), track("c")]

describe("audio engine: basics", () => {
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

  it("plays on alternating decks and stops the old one", () => {
    const { engine, elements } = setup()
    engine.play(track("a"), { owner: "story", loop: true })
    const [first, second] = elements
    expect(second.src).toContain("a.m4a")
    expect(second.loop).toBe(true)
    engine.play(track("b"), { owner: "story" })
    expect(first.src).toContain("b.m4a")
    expect(second.pause).toHaveBeenCalled()
    expect(engine.getState()).toMatchObject({ playing: true, owner: "story" })
  })

  it("hands over between owners: the newest play wins, old owners can't stop it", () => {
    const { engine } = setup()
    engine.play(track("story-song"), { owner: "story" })
    engine.playQueue(QUEUE, 0, { owner: "player" })
    expect(engine.getState()).toMatchObject({ owner: "player", playing: true })
    engine.stop("story")
    expect(engine.getState().track?.id).toBe("a")
  })

  it("pauses, resumes, toggles and stops", () => {
    const { engine, holding } = setup()
    engine.play(track("a"), { owner: "player" })
    engine.pause()
    expect(engine.getState().playing).toBe(false)
    expect(holding("a")?.pause).toHaveBeenCalled()
    engine.toggle()
    expect(engine.getState().playing).toBe(true)
    engine.stop()
    expect(engine.getState()).toMatchObject({ track: null, owner: null, queue: [], index: -1 })
  })

  it("remembers the mute preference", () => {
    const { engine, storage } = setup()
    engine.play(track("a"), { owner: "story" })
    engine.setMuted(true)
    expect(storage.get(MUTED_STORAGE_KEY)).toBe("1")
    const next = setup({ storage })
    expect(next.engine.getState().muted).toBe(true)
    next.engine.play(track("b"), { owner: "story" })
    expect(next.elements.every((element) => element.muted)).toBe(true)
  })
})

describe("audio engine: queue", () => {
  it("plays a queue from any index and moves next/previous", () => {
    const { engine } = setup()
    engine.playQueue(QUEUE, 1, { owner: "player", context: "This is rage" })
    expect(engine.getState()).toMatchObject({ index: 1, context: "This is rage" })
    expect(engine.getState().track?.id).toBe("b")
    engine.next()
    expect(engine.getState().track?.id).toBe("c")
    engine.next() // end of queue: stays put
    expect(engine.getState().track?.id).toBe("c")
    engine.previous()
    expect(engine.getState().track?.id).toBe("b")
  })

  it("previous restarts the song when you're a few seconds in", () => {
    const { engine, holding } = setup()
    engine.playQueue(QUEUE, 1, { owner: "player" })
    const element = holding("b") as FakeAudio
    element.currentTime = 12
    engine.previous()
    expect(engine.getState().track?.id).toBe("b")
    expect(element.currentTime).toBe(0)
  })

  it("auto-advances when a track ends, and stops at the end of the queue", () => {
    const { engine, holding } = setup()
    engine.playQueue(QUEUE, 1, { owner: "player" })
    holding("b")?.fire("ended")
    expect(engine.getState().track?.id).toBe("c")
    holding("c")?.fire("ended")
    expect(engine.getState()).toMatchObject({ playing: false })
    expect(engine.getState().track?.id).toBe("c")
  })

  it("keeps the current song when a new queue starts on it", () => {
    const { engine, holding } = setup()
    engine.play(track("b"), { owner: "story" })
    const element = holding("b") as FakeAudio
    const plays = element.play.mock.calls.length
    engine.playQueue(QUEUE, 1, { owner: "player" })
    expect(engine.getState()).toMatchObject({ owner: "player", index: 1 })
    expect(element.play.mock.calls.length).toBe(plays + 1) // resumed, not reloaded
    expect(element.src).toContain("b.m4a")
  })
})

describe("audio engine: cue", () => {
  it("loads a queue paused, ready to resume", () => {
    const { engine, holding } = setup()
    engine.cue(QUEUE, 2, { owner: "player", context: "This is rage" })
    expect(engine.getState()).toMatchObject({ owner: "player", index: 2, playing: false })
    const element = holding("c") as FakeAudio
    expect(element.play).not.toHaveBeenCalled()
    engine.resume()
    expect(element.play).toHaveBeenCalled()
    expect(engine.getState().playing).toBe(true)
  })
})

describe("audio engine: progress, listening and media session", () => {
  it("publishes progress separately and counts only real listening", () => {
    const { engine, holding } = setup()
    const heard: number[] = []
    engine.onListen((_track, seconds) => heard.push(seconds))
    const progressSpy = vi.fn()
    engine.subscribeProgress(progressSpy)
    engine.playQueue(QUEUE, 0, { owner: "player" })
    const element = holding("a") as FakeAudio
    element.currentTime = 1
    element.fire("timeupdate")
    element.currentTime = 1.5
    element.fire("timeupdate")
    element.currentTime = 20 // a seek: not counted
    element.fire("timeupdate")
    expect(heard).toEqual([1, 0.5])
    expect(engine.getProgress()).toEqual({ position: 20, duration: 30 })
    expect(progressSpy).toHaveBeenCalled()
  })

  it("doesn't count muted listening", () => {
    const { engine, holding } = setup()
    const heard: number[] = []
    engine.onListen((_track, seconds) => heard.push(seconds))
    engine.play(track("a"), { owner: "player" })
    engine.setMuted(true)
    const element = holding("a") as FakeAudio
    element.currentTime = 1
    element.fire("timeupdate")
    expect(heard).toEqual([])
  })

  it("drives lock-screen metadata and controls", () => {
    const { engine, session } = setup()
    engine.playQueue(QUEUE, 0, { owner: "player", context: "This is rage" })
    expect(session.metadata).toMatchObject({
      title: "Song a",
      artist: "Che",
      album: "This is rage",
    })
    expect(session.playbackState).toBe("playing")
    session.handlers.get("nexttrack")?.({ action: "nexttrack" })
    expect(engine.getState().track?.id).toBe("b")
    session.handlers.get("pause")?.({ action: "pause" })
    expect(session.playbackState).toBe("paused")
    engine.stop()
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe("none")
  })
})

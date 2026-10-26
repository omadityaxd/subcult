/**
 * One audio engine for the whole app: stories, the persistent player, the
 * Sounds tab and artist sheets all play through it. Exactly one thing plays at
 * a time; whoever calls play()/playQueue() takes over (stories, the player…).
 *
 * Two "decks" (audio elements) let tracks crossfade. When Web Audio is
 * available, fades run through GainNodes, which also works on iOS, where
 * element.volume is read-only. iOS only allows programmatic play() on an
 * element that was first played inside a user gesture, so call unlock()
 * synchronously in the tap handler that leads to sound.
 */

export interface AudioTrack {
  id: string
  src: string
  title: string
  artist: string
  artworkUrl?: string | null
  /** Where "Open in Spotify" goes (exact track, or the artist's page). */
  spotifyUrl?: string | null
  /** Apple Music page for the preview (Apple's terms want it near the preview). */
  appleUrl?: string | null
  /** Niche the track was queued from (Wrapped, attribution). */
  niche?: string | null
}

export type AudioOwner = "story" | "player" | "preview"

export interface AudioState {
  track: AudioTrack | null
  owner: AudioOwner | null
  playing: boolean
  muted: boolean
  queue: readonly AudioTrack[]
  index: number
  /** Label for the queue ("This is rage"). */
  context: string | null
}

export interface Progress {
  position: number
  duration: number
}

export interface PlayOptions {
  owner: AudioOwner
  /** Stories loop their 30s preview under ~50s of frames. */
  loop?: boolean
  context?: string | null
}

interface Deck {
  element: HTMLAudioElement
  gain: GainNode | null
}

/** Minimal slice of navigator.mediaSession (lock screen / headphone controls). */
export interface MediaSessionLike {
  metadata: MediaMetadata | null
  playbackState: MediaSessionPlaybackState
  setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void
  setPositionState?(state?: MediaPositionState): void
}

export interface EngineEnvironment {
  createAudio: () => HTMLAudioElement
  /** null where Web Audio is missing: tracks then switch without a fade. */
  createContext: () => AudioContext | null
  storage?: Pick<Storage, "getItem" | "setItem"> | null
  mediaSession?: MediaSessionLike | null
  createMetadata?: (init: MediaMetadataInit) => MediaMetadata
  fadeMs?: number
  setTimer?: (run: () => void, ms: number) => unknown
}

export const MUTED_STORAGE_KEY = "subcult-audio-muted"
const DEFAULT_FADE_MS = 700
/** "Previous" restarts the track if we're further in than this. */
const RESTART_THRESHOLD_S = 3
/** A zero-length WAV: enough to "play" an element during a gesture and unlock it. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

function readMuted(storage: EngineEnvironment["storage"]): boolean {
  try {
    return storage?.getItem(MUTED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function createAudioEngine(env: EngineEnvironment) {
  const fadeMs = env.fadeMs ?? DEFAULT_FADE_MS
  const setTimer = env.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms))
  let state: AudioState = {
    track: null,
    owner: null,
    playing: false,
    muted: readMuted(env.storage),
    queue: [],
    index: -1,
    context: null,
  }
  let progress: Progress = { position: 0, duration: 0 }
  const listeners = new Set<() => void>()
  const progressListeners = new Set<() => void>()
  const listenListeners = new Set<(track: AudioTrack, seconds: number) => void>()
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let decks: [Deck, Deck] | null = null
  let active = 0
  // Bumped on every switch, so a late fade-out never pauses the new track.
  let generation = 0
  let lastTime = 0

  const emit = (next: Partial<AudioState>) => {
    state = { ...state, ...next }
    listeners.forEach((listener) => listener())
    syncMediaSession()
  }
  const emitProgress = (next: Progress) => {
    progress = next
    progressListeners.forEach((listener) => listener())
  }

  function syncMediaSession() {
    const session = env.mediaSession
    if (!session) return
    session.playbackState = state.track ? (state.playing ? "playing" : "paused") : "none"
  }

  function setMetadata(track: AudioTrack) {
    const session = env.mediaSession
    if (!session || !env.createMetadata) return
    session.metadata = env.createMetadata({
      title: track.title,
      artist: track.artist,
      album: state.context ?? "subcult",
      artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: "600x600" }] : [],
    })
  }

  function onTimeUpdate(deck: Deck) {
    if (!decks || deck !== decks[active] || !state.track) return
    const { currentTime, duration } = deck.element
    const delta = currentTime - lastTime
    lastTime = currentTime
    // Count real listening only (not seeks, not muted).
    if (delta > 0 && delta < 2 && state.playing && !state.muted) {
      const track = state.track
      listenListeners.forEach((listener) => listener(track, delta))
    }
    const total = Number.isFinite(duration) ? duration : 0
    emitProgress({ position: currentTime, duration: total })
    try {
      env.mediaSession?.setPositionState?.({
        duration: total,
        position: Math.min(currentTime, total || currentTime),
        playbackRate: 1,
      })
    } catch {
      // Some browsers reject position state before metadata loads.
    }
  }

  function onEnded(deck: Deck) {
    if (!decks || deck !== decks[active]) return
    if (state.index < state.queue.length - 1) goTo(state.index + 1)
    else emit({ playing: false })
  }

  function graph(): [Deck, Deck] {
    if (decks) return decks
    context = env.createContext()
    if (context) {
      master = context.createGain()
      master.gain.value = state.muted ? 0 : 1
      master.connect(context.destination)
    }
    const makeDeck = (): Deck => {
      const element = env.createAudio()
      element.crossOrigin = "anonymous" // iTunes previews send CORS headers; required for Web Audio.
      element.preload = "auto"
      let deck: Deck
      if (!context || !master) {
        element.muted = state.muted
        deck = { element, gain: null }
      } else {
        const gain = context.createGain()
        gain.gain.value = 0
        context.createMediaElementSource(element).connect(gain)
        gain.connect(master)
        deck = { element, gain }
      }
      element.addEventListener("timeupdate", () => onTimeUpdate(deck))
      element.addEventListener("ended", () => onEnded(deck))
      return deck
    }
    decks = [makeDeck(), makeDeck()]
    registerMediaHandlers()
    return decks
  }

  function registerMediaHandlers() {
    const session = env.mediaSession
    if (!session) return
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => resume()],
      ["pause", () => pause()],
      ["previoustrack", () => previous()],
      ["nexttrack", () => next()],
      [
        "seekto",
        (details) => {
          if (details.seekTime !== undefined) seek(details.seekTime)
        },
      ],
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // Unsupported action on this browser.
      }
    }
  }

  function ramp(deck: Deck, to: number) {
    if (!deck.gain || !context) return
    const now = context.currentTime
    deck.gain.gain.cancelScheduledValues(now)
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now)
    deck.gain.gain.linearRampToValueAtTime(to, now + fadeMs / 1000)
  }

  /** Crossfade to queue[index] on the other deck (or just load it, paused). */
  function goTo(index: number, loop = false, autoplay = true) {
    const track = state.queue[index]
    if (!track) return
    const pair = graph()
    const outgoing = pair[active]
    active = 1 - active
    const incoming = pair[active]
    const current = ++generation

    incoming.element.src = track.src
    incoming.element.loop = loop
    incoming.element.currentTime = 0
    lastTime = 0
    ramp(incoming, 1)
    ramp(outgoing, 0)
    if (!incoming.gain) outgoing.element.pause()
    else setTimer(() => current === generation && outgoing.element.pause(), fadeMs)

    emit({ track, index, playing: autoplay })
    setMetadata(track)
    emitProgress({ position: 0, duration: 0 })
    if (!autoplay) return
    incoming.element.play().catch(() => {
      if (current === generation) emit({ playing: false })
    })
  }

  function resume(): void {
    if (!decks || !state.track) return
    ramp(decks[active], 1)
    emit({ playing: true })
    decks[active].element.play().catch(() => emit({ playing: false }))
  }

  function pause(): void {
    if (!decks || !state.playing) return
    decks[active].element.pause()
    emit({ playing: false })
  }

  function next(): void {
    if (state.index < state.queue.length - 1) goTo(state.index + 1)
  }

  function seek(seconds: number): void {
    if (!decks || !state.track) return
    const element = decks[active].element
    element.currentTime = Math.max(0, seconds)
    lastTime = element.currentTime
    emitProgress({ position: element.currentTime, duration: progress.duration })
  }

  function previous(): void {
    if (!decks) return
    if (decks[active].element.currentTime > RESTART_THRESHOLD_S || state.index <= 0) {
      seek(0)
      return
    }
    goTo(state.index - 1)
  }

  function playQueue(
    tracks: readonly AudioTrack[],
    startIndex: number,
    { owner, loop = false, context: label = null }: PlayOptions,
  ): void {
    const start = tracks[startIndex]
    if (!start) return
    graph()
    if (state.track?.id === start.id) {
      // Same song already loaded: keep it going, adopt the new queue around it.
      emit({ owner, queue: tracks, index: startIndex, context: label })
      resume()
      return
    }
    emit({ owner, queue: tracks, context: label })
    goTo(startIndex, loop)
  }

  return {
    getState: (): AudioState => state,
    getProgress: (): Progress => progress,

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    subscribeProgress(listener: () => void): () => void {
      progressListeners.add(listener)
      return () => progressListeners.delete(listener)
    },

    /** Seconds actually heard (unmuted, playing), per track: feeds Wrapped. */
    onListen(listener: (track: AudioTrack, seconds: number) => void): () => void {
      listenListeners.add(listener)
      return () => listenListeners.delete(listener)
    },

    /** Call synchronously inside a tap/click handler before anything that will play. */
    unlock(): void {
      const [a, b] = graph()
      void context?.resume().catch(() => undefined)
      for (const deck of [a, b]) {
        if (deck.element.src) continue
        deck.element.src = SILENCE
        deck.element.play().then(
          () => deck.element.pause(),
          () => undefined,
        )
      }
    },

    /** One track, as its own queue. */
    play(track: AudioTrack, options: PlayOptions): void {
      playQueue([track], 0, options)
    },

    playQueue,

    /** Load a queue without playing (e.g. hand the player back after a story). */
    cue(
      tracks: readonly AudioTrack[],
      index: number,
      { owner, context: label = null }: PlayOptions,
    ) {
      if (!tracks[index]) return
      graph()
      emit({ owner, queue: tracks, context: label })
      goTo(index, false, false)
    },

    pause,
    resume,
    next,
    previous,
    seek,

    toggle(): void {
      if (state.playing) pause()
      else resume()
    },

    /** Fade out and forget the track (story closed, player dismissed). */
    stop(owner?: AudioOwner): void {
      if (!decks || (owner && state.owner !== owner)) return
      const deck = decks[active]
      const current = ++generation
      ramp(deck, 0)
      if (!deck.gain) deck.element.pause()
      else setTimer(() => current === generation && deck.element.pause(), fadeMs)
      emit({ track: null, owner: null, playing: false, queue: [], index: -1, context: null })
      emitProgress({ position: 0, duration: 0 })
      if (env.mediaSession) env.mediaSession.metadata = null
    },

    setMuted(muted: boolean): void {
      if (master) master.gain.value = muted ? 0 : 1
      else decks?.forEach((deck) => (deck.element.muted = muted))
      try {
        env.storage?.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0")
      } catch {
        // Private mode: the choice just won't be remembered.
      }
      emit({ muted })
    },
  }
}

export type AudioEngine = ReturnType<typeof createAudioEngine>

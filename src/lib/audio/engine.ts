/**
 * One audio engine for the whole app (stories now; the mini-player and the
 * Sounds tab next). Exactly one thing plays at a time: whoever calls play()
 * takes over from the previous owner.
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
}

export type AudioOwner = "story" | "player" | "sounds"

export interface AudioState {
  track: AudioTrack | null
  owner: AudioOwner | null
  playing: boolean
  muted: boolean
}

export interface PlayOptions {
  owner: AudioOwner
  /** Stories loop their 30s preview under ~50s of frames. */
  loop?: boolean
}

interface Deck {
  element: HTMLAudioElement
  gain: GainNode | null
}

export interface EngineEnvironment {
  createAudio: () => HTMLAudioElement
  /** null where Web Audio is missing: tracks then switch without a fade. */
  createContext: () => AudioContext | null
  storage?: Pick<Storage, "getItem" | "setItem"> | null
  fadeMs?: number
  setTimer?: (run: () => void, ms: number) => unknown
}

export const MUTED_STORAGE_KEY = "subcult-audio-muted"
const DEFAULT_FADE_MS = 700
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
  }
  const listeners = new Set<() => void>()
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let decks: [Deck, Deck] | null = null
  let active = 0
  // Bumped on every switch, so a late fade-out never pauses the new track.
  let generation = 0

  const emit = (next: Partial<AudioState>) => {
    state = { ...state, ...next }
    listeners.forEach((listener) => listener())
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
      if (!context || !master) {
        element.muted = state.muted
        return { element, gain: null }
      }
      const gain = context.createGain()
      gain.gain.value = 0
      context.createMediaElementSource(element).connect(gain)
      gain.connect(master)
      return { element, gain }
    }
    decks = [makeDeck(), makeDeck()]
    return decks
  }

  function ramp(deck: Deck, to: number) {
    if (!deck.gain || !context) return
    const now = context.currentTime
    deck.gain.gain.cancelScheduledValues(now)
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now)
    deck.gain.gain.linearRampToValueAtTime(to, now + fadeMs / 1000)
  }

  function resume(): void {
    if (!decks || !state.track) return
    ramp(decks[active], 1)
    emit({ playing: true })
    decks[active].element.play().catch(() => emit({ playing: false }))
  }

  return {
    getState: (): AudioState => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
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

    play(track: AudioTrack, { owner, loop = false }: PlayOptions): void {
      const pair = graph()
      if (state.track?.id === track.id) {
        emit({ owner })
        resume()
        return
      }
      const outgoing = pair[active]
      active = 1 - active
      const incoming = pair[active]
      const current = ++generation

      incoming.element.src = track.src
      incoming.element.loop = loop
      incoming.element.currentTime = 0
      ramp(incoming, 1)
      ramp(outgoing, 0)
      if (!incoming.gain) outgoing.element.pause()
      else setTimer(() => current === generation && outgoing.element.pause(), fadeMs)

      emit({ track, owner, playing: true })
      incoming.element.play().catch(() => {
        if (current === generation) emit({ playing: false })
      })
    },

    pause(): void {
      if (!decks || !state.playing) return
      decks[active].element.pause()
      emit({ playing: false })
    },

    resume,

    /** Fade out and forget the track (story closed, player dismissed). */
    stop(owner?: AudioOwner): void {
      if (!decks || (owner && state.owner !== owner)) return
      const deck = decks[active]
      const current = ++generation
      ramp(deck, 0)
      if (!deck.gain) deck.element.pause()
      else setTimer(() => current === generation && deck.element.pause(), fadeMs)
      emit({ track: null, owner: null, playing: false })
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

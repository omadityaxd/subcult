/**
 * Exactly one thing makes sound in the app. The audio engine is one source
 * (the player, The Sound, stories, artist sheets, vibe check previews all go
 * through it); embedded players (the Spotify embed, YouTube, the Spotify SDK)
 * register here. Whenever any source starts, every other one is paused,
 * iframes through their own APIs.
 */

export interface EngineLike {
  getState(): { playing: boolean }
  subscribe(listener: () => void): () => void
  pause(): void
}

export interface ExternalPlayer {
  pause: () => void
}

export interface MediaCoordinator {
  /** An embedded player that can make sound; returns an unregister function. */
  register(id: string, player: ExternalPlayer): () => void
  /** An embedded player started sounding: everything else goes quiet. */
  started(id: string): void
  /** An embedded player paused, ended or was closed. */
  stopped(id: string): void
  /** Is anything (the engine or an embed) making sound right now? */
  isAnythingPlaying(): boolean
}

export function createMediaCoordinator(getEngine: () => EngineLike): MediaCoordinator {
  const players = new Map<string, ExternalPlayer>()
  /** The embedded player currently sounding, if any. */
  let sounding: string | null = null
  let watching = false
  let engineWasPlaying = false

  const pauseExternal = (except: string | null) => {
    for (const [id, player] of players) {
      if (id === except) continue
      try {
        player.pause()
      } catch {
        // A player that already tore itself down; nothing to pause.
      }
    }
    if (sounding !== except) sounding = null
  }

  // The engine starting (any owner) silences every embed.
  const watchEngine = () => {
    if (watching) return
    watching = true
    const engine = getEngine()
    engineWasPlaying = engine.getState().playing
    engine.subscribe(() => {
      const { playing } = engine.getState()
      if (playing && !engineWasPlaying) pauseExternal(null)
      engineWasPlaying = playing
    })
  }

  return {
    register(id, player) {
      watchEngine()
      players.set(id, player)
      return () => {
        players.delete(id)
        if (sounding === id) sounding = null
      }
    },
    started(id) {
      watchEngine()
      pauseExternal(id)
      sounding = id
      const engine = getEngine()
      if (engine.getState().playing) engine.pause()
    },
    stopped(id) {
      if (sounding === id) sounding = null
    },
    isAnythingPlaying() {
      return sounding !== null || getEngine().getState().playing
    },
  }
}

import { createGame, dedupeKey, patchGame, type Game, type GameDraft } from '../types/game'
import { kvStore } from './kv-store'
import {
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  MAX_HISTORY,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  migrateSession,
  migrateSettings,
  type GamesMap,
  type SessionState,
  type Settings,
  type SpinRecord,
} from './schema'

export interface LibrarySnapshot {
  games: Game[]
  settings: Settings
  session: SessionState
}

export interface ImportSummary {
  added: number
  merged: number
  skipped: number
}

/**
 * Única puerta de entrada a los datos de la extensión.
 *
 * La UI nunca habla con `chrome.storage` directamente: pide y muta a través de
 * este repositorio, que además normaliza entidades y emite cambios para que
 * popup y dashboard se mantengan sincronizados en vivo.
 */
class LibraryRepository {
  private cache: GamesMap | null = null

  // --- Lectura -------------------------------------------------------------

  async ensureSchema(): Promise<void> {
    const current = await kvStore.get<number>(STORAGE_KEYS.schemaVersion, 0)
    if (current === SCHEMA_VERSION) return

    const settings = migrateSettings(await kvStore.get<unknown>(STORAGE_KEYS.settings, null), current)
    const session = migrateSession(await kvStore.get<unknown>(STORAGE_KEYS.session, null), current)
    await kvStore.setMany({
      [STORAGE_KEYS.settings]: settings,
      [STORAGE_KEYS.session]: session,
      [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION,
    })
  }

  async getGamesMap(): Promise<GamesMap> {
    if (this.cache) return this.cache
    const map = await kvStore.get<GamesMap>(STORAGE_KEYS.games, {})
    this.cache = map
    return map
  }

  async getGames(): Promise<Game[]> {
    const map = await this.getGamesMap()
    return Object.values(map).sort((a, b) => b.addedAt - a.addedAt)
  }

  async getGame(id: string): Promise<Game | null> {
    const map = await this.getGamesMap()
    return map[id] ?? null
  }

  async getSettings(): Promise<Settings> {
    return migrateSettings(await kvStore.get<unknown>(STORAGE_KEYS.settings, null), SCHEMA_VERSION)
  }

  async getSession(): Promise<SessionState> {
    return migrateSession(await kvStore.get<unknown>(STORAGE_KEYS.session, null), SCHEMA_VERSION)
  }

  async snapshot(): Promise<LibrarySnapshot> {
    const [games, settings, session] = await Promise.all([
      this.getGames(),
      this.getSettings(),
      this.getSession(),
    ])
    return { games, settings, session }
  }

  // --- Escritura de juegos -------------------------------------------------

  async addGame(draft: GameDraft): Promise<Game> {
    const game = createGame(draft)
    const map = { ...(await this.getGamesMap()) }
    map[game.id] = game
    await this.writeGames(map)
    return game
  }

  async updateGame(id: string, patch: Partial<Game>): Promise<Game | null> {
    const map = { ...(await this.getGamesMap()) }
    const current = map[id]
    if (!current) return null
    const next = patchGame(current, patch)
    map[id] = next
    await this.writeGames(map)
    return next
  }

  async removeGame(id: string): Promise<void> {
    const map = { ...(await this.getGamesMap()) }
    if (!(id in map)) return
    delete map[id]
    await this.writeGames(map)
  }

  async removeMany(ids: string[]): Promise<void> {
    const map = { ...(await this.getGamesMap()) }
    for (const id of ids) delete map[id]
    await this.writeGames(map)
  }

  /**
   * Alta masiva con deduplicación (usada por los importadores y por el
   * restaurar-copia). `merge` actualiza los campos vacíos del juego existente
   * sin pisar lo que el usuario ya haya editado a mano.
   */
  async importGames(drafts: GameDraft[], options: { merge?: boolean } = {}): Promise<ImportSummary> {
    const map = { ...(await this.getGamesMap()) }
    const byKey = new Map<string, Game>()
    for (const game of Object.values(map)) byKey.set(dedupeKey(game), game)

    const summary: ImportSummary = { added: 0, merged: 0, skipped: 0 }
    for (const draft of drafts) {
      if (!draft?.name?.trim()) {
        summary.skipped++
        continue
      }
      const candidate = createGame(draft)
      const existing = byKey.get(dedupeKey(candidate))
      if (!existing) {
        map[candidate.id] = candidate
        byKey.set(dedupeKey(candidate), candidate)
        summary.added++
        continue
      }
      if (!options.merge) {
        summary.skipped++
        continue
      }
      const merged = patchGame(existing, {
        genres: existing.genres.length ? existing.genres : candidate.genres,
        estimatedHours: existing.estimatedHours ?? candidate.estimatedHours,
        playedHours: Math.max(existing.playedHours, candidate.playedHours),
        coverUrl: existing.coverUrl ?? candidate.coverUrl,
        tags: existing.tags.length ? existing.tags : candidate.tags,
        externalId: existing.externalId ?? candidate.externalId,
        lastPlayedAt: Math.max(existing.lastPlayedAt ?? 0, candidate.lastPlayedAt ?? 0) || null,
      })
      map[merged.id] = merged
      byKey.set(dedupeKey(merged), merged)
      summary.merged++
    }

    await this.writeGames(map)
    return summary
  }

  async replaceAll(games: Game[]): Promise<void> {
    const map: GamesMap = {}
    for (const game of games) map[game.id] = game
    await this.writeGames(map)
  }

  async clearLibrary(): Promise<void> {
    await this.writeGames({})
  }

  // --- Ajustes y sesión ----------------------------------------------------

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.getSettings()), ...patch }
    await kvStore.set(STORAGE_KEYS.settings, next)
    return next
  }

  async resetSettings(): Promise<Settings> {
    await kvStore.set(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }

  async recordSpin(record: SpinRecord): Promise<SessionState> {
    const session = await this.getSession()
    const next: SessionState = {
      lastResult: record,
      history: [record, ...session.history].slice(0, MAX_HISTORY),
    }
    await kvStore.set(STORAGE_KEYS.session, next)
    return next
  }

  async clearSession(): Promise<SessionState> {
    await kvStore.set(STORAGE_KEYS.session, DEFAULT_SESSION)
    return DEFAULT_SESSION
  }

  // --- Suscripción ---------------------------------------------------------

  /** Notifica cuando cambia cualquier dato de la extensión, venga del contexto que venga. */
  subscribe(listener: (keys: string[]) => void): () => void {
    return kvStore.subscribe((keys) => {
      if (keys.includes(STORAGE_KEYS.games)) this.cache = null
      listener(keys)
    })
  }

  private async writeGames(map: GamesMap): Promise<void> {
    this.cache = map
    await kvStore.set(STORAGE_KEYS.games, map)
  }
}

export const libraryRepository = new LibraryRepository()

/** Modelo de dominio de un videojuego de la biblioteca. */

export const GAME_STATUSES = ['backlog', 'playing', 'completed', 'dropped', 'wishlist'] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

export const PLAYER_MODES = ['single', 'multi', 'both', 'unknown'] as const
export type PlayerMode = (typeof PLAYER_MODES)[number]

/** Origen del registro. Los proveedores externos se anaden aqui al implementar su importador. */
export const GAME_SOURCES = [
  'manual',
  'file',
  'steam',
  'epic',
  'gog',
  'xbox',
  'playstation',
  'nintendo',
] as const
export type GameSource = (typeof GAME_SOURCES)[number]

export interface Game {
  id: string
  name: string
  platform: string
  genres: string[]
  status: GameStatus
  /** Duracion estimada para terminarlo, en horas. `null` = desconocida. */
  estimatedHours: number | null
  playedHours: number
  /** Valoracion personal 0-10. `null` = sin puntuar. */
  rating: number | null
  tags: string[]
  playerMode: PlayerMode
  coverUrl: string | null
  notes: string
  favorite: boolean
  /** Excluido del randomizer de forma permanente: nunca se selecciona. */
  excluded: boolean
  addedAt: number
  updatedAt: number
  startedAt: number | null
  completedAt: number | null
  lastPlayedAt: number | null
  source: GameSource
  /** Identificador en el servicio de origen (appid de Steam, etc.). */
  externalId: string | null
}

export type GameDraft = Partial<Omit<Game, 'id'>> & { name: string }

/** Clave de deduplicacion: mismo juego en la misma plataforma. */
export function dedupeKey(game: Pick<Game, 'name' | 'platform' | 'source' | 'externalId'>): string {
  if (game.externalId) return `${game.source}:${game.externalId}`
  return `${game.name.trim().toLowerCase()}@${game.platform.trim().toLowerCase()}`
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Normaliza un borrador (formulario o importador) a una entidad completa y valida. */
export function createGame(draft: GameDraft, now = Date.now()): Game {
  const status: GameStatus = draft.status ?? 'backlog'
  return {
    id: newId(),
    name: draft.name.trim(),
    platform: (draft.platform ?? 'PC').trim(),
    genres: normalizeList(draft.genres),
    status,
    estimatedHours: normalizeHours(draft.estimatedHours),
    playedHours: Math.max(0, Number(draft.playedHours ?? 0)) || 0,
    rating: draft.rating == null ? null : clamp(Number(draft.rating), 0, 10),
    tags: normalizeList(draft.tags),
    playerMode: draft.playerMode ?? 'unknown',
    coverUrl: draft.coverUrl?.trim() || null,
    notes: draft.notes ?? '',
    favorite: draft.favorite ?? false,
    excluded: draft.excluded ?? false,
    addedAt: draft.addedAt ?? now,
    updatedAt: now,
    startedAt: draft.startedAt ?? (status === 'playing' ? now : null),
    completedAt: draft.completedAt ?? (status === 'completed' ? now : null),
    lastPlayedAt: draft.lastPlayedAt ?? null,
    source: draft.source ?? 'manual',
    externalId: draft.externalId ?? null,
  }
}

/** Aplica un parche manteniendo las invariantes de fechas derivadas del estado. */
export function patchGame(game: Game, patch: Partial<Game>, now = Date.now()): Game {
  const next: Game = { ...game, ...patch, id: game.id, updatedAt: now }
  if (patch.name != null) next.name = patch.name.trim()
  if (patch.genres) next.genres = normalizeList(patch.genres)
  if (patch.tags) next.tags = normalizeList(patch.tags)
  if (patch.estimatedHours !== undefined) next.estimatedHours = normalizeHours(patch.estimatedHours)
  if (patch.rating !== undefined && patch.rating !== null) next.rating = clamp(Number(patch.rating), 0, 10)
  if (patch.playedHours !== undefined) next.playedHours = Math.max(0, Number(patch.playedHours) || 0)

  if (patch.status && patch.status !== game.status) {
    if (patch.status === 'playing') {
      next.startedAt = game.startedAt ?? now
      next.lastPlayedAt = now
    }
    next.completedAt = patch.status === 'completed' ? (game.completedAt ?? now) : null
  }
  return next
}

function normalizeHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function normalizeList(value: unknown): string[] {
  if (!value) return []
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const clean = String(item).trim()
    const key = clean.toLowerCase()
    if (clean && !seen.has(key)) {
      seen.add(key)
      out.push(clean)
    }
  }
  return out
}

/** Horas que faltan para terminar un juego (0 si ya se supero la estimacion). */
export function remainingHours(game: Game): number {
  if (game.estimatedHours == null) return 0
  return Math.max(0, game.estimatedHours - game.playedHours)
}

export function daysSince(timestamp: number | null, now = Date.now()): number {
  if (!timestamp) return 0
  return Math.max(0, Math.floor((now - timestamp) / 86_400_000))
}

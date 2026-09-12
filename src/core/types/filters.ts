import type { GameStatus, PlayerMode } from './game'

/**
 * Criterios de filtrado. Todo campo vacio o `null` significa "sin restriccion".
 * Es la unica forma de acotar el pool del randomizer: los modos de seleccion
 * se expresan como un `Partial<FilterCriteria>` sobre estos mismos campos.
 */
export interface FilterCriteria {
  search: string
  platforms: string[]
  genres: string[]
  tags: string[]
  statuses: GameStatus[]
  playerModes: PlayerMode[]
  /** Duracion estimada minima / maxima en horas. */
  minHours: number | null
  maxHours: number | null
  /** Incluye juegos sin duracion estimada cuando hay un rango de horas activo. */
  includeUnknownDuration: boolean
  minRating: number | null
  /** Solo juegos con 0 horas jugadas. */
  neverPlayed: boolean
  /** Tope de horas ya jugadas: sirve para pedir "apenas tocados". */
  maxPlayedHours: number | null
  /** Solo juegos abandonados (status `dropped`). */
  abandonedOnly: boolean
  /** Solo juegos empezados y sin terminar (horas jugadas > 0, no completados). */
  startedNotFinished: boolean
  /** Solo juegos que llevan al menos N dias en la biblioteca sin completarse. */
  minBacklogDays: number | null
  favoritesOnly: boolean
  /** Permite incluir juegos marcados como excluidos. Por defecto, nunca. */
  includeExcluded: boolean
}

export const DEFAULT_FILTERS: FilterCriteria = {
  search: '',
  platforms: [],
  genres: [],
  tags: [],
  statuses: [],
  playerModes: [],
  minHours: null,
  maxHours: null,
  includeUnknownDuration: true,
  minRating: null,
  neverPlayed: false,
  maxPlayedHours: null,
  abandonedOnly: false,
  startedNotFinished: false,
  minBacklogDays: null,
  favoritesOnly: false,
  includeExcluded: false,
}

export function makeFilters(partial: Partial<FilterCriteria> = {}): FilterCriteria {
  return { ...DEFAULT_FILTERS, ...partial }
}

/** Cuenta las restricciones reales de un criterio, para los badges de la UI. */
export function countActiveFilters(filters: FilterCriteria): number {
  let n = 0
  if (filters.search.trim()) n++
  if (filters.platforms.length) n++
  if (filters.genres.length) n++
  if (filters.tags.length) n++
  if (filters.statuses.length) n++
  if (filters.playerModes.length) n++
  if (filters.minHours != null || filters.maxHours != null) n++
  if (filters.minRating != null) n++
  if (filters.neverPlayed) n++
  if (filters.maxPlayedHours != null) n++
  if (filters.abandonedOnly) n++
  if (filters.startedNotFinished) n++
  if (filters.minBacklogDays != null) n++
  if (filters.favoritesOnly) n++
  return n
}

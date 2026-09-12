import type { FilterCriteria } from '../types/filters'
import { daysSince, type Game, type PlayerMode } from '../types/game'

const lower = (value: string) => value.trim().toLowerCase()

function includesAny(haystack: string[], needles: string[]): boolean {
  if (!needles.length) return true
  const set = new Set(haystack.map(lower))
  return needles.some((needle) => set.has(lower(needle)))
}

/** `both` satisface tanto "un jugador" como "multijugador"; `unknown` solo si se pide expresamente. */
function matchesPlayerMode(game: Game, wanted: PlayerMode[]): boolean {
  if (!wanted.length) return true
  if (wanted.includes(game.playerMode)) return true
  if (game.playerMode === 'both') return wanted.includes('single') || wanted.includes('multi')
  return false
}

function matchesDuration(game: Game, filters: FilterCriteria): boolean {
  const { minHours, maxHours } = filters
  if (minHours == null && maxHours == null) return true
  if (game.estimatedHours == null) return filters.includeUnknownDuration
  if (minHours != null && game.estimatedHours < minHours) return false
  if (maxHours != null && game.estimatedHours > maxHours) return false
  return true
}

function matchesSearch(game: Game, search: string): boolean {
  const query = lower(search)
  if (!query) return true
  const haystack = [game.name, game.platform, ...game.genres, ...game.tags, game.notes]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

/**
 * Predicado único de filtrado. Lo usan por igual la vista de biblioteca y el
 * randomizer, así que lo que se ve en pantalla es exactamente el pool del sorteo.
 */
export function matchesFilters(game: Game, filters: FilterCriteria, now = Date.now()): boolean {
  // Regla dura: un juego excluido nunca entra, salvo que se pida explícitamente.
  if (game.excluded && !filters.includeExcluded) return false

  if (!matchesSearch(game, filters.search)) return false
  if (filters.platforms.length && !includesAny([game.platform], filters.platforms)) return false
  if (!includesAny(game.genres, filters.genres)) return false
  if (!includesAny(game.tags, filters.tags)) return false
  if (filters.statuses.length && !filters.statuses.includes(game.status)) return false
  if (!matchesPlayerMode(game, filters.playerModes)) return false
  if (!matchesDuration(game, filters)) return false

  if (filters.minRating != null && (game.rating == null || game.rating < filters.minRating)) return false
  if (filters.neverPlayed && game.playedHours > 0) return false
  if (filters.maxPlayedHours != null && game.playedHours > filters.maxPlayedHours) return false
  if (filters.abandonedOnly && game.status !== 'dropped') return false
  if (filters.startedNotFinished && (game.playedHours <= 0 || game.status === 'completed')) return false
  if (filters.favoritesOnly && !game.favorite) return false

  if (filters.minBacklogDays != null) {
    if (game.status === 'completed') return false
    if (daysSince(game.addedAt, now) < filters.minBacklogDays) return false
  }

  return true
}

export function applyFilters(games: Game[], filters: FilterCriteria, now = Date.now()): Game[] {
  return games.filter((game) => matchesFilters(game, filters, now))
}

export interface Facets {
  platforms: string[]
  genres: string[]
  tags: string[]
}

/** Valores presentes en la biblioteca, para alimentar los selectores de la UI. */
export function collectFacets(games: Game[]): Facets {
  const platforms = new Map<string, string>()
  const genres = new Map<string, string>()
  const tags = new Map<string, string>()

  for (const game of games) {
    if (game.platform) platforms.set(lower(game.platform), game.platform)
    for (const genre of game.genres) genres.set(lower(genre), genre)
    for (const tag of game.tags) tags.set(lower(tag), tag)
  }

  const sorted = (map: Map<string, string>) =>
    [...map.values()].sort((a, b) => a.localeCompare(b, 'es'))

  return { platforms: sorted(platforms), genres: sorted(genres), tags: sorted(tags) }
}

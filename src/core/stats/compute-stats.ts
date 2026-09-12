import { GAME_STATUSES, remainingHours, type Game, type GameStatus } from '../types/game'

export interface LibraryStats {
  total: number
  byStatus: Record<GameStatus, number>
  /** Total de horas jugadas registradas. */
  playedHours: number
  /** Horas estimadas que quedan en backlog + jugando. */
  pendingHours: number
  /** Porcentaje de juegos completados sobre el total sin contar la wishlist. */
  completionRate: number
  /** Juegos sin ninguna hora jugada. */
  neverPlayed: number
  favorites: number
  excluded: number
  averageRating: number | null
  topPlatforms: Array<{ label: string; count: number }>
  topGenres: Array<{ label: string; count: number }>
}

function emptyByStatus(): Record<GameStatus, number> {
  return Object.fromEntries(GAME_STATUSES.map((status) => [status, 0])) as Record<GameStatus, number>
}

function rank(counter: Map<string, number>, limit: number): Array<{ label: string; count: number }> {
  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
    .slice(0, limit)
}

export function computeStats(games: Game[], topLimit = 5): LibraryStats {
  const byStatus = emptyByStatus()
  const platforms = new Map<string, number>()
  const genres = new Map<string, number>()

  let playedHours = 0
  let pendingHours = 0
  let neverPlayed = 0
  let favorites = 0
  let excluded = 0
  let ratingSum = 0
  let ratingCount = 0

  for (const game of games) {
    byStatus[game.status]++
    playedHours += game.playedHours
    if (game.status === 'backlog' || game.status === 'playing') pendingHours += remainingHours(game)
    if (game.playedHours === 0) neverPlayed++
    if (game.favorite) favorites++
    if (game.excluded) excluded++
    if (game.rating != null) {
      ratingSum += game.rating
      ratingCount++
    }
    if (game.platform) platforms.set(game.platform, (platforms.get(game.platform) ?? 0) + 1)
    for (const genre of game.genres) genres.set(genre, (genres.get(genre) ?? 0) + 1)
  }

  // La wishlist no cuenta: son juegos que aún no tienes, no backlog pendiente.
  const owned = games.length - byStatus.wishlist

  return {
    total: games.length,
    byStatus,
    playedHours: Math.round(playedHours * 10) / 10,
    pendingHours: Math.round(pendingHours * 10) / 10,
    completionRate: owned > 0 ? Math.round((byStatus.completed / owned) * 1000) / 10 : 0,
    neverPlayed,
    favorites,
    excluded,
    averageRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    topPlatforms: rank(platforms, topLimit),
    topGenres: rank(genres, topLimit),
  }
}

/** Formatea horas de forma compacta: 8 h, 1.5 h, 1.240 h. */
export function formatHours(hours: number | null): string {
  if (hours == null) return '—'
  if (hours < 1 && hours > 0) return `${Math.round(hours * 60)} min`
  const rounded = Math.round(hours * 10) / 10
  const group = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${group} h`
}

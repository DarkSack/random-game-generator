import { applyFilters } from '../filters/apply-filters'
import { getMode, mergeModeCriteria, type SelectionMode } from '../modes/selection-modes'
import type { FilterCriteria } from '../types/filters'
import type { Game } from '../types/game'
import { pickWeighted } from './rng'

export type SpinFailure = 'empty-library' | 'no-matches'

export interface SpinResult {
  game: Game | null
  /** Juegos que cumplían los filtros del modo (antes de descartar repeticiones). */
  pool: Game[]
  mode: SelectionMode
  criteria: FilterCriteria
  /** `true` si hubo que reutilizar juegos recientes por falta de alternativas. */
  reusedRecent: boolean
  failure: SpinFailure | null
}

export interface SpinOptions {
  filters: FilterCriteria
  modeId?: string
  /** Ids sorteados recientemente que se intentan evitar. */
  avoidIds?: string[]
  now?: number
}

/**
 * Núcleo del randomizer.
 *
 * Contrato: el resultado siempre sale del conjunto de juegos que cumplen los
 * filtros efectivos; nunca de uno excluido. Evitar repeticiones es un intento,
 * no una restricción: si al descartar los recientes el pool se vacía, se vuelve
 * al pool completo en lugar de devolver "sin resultados".
 */
export function spin(games: Game[], options: SpinOptions): SpinResult {
  const now = options.now ?? Date.now()
  const mode = getMode(options.modeId)
  const criteria = mergeModeCriteria(options.filters, mode)
  const pool = applyFilters(games, criteria, now)

  const base: Omit<SpinResult, 'game' | 'failure' | 'reusedRecent'> = { pool, mode, criteria }

  if (!pool.length) {
    return {
      ...base,
      game: null,
      reusedRecent: false,
      failure: games.length ? 'no-matches' : 'empty-library',
    }
  }

  const avoid = new Set(options.avoidIds ?? [])
  const fresh = pool.filter((game) => !avoid.has(game.id))
  const candidates = fresh.length ? fresh : pool

  const weightOf = mode.weight ? (game: Game) => mode.weight!(game, now) : () => 1
  const game = pickWeighted(candidates, weightOf)

  return {
    ...base,
    game,
    reusedRecent: fresh.length === 0 && avoid.size > 0,
    failure: game ? null : 'no-matches',
  }
}

/** Tamaño del pool para un modo concreto, sin llegar a sortear (para la UI). */
export function poolSize(games: Game[], filters: FilterCriteria, modeId?: string, now = Date.now()): number {
  const mode = getMode(modeId)
  return applyFilters(games, mergeModeCriteria(filters, mode), now).length
}

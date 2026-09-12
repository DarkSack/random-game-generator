import type { FilterCriteria } from '../types/filters'
import { DEFAULT_FILTERS } from '../types/filters'
import type { Game } from '../types/game'

/** Versión del esquema persistido. Súbela al cambiar la forma de los datos y añade una migración. */
export const SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
  schemaVersion: 'rgg.schemaVersion',
  games: 'rgg.games',
  settings: 'rgg.settings',
  session: 'rgg.session',
} as const

export type GamesMap = Record<string, Game>

export interface Settings {
  /** Modo de selección activo por defecto. */
  defaultModeId: string
  /** Filtros compartidos entre popup y dashboard. */
  filters: FilterCriteria
  /** Evita repetir los últimos N juegos sorteados, si el pool lo permite. */
  avoidRepeatsCount: number
  /** Duración de la animación de sorteo, en ms. */
  spinDurationMs: number
  /** Al pulsar "Jugar", marca el juego como `playing`. */
  autoMarkPlaying: boolean
  /** Al completar un juego, pide confirmación antes de borrarlo de la biblioteca. */
  confirmBeforeDelete: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  defaultModeId: 'completely-random',
  filters: { ...DEFAULT_FILTERS },
  avoidRepeatsCount: 5,
  spinDurationMs: 1400,
  autoMarkPlaying: true,
  confirmBeforeDelete: true,
}

export interface SpinRecord {
  gameId: string
  modeId: string
  at: number
}

export interface SessionState {
  lastResult: SpinRecord | null
  /** Historial reciente, del más nuevo al más antiguo. */
  history: SpinRecord[]
}

export const DEFAULT_SESSION: SessionState = { lastResult: null, history: [] }

export const MAX_HISTORY = 30

/**
 * Migra el estado persistido entre versiones de esquema.
 * Cada rama debe ser idempotente: puede ejecutarse sobre datos ya migrados.
 */
export function migrateSettings(raw: unknown, _fromVersion: number): Settings {
  const input = (raw ?? {}) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    filters: { ...DEFAULT_FILTERS, ...(input.filters ?? {}) },
  }
}

export function migrateSession(raw: unknown, _fromVersion: number): SessionState {
  const input = (raw ?? {}) as Partial<SessionState>
  return {
    lastResult: input.lastResult ?? null,
    history: Array.isArray(input.history) ? input.history.slice(0, MAX_HISTORY) : [],
  }
}

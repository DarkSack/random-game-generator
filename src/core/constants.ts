import type { GameStatus, PlayerMode } from './types/game'

/** Sugerencias de plataforma. El campo es texto libre: esto solo alimenta el datalist. */
export const SUGGESTED_PLATFORMS = [
  'PC',
  'Steam Deck',
  'PlayStation 5',
  'PlayStation 4',
  'Xbox Series X|S',
  'Xbox One',
  'Nintendo Switch',
  'Nintendo Switch 2',
  'Retro',
  'Móvil',
  'VR',
] as const

/** Sugerencias de género para el datalist del formulario. */
export const SUGGESTED_GENRES = [
  'RPG',
  'JRPG',
  'Acción',
  'Aventura',
  'Shooter',
  'Estrategia',
  'Roguelike',
  'Metroidvania',
  'Plataformas',
  'Puzzle',
  'Survival',
  'Terror',
  'Simulación',
  'Deportes',
  'Carreras',
  'Lucha',
  'Sandbox',
  'Visual Novel',
  'Souls-like',
  'Indie',
] as const

export const STATUS_LABEL: Record<GameStatus, string> = {
  backlog: 'Backlog',
  playing: 'Jugando',
  completed: 'Completado',
  dropped: 'Abandonado',
  wishlist: 'Wishlist',
}

export const STATUS_EMOJI: Record<GameStatus, string> = {
  backlog: '📚',
  playing: '🎮',
  completed: '🏆',
  dropped: '💀',
  wishlist: '⭐',
}

export const PLAYER_MODE_LABEL: Record<PlayerMode, string> = {
  single: 'Un jugador',
  multi: 'Multijugador',
  both: 'Ambos',
  unknown: 'Sin definir',
}

/** Umbrales compartidos por los modos de selección y por la UI. */
export const THRESHOLDS = {
  /** Un juego "corto" dura como mucho estas horas. */
  shortGameHours: 15,
  /** Un juego "largo" dura al menos estas horas. */
  longGameHours: 40,
  /** Días en biblioteca a partir de los cuales el backlog se considera estancado. */
  staleBacklogDays: 90,
  /** Horas jugadas por debajo de las cuales un juego cuenta como "apenas tocado". */
  barelyPlayedHours: 2,
  /** Nota mínima para que un juego cuente como joya oculta. */
  hiddenGemRating: 7,
} as const

export const HOUR_PRESETS = [
  { label: 'Cualquiera', min: null, max: null },
  { label: '< 10 h', min: null, max: 10 },
  { label: '10 - 30 h', min: 10, max: 30 },
  { label: '30 - 60 h', min: 30, max: 60 },
  { label: '> 60 h', min: 60, max: null },
] as const

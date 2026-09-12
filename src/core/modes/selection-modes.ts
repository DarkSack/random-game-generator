import { THRESHOLDS } from '../constants'
import type { FilterCriteria } from '../types/filters'
import { daysSince, remainingHours, type Game } from '../types/game'

/**
 * Un modo de selección es, simplemente, un preset de filtros más una función de
 * peso opcional. Añadir un modo nuevo es añadir una entrada a `SELECTION_MODES`:
 * ni el randomizer ni la UI necesitan cambios.
 */
export interface SelectionMode {
  id: string
  label: string
  emoji: string
  description: string
  /** Filtros que impone el modo. Sobrescriben los del usuario solo en estos campos. */
  criteria: Partial<FilterCriteria>
  /** Peso relativo de cada juego dentro del pool. Sin función, el sorteo es uniforme. */
  weight?: (game: Game, now: number) => number
}

/** Estados que se consideran "juegos que tienes y aún puedes jugar". */
const PLAYABLE_STATUSES: FilterCriteria['statuses'] = ['backlog', 'playing', 'dropped']

export const SELECTION_MODES: SelectionMode[] = [
  {
    id: 'completely-random',
    label: 'Completamente aleatorio',
    emoji: '🎲',
    description: 'Cualquier juego de tu biblioteca que no esté completado ni en la wishlist.',
    criteria: { statuses: PLAYABLE_STATUSES },
  },
  {
    id: 'short-game',
    label: 'Partida corta',
    emoji: '⚡',
    description: `Juegos de ${THRESHOLDS.shortGameHours} horas o menos. Para terminar algo esta semana.`,
    criteria: {
      statuses: PLAYABLE_STATUSES,
      maxHours: THRESHOLDS.shortGameHours,
      includeUnknownDuration: false,
    },
  },
  {
    id: 'long-game',
    label: 'Aventura larga',
    emoji: '🏔️',
    description: `Juegos de ${THRESHOLDS.longGameHours} horas o más. Para perderse una temporada.`,
    criteria: {
      statuses: PLAYABLE_STATUSES,
      minHours: THRESHOLDS.longGameHours,
      includeUnknownDuration: false,
    },
  },
  {
    id: 'backlog-killer',
    label: 'Backlog Killer',
    emoji: '💀',
    description: 'Prioriza lo que lleva más tiempo criando polvo en tu backlog.',
    criteria: { statuses: ['backlog'], minBacklogDays: THRESHOLDS.staleBacklogDays },
    // Cuanto más antiguo, más papeletas: peso lineal con la edad en meses.
    weight: (game, now) => 1 + daysSince(game.addedAt, now) / 30,
  },
  {
    id: 'never-played',
    label: 'Nunca jugado',
    emoji: '🆕',
    description: 'Solo juegos que jamás has arrancado.',
    criteria: { statuses: ['backlog'], neverPlayed: true },
  },
  {
    id: 'finish-what-you-started',
    label: 'Termina lo que empezaste',
    emoji: '🎯',
    description: 'Juegos a medias. Cuanto más avanzados, más probabilidad.',
    criteria: { startedNotFinished: true, statuses: ['playing', 'dropped', 'backlog'] },
    // Premia el progreso ya invertido y castiga lo que aún exige muchas horas.
    weight: (game) => {
      const progress = game.estimatedHours ? game.playedHours / game.estimatedHours : 0.5
      const pending = remainingHours(game)
      return 1 + progress * 4 + (pending > 0 && pending < THRESHOLDS.shortGameHours ? 1.5 : 0)
    },
  },
  {
    id: 'hidden-gem',
    label: 'Joya oculta',
    emoji: '💎',
    description: 'Bien valorados o prometedores que apenas has tocado y llevan meses ahí.',
    criteria: {
      statuses: PLAYABLE_STATUSES,
      minBacklogDays: THRESHOLDS.staleBacklogDays,
      // "Apenas tocado" es pertenencia al pool, no una penalización de peso:
      // así el contador del modo refleja los juegos que de verdad pueden salir.
      maxPlayedHours: THRESHOLDS.barelyPlayedHours,
    },
    weight: (game, now) => {
      const ageBonus = daysSince(game.addedAt, now) / 60
      const ratingBonus = game.rating != null && game.rating >= THRESHOLDS.hiddenGemRating ? 3 : 1
      return 1 + ageBonus + ratingBonus
    },
  },
  {
    id: 'favorite',
    label: 'Favoritos',
    emoji: '❤️',
    description: 'Solo entre los juegos que has marcado como favoritos.',
    criteria: { favoritesOnly: true },
  },
  {
    id: 'random-rpg',
    label: 'RPG aleatorio',
    emoji: '🗡️',
    description: 'Un RPG o JRPG al azar de tu biblioteca.',
    criteria: { statuses: PLAYABLE_STATUSES, genres: ['RPG', 'JRPG'] },
  },
]

const MODE_INDEX = new Map(SELECTION_MODES.map((mode) => [mode.id, mode]))

export const DEFAULT_MODE = SELECTION_MODES[0]!

export function getMode(id: string | undefined): SelectionMode {
  return (id && MODE_INDEX.get(id)) || DEFAULT_MODE
}

/**
 * Combina los filtros del usuario con los del modo.
 * El modo manda en los campos que declara; el resto de filtros se respetan tal cual.
 */
export function mergeModeCriteria(filters: FilterCriteria, mode: SelectionMode): FilterCriteria {
  return { ...filters, ...mode.criteria }
}

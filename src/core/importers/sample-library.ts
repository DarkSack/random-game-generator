import type { GameDraft } from '../types/game'

/**
 * Biblioteca de ejemplo para el primer arranque.
 *
 * Existe para que la extensión se pueda probar sin teclear veinte fichas: el
 * conjunto está elegido para que **los nueve modos de selección tengan al menos
 * un candidato** (hay juegos cortos y largos, nunca jugados, a medias,
 * abandonados, favoritos y RPGs), y las fechas son relativas a `now` para que
 * "Backlog Killer" y "Joya oculta" —que exigen meses de antigüedad— funcionen
 * desde el primer segundo.
 *
 * Todas las entradas llevan el tag `SAMPLE_TAG`: buscar por él en la biblioteca
 * las agrupa y permite borrarlas de golpe cuando sobran.
 */

/** Tag que marca las fichas de ejemplo, para poder encontrarlas y borrarlas. */
export const SAMPLE_TAG = 'Ejemplo'

const DAY = 86_400_000

interface SampleSpec {
  name: string
  platform: string
  genres: string[]
  status: GameDraft['status']
  playerMode?: GameDraft['playerMode']
  estimatedHours?: number | null
  playedHours?: number
  rating?: number | null
  favorite?: boolean
  tags?: string[]
  notes?: string
  /** Días que lleva en la biblioteca. */
  daysOwned: number
}

const SPECS: SampleSpec[] = [
  // --- Backlog antiguo: alimenta Backlog Killer y Joya oculta ---
  {
    name: 'Outer Wilds',
    platform: 'PC',
    genres: ['Aventura', 'Puzzle'],
    status: 'backlog',
    estimatedHours: 22,
    rating: 9.5,
    daysOwned: 620,
    tags: ['Espacio'],
    notes: 'Todo el mundo dice que hay que jugarlo sin saber nada.',
  },
  {
    name: 'Disco Elysium',
    platform: 'PC',
    genres: ['RPG'],
    status: 'backlog',
    estimatedHours: 30,
    rating: 9.2,
    daysOwned: 410,
    tags: ['Narrativo'],
  },
  {
    name: 'Hollow Knight',
    platform: 'Nintendo Switch',
    genres: ['Metroidvania', 'Indie'],
    status: 'backlog',
    estimatedHours: 40,
    rating: 9,
    daysOwned: 380,
  },
  {
    name: 'Return of the Obra Dinn',
    platform: 'PC',
    genres: ['Puzzle', 'Indie'],
    status: 'backlog',
    estimatedHours: 9,
    rating: 8.9,
    daysOwned: 300,
  },
  {
    name: 'Divinity: Original Sin 2',
    platform: 'PC',
    genres: ['RPG', 'Estrategia'],
    status: 'backlog',
    playerMode: 'both',
    estimatedHours: 90,
    rating: 9.1,
    daysOwned: 250,
  },

  // --- Cortos: alimentan Partida corta ---
  {
    name: 'Inside',
    platform: 'PC',
    genres: ['Plataformas', 'Indie'],
    status: 'backlog',
    estimatedHours: 4,
    rating: 8.6,
    daysOwned: 190,
  },
  {
    name: 'Journey',
    platform: 'PlayStation 5',
    genres: ['Aventura', 'Indie'],
    status: 'backlog',
    estimatedHours: 3,
    rating: 8.8,
    daysOwned: 160,
  },
  {
    name: 'Celeste',
    platform: 'Nintendo Switch',
    genres: ['Plataformas', 'Indie'],
    status: 'backlog',
    estimatedHours: 12,
    rating: 9,
    favorite: true,
    daysOwned: 140,
  },

  // --- Largos: alimentan Aventura larga ---
  {
    name: "Baldur's Gate 3",
    platform: 'PC',
    genres: ['RPG', 'Estrategia'],
    status: 'backlog',
    playerMode: 'both',
    estimatedHours: 140,
    rating: 9.6,
    favorite: true,
    daysOwned: 120,
  },
  {
    name: 'The Witcher 3: Wild Hunt',
    platform: 'Xbox Series X|S',
    genres: ['RPG', 'Acción'],
    status: 'backlog',
    estimatedHours: 100,
    rating: 9.3,
    daysOwned: 200,
  },
  {
    name: 'Persona 5 Royal',
    platform: 'PlayStation 5',
    genres: ['JRPG', 'RPG'],
    status: 'backlog',
    estimatedHours: 120,
    rating: 9.2,
    daysOwned: 95,
  },

  // --- A medias: alimentan Termina lo que empezaste ---
  {
    name: 'Elden Ring',
    platform: 'PlayStation 5',
    genres: ['RPG', 'Souls-like'],
    status: 'playing',
    estimatedHours: 110,
    playedHours: 47,
    rating: 9.4,
    favorite: true,
    daysOwned: 330,
    notes: 'Voy por Leyndell. Falta poco para el final.',
  },
  {
    name: 'Stardew Valley',
    platform: 'PC',
    genres: ['Simulación', 'Indie'],
    status: 'playing',
    playerMode: 'both',
    estimatedHours: 60,
    playedHours: 18,
    rating: 8.8,
    daysOwned: 270,
  },
  {
    name: 'Hades',
    platform: 'Nintendo Switch',
    genres: ['Roguelike', 'Acción'],
    status: 'playing',
    estimatedHours: 25,
    playedHours: 21,
    rating: 9,
    daysOwned: 210,
  },

  // --- Abandonados ---
  {
    name: 'Cuphead',
    platform: 'Nintendo Switch',
    genres: ['Acción', 'Plataformas'],
    status: 'dropped',
    estimatedHours: 15,
    playedHours: 6,
    rating: 8,
    daysOwned: 350,
    notes: 'Demasiado difícil para mi paciencia de entre semana.',
  },
  {
    name: 'No Man’s Sky',
    platform: 'PC',
    genres: ['Sandbox', 'Aventura'],
    status: 'dropped',
    playerMode: 'both',
    estimatedHours: 80,
    playedHours: 11,
    rating: 7,
    daysOwned: 290,
  },

  // --- Multijugador ---
  {
    name: 'It Takes Two',
    platform: 'Xbox Series X|S',
    genres: ['Aventura', 'Plataformas'],
    status: 'backlog',
    playerMode: 'multi',
    estimatedHours: 14,
    rating: 9,
    daysOwned: 110,
    notes: 'Pendiente de encontrar con quién jugarlo.',
  },
  {
    name: 'Overcooked! 2',
    platform: 'Nintendo Switch',
    genres: ['Puzzle', 'Indie'],
    status: 'backlog',
    playerMode: 'multi',
    estimatedHours: 10,
    daysOwned: 170,
  },

  // --- Completado y wishlist: dan contenido a las estadísticas ---
  {
    name: 'Portal 2',
    platform: 'PC',
    genres: ['Puzzle'],
    status: 'completed',
    playerMode: 'both',
    estimatedHours: 10,
    playedHours: 13,
    rating: 9.5,
    daysOwned: 540,
  },
  {
    name: 'Silksong',
    platform: 'PC',
    genres: ['Metroidvania'],
    status: 'wishlist',
    estimatedHours: 35,
    daysOwned: 25,
  },
]

/**
 * Construye los borradores de la biblioteca de ejemplo.
 * Se pasan por `libraryRepository.importGames`, que normaliza y deduplica, así
 * que cargarla dos veces no duplica fichas.
 */
export function buildSampleLibrary(now = Date.now()): GameDraft[] {
  return SPECS.map((spec) => ({
    name: spec.name,
    platform: spec.platform,
    genres: spec.genres,
    status: spec.status,
    playerMode: spec.playerMode ?? 'single',
    estimatedHours: spec.estimatedHours ?? null,
    playedHours: spec.playedHours ?? 0,
    rating: spec.rating ?? null,
    favorite: spec.favorite ?? false,
    tags: [SAMPLE_TAG, ...(spec.tags ?? [])],
    notes: spec.notes ?? '',
    addedAt: now - spec.daysOwned * DAY,
    lastPlayedAt: spec.playedHours ? now - 12 * DAY : null,
    source: 'file',
  }))
}

export const SAMPLE_LIBRARY_SIZE = SPECS.length

import type { DiscoverGenre } from '../../src/core/discover/types'

/**
 * Traducción de taxonomías.
 *
 * Es la pieza que hace que "RPG" signifique lo mismo en las cuatro tiendas:
 * Steam dice "RPG", Nintendo "Juegos de rol", Xbox "Rol y fantasía". Sin este
 * mapeo, filtrar por género daría resultados distintos según la tienda y el
 * usuario lo leería como un fallo.
 *
 * El emparejamiento es por subcadena en minúsculas y sin acentos, porque las
 * tiendas varían las etiquetas según idioma y región.
 */

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

/** Términos que identifican cada género canónico, en los idiomas que devuelven las tiendas. */
const GENRE_TERMS: Record<DiscoverGenre, string[]> = {
  action: ['action', 'accion', 'arcade'],
  adventure: ['adventure', 'aventura'],
  rpg: ['rpg', 'role', 'rol', 'jdr'],
  shooter: ['shooter', 'disparos', 'fps', 'first-person'],
  strategy: ['strategy', 'estrategia', 'tactics', 'tactica'],
  puzzle: ['puzzle', 'rompecabezas', 'logica'],
  platformer: ['platform', 'plataforma'],
  racing: ['racing', 'carreras', 'driving', 'conduccion'],
  sports: ['sport', 'deporte'],
  simulation: ['simulation', 'simulacion', 'simulador'],
  horror: ['horror', 'terror', 'survival horror'],
  roguelike: ['roguelike', 'roguelite'],
  fighting: ['fighting', 'lucha', 'pelea', 'combate'],
  indie: ['indie', 'independiente'],
  metroidvania: ['metroidvania'],
  sandbox: ['sandbox', 'mundo abierto', 'open world', 'caja de arena'],
}

/** Convierte las etiquetas crudas de una tienda al vocabulario canónico. */
export function toCanonicalGenres(rawLabels: readonly string[]): DiscoverGenre[] {
  const found = new Set<DiscoverGenre>()
  for (const label of rawLabels) {
    const value = normalize(label)
    if (!value) continue
    for (const [genre, terms] of Object.entries(GENRE_TERMS) as Array<[DiscoverGenre, string[]]>) {
      if (terms.some((term) => value.includes(term))) found.add(genre)
    }
  }
  return [...found]
}

/**
 * Término de búsqueda que mejor representa un género en las tiendas cuyo
 * descubrimiento es por texto libre (Xbox) en lugar de por faceta.
 */
const GENRE_QUERY: Record<DiscoverGenre, string> = {
  action: 'action',
  adventure: 'adventure',
  rpg: 'rpg',
  shooter: 'shooter',
  strategy: 'strategy',
  puzzle: 'puzzle',
  platformer: 'platformer',
  racing: 'racing',
  sports: 'sports',
  simulation: 'simulator',
  horror: 'horror',
  roguelike: 'roguelike',
  fighting: 'fighting',
  indie: 'indie',
  metroidvania: 'metroidvania',
  sandbox: 'sandbox',
}

export function genreQueryTerm(genre: DiscoverGenre): string {
  return GENRE_QUERY[genre]
}

/** Detecta modos de juego a partir de las categorías que publica la tienda. */
export function toPlayerModes(rawLabels: readonly string[]): Array<'single' | 'multi' | 'coop'> {
  const modes = new Set<'single' | 'multi' | 'coop'>()
  for (const label of rawLabels) {
    const value = normalize(label)
    if (value.includes('single') || value.includes('un jugador') || value.includes('1 jugador')) {
      modes.add('single')
    }
    if (value.includes('co-op') || value.includes('coop') || value.includes('cooperativo')) {
      modes.add('coop')
    }
    if (
      value.includes('multi') ||
      value.includes('pvp') ||
      value.includes('online') ||
      value.includes('en linea')
    ) {
      modes.add('multi')
    }
  }
  return [...modes]
}

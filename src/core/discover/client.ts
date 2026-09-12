import { pickRandom } from '../random/rng'
import type { Game, GameDraft } from '../types/game'
import {
  GENRE_LABEL,
  type DiscoverCriteria,
  type DiscoverGame,
  type DiscoverResponse,
} from './types'

/**
 * Cliente del recomendador.
 *
 * Es la única parte de la extensión que sale a la red, y solo cuando el
 * usuario pulsa en "Descubrir": la biblioteca y el sorteo siguen funcionando
 * sin conexión.
 */

export class DiscoverError extends Error {
  constructor(
    message: string,
    public readonly kind: 'offline' | 'server' | 'bad-response',
  ) {
    super(message)
    this.name = 'DiscoverError'
  }
}

/** Traduce los criterios a la query string que entiende `/api/discover`. */
export function buildDiscoverQuery(criteria: DiscoverCriteria): URLSearchParams {
  const params = new URLSearchParams({
    platforms: criteria.platforms.join(','),
    region: criteria.region,
    includeFree: criteria.includeFree ? '1' : '0',
    onlyDeals: criteria.onlyDeals ? '1' : '0',
  })
  if (criteria.genres.length) params.set('genres', criteria.genres.join(','))
  if (criteria.playerModes.length) params.set('players', criteria.playerModes.join(','))
  if (criteria.minPrice != null) params.set('minPrice', String(criteria.minPrice))
  if (criteria.maxPrice != null) params.set('maxPrice', String(criteria.maxPrice))
  if (criteria.minRating != null) params.set('minRating', String(criteria.minRating))
  return params
}

/**
 * Clave de caché del lado cliente. `excludeOwned` no viaja al servidor, así
 * que no forma parte de la clave: cambiarlo reutiliza la misma respuesta.
 */
export function discoverCacheKey(criteria: DiscoverCriteria): string {
  return buildDiscoverQuery(criteria).toString()
}

export async function fetchDiscover(
  apiUrl: string,
  criteria: DiscoverCriteria,
  { timeoutMs = 45_000 }: { timeoutMs?: number } = {},
): Promise<DiscoverResponse> {
  const base = apiUrl.trim().replace(/\/+$/, '')
  const url = `${base}/api/discover?${buildDiscoverQuery(criteria)}`

  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new DiscoverError(
      `No se pudo contactar con el servidor de recomendaciones (${base}). Comprueba tu conexión o la URL en Ajustes.`,
      'offline',
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new DiscoverError('El servidor respondió algo que no es una recomendación válida.', 'bad-response')
  }

  // 502 trae cuerpo útil: todas las tiendas pedidas fallaron, y cada una dice por qué.
  if (response.status === 502 && isDiscoverResponse(body)) return body
  if (!response.ok) {
    const message = (body as { message?: string })?.message
    throw new DiscoverError(message ?? `El servidor respondió con un error (${response.status}).`, 'server')
  }
  if (!isDiscoverResponse(body)) {
    throw new DiscoverError('El servidor respondió algo que no es una recomendación válida.', 'bad-response')
  }
  return body
}

function isDiscoverResponse(value: unknown): value is DiscoverResponse {
  const candidate = value as DiscoverResponse
  return Boolean(candidate) && Array.isArray(candidate.games) && Array.isArray(candidate.failures)
}

/** Nombre comparable entre tiendas: sin símbolos de marca, mayúsculas ni puntuación. */
export function normalizeTitle(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Quita de las recomendaciones lo que el usuario ya tiene en su biblioteca, en cualquier estado. */
export function excludeOwnedGames(games: DiscoverGame[], library: Game[]): DiscoverGame[] {
  const owned = new Set(library.map((game) => normalizeTitle(game.name)))
  return games.filter((game) => !owned.has(normalizeTitle(game.name)))
}

/**
 * Elige una recomendación al azar.
 *
 * Evitar las ya vistas es un intento, igual que en el sorteo de biblioteca: si
 * se agotan, se vuelve al conjunto completo en lugar de dejar al usuario sin
 * respuesta.
 */
export function pickDiscovery(
  games: DiscoverGame[],
  seenIds: ReadonlySet<string>,
): { game: DiscoverGame | null; exhausted: boolean } {
  const fresh = games.filter((game) => !seenIds.has(game.id))
  if (fresh.length) return { game: pickRandom(fresh), exhausted: false }
  return { game: pickRandom(games), exhausted: games.length > 0 }
}

const PLATFORM_NAME: Record<DiscoverGame['platform'], string> = {
  pc: 'PC',
  switch: 'Nintendo Switch',
  xbox: 'Xbox Series X|S',
  playstation: 'PlayStation 5',
}

/** Convierte una recomendación en ficha de wishlist de la biblioteca. */
export function discoveryToDraft(game: DiscoverGame): GameDraft {
  const offer = game.cheapest
  const priceNote =
    offer?.price != null
      ? offer.free
        ? 'Gratis'
        : `${offer.price.toFixed(2)} ${offer.currency} en ${offer.store}`
      : null

  return {
    name: game.name,
    platform: PLATFORM_NAME[game.platform],
    genres: game.genres.map((genre) => GENRE_LABEL[genre]),
    status: 'wishlist',
    rating: null,
    playerMode:
      game.playerModes.includes('single') &&
      (game.playerModes.includes('multi') || game.playerModes.includes('coop'))
        ? 'both'
        : game.playerModes.includes('multi') || game.playerModes.includes('coop')
          ? 'multi'
          : game.playerModes.includes('single')
            ? 'single'
            : 'unknown',
    coverUrl: game.coverUrl,
    notes: [
      game.description,
      priceNote ? `Precio al descubrirlo: ${priceNote}.` : null,
      offer?.url ? `Tienda: ${offer.url}` : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
    tags: ['Descubierto'],
    source: 'manual',
    externalId: game.id,
  }
}

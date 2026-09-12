import {
  DEFAULT_DISCOVER_CRITERIA,
  DISCOVER_GENRES,
  DISCOVER_PLATFORMS,
  currencyForRegion,
  type DiscoverCriteria,
  type DiscoverGame,
  type DiscoverGenre,
  type DiscoverPlatform,
  type DiscoverPlayerMode,
  type DiscoverResponse,
  type StoreOffer,
  type Storefront,
} from '../../src/core/discover/types'
import { TtlCache } from './cache'
import { ProviderUnavailableError } from './provider'
import { providerFor } from './providers/registry'

/** Candidatos que se piden a cada tienda antes de filtrar. */
const CANDIDATES_PER_PROVIDER = 24
const CATALOG_TTL_MS = 30 * 60 * 1000

/**
 * Se cachea el catálogo crudo por tienda, no la respuesta final: así cambiar el
 * rango de precio o la nota mínima reutiliza la misma búsqueda y solo repite el
 * filtrado, que es gratis.
 */
const catalogCache = new TtlCache<DiscoverGame[]>(CATALOG_TTL_MS)

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

const PLAYER_MODES: readonly DiscoverPlayerMode[] = ['single', 'multi', 'coop']

function listParam<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const values = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is T => (allowed as readonly string[]).includes(value))
  return [...new Set(values)]
}

function numberParam(raw: string | null, min: number, max: number): number | null {
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, value))
}

function boolParam(raw: string | null, fallback: boolean): boolean {
  if (raw == null) return fallback
  return raw === '1' || raw.toLowerCase() === 'true'
}

/**
 * Traduce la query string a criterios válidos. Todo valor desconocido se
 * descarta en silencio: una extensión desactualizada que mande un género que
 * ya no existe debe seguir recibiendo resultados, no un 400.
 */
export function parseCriteria(params: URLSearchParams): DiscoverCriteria {
  const region = (params.get('region') ?? DEFAULT_DISCOVER_CRITERIA.region)
    .trim()
    .toUpperCase()
    .slice(0, 2)

  const platforms = listParam(params.get('platforms'), DISCOVER_PLATFORMS)
  let minPrice = numberParam(params.get('minPrice'), 0, 1_000_000)
  let maxPrice = numberParam(params.get('maxPrice'), 0, 1_000_000)
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }

  return {
    genres: listParam(params.get('genres'), DISCOVER_GENRES),
    platforms: platforms.length ? platforms : DEFAULT_DISCOVER_CRITERIA.platforms,
    minPrice,
    maxPrice,
    onlyDeals: boolParam(params.get('onlyDeals'), false),
    includeFree: boolParam(params.get('includeFree'), true),
    playerModes: listParam(params.get('players'), PLAYER_MODES),
    minRating: numberParam(params.get('minRating'), 0, 10),
    region: /^[A-Z]{2}$/.test(region) ? region : DEFAULT_DISCOVER_CRITERIA.region,
    // El backend no conoce la biblioteca: excluir lo que ya se tiene es cosa del cliente.
    excludeOwned: false,
  }
}

// ---------------------------------------------------------------------------
// Filtrado (puro, testeable sin red)
// ---------------------------------------------------------------------------

/**
 * Oferta más barata expresada en la moneda del usuario.
 *
 * Las ofertas en otra moneda no cuentan para el rango de precio: comparar 15
 * USD con un tope de 300 MXN sin tipo de cambio sería inventarse la respuesta.
 */
export function cheapestInCurrency(game: DiscoverGame, currency: string): StoreOffer | null {
  let best: StoreOffer | null = null
  for (const offer of game.offers) {
    if (offer.price == null || offer.currency !== currency) continue
    if (!best || offer.price < best.price!) best = offer
  }
  return best
}

function isFree(game: DiscoverGame): boolean {
  return game.offers.some((offer) => offer.free)
}

export function matchesCriteria(game: DiscoverGame, criteria: DiscoverCriteria): boolean {
  const currency = currencyForRegion(criteria.region)

  if (criteria.genres.length) {
    // Un juego sin géneros conocidos no puede demostrar que cumple: fuera.
    if (!criteria.genres.some((genre: DiscoverGenre) => game.genres.includes(genre))) return false
  }

  if (criteria.playerModes.length) {
    if (!criteria.playerModes.some((mode) => game.playerModes.includes(mode))) return false
  }

  if (criteria.minRating != null) {
    if (game.rating == null || game.rating < criteria.minRating) return false
  }

  const free = isFree(game)
  if (free && !criteria.includeFree) return false

  if (criteria.onlyDeals && !free && !game.offers.some((offer) => offer.discountPct > 0)) {
    return false
  }

  if (criteria.minPrice != null || criteria.maxPrice != null) {
    if (free) {
      // Gratis cumple cualquier tope, pero no un mínimo mayor que cero.
      if (criteria.minPrice != null && criteria.minPrice > 0) return false
    } else {
      const offer = cheapestInCurrency(game, currency)
      if (!offer) return false
      if (criteria.minPrice != null && offer.price! < criteria.minPrice) return false
      if (criteria.maxPrice != null && offer.price! > criteria.maxPrice) return false
    }
  }

  return true
}

const dedupeKey = (game: DiscoverGame) =>
  `${game.platform}:${game.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`

export function filterCandidates(games: DiscoverGame[], criteria: DiscoverCriteria): DiscoverGame[] {
  const currency = currencyForRegion(criteria.region)
  const seen = new Set<string>()
  const out: DiscoverGame[] = []

  for (const game of games) {
    const key = dedupeKey(game)
    if (seen.has(key) || !matchesCriteria(game, criteria)) continue
    seen.add(key)

    // Reordena ofertas: primero las de la moneda del usuario, y dentro de cada
    // grupo de más barata a más cara. `cheapest` pasa a ser la que el usuario
    // puede comparar con su presupuesto.
    const offers = [...game.offers].sort((a, b) => {
      const aLocal = a.currency === currency ? 0 : 1
      const bLocal = b.currency === currency ? 0 : 1
      if (aLocal !== bLocal) return aLocal - bLocal
      return (a.price ?? Infinity) - (b.price ?? Infinity)
    })
    out.push({ ...game, offers, cheapest: offers[0] ?? null })
  }

  return out
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

function cacheKey(platform: DiscoverPlatform, criteria: DiscoverCriteria): string {
  return [platform, criteria.region, [...criteria.genres].sort().join('+'), criteria.onlyDeals ? 'deals' : 'all'].join('|')
}

export async function discover(criteria: DiscoverCriteria): Promise<DiscoverResponse> {
  const sources: Storefront[] = []
  const failures: DiscoverResponse['failures'] = []
  let allCached = true

  const settled = await Promise.allSettled(
    criteria.platforms.map(async (platform) => {
      const provider = providerFor(platform)
      const key = cacheKey(platform, criteria)
      const cached = catalogCache.get(key)
      if (cached) return { provider, games: cached }

      allCached = false
      const games = await provider.search(criteria, CANDIDATES_PER_PROVIDER)
      // No se cachea un catálogo vacío: puede ser un fallo transitorio de la tienda.
      if (games.length) catalogCache.set(key, games)
      return { provider, games }
    }),
  )

  const candidates: DiscoverGame[] = []
  settled.forEach((result, index) => {
    const platform = criteria.platforms[index]!
    const provider = providerFor(platform)
    if (result.status === 'fulfilled') {
      sources.push(provider.id)
      candidates.push(...result.value.games)
      return
    }
    const reason =
      result.reason instanceof ProviderUnavailableError
        ? result.reason.message
        : `La tienda no respondió (${result.reason instanceof Error ? result.reason.message : 'error desconocido'}).`
    failures.push({ store: provider.id, reason })
  })

  return {
    games: filterCandidates(candidates, criteria),
    sources,
    failures,
    currency: currencyForRegion(criteria.region),
    generatedAt: new Date().toISOString(),
    cached: allCached && sources.length > 0,
  }
}

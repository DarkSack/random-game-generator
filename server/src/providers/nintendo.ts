import type { DiscoverGenre, DiscoverGame, StoreOffer } from '../../../src/core/discover/types'
import { toCanonicalGenres } from '../genres'
import { fetchJson } from '../http'
import { discountPct, parsePrice, type CatalogProvider } from '../provider'

/**
 * Catálogo de Nintendo Switch.
 *
 * Dos endpoints públicos del propio eShop, sin API key:
 *
 * - El índice Solr de `search.nintendo-europe.com` para descubrir, filtrando
 *   por la faceta de género (buscar "rpg" como texto devuelve juegos con "RPG"
 *   en el título, no RPGs).
 * - `api.ec.nintendo.com/v1/price` para el precio oficial.
 *
 * LIMITACIÓN VERIFICADA: el índice europeo publica nsuids europeos, y el
 * endpoint de precios solo los resuelve en países europeos (en MX y US
 * responde `not_found`). Fuera de Europa se pide el precio de España como
 * referencia, marcado en EUR: nunca cuenta para un rango de precio en otra
 * moneda, pero el usuario ve un importe real en lugar de nada. Cubrir América
 * exigiría el índice Algolia de Nintendo US, que no es accesible de forma
 * estable.
 */

const SEARCH = 'https://search.nintendo-europe.com/es/select'
const PRICE = 'https://api.ec.nintendo.com/v1/price'

const EUROPEAN_REGIONS = new Set(['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'GB'])
const REFERENCE_REGION = 'ES'

/**
 * Término de la faceta `pretty_game_categories_txt` del índice en español.
 * Las categorías se guardan con acentos ("Acción", "Simulación"), así que se
 * usa la raíz sin la letra acentuada para que el comodín empareje.
 */
const GENRE_FACET: Partial<Record<DiscoverGenre, string>> = {
  rpg: 'RPG',
  action: 'Acci',
  adventure: 'Aventura',
  platformer: 'Plataformas',
  puzzle: 'Puzle',
  racing: 'Carreras',
  sports: 'Deportes',
  simulation: 'Simulaci',
  strategy: 'Estrategia',
  fighting: 'Lucha',
  shooter: 'Disparos',
  horror: 'Terror',
}

interface SolrDoc {
  title: string
  nsuid_txt?: string[]
  image_url_sq_s?: string
  image_url?: string
  pretty_game_categories_txt?: string[]
  players_to?: number
  excerpt?: string
  url?: string
  dates_released_dts?: string[]
}

interface SolrResponse {
  response: { numFound: number; docs: SolrDoc[] }
}

interface PriceEntry {
  title_id: number
  sales_status: string
  regular_price?: { currency: string; raw_value: string }
  discount_price?: { currency: string; raw_value: string }
}

function buildSearchUrl(genres: DiscoverGenre[], limit: number): string {
  const filters = [
    'type:GAME',
    'system_type:nintendoswitch*',
    // Solo fichas con id de compra y a la venta: `price_lowest_f` vale -1 en
    // juegos retirados, que no tiene sentido recomendar.
    'nsuid_txt:*',
    'price_lowest_f:[0 TO *]',
  ]
  const facets = genres
    .map((genre) => GENRE_FACET[genre])
    .filter((term): term is string => Boolean(term))
  if (facets.length) {
    filters.push(`(${facets.map((term) => `pretty_game_categories_txt:*${term}*`).join(' OR ')})`)
  }

  const params = new URLSearchParams({
    q: '*',
    fq: filters.join(' AND '),
    rows: String(Math.min(60, limit * 2)),
    sort: 'popularity asc',
    wt: 'json',
  })
  return `${SEARCH}?${params}`
}

async function fetchPrices(nsuids: string[], region: string): Promise<Map<string, PriceEntry>> {
  const map = new Map<string, PriceEntry>()
  // El endpoint acepta lotes de 50 como máximo.
  for (let i = 0; i < nsuids.length; i += 50) {
    const batch = nsuids.slice(i, i + 50)
    try {
      const payload = await fetchJson<{ prices?: PriceEntry[] }>(
        `${PRICE}?country=${region}&lang=es&ids=${batch.join(',')}`,
        { timeoutMs: 9000 },
      )
      for (const entry of payload.prices ?? []) {
        if (entry.regular_price) map.set(String(entry.title_id), entry)
      }
    } catch {
      // Sin precios seguimos: la ficha se muestra sin importe.
    }
  }
  return map
}

export const nintendoProvider: CatalogProvider = {
  id: 'nintendo',
  platform: 'switch',
  label: 'Nintendo eShop',
  status: 'available',

  async search(criteria, limit) {
    const payload = await fetchJson<SolrResponse>(buildSearchUrl(criteria.genres, limit), {
      timeoutMs: 10_000,
    })
    const docs = (payload.response?.docs ?? []).filter((doc) => doc.title && doc.nsuid_txt?.[0])
    const nsuids = docs.map((doc) => doc.nsuid_txt![0]!)

    const region = criteria.region.toUpperCase()
    const priceRegion = EUROPEAN_REGIONS.has(region) ? region : REFERENCE_REGION
    const prices = await fetchPrices(nsuids, priceRegion)

    return docs.map((doc): DiscoverGame => {
      const nsuid = doc.nsuid_txt![0]!
      const entry = prices.get(nsuid)
      const regular = parsePrice(entry?.regular_price?.raw_value)
      const discounted = parsePrice(entry?.discount_price?.raw_value)
      const price = discounted ?? regular

      const offer: StoreOffer = {
        store: 'nintendo',
        price,
        normalPrice: regular,
        currency: entry?.regular_price?.currency ?? '',
        discountPct: discountPct(price, regular),
        free: price === 0,
        url: doc.url
          ? `https://www.nintendo.com${doc.url}`
          : `https://www.nintendo.com/search/#q=${encodeURIComponent(doc.title)}`,
      }

      const releaseDate = doc.dates_released_dts?.[0]
      const cover = doc.image_url_sq_s ?? doc.image_url ?? null

      return {
        id: `nintendo:${nsuid}`,
        name: doc.title,
        platform: 'switch',
        genres: toCanonicalGenres(doc.pretty_game_categories_txt ?? []),
        playerModes: (doc.players_to ?? 1) > 1 ? ['single', 'multi'] : ['single'],
        coverUrl: cover ? (cover.startsWith('//') ? `https:${cover}` : cover) : null,
        description: doc.excerpt ?? '',
        rating: null,
        releaseYear: releaseDate ? new Date(releaseDate).getUTCFullYear() : null,
        offers: [offer],
        cheapest: offer,
      }
    })
  },
}

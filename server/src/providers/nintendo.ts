import type { DiscoverGame, StoreOffer } from '../../../src/core/discover/types'
import { toCanonicalGenres } from '../genres'
import { fetchJson } from '../http'
import { discountPct, parsePrice, type CatalogProvider } from '../provider'

/**
 * Catálogo de Nintendo Switch.
 *
 * Dos endpoints públicos del propio eShop, sin API key:
 *
 * - El índice Solr de `search.nintendo-europe.com` para descubrir por género.
 * - `api.ec.nintendo.com/v1/price` para el precio oficial, que acepta hasta 50
 *   nsuids por llamada y devuelve la moneda del país pedido.
 *
 * LIMITACIÓN CONOCIDA: el índice europeo publica nsuids europeos. Para países
 * de América el endpoint de precios puede no resolverlos, y entonces la ficha
 * sale sin precio en lugar de con un precio inventado. Cubrir América exigiría
 * el índice Algolia de Nintendo US, cuyas claves rotan.
 */

const SEARCH = 'https://search.nintendo-europe.com/es/select'
const PRICE = 'https://api.ec.nintendo.com/v1/price'

interface SolrDoc {
  title: string
  nsuid_txt?: string[]
  image_url?: string
  image_url_sq_s?: string
  pretty_game_categories_txt?: string[]
  players_to?: number
  players_from?: number
  excerpt?: string
  url?: string
  dates_released_dts?: string[]
  pretty_agerating_s?: string
}

interface SolrResponse {
  response: { numFound: number; docs: SolrDoc[] }
}

interface PriceEntry {
  title_id: number
  sales_status: string
  regular_price?: { amount: string; currency: string; raw_value: string }
  discount_price?: { amount: string; currency: string; raw_value: string }
}

interface PriceResponse {
  country: string
  prices: PriceEntry[]
}

function buildSearchUrl(terms: string[], limit: number): string {
  // Solr: `fq` acota a juegos de Switch; `q` busca en título y descripción.
  const query = terms.length ? terms.join(' OR ') : '*'
  const params = new URLSearchParams({
    q: query,
    fq: 'type:GAME AND system_type:nintendoswitch*',
    rows: String(Math.min(60, limit * 3)),
    start: '0',
    sort: 'score desc, date_from desc',
    wt: 'json',
  })
  return `${SEARCH}?${params}`
}

async function fetchPrices(nsuids: string[], region: string): Promise<Map<string, PriceEntry>> {
  const map = new Map<string, PriceEntry>()
  if (!nsuids.length) return map

  // El endpoint acepta lotes de 50 como máximo.
  for (let i = 0; i < nsuids.length; i += 50) {
    const batch = nsuids.slice(i, i + 50)
    try {
      const payload = await fetchJson<PriceResponse>(
        `${PRICE}?country=${region.toUpperCase()}&lang=es&ids=${batch.join(',')}`,
        { timeoutMs: 9000 },
      )
      for (const entry of payload.prices ?? []) {
        map.set(String(entry.title_id), entry)
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
    const terms = criteria.genres.length ? criteria.genres.map((genre) => genre) : []
    const payload = await fetchJson<SolrResponse>(buildSearchUrl(terms, limit), {
      timeoutMs: 10_000,
    })

    const docs = (payload.response?.docs ?? []).filter((doc) => doc.title && doc.nsuid_txt?.length)
    const nsuids = docs.map((doc) => doc.nsuid_txt![0]!).filter(Boolean)
    const prices = await fetchPrices(nsuids, criteria.region)

    return docs.slice(0, limit * 2).map((doc): DiscoverGame => {
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
          : `https://www.nintendo.com/store/products/?q=${encodeURIComponent(doc.title)}`,
      }

      const players = doc.players_to ?? doc.players_from ?? 1
      const releaseDate = doc.dates_released_dts?.[0]

      return {
        id: `nintendo:${nsuid}`,
        name: doc.title,
        platform: 'switch',
        genres: toCanonicalGenres(doc.pretty_game_categories_txt ?? []),
        playerModes: players > 1 ? ['single', 'multi'] : ['single'],
        coverUrl: doc.image_url
          ? doc.image_url.startsWith('http')
            ? doc.image_url
            : `https:${doc.image_url}`
          : null,
        description: doc.excerpt ?? '',
        rating: null,
        releaseYear: releaseDate ? new Date(releaseDate).getUTCFullYear() : null,
        offers: [offer],
        cheapest: offer,
      }
    })
  },
}

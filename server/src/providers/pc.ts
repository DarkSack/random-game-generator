import type {
  DiscoverCriteria,
  DiscoverGame,
  StoreOffer,
  Storefront,
} from '../../../src/core/discover/types'
import { toCanonicalGenres, toPlayerModes } from '../genres'
import { fetchJson, mapLimit } from '../http'
import { discountPct, parsePrice, type CatalogProvider } from '../provider'

/**
 * Catálogo de PC.
 *
 * Se apoya en dos fuentes que se complementan y ninguna necesita API key:
 *
 * - **CheapShark** descubre: compara la misma ficha en Steam, Epic, GOG, Humble
 *   y Fanatical, y filtra por precio. Su pega es que publica **solo en USD**.
 * - **Steam appdetails** enriquece: géneros, modos de juego, portada, nota y —lo
 *   importante— el precio en la moneda del país del usuario.
 *
 * Por eso el precio que se muestra sale de Steam cuando el juego existe ahí, y
 * las ofertas de otras tiendas se marcan explícitamente en USD: preferimos
 * enseñar la moneda real de cada tienda antes que convertir con un tipo de
 * cambio inventado.
 */

const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0'
const STEAM_APPDETAILS = 'https://store.steampowered.com/api/appdetails'

/** storeID de CheapShark -> nuestra taxonomía. */
const STORE_IDS: Record<string, Storefront> = {
  '1': 'steam',
  '7': 'gog',
  '11': 'humble',
  '15': 'fanatical',
  '25': 'epic',
}

interface CheapSharkDeal {
  title: string
  dealID: string
  storeID: string
  gameID: string
  steamAppID: string | null
  salePrice: string
  normalPrice: string
  steamRatingPercent: string | null
  thumb: string
  releaseDate: number
}

interface SteamAppDetails {
  success: boolean
  data?: {
    name: string
    short_description?: string
    header_image?: string
    genres?: Array<{ description: string }>
    categories?: Array<{ description: string }>
    is_free?: boolean
    release_date?: { date?: string }
    metacritic?: { score?: number }
    price_overview?: {
      currency: string
      initial: number
      final: number
      discount_percent: number
    }
  }
}

/**
 * CheapShark filtra en USD, pero el usuario pide en su moneda. Sin un tipo de
 * cambio no podemos traducir el rango, así que pedimos un margen amplio y
 * hacemos el filtrado fino más tarde contra el precio local real de Steam.
 */
function buildDealsUrl(criteria: DiscoverCriteria, limit: number): string {
  const params = new URLSearchParams({
    pageSize: String(Math.min(60, limit * 3)),
    sortBy: 'Reviews',
  })
  if (criteria.onlyDeals) params.set('onSale', '1')
  return `${CHEAPSHARK}/deals?${params}`
}

async function steamDetails(appId: string, region: string): Promise<SteamAppDetails['data'] | null> {
  const url = `${STEAM_APPDETAILS}?appids=${appId}&cc=${region.toLowerCase()}&l=spanish`
  const payload = await fetchJson<Record<string, SteamAppDetails>>(url, { timeoutMs: 9000 })
  const entry = payload[appId]
  return entry?.success && entry.data?.name ? entry.data : null
}

export const pcProvider: CatalogProvider = {
  id: 'steam',
  platform: 'pc',
  label: 'PC (Steam, Epic, GOG, Humble…)',
  status: 'available',

  async search(criteria, limit) {
    const deals = await fetchJson<CheapSharkDeal[]>(buildDealsUrl(criteria, limit), {
      timeoutMs: 10_000,
    })

    // CheapShark repite el mismo juego una vez por tienda: agrupamos por ficha
    // para que una recomendación sea un juego, no una oferta suelta.
    const byGame = new Map<string, CheapSharkDeal[]>()
    for (const deal of deals) {
      const key = deal.steamAppID || deal.gameID
      const bucket = byGame.get(key)
      if (bucket) bucket.push(deal)
      else byGame.set(key, [deal])
    }

    const candidates = [...byGame.entries()].slice(0, Math.min(40, limit * 2))

    const games = await mapLimit(candidates, 6, async ([key, groupDeals]) => {
      const steamAppId = groupDeals.find((deal) => deal.steamAppID)?.steamAppID ?? null
      const details = steamAppId ? await steamDetails(steamAppId, criteria.region) : null

      const offers: StoreOffer[] = groupDeals.map((deal) => {
        const store = STORE_IDS[deal.storeID] ?? 'other-pc'
        const price = parsePrice(deal.salePrice)
        const normalPrice = parsePrice(deal.normalPrice)
        return {
          store,
          // Steam nos da el precio localizado; el resto se queda en USD.
          price: store === 'steam' && details?.price_overview ? details.price_overview.final / 100 : price,
          normalPrice:
            store === 'steam' && details?.price_overview
              ? details.price_overview.initial / 100
              : normalPrice,
          currency: store === 'steam' && details?.price_overview ? details.price_overview.currency : 'USD',
          discountPct:
            store === 'steam' && details?.price_overview
              ? details.price_overview.discount_percent
              : discountPct(price, normalPrice),
          free: details?.is_free === true || price === 0,
          url:
            store === 'steam' && steamAppId
              ? `https://store.steampowered.com/app/${steamAppId}`
              : `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.dealID)}`,
        }
      })

      offers.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))

      const first = groupDeals[0]!
      const ratingPercent = Number(first.steamRatingPercent ?? 0)
      const releaseYear = first.releaseDate
        ? new Date(first.releaseDate * 1000).getUTCFullYear()
        : null

      const game: DiscoverGame = {
        id: `steam:${key}`,
        name: details?.name ?? first.title,
        platform: 'pc',
        genres: toCanonicalGenres((details?.genres ?? []).map((genre) => genre.description)),
        playerModes: toPlayerModes((details?.categories ?? []).map((category) => category.description)),
        coverUrl: details?.header_image ?? first.thumb ?? null,
        description: details?.short_description ?? '',
        rating: details?.metacritic?.score
          ? details.metacritic.score / 10
          : ratingPercent > 0
            ? ratingPercent / 10
            : null,
        releaseYear,
        offers,
        cheapest: offers[0] ?? null,
      }
      return game
    })

    return games.filter(
      (game): game is DiscoverGame => game !== null && game.name.trim().length > 0,
    )
  },
}

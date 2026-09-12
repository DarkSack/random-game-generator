import type { DiscoverGame, StoreOffer } from '../../../src/core/discover/types'
import { genreQueryTerm, toCanonicalGenres, toPlayerModes } from '../genres'
import { fetchJson } from '../http'
import { discountPct, type CatalogProvider } from '../provider'

/** Modos de juego a partir de los atributos Xbox Live de la ficha. */
function playerModesFrom(product: CatalogProduct): Array<'single' | 'multi' | 'coop'> {
  const names = (product.Properties?.Attributes ?? []).map((attribute) => attribute.Name ?? '')
  const modes = new Set<'single' | 'multi' | 'coop'>()
  for (const name of names) {
    if (/singleplayer/i.test(name)) modes.add('single')
    if (/multiplayer/i.test(name)) modes.add('multi')
    if (/coop/i.test(name)) modes.add('coop')
  }
  return modes.size ? [...modes] : toPlayerModes(product.Properties?.Categories ?? [])
}

/**
 * Catálogo de Xbox.
 *
 * `storeedgefd` es el buscador que usa la propia Microsoft Store; exige el
 * parámetro `deviceFamily` (sin él responde 400) y devuelve los `productId`
 * que luego resuelve `displaycatalog` con precio en la moneda del mercado.
 *
 * El descubrimiento es por texto libre, no por faceta de género, así que se
 * busca el término canónico y después se filtra por las categorías reales que
 * devuelve la ficha.
 */

const SEARCH = 'https://storeedgefd.dsx.mp.microsoft.com/v9.0/search'
const CATALOG = 'https://displaycatalog.mp.microsoft.com/v7.0/products'
const APP_VERSION = '22203.1401.0.0'

interface SearchResponse {
  Payload?: {
    SearchResults?: Array<{
      ProductId: string
      Title: string
      Images?: Array<{ ImageType: string; Url: string }>
    }>
  }
}

interface CatalogProduct {
  ProductId: string
  /** 'Game' para juegos base; 'Durable'/'Consumable' para DLC, pases y monedas. */
  ProductKind?: string
  LocalizedProperties?: Array<{
    ProductTitle?: string
    ShortDescription?: string
    ProductDescription?: string
    Images?: Array<{ ImagePurpose?: string; Uri?: string }>
  }>
  Properties?: { Categories?: string[]; Attributes?: Array<{ Name?: string }> }
  DisplaySkuAvailabilities?: Array<{
    Availabilities?: Array<{
      OrderManagementData?: {
        Price?: { ListPrice?: number; MSRP?: number; CurrencyCode?: string }
      }
    }>
  }>
  MarketProperties?: Array<{ OriginalReleaseDate?: string; UsageData?: Array<{ AverageRating?: number }> }>
}

interface CatalogResponse {
  Products?: CatalogProduct[]
}

function searchUrl(term: string, region: string, limit: number): string {
  const params = new URLSearchParams({
    query: term,
    market: region.toUpperCase(),
    locale: `es-${region.toUpperCase()}`,
    deviceFamily: 'Windows.Xbox',
    // Con 'Apps' el buscador devuelve aplicaciones (reproductores, utilidades).
    mediaType: 'Games',
    appVersion: APP_VERSION,
    count: String(Math.min(25, limit * 2)),
  })
  return `${SEARCH}?${params}`
}

function catalogUrl(productIds: string[], region: string): string {
  const params = new URLSearchParams({
    bigIds: productIds.join(','),
    market: region.toUpperCase(),
    languages: `es-${region.toUpperCase()}`,
    'MS-CV': 'DGU1mcuYo0WMMp.1',
  })
  return `${CATALOG}?${params}`
}

function pickImage(product: CatalogProduct): string | null {
  const images = product.LocalizedProperties?.[0]?.Images ?? []
  const preferred =
    images.find((image) => image.ImagePurpose === 'Poster') ??
    images.find((image) => image.ImagePurpose === 'BoxArt') ??
    images[0]
  const uri = preferred?.Uri
  if (!uri) return null
  return uri.startsWith('//') ? `https:${uri}` : uri
}

export const xboxProvider: CatalogProvider = {
  id: 'xbox',
  platform: 'xbox',
  label: 'Microsoft Store (Xbox)',
  status: 'available',

  async search(criteria, limit) {
    const terms = criteria.genres.length ? criteria.genres.map(genreQueryTerm) : ['game']

    const idSet = new Set<string>()
    for (const term of terms.slice(0, 3)) {
      try {
        const payload = await fetchJson<SearchResponse>(searchUrl(term, criteria.region, limit), {
          timeoutMs: 10_000,
          browserAgent: true,
        })
        for (const result of payload.Payload?.SearchResults ?? []) {
          if (result.ProductId) idSet.add(result.ProductId)
        }
      } catch {
        // Un término sin resultados no invalida los demás.
      }
    }

    const productIds = [...idSet].slice(0, Math.min(20, limit * 2))
    if (!productIds.length) return []

    const catalog = await fetchJson<CatalogResponse>(catalogUrl(productIds, criteria.region), {
      timeoutMs: 12_000,
      browserAgent: true,
    })

    return (catalog.Products ?? [])
      // Fuera DLC, temporadas y paquetes: se recomienda el juego, no sus añadidos.
      .filter((product) => !product.ProductKind || product.ProductKind === 'Game')
      .map((product): DiscoverGame => {
      const localized = product.LocalizedProperties?.[0]
      const priceInfo =
        product.DisplaySkuAvailabilities?.[0]?.Availabilities?.[0]?.OrderManagementData?.Price
      const price = priceInfo?.ListPrice ?? null
      const normalPrice = priceInfo?.MSRP ?? null
      const categories = product.Properties?.Categories ?? []

      const offer: StoreOffer = {
        store: 'xbox',
        price,
        normalPrice,
        currency: priceInfo?.CurrencyCode ?? '',
        discountPct: discountPct(price, normalPrice),
        free: price === 0,
        url: `https://www.xbox.com/${criteria.region.toLowerCase()}/games/store/_/${product.ProductId}`,
      }

      const release = product.MarketProperties?.[0]?.OriginalReleaseDate
      const rating = product.MarketProperties?.[0]?.UsageData?.[0]?.AverageRating ?? null

      return {
        id: `xbox:${product.ProductId}`,
        name: localized?.ProductTitle ?? '',
        platform: 'xbox',
        genres: toCanonicalGenres(categories),
        playerModes: playerModesFrom(product),
        coverUrl: pickImage(product),
        description: localized?.ShortDescription ?? localized?.ProductDescription ?? '',
        rating: rating ? Math.round(rating * 2 * 10) / 10 : null,
        releaseYear: release ? new Date(release).getUTCFullYear() : null,
        offers: [offer],
        cheapest: offer,
      }
    })
      .filter((game) => game.name.trim().length > 0)
  },
}

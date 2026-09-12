/**
 * Contrato del recomendador ("Descubrir").
 *
 * Este fichero es la frontera entre la extensión y el backend: ambos lo
 * importan, así que cualquier cambio de forma rompe la compilación de los dos
 * lados a la vez en lugar de fallar en tiempo de ejecución.
 *
 * Ojo con la diferencia respecto al resto del núcleo: aquí se habla de juegos
 * que el usuario NO tiene. Un `DiscoverGame` no es un `Game`; se convierte en
 * uno solo cuando el usuario lo guarda en su wishlist.
 */

/** Tiendas soportadas por el recomendador. */
export const STOREFRONTS = [
  'steam',
  'epic',
  'gog',
  'humble',
  'fanatical',
  'other-pc',
  'nintendo',
  'xbox',
  'playstation',
] as const
export type Storefront = (typeof STOREFRONTS)[number]

/** Plataformas que el usuario elige en la UI; agrupan tiendas. */
export const DISCOVER_PLATFORMS = ['pc', 'switch', 'xbox', 'playstation'] as const
export type DiscoverPlatform = (typeof DISCOVER_PLATFORMS)[number]

export const PLATFORM_STOREFRONTS: Record<DiscoverPlatform, Storefront[]> = {
  pc: ['steam', 'epic', 'gog', 'humble', 'fanatical', 'other-pc'],
  switch: ['nintendo'],
  xbox: ['xbox'],
  playstation: ['playstation'],
}

/**
 * Vocabulario canónico de géneros.
 *
 * Cada tienda usa su propia taxonomía ("Rol" en Nintendo, "RPG" en Steam,
 * "Juegos de rol" en Xbox). Los proveedores traducen a estas claves, de forma
 * que el filtro del usuario significa lo mismo en las cuatro tiendas.
 */
export const DISCOVER_GENRES = [
  'action',
  'adventure',
  'rpg',
  'shooter',
  'strategy',
  'puzzle',
  'platformer',
  'racing',
  'sports',
  'simulation',
  'horror',
  'roguelike',
  'fighting',
  'indie',
  'metroidvania',
  'sandbox',
] as const
export type DiscoverGenre = (typeof DISCOVER_GENRES)[number]

export const GENRE_LABEL: Record<DiscoverGenre, string> = {
  action: 'Acción',
  adventure: 'Aventura',
  rpg: 'RPG',
  shooter: 'Shooter',
  strategy: 'Estrategia',
  puzzle: 'Puzzle',
  platformer: 'Plataformas',
  racing: 'Carreras',
  sports: 'Deportes',
  simulation: 'Simulación',
  horror: 'Terror',
  roguelike: 'Roguelike',
  fighting: 'Lucha',
  indie: 'Indie',
  metroidvania: 'Metroidvania',
  sandbox: 'Sandbox',
}

export type DiscoverPlayerMode = 'single' | 'multi' | 'coop'

/** Oferta concreta de una tienda para un juego. */
export interface StoreOffer {
  store: Storefront
  /** Precio actual ya con descuento, en `currency`. `null` = no disponible. */
  price: number | null
  /** Precio sin descuento. */
  normalPrice: number | null
  currency: string
  /** Porcentaje de descuento, 0-100. */
  discountPct: number
  /** `true` si el juego es gratuito o está incluido en una suscripción. */
  free: boolean
  url: string
}

/** Juego recomendado, ya normalizado desde cualquier tienda. */
export interface DiscoverGame {
  /** Id estable `storefront:externalId`, usado para deduplicar entre tiendas. */
  id: string
  name: string
  platform: DiscoverPlatform
  genres: DiscoverGenre[]
  playerModes: DiscoverPlayerMode[]
  coverUrl: string | null
  description: string
  /** Nota agregada 0-10 cuando la tienda la publica. */
  rating: number | null
  releaseYear: number | null
  /** Todas las ofertas encontradas, de más barata a más cara. */
  offers: StoreOffer[]
  /** Atajo a `offers[0]`: la más barata. */
  cheapest: StoreOffer | null
}

/** Lo que el usuario pide desde la UI. */
export interface DiscoverCriteria {
  genres: DiscoverGenre[]
  platforms: DiscoverPlatform[]
  /** Rango de precio en la moneda de `region`. `null` = sin límite. */
  minPrice: number | null
  maxPrice: number | null
  /** Solo juegos gratuitos o con descuento activo. */
  onlyDeals: boolean
  includeFree: boolean
  playerModes: DiscoverPlayerMode[]
  /** Nota mínima 0-10. */
  minRating: number | null
  /** País ISO-3166 alpha-2: decide moneda y disponibilidad. */
  region: string
  /** Excluye lo que ya está en la biblioteca del usuario. */
  excludeOwned: boolean
}

export const DEFAULT_DISCOVER_CRITERIA: DiscoverCriteria = {
  genres: [],
  platforms: ['pc'],
  minPrice: null,
  maxPrice: null,
  onlyDeals: false,
  includeFree: true,
  playerModes: [],
  minRating: null,
  region: 'MX',
  excludeOwned: true,
}

/** Respuesta del backend. */
export interface DiscoverResponse {
  games: DiscoverGame[]
  /** Tiendas que respondieron correctamente. */
  sources: Storefront[]
  /** Tiendas que fallaron o no están implementadas, con el motivo. */
  failures: Array<{ store: Storefront; reason: string }>
  currency: string
  /** Momento de generación, para que el cliente sepa cuán fresco es el precio. */
  generatedAt: string
  cached: boolean
}

/** Moneda por región. El backend la usa para pedir precios localizados. */
export const REGION_CURRENCY: Record<string, string> = {
  MX: 'MXN',
  US: 'USD',
  ES: 'EUR',
  AR: 'ARS',
  CO: 'COP',
  CL: 'CLP',
  BR: 'BRL',
  GB: 'GBP',
}

export function currencyForRegion(region: string): string {
  return REGION_CURRENCY[region.toUpperCase()] ?? 'USD'
}

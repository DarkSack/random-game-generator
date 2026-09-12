import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DiscoverGame, StoreOffer } from '../src/core/discover/types'
import { DEFAULT_DISCOVER_CRITERIA } from '../src/core/discover/types'
import {
  cheapestInCurrency,
  filterCandidates,
  matchesCriteria,
  parseCriteria,
} from '../server/src/discover'
import { toCanonicalGenres, toPlayerModes } from '../server/src/genres'
import { discountPct, parsePrice } from '../server/src/provider'
import { TtlCache } from '../server/src/cache'

const offer = (patch: Partial<StoreOffer> = {}): StoreOffer => ({
  store: 'steam',
  price: 100,
  normalPrice: 100,
  currency: 'MXN',
  discountPct: 0,
  free: false,
  url: 'https://example.com',
  ...patch,
})

const game = (patch: Partial<DiscoverGame> = {}): DiscoverGame => {
  const offers = patch.offers ?? [offer()]
  return {
    id: 'steam:1',
    name: 'Juego',
    platform: 'pc',
    genres: ['rpg'],
    playerModes: ['single'],
    coverUrl: null,
    description: '',
    rating: 8,
    releaseYear: 2020,
    offers,
    cheapest: offers[0] ?? null,
    ...patch,
  }
}

const criteria = (patch: Partial<typeof DEFAULT_DISCOVER_CRITERIA> = {}) => ({
  ...DEFAULT_DISCOVER_CRITERIA,
  ...patch,
})

// --- Entrada ---------------------------------------------------------------

test('parseCriteria: descarta valores desconocidos en lugar de fallar', () => {
  const parsed = parseCriteria(
    new URLSearchParams('genres=rpg,inventado,RPG&platforms=pc,nes&players=multi,raro&region=mx'),
  )
  assert.deepEqual(parsed.genres, ['rpg'])
  assert.deepEqual(parsed.platforms, ['pc'])
  assert.deepEqual(parsed.playerModes, ['multi'])
  assert.equal(parsed.region, 'MX')
})

test('parseCriteria: sin plataformas válidas usa las de por defecto', () => {
  assert.deepEqual(parseCriteria(new URLSearchParams('platforms=nes')).platforms, ['pc'])
})

test('parseCriteria: intercambia un rango de precio invertido', () => {
  const parsed = parseCriteria(new URLSearchParams('minPrice=500&maxPrice=100'))
  assert.equal(parsed.minPrice, 100)
  assert.equal(parsed.maxPrice, 500)
})

test('parseCriteria: una región mal formada cae a la de por defecto', () => {
  assert.equal(parseCriteria(new URLSearchParams('region=1x')).region, 'MX')
})

// --- Precio y moneda -------------------------------------------------------

test('parsePrice: entiende formatos de miles con coma y con punto', () => {
  assert.equal(parsePrice('MX$1,029.00'), 1029)
  assert.equal(parsePrice('1.029,50 €'), 1029.5)
  assert.equal(parsePrice('7.99'), 7.99)
  assert.equal(parsePrice(''), null)
  assert.equal(parsePrice(null), null)
})

test('discountPct: calcula el descuento y nunca devuelve negativos', () => {
  assert.equal(discountPct(75, 100), 25)
  assert.equal(discountPct(120, 100), 0)
  assert.equal(discountPct(null, 100), 0)
})

test('cheapestInCurrency: ignora ofertas en otra moneda', () => {
  const g = game({
    offers: [offer({ price: 5, currency: 'USD' }), offer({ price: 90, currency: 'MXN' })],
  })
  assert.equal(cheapestInCurrency(g, 'MXN')?.price, 90)
  assert.equal(cheapestInCurrency(g, 'EUR'), null)
})

test('matchesCriteria: el rango de precio no compara monedas distintas', () => {
  // 5 USD parece barato frente a un tope de 100 MXN, pero sin tipo de cambio no se puede afirmar.
  const soloUsd = game({ offers: [offer({ price: 5, currency: 'USD' })] })
  assert.equal(matchesCriteria(soloUsd, criteria({ maxPrice: 100 })), false)
  assert.equal(matchesCriteria(soloUsd, criteria()), true)
})

test('matchesCriteria: respeta mínimo y máximo de precio', () => {
  const g = game({ offers: [offer({ price: 150 })] })
  assert.equal(matchesCriteria(g, criteria({ maxPrice: 100 })), false)
  assert.equal(matchesCriteria(g, criteria({ minPrice: 200 })), false)
  assert.equal(matchesCriteria(g, criteria({ minPrice: 100, maxPrice: 200 })), true)
})

test('matchesCriteria: lo gratuito cumple cualquier tope pero no un mínimo positivo', () => {
  const gratis = game({ offers: [offer({ price: 0, free: true })] })
  assert.equal(matchesCriteria(gratis, criteria({ maxPrice: 50 })), true)
  assert.equal(matchesCriteria(gratis, criteria({ minPrice: 10 })), false)
  assert.equal(matchesCriteria(gratis, criteria({ includeFree: false })), false)
})

test('matchesCriteria: solo ofertas exige descuento activo o gratuidad', () => {
  assert.equal(matchesCriteria(game(), criteria({ onlyDeals: true })), false)
  assert.equal(
    matchesCriteria(game({ offers: [offer({ discountPct: 30 })] }), criteria({ onlyDeals: true })),
    true,
  )
})

test('matchesCriteria: un juego sin géneros conocidos no pasa un filtro de género', () => {
  assert.equal(matchesCriteria(game({ genres: [] }), criteria({ genres: ['rpg'] })), false)
  assert.equal(matchesCriteria(game({ genres: ['rpg', 'indie'] }), criteria({ genres: ['indie'] })), true)
})

test('matchesCriteria: nota mínima y modos de juego', () => {
  assert.equal(matchesCriteria(game({ rating: null }), criteria({ minRating: 7 })), false)
  assert.equal(matchesCriteria(game({ rating: 6 }), criteria({ minRating: 7 })), false)
  assert.equal(matchesCriteria(game(), criteria({ playerModes: ['multi'] })), false)
  assert.equal(
    matchesCriteria(game({ playerModes: ['single', 'coop'] }), criteria({ playerModes: ['coop'] })),
    true,
  )
})

test('filterCandidates: deduplica por plataforma y nombre normalizado', () => {
  const result = filterCandidates(
    [
      game({ id: 'steam:1', name: 'Hades' }),
      game({ id: 'gog:9', name: 'HADES' }),
      game({ id: 'nintendo:3', name: 'Hades', platform: 'switch' }),
    ],
    criteria(),
  )
  assert.equal(result.length, 2)
})

test('filterCandidates: la oferta destacada es la de la moneda del usuario', () => {
  const [result] = filterCandidates(
    [game({ offers: [offer({ price: 3, currency: 'USD' }), offer({ price: 80, currency: 'MXN' })] })],
    criteria(),
  )
  assert.equal(result?.cheapest?.currency, 'MXN')
})

// --- Taxonomías ------------------------------------------------------------

test('toCanonicalGenres: traduce las etiquetas de cada tienda al mismo género', () => {
  assert.deepEqual(toCanonicalGenres(['RPG']), ['rpg'])
  assert.deepEqual(toCanonicalGenres(['Rol (RPG)']), ['rpg'])
  assert.deepEqual(toCanonicalGenres(['Acción']), ['action'])
  assert.deepEqual(toCanonicalGenres(['Simulación']), ['simulation'])
  assert.deepEqual(toCanonicalGenres(['Puzle']), ['puzzle'])
  assert.deepEqual(toCanonicalGenres(['Shooter']), ['shooter'])
})

test('toPlayerModes: detecta un jugador, multijugador y cooperativo', () => {
  assert.deepEqual(toPlayerModes(['Un jugador']), ['single'])
  assert.deepEqual(new Set(toPlayerModes(['Multijugador en línea', 'Cooperativo'])), new Set(['multi', 'coop']))
})

// --- Caché -----------------------------------------------------------------

test('TtlCache: caduca y expulsa la entrada más antigua al llenarse', () => {
  const cache = new TtlCache<number>(1000, 2)
  cache.set('a', 1, 0)
  cache.set('b', 2, 0)
  cache.set('c', 3, 0)
  assert.equal(cache.get('a', 10), undefined)
  assert.equal(cache.get('c', 10), 3)
  assert.equal(cache.get('c', 2000), undefined)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDiscoverQuery,
  discoverCacheKey,
  discoveryToDraft,
  excludeOwnedGames,
  normalizeTitle,
  pickDiscovery,
} from '../src/core/discover/client'
import { DEFAULT_DISCOVER_CRITERIA, type DiscoverGame } from '../src/core/discover/types'
import { DEFAULT_DISCOVER_API_URL, migrateSettings } from '../src/core/storage/schema'
import { createGame } from '../src/core/types/game'

const discovery = (patch: Partial<DiscoverGame> = {}): DiscoverGame => {
  const offer = {
    store: 'steam' as const,
    price: 149.99,
    normalPrice: 199.99,
    currency: 'MXN',
    discountPct: 25,
    free: false,
    url: 'https://store.steampowered.com/app/413150',
  }
  return {
    id: 'steam:413150',
    name: 'Stardew Valley',
    platform: 'pc',
    genres: ['rpg', 'simulation'],
    playerModes: ['single', 'coop'],
    coverUrl: 'https://example.com/cover.jpg',
    description: 'Granja y amistad.',
    rating: 9.4,
    releaseYear: 2016,
    offers: [offer],
    cheapest: offer,
    ...patch,
  }
}

test('buildDiscoverQuery: solo envía los filtros activos', () => {
  const query = buildDiscoverQuery({ ...DEFAULT_DISCOVER_CRITERIA, genres: ['rpg', 'indie'], maxPrice: 300 })
  assert.equal(query.get('genres'), 'rpg,indie')
  assert.equal(query.get('maxPrice'), '300')
  assert.equal(query.get('minPrice'), null)
  assert.equal(query.get('platforms'), 'pc')
  assert.equal(query.get('region'), 'MX')
})

test('discoverCacheKey: ocultar lo que ya tengo no invalida la búsqueda', () => {
  const base = { ...DEFAULT_DISCOVER_CRITERIA, excludeOwned: true }
  assert.equal(discoverCacheKey(base), discoverCacheKey({ ...base, excludeOwned: false }))
  assert.notEqual(discoverCacheKey(base), discoverCacheKey({ ...base, maxPrice: 100 }))
})

test('normalizeTitle: iguala títulos con marcas, acentos y puntuación distintos', () => {
  assert.equal(normalizeTitle('Pokémon™ Legends: Arceus'), normalizeTitle('POKEMON LEGENDS ARCEUS'))
})

test('excludeOwnedGames: quita lo que ya está en la biblioteca, en cualquier estado', () => {
  const library = [createGame({ name: 'Stardew Valley™', status: 'completed' })]
  const result = excludeOwnedGames([discovery(), discovery({ id: 'steam:1', name: 'Hades' })], library)
  assert.deepEqual(result.map((game) => game.name), ['Hades'])
})

test('pickDiscovery: evita las ya vistas mientras queden alternativas', () => {
  const games = [discovery({ id: 'a' }), discovery({ id: 'b' })]
  for (let i = 0; i < 20; i++) {
    const { game, exhausted } = pickDiscovery(games, new Set(['a']))
    assert.equal(game?.id, 'b')
    assert.equal(exhausted, false)
  }
})

test('pickDiscovery: si ya se vieron todas, repite en vez de quedarse sin respuesta', () => {
  const { game, exhausted } = pickDiscovery([discovery({ id: 'a' })], new Set(['a']))
  assert.equal(game?.id, 'a')
  assert.equal(exhausted, true)
  assert.equal(pickDiscovery([], new Set()).game, null)
})

test('discoveryToDraft: guarda en wishlist con precio y tienda en las notas', () => {
  const draft = discoveryToDraft(discovery())
  assert.equal(draft.status, 'wishlist')
  assert.equal(draft.platform, 'PC')
  assert.deepEqual(draft.genres, ['RPG', 'Simulación'])
  assert.equal(draft.playerMode, 'both')
  assert.equal(draft.externalId, 'steam:413150')
  assert.match(draft.notes ?? '', /149\.99 MXN en steam/)
  assert.match(draft.notes ?? '', /store\.steampowered\.com\/app\/413150/)
  assert.ok(draft.tags?.includes('Descubierto'))
})

test('migrateSettings: una instalación previa a Descubrir recibe sus valores por defecto', () => {
  const legacy = { defaultModeId: 'short-game', avoidRepeatsCount: 3 }
  const migrated = migrateSettings(legacy, 1)
  assert.equal(migrated.defaultModeId, 'short-game')
  assert.equal(migrated.avoidRepeatsCount, 3)
  assert.equal(migrated.discoverApiUrl, DEFAULT_DISCOVER_API_URL)
  assert.deepEqual(migrated.discoverCriteria, DEFAULT_DISCOVER_CRITERIA)
})

test('migrateSettings: conserva criterios guardados y normaliza la URL', () => {
  const migrated = migrateSettings(
    { discoverApiUrl: 'https://api.example.com///', discoverCriteria: { genres: ['rpg'], region: 'ES' } },
    1,
  )
  assert.equal(migrated.discoverApiUrl, 'https://api.example.com')
  assert.deepEqual(migrated.discoverCriteria.genres, ['rpg'])
  assert.equal(migrated.discoverCriteria.region, 'ES')
  // Un campo que no venía guardado se rellena, no se pierde.
  assert.equal(migrated.discoverCriteria.includeFree, true)
})

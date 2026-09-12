import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStats, formatHours } from '../src/core/stats/compute-stats'
import { createGame, type Game } from '../src/core/types/game'

const game = (patch: Partial<Game> = {}): Game =>
  createGame(
    {
      name: patch.name ?? 'Juego',
      status: patch.status ?? 'backlog',
      platform: patch.platform ?? 'PC',
      genres: patch.genres ?? ['RPG'],
      ...patch,
    },
    10_000,
  )

test('computeStats: contadores por estado', () => {
  const stats = computeStats([
    game({ status: 'backlog' }),
    game({ status: 'backlog' }),
    game({ status: 'playing' }),
    game({ status: 'completed' }),
    game({ status: 'dropped' }),
    game({ status: 'wishlist' }),
  ])
  assert.equal(stats.total, 6)
  assert.equal(stats.byStatus.backlog, 2)
  assert.equal(stats.byStatus.playing, 1)
  assert.equal(stats.byStatus.completed, 1)
  assert.equal(stats.byStatus.dropped, 1)
  assert.equal(stats.byStatus.wishlist, 1)
})

test('computeStats: horas jugadas y pendientes', () => {
  const stats = computeStats([
    game({ playedHours: 12.4, estimatedHours: 20 }),
    game({ playedHours: 40.2, estimatedHours: 40, status: 'completed' }),
    game({ playedHours: 1, estimatedHours: null }),
  ])
  assert.equal(stats.playedHours, 53.6)
  assert.equal(stats.pendingHours, 7.6)
})

test('computeStats: completado excluye la wishlist del denominador', () => {
  const stats = computeStats([
    game({ status: 'completed' }),
    game({ status: 'completed' }),
    game({ status: 'wishlist' }),
    game({ status: 'wishlist' }),
  ])
  assert.equal(stats.completionRate, 100)
})

test('computeStats: sin juegos propios la tasa es 0', () => {
  const stats = computeStats([game({ status: 'wishlist' })])
  assert.equal(stats.completionRate, 0)
})

test('computeStats: nunca jugados, favoritos, excluidos y nota media', () => {
  const stats = computeStats([
    game({ playedHours: 0, favorite: true, excluded: false, rating: 8 }),
    game({ playedHours: 0, favorite: false, excluded: true, rating: 6.5 }),
    game({ playedHours: 5, favorite: false, excluded: false, rating: null }),
  ])
  assert.equal(stats.neverPlayed, 2)
  assert.equal(stats.favorites, 1)
  assert.equal(stats.excluded, 1)
  assert.equal(stats.averageRating, 7.3)
})

test('computeStats: top de plataformas y géneros ordenado', () => {
  const stats = computeStats([
    game({ platform: 'PC', genres: ['RPG', 'Shooter'] }),
    game({ platform: 'PC', genres: ['RPG'] }),
    game({ platform: 'Switch', genres: ['Shooter'] }),
    game({ platform: 'Switch', genres: ['Shooter'] }),
  ])
  assert.deepEqual(stats.topPlatforms.map((item) => item.label), ['PC', 'Switch'])
  assert.deepEqual(stats.topGenres.slice(0, 2).map((item) => item.label), ['Shooter', 'RPG'])
})

test('formatHours: compacto y localizado', () => {
  assert.equal(formatHours(null), '—')
  assert.equal(formatHours(0.5), '30 min')
  assert.equal(formatHours(8), '8 h')
  assert.equal(formatHours(1240), '1.240 h')
  assert.equal(formatHours(0), '0 h')
})
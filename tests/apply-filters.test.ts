import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyFilters } from '../src/core/filters/apply-filters'
import { makeFilters } from '../src/core/types/filters'
import { createGame, type Game } from '../src/core/types/game'

const game = (patch: Partial<Game> = {}): Game =>
  createGame(
    {
      name: patch.name ?? 'Juego',
      platform: patch.platform ?? 'PC',
      genres: patch.genres ?? ['RPG'],
      status: patch.status ?? 'backlog',
      playerMode: patch.playerMode ?? 'single',
      ...patch,
    },
    10_000,
  )

test('applyFilters: sin filtros devuelve todo', () => {
  const games = [game({ name: 'A' }), game({ name: 'B' })]
  assert.equal(applyFilters(games, makeFilters()).length, 2)
})

test('applyFilters: un juego excluido nunca entra por defecto', () => {
  const games = [game({ name: 'A', excluded: true }), game({ name: 'B' })]
  assert.deepEqual(
    applyFilters(games, makeFilters()).map((item) => item.name),
    ['B'],
  )
})

test('applyFilters: incluye excluidos solo si se pide explícitamente', () => {
  const games = [game({ name: 'A', excluded: true }), game({ name: 'B' })]
  assert.equal(applyFilters(games, makeFilters({ includeExcluded: true })).length, 2)
})

test('applyFilters: filtra por plataforma y género', () => {
  const games = [
    game({ name: 'PC RPG', platform: 'PC', genres: ['RPG'] }),
    game({ name: 'PC Shooter', platform: 'PC', genres: ['Shooter'] }),
    game({ name: 'Switch RPG', platform: 'Switch', genres: ['RPG'] }),
  ]
  const out = applyFilters(games, makeFilters({ platforms: ['PC'], genres: ['RPG'] }))
  assert.deepEqual(out.map((item) => item.name), ['PC RPG'])
})

test('applyFilters: el género es insensible a mayúsculas', () => {
  const games = [game({ genres: ['rpg'] })]
  assert.equal(applyFilters(games, makeFilters({ genres: ['RPG'] })).length, 1)
})

test('applyFilters: rango de duración excluye desconocidas si se pide', () => {
  const known = game({ name: 'Largo', estimatedHours: 50 })
  const unknown = game({ name: 'Sin dato', estimatedHours: null })
  const strict = applyFilters([known, unknown], makeFilters({ minHours: 30, includeUnknownDuration: false }))
  assert.deepEqual(strict.map((item) => item.name), ['Largo'])
  const lax = applyFilters([known, unknown], makeFilters({ minHours: 30, includeUnknownDuration: true }))
  assert.equal(lax.length, 2)
})

test('applyFilters: neverPlayed excluye con horas jugadas', () => {
  const played = game({ name: 'Jugado', playedHours: 3 })
  const fresh = game({ name: 'Nuevo', playedHours: 0 })
  assert.deepEqual(
    applyFilters([played, fresh], makeFilters({ neverPlayed: true })).map((item) => item.name),
    ['Nuevo'],
  )
})

test('applyFilters: abandonedOnly restringe a dropped', () => {
  const dropped = game({ name: 'Tirado', status: 'dropped' })
  const backlog = game({ name: 'En espera', status: 'backlog' })
  assert.deepEqual(
    applyFilters([dropped, backlog], makeFilters({ abandonedOnly: true })).map((item) => item.name),
    ['Tirado'],
  )
})

test('applyFilters: startedNotFinished exige horas jugadas y no completado', () => {
  const inProgress = game({ name: 'A medias', playedHours: 5 })
  const done = game({ name: 'Acabado', playedHours: 40, status: 'completed' })
  const fresh = game({ name: 'Sin tocar', playedHours: 0 })
  assert.deepEqual(
    applyFilters([inProgress, done, fresh], makeFilters({ startedNotFinished: true })).map(
      (item) => item.name,
    ),
    ['A medias'],
  )
})

test('applyFilters: minBacklogDays ignora completados y los recién añadidos', () => {
  const old = game({ name: 'Veterano', addedAt: 10_000 })
  const young = game({ name: 'Novato', addedAt: 10_000 })
  const done = game({ name: 'Acabado', addedAt: 10_000, status: 'completed' })
  const out = applyFilters([old, young, done], makeFilters({ minBacklogDays: 30 }), 10_000 + 40 * 86_400_000)
  assert.deepEqual(out.map((item) => item.name), ['Veterano', 'Novato'])
})

test('applyFilters: nota mínima exige rating no nulo', () => {
  const rated = game({ name: 'Rated', rating: 8 })
  const unrated = game({ name: 'Sin nota', rating: null })
  assert.deepEqual(
    applyFilters([rated, unrated], makeFilters({ minRating: 7 })).map((item) => item.name),
    ['Rated'],
  )
})

test('applyFilters: playerModes acepta both para single y multi', () => {
  const both = game({ name: 'Ambos', playerMode: 'both' })
  const single = game({ name: 'Solo', playerMode: 'single' })
  assert.deepEqual(
    applyFilters([both, single], makeFilters({ playerModes: ['multi'] })).map((item) => item.name),
    ['Ambos'],
  )
  assert.equal(
    applyFilters([both, single], makeFilters({ playerModes: ['single'] })).length,
    2,
  )
})

test('applyFilters: búsqueda recorre nombre, plataforma, géneros, tags y notas', () => {
  const games = [game({ name: 'Portal', tags: ['coop'], notes: 'clásico' })]
  assert.equal(applyFilters(games, makeFilters({ search: 'coop' })).length, 1)
  assert.equal(applyFilters(games, makeFilters({ search: 'clásico' })).length, 1)
  assert.equal(applyFilters(games, makeFilters({ search: 'portal' })).length, 1)
  assert.equal(applyFilters(games, makeFilters({ search: 'x' })).length, 0)
})
test('applyFilters: maxPlayedHours deja fuera lo ya muy jugado', () => {
  const games = [
    game({ name: 'Intacto', playedHours: 0 }),
    game({ name: 'Apenas tocado', playedHours: 1.5 }),
    game({ name: 'Muy jugado', playedHours: 40 }),
  ]
  assert.deepEqual(
    applyFilters(games, makeFilters({ maxPlayedHours: 2 })).map((item) => item.name),
    ['Intacto', 'Apenas tocado'],
  )
})

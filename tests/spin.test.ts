import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spin, poolSize } from '../src/core/random/spin'
import { makeFilters } from '../src/core/types/filters'
import { createGame, type Game } from '../src/core/types/game'
import { randomInt, pickWeighted, shuffle } from '../src/core/random/rng'

const game = (patch: Partial<Game> = {}): Game => createGame({ name: 'Juego', ...patch }, 10_000)

test('spin: biblioteca vacía devuelve empty-library', () => {
  const result = spin([], { filters: makeFilters() })
  assert.equal(result.failure, 'empty-library')
  assert.equal(result.game, null)
})

test('spin: sin coincidencias devuelve no-matches', () => {
  const result = spin([game({ status: 'completed' })], {
    filters: makeFilters({ statuses: ['backlog'] }),
  })
  assert.equal(result.failure, 'no-matches')
  assert.equal(result.game, null)
})

test('spin: nunca devuelve un juego excluido', () => {
  const excluded = game({ name: 'Excluido', excluded: true })
  const normal = game({ name: 'Normal' })
  for (let index = 0; index < 50; index++) {
    const result = spin([excluded, normal], { filters: makeFilters() })
    assert.ok(result.game)
    assert.equal(result.game!.excluded, false)
  }
})

test('spin: evita los recientes salvo que no queden alternativas', () => {
  const games = Array.from({ length: 6 }, (_, index) => game({ name: `J${index}`, estimatedHours: 10 }))
  const avoidIds = games.slice(0, 3).map((item) => item.id)
  for (let index = 0; index < 40; index++) {
    const result = spin(games, { filters: makeFilters(), avoidIds })
    assert.ok(result.game)
    assert.ok(!avoidIds.includes(result.game!.id), `repitió un juego evitado: ${result.game!.name}`)
    assert.equal(result.reusedRecent, false)
  }
})

test('spin: si todo el pool son recientes, reutiliza en vez de fallar', () => {
  const games = [game({ name: 'Único' })]
  const result = spin(games, {
    filters: makeFilters(),
    avoidIds: [games[0]!.id],
  })
  assert.ok(result.game)
  assert.equal(result.reusedRecent, true)
})

test('spin: el resultado siempre está dentro del pool filtrado', () => {
  const games = [
    game({ name: 'Corto', estimatedHours: 8 }),
    game({ name: 'Largo', estimatedHours: 60 }),
    game({ name: 'Medio', estimatedHours: 20 }),
  ]
  const result = spin(games, {
    filters: makeFilters(),
    modeId: 'short-game',
  })
  assert.ok(result.game)
  assert.ok(result.game!.estimatedHours! <= 15)
})

test('spin: poolSize respeta filtros + modo', () => {
  const games = [
    game({ name: 'Corto', estimatedHours: 8 }),
    game({ name: 'Largo', estimatedHours: 60 }),
  ]
  assert.equal(poolSize(games, makeFilters(), 'completely-random'), 2)
  assert.equal(poolSize(games, makeFilters(), 'short-game'), 1)
})

test('spin: modeId desconocido cae al aleatorio', () => {
  const result = spin([game({ status: 'backlog' })], {
    filters: makeFilters({ statuses: ['backlog'] }),
    modeId: 'no-existe',
  })
  assert.ok(result.game)
  assert.equal(result.mode.id, 'completely-random')
  assert.equal(result.failure, null)
})

test('rng: randomInt siempre cae en [0, max)', () => {
  for (let index = 0; index < 2000; index++) {
    const value = randomInt(7)
    assert.ok(value >= 0 && value < 7)
  }
  assert.throws(() => randomInt(0), RangeError)
})

test('rng: pickWeighted con pesos nulos cae a selección uniforme', () => {
  const items = ['a', 'b', 'c']
  for (let index = 0; index < 50; index++) {
    const picked = pickWeighted(items, () => 0)
    assert.ok(items.includes(picked ?? ''))
  }
})

test('rng: shuffle conserva elementos y longitud', () => {
  const source = [1, 2, 3, 4, 5]
  for (let index = 0; index < 20; index++) {
    const out = shuffle(source)
    assert.equal(out.length, source.length)
    assert.deepEqual([...out].sort(), [...source])
  }
})
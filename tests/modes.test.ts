import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMode, mergeModeCriteria, SELECTION_MODES } from '../src/core/modes/selection-modes'
import { applyFilters } from '../src/core/filters/apply-filters'
import { makeFilters } from '../src/core/types/filters'
import { createGame, type Game } from '../src/core/types/game'

const game = (patch: Partial<Game> = {}): Game => createGame({ name: 'Juego', ...patch }, 10_000)

test('modes: DEFAULT_MODE es completamente aleatorio', () => {
  assert.equal(getMode(undefined).id, 'completely-random')
  assert.equal(getMode('no-existe').id, 'completely-random')
})

test('modes: registro contiene los nueve modos pedidos', () => {
  const ids = SELECTION_MODES.map((mode) => mode.id)
  for (const expected of [
    'completely-random',
    'short-game',
    'long-game',
    'backlog-killer',
    'never-played',
    'finish-what-you-started',
    'hidden-gem',
    'favorite',
    'random-rpg',
  ]) {
    assert.ok(ids.includes(expected), `falta el modo ${expected}`)
  }
})

test('modes: el modo manda en los campos que declara y respeta el resto', () => {
  const mode = getMode('short-game')
  const merged = mergeModeCriteria(makeFilters({ platforms: ['PC'] }), mode)
  assert.deepEqual(merged.platforms, ['PC'])
  assert.equal(merged.maxHours, mode.criteria.maxHours)
})

test('modes: backlog-killer restringe a backlog añejo', () => {
  const criteria = getMode('backlog-killer').criteria
  assert.deepEqual(criteria.statuses, ['backlog'])
  assert.ok((criteria.minBacklogDays ?? 0) > 0)
})

test('modes: los modos con peso devuelven pesos no negativos', () => {
  const now = 10_000
  for (const mode of SELECTION_MODES) {
    if (!mode.weight) continue
    const candidate = game({ addedAt: 5_000, playedHours: 1, estimatedHours: 20, rating: 8 })
    const weight = mode.weight(candidate, now)
    assert.ok(Number.isFinite(weight) && weight >= 0, `${mode.id} peso inválido ${weight}`)
  }
})

test('modes: finish-what-you-started pesa más cuanto más avanzado', () => {
  const mode = getMode('finish-what-you-started')!
  assert.ok(mode.weight, 'el modo debe tener peso')
  const started = game({ playedHours: 10, estimatedHours: 20 })
  const barely = game({ playedHours: 1, estimatedHours: 200 })
  const now = 10_000
  assert.ok(mode.weight(started, now) > mode.weight(barely, now))
})
test('modes: el pool de joya oculta solo contiene juegos apenas tocados', () => {
  const now = Date.now()
  const old = now - 200 * 86_400_000
  const games = [
    createGame({ name: 'Intacto y viejo', addedAt: old, playedHours: 0 }, now),
    createGame({ name: 'Muy jugado', addedAt: old, playedHours: 50 }, now),
  ]
  const mode = getMode('hidden-gem')
  const pool = applyFilters(games, mergeModeCriteria(makeFilters(), mode), now)
  assert.deepEqual(
    pool.map((game) => game.name),
    ['Intacto y viejo'],
  )
})

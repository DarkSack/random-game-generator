import { test } from 'node:test'
import assert from 'node:assert/strict'
import { libraryRepository } from '../src/core/storage/library-repository'
import { MAX_HISTORY, SCHEMA_VERSION, STORAGE_KEYS } from '../src/core/storage/schema'
import { kvStore } from '../src/core/storage/kv-store'
import { createGame } from '../src/core/types/game'

test.beforeEach(async () => {
  await libraryRepository.clearLibrary()
})

test('repository: ensureSchema escribe versión, ajustes y sesión', async () => {
  await libraryRepository.ensureSchema()
  assert.equal(await kvStore.get<number>(STORAGE_KEYS.schemaVersion, 0), SCHEMA_VERSION)
  const settings = await libraryRepository.getSettings()
  assert.equal(settings.defaultModeId, 'completely-random')
})

test('repository: addGame normaliza nombre, listas y horas', async () => {
  const result = await libraryRepository.addGame({
    name: '  Hades  ',
    genres: [' Acción', 'rpg', 'acción '],
    estimatedHours: -5,
    rating: 11,
  })
  assert.equal(result.name, 'Hades')
  assert.deepEqual(result.genres, ['Acción', 'rpg'])
  assert.equal(result.estimatedHours, null)
  assert.equal(result.rating, 10)
  assert.equal(result.status, 'backlog')
})

test('repository: updateGame marca playing y completa', async () => {
  const created = await libraryRepository.addGame({ name: 'Portal 2' })
  const playing = await libraryRepository.updateGame(created.id, { status: 'playing' })
  assert.ok(playing)
  assert.ok(playing.startedAt != null)
  assert.ok(playing.lastPlayedAt != null)

  const completed = await libraryRepository.updateGame(created.id, { status: 'completed' })
  assert.ok(completed)
  assert.ok(completed.completedAt != null)

  const dropped = await libraryRepository.updateGame(created.id, { status: 'dropped' })
  assert.ok(dropped)
  assert.equal(dropped.completedAt, null)
})

test('repository: importGames detecta duplicados y fusiona sin pisar', async () => {
  await libraryRepository.addGame({ name: 'Hades', platform: 'PC', genres: ['RPG'], rating: 8 })
  const summary = await libraryRepository.importGames(
    [
      { name: 'Hades', platform: 'PC', genres: [], rating: null, estimatedHours: 40 },
      { name: 'Hades', platform: 'Switch', genres: ['RPG'] },
    ],
    { merge: true },
  )
  assert.deepEqual(summary, { added: 1, merged: 1, skipped: 0 })
  const games = await libraryRepository.getGames()
  assert.equal(games.length, 2)
  const pc = games.find((item) => item.platform === 'PC')!
  // Los campos no vacíos del original se conservan.
  assert.deepEqual(pc.genres, ['RPG'])
  assert.equal(pc.rating, 8)
  assert.equal(pc.estimatedHours, 40)
})

test('repository: importGames sin merge omite duplicados', async () => {
  await libraryRepository.addGame({ name: 'Hades', platform: 'PC' })
  const summary = await libraryRepository.importGames([{ name: 'Hades', platform: 'PC' }])
  assert.deepEqual(summary, { added: 0, merged: 0, skipped: 1 })
})

test('repository: recordSpin guarda historial limitado', async () => {
  for (let index = 0; index < MAX_HISTORY + 5; index++) {
    await libraryRepository.recordSpin({ gameId: `g${index}`, modeId: 'completely-random', at: index })
  }
  const session = await libraryRepository.getSession()
  assert.equal(session.history.length, MAX_HISTORY)
  assert.equal(session.lastResult?.gameId, `g${MAX_HISTORY + 4}`)
  assert.equal(session.history[0]!.gameId, `g${MAX_HISTORY + 4}`)
})

test('repository: removeMany borra varios juegos', async () => {
  const a = await libraryRepository.addGame({ name: 'A' })
  const b = await libraryRepository.addGame({ name: 'B' })
  const c = await libraryRepository.addGame({ name: 'C' })
  await libraryRepository.removeMany([a.id, b.id])
  const games = await libraryRepository.getGames()
  assert.deepEqual(games.map((item) => item.id), [c.id])
})

test('repository: createGame asigna ids únicos', () => {
  const a = createGame({ name: 'A' })
  const b = createGame({ name: 'B' })
  assert.notEqual(a.id, b.id)
  assert.ok(a.id.length > 0)
})
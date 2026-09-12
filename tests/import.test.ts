import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBackup,
  parseCsv,
  parseCsvImport,
  parseImportFile,
  parseJsonImport,
  rowToDraft,
} from '../src/core/importers/file-import'
import { createGame } from '../src/core/types/game'

test('rowToDraft: alias y normalización de campos', () => {
  const draft = rowToDraft({
    Title: 'Portal 2',
    Platform: 'PC',
    genre: 'Acción, Puzzle',
    status: 'COMPLETED',
    hours: '12,5',
    score: '9',
    favorite: 'true',
    cover: 'https://x/y.jpg',
    addedAt: '2026-01-02T00:00:00Z',
  })
  assert.ok(draft)
  assert.equal(draft!.name, 'Portal 2')
  assert.equal(draft!.platform, 'PC')
  assert.deepEqual(draft!.genres, ['Acción', 'Puzzle'])
  assert.equal(draft!.status, 'completed')
  assert.equal(draft!.estimatedHours, 12.5)
  assert.equal(draft!.rating, 9)
  assert.equal(draft!.favorite, true)
  assert.equal(draft!.coverUrl, 'https://x/y.jpg')
  assert.equal(draft!.addedAt, Date.parse('2026-01-02T00:00:00Z'))
  assert.equal(draft!.source, 'file')
})

test('rowToDraft: sin nombre devuelve null', () => {
  assert.equal(rowToDraft({ platform: 'PC' }), null)
  assert.equal(rowToDraft({}), null)
})

test('rowToDraft: separa lista con comas, punto y coma o tubo', () => {
  const draft = rowToDraft({ name: 'X', tags: 'a;b|c, d' })!
  assert.deepEqual(draft.tags, ['a', 'b', 'c', 'd'])
})

test('parseCsv: comillas y comas internas', () => {
  const rows = parseCsv('name,genres,notes\n"Portal, un juego","Acción","Dijo ""genial"""')
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.name, 'Portal, un juego')
  assert.equal(rows[0]!.notes, 'Dijo "genial"')
})

test('parseCsv: tolera punto y coma y CRLF', () => {
  const rows = parseCsv('name;status\r\nHades;backlog\r\n')
  assert.deepEqual(rows, [{ name: 'Hades', status: 'backlog' }])
})

test('parseCsvImport: filas inválidas se descartan', () => {
  const drafts = parseCsvImport('name,status\nHades,backlog\n,playing\n')
  assert.equal(drafts.length, 1)
  assert.equal(drafts[0]!.name, 'Hades')
})

test('parseJsonImport: acepta backup y array suelto', () => {
  const games = [createGame({ name: 'Hades' })]
  const backupText = JSON.stringify(buildBackup(games))
  assert.equal(parseJsonImport(backupText).length, 1)

  const rawText = JSON.stringify([{ name: 'Hades' }, { name: 'Hollow Knight' }])
  assert.equal(parseJsonImport(rawText).length, 2)
})

test('parseJsonImport: rechaza contenido sin juegos', () => {
  assert.throws(() => parseJsonImport('{"foo":1}'), /no contiene juegos/)
  assert.throws(() => parseJsonImport('[]'), /no contiene juegos/)
  assert.throws(() => parseJsonImport('no es json'), SyntaxError)
})

test('parseImportFile: delega según extensión', () => {
  const csv = 'name,status\nHades,backlog\n'
  const json = JSON.stringify([{ name: 'Hades', status: 'backlog' }])
  assert.equal(parseImportFile('lib.csv', csv).length, 1)
  assert.equal(parseImportFile('backup.json', json).length, 1)
})
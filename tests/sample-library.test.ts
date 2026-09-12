import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSampleLibrary,
  SAMPLE_LIBRARY_SIZE,
  SAMPLE_TAG,
} from '../src/core/importers/sample-library'
import { applyFilters } from '../src/core/filters/apply-filters'
import { SELECTION_MODES, mergeModeCriteria } from '../src/core/modes/selection-modes'
import { makeFilters } from '../src/core/types/filters'
import { createGame, dedupeKey } from '../src/core/types/game'

const NOW = Date.parse('2026-06-15T12:00:00Z')
const sampleGames = () => buildSampleLibrary(NOW).map((draft) => createGame(draft, NOW))

test('sample: el tamaño anunciado coincide con lo que se genera', () => {
  assert.equal(buildSampleLibrary(NOW).length, SAMPLE_LIBRARY_SIZE)
})

test('sample: no hay duplicados entre las fichas de ejemplo', () => {
  const games = sampleGames()
  const keys = new Set(games.map(dedupeKey))
  assert.equal(keys.size, games.length)
})

test('sample: todas las fichas van marcadas con el tag Ejemplo', () => {
  for (const game of sampleGames()) {
    assert.ok(
      game.tags.includes(SAMPLE_TAG),
      `«${game.name}» debería llevar el tag ${SAMPLE_TAG} para poder borrarla en bloque`,
    )
  }
})

// La UI promete que la biblioteca de ejemplo sirve para probar TODOS los modos.
// Si alguien retoca las fichas o los umbrales de un modo, esto lo detecta.
test('sample: cada modo de selección tiene al menos un candidato', () => {
  const games = sampleGames()
  for (const mode of SELECTION_MODES) {
    const pool = applyFilters(games, mergeModeCriteria(makeFilters(), mode), NOW)
    assert.ok(pool.length > 0, `el modo «${mode.label}» se queda sin candidatos`)
  }
})

test('sample: las fechas son relativas al momento de carga', () => {
  const later = NOW + 30 * 86_400_000
  const [first] = buildSampleLibrary(later)
  const [original] = buildSampleLibrary(NOW)
  assert.ok(first && original)
  assert.equal(first.addedAt! - original.addedAt!, 30 * 86_400_000)
})

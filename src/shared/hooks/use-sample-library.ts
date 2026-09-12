import { useCallback, useState } from 'react'
import { buildSampleLibrary, SAMPLE_LIBRARY_SIZE, type ImportSummary } from '@core/index'
import { useLibrary } from './use-library'

/**
 * Carga de la biblioteca de ejemplo.
 *
 * Vive en un hook porque hay tres sitios desde donde tiene sentido ofrecerla
 * —el randomizador vacío, la biblioteca vacía y los ajustes— y todos deben
 * comportarse igual. La deduplicación la hace el repositorio, así que pulsar
 * dos veces no duplica fichas; `loading` solo evita el doble clic accidental.
 */
export function useSampleLibrary() {
  const { actions } = useLibrary()
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<ImportSummary> => {
    setLoading(true)
    try {
      return await actions.importGames(buildSampleLibrary())
    } finally {
      setLoading(false)
    }
  }, [actions])

  return { load, loading, size: SAMPLE_LIBRARY_SIZE }
}

/** Texto de confirmación compartido por las tres entradas. */
export function sampleSummaryMessage(summary: ImportSummary): string {
  if (summary.added) return `Biblioteca de ejemplo cargada: ${summary.added} juegos.`
  return 'Los juegos de ejemplo ya estaban en tu biblioteca.'
}

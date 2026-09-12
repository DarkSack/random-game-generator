import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyFilters,
  getMode,
  mergeModeCriteria,
  shuffle,
  spin,
  type Game,
  type SpinResult,
} from '@core/index'
import { useLibrary } from './use-library'

export type SpinPhase = 'idle' | 'spinning' | 'result'

const TEASER_INTERVAL_MS = 80

/**
 * Máquina de estados del sorteo, compartida por popup y dashboard.
 *
 * El juego ganador se decide *antes* de la animación: el carrusel de nombres es
 * decorativo y no influye en el resultado. Así la animación puede acortarse o
 * interrumpirse sin alterar la aleatoriedad.
 */
export function useSpin(modeIdOverride?: string) {
  const { games, settings, session, actions } = useLibrary()
  const [phase, setPhase] = useState<SpinPhase>('idle')
  const [result, setResult] = useState<SpinResult | null>(null)
  const [teaser, setTeaser] = useState<Game | null>(null)
  const timers = useRef<number[]>([])

  const modeId = modeIdOverride ?? settings.defaultModeId
  const mode = useMemo(() => getMode(modeId), [modeId])

  /** Juegos que cumplen filtros + modo: el pool real del próximo sorteo. */
  const pool = useMemo(
    () => applyFilters(games, mergeModeCriteria(settings.filters, mode)),
    [games, settings.filters, mode],
  )

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  // Al abrir el popup, recupera el último resultado en lugar de mostrar vacío.
  useEffect(() => {
    if (phase !== 'idle' || result || !session.lastResult) return
    const last = games.find((game) => game.id === session.lastResult?.gameId)
    if (!last) return
    setResult({
      game: last,
      pool: [],
      mode: getMode(session.lastResult.modeId),
      criteria: settings.filters,
      reusedRecent: false,
      failure: null,
    })
    setPhase('result')
  }, [games, phase, result, session.lastResult, settings.filters])

  const roll = useCallback(async () => {
    if (phase === 'spinning') return

    const avoidIds = session.history.slice(0, settings.avoidRepeatsCount).map((entry) => entry.gameId)
    const outcome = spin(games, { filters: settings.filters, modeId, avoidIds })

    if (!outcome.game) {
      clearTimers()
      setResult(outcome)
      setPhase('result')
      return
    }

    clearTimers()
    setPhase('spinning')

    // Carrusel decorativo mientras dura la animación.
    const carousel = shuffle(outcome.pool).slice(0, 24)
    const duration = Math.max(300, settings.spinDurationMs)
    const steps = Math.floor(duration / TEASER_INTERVAL_MS)
    for (let step = 0; step < steps; step++) {
      const game = carousel[step % Math.max(1, carousel.length)] ?? outcome.game
      timers.current.push(window.setTimeout(() => setTeaser(game), step * TEASER_INTERVAL_MS))
    }

    timers.current.push(
      window.setTimeout(() => {
        setTeaser(null)
        setResult(outcome)
        setPhase('result')
      }, duration),
    )

    await actions.recordSpin({ gameId: outcome.game.id, modeId, at: Date.now() })
  }, [actions, clearTimers, games, modeId, phase, session.history, settings])

  const reset = useCallback(() => {
    clearTimers()
    setTeaser(null)
    setResult(null)
    setPhase('idle')
  }, [clearTimers])

  return { phase, result, teaser, pool, mode, roll, reset }
}

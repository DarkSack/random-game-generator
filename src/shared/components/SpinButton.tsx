import type { Game } from '@core/index'
import type { SpinPhase } from '@shared/hooks/use-spin'

/**
 * Botón principal del randomizer. Muestra el tamaño del pool para que el
 * usuario sepa entre cuántos juegos está sorteando antes de pulsar.
 */
export function SpinButton({
  phase,
  poolSize,
  teaser,
  onSpin,
  label = '🎲 ¿QUÉ JUGAMOS?',
  compact = false,
}: {
  phase: SpinPhase
  poolSize: number
  teaser: Game | null
  onSpin: () => void
  label?: string
  compact?: boolean
}) {
  const rolling = phase === 'spinning'
  const disabled = rolling || poolSize === 0

  return (
    <div className="spin">
      <button
        className={`spin__button ${rolling ? 'spin__button--rolling' : ''}`}
        style={compact ? { fontSize: 18, padding: '14px 18px' } : undefined}
        onClick={onSpin}
        disabled={disabled}
        aria-live="polite"
      >
        {rolling ? (
          <>
            <span className="spin__dice">🎲</span>
            GIRANDO…
          </>
        ) : (
          label
        )}
      </button>

      <div className="spin__teaser" aria-hidden={!rolling}>
        {rolling && teaser ? teaser.name : ''}
      </div>

      <p className="spin__pool">
        {poolSize === 0 ? (
          'Ningún juego cumple los filtros actuales'
        ) : (
          <>
            Sorteando entre <strong>{poolSize}</strong> {poolSize === 1 ? 'juego' : 'juegos'}
          </>
        )}
      </p>
    </div>
  )
}

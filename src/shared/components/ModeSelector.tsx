import { useMemo } from 'react'
import { SELECTION_MODES, poolSize, type FilterCriteria, type Game } from '@core/index'

/**
 * Rejilla de modos de selección. Cada modo muestra cuántos juegos tendría
 * disponibles con los filtros actuales, de forma que se ve de un vistazo cuál
 * está vacío antes de gastar un giro.
 */
export function ModeSelector({
  games,
  filters,
  activeId,
  onSelect,
  compact = false,
}: {
  games: Game[]
  filters: FilterCriteria
  activeId: string
  onSelect: (modeId: string) => void
  compact?: boolean
}) {
  const counts = useMemo(() => {
    const now = Date.now()
    return new Map(SELECTION_MODES.map((mode) => [mode.id, poolSize(games, filters, mode.id, now)]))
  }, [games, filters])

  return (
    <div className="mode-grid" role="radiogroup" aria-label="Modo de selección">
      {SELECTION_MODES.map((mode) => {
        const count = counts.get(mode.id) ?? 0
        const active = mode.id === activeId
        return (
          <button
            key={mode.id}
            role="radio"
            aria-checked={active}
            className={`mode ${active ? 'mode--active' : ''} ${count === 0 ? 'mode--empty' : ''}`}
            onClick={() => onSelect(mode.id)}
            title={mode.description}
          >
            <span className="mode__label">
              {mode.emoji} {mode.label}
            </span>
            {!compact ? (
              <span className="mode__count">
                {count} {count === 1 ? 'juego' : 'juegos'}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

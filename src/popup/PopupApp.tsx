import { useState } from 'react'
import { openDashboard, type Game } from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { useSpin } from '@shared/hooks/use-spin'
import { EmptyState } from '@shared/components/atoms'
import { FiltersPanel } from '@shared/components/FiltersPanel'
import { ResultCard } from '@shared/components/ResultCard'
import { SpinButton } from '@shared/components/SpinButton'

/** Acciones de resultado compartidas por popup y dashboard. */
function useResultActions() {
  const { actions } = useLibrary()
  return {
    async onPlay(game: Game, autoMark: boolean) {
      if (autoMark) {
        await actions.updateGame(game.id, { status: 'playing', lastPlayedAt: Date.now() })
      }
    },
    async onMarkPlaying(game: Game) {
      await actions.updateGame(game.id, { status: 'playing', lastPlayedAt: Date.now() })
    },
    async onToggleFavorite(game: Game) {
      await actions.updateGame(game.id, { favorite: !game.favorite })
    },
  }
}

export function PopupApp() {
  const { ready, games, settings, facets, stats, actions } = useLibrary()
  const spin = useSpin()
  const resultActions = useResultActions()
  const [showFilters, setShowFilters] = useState(false)

  const openFull = () => void openDashboard()

  return (
    <div className="pop">
      <header className="pop__header">
        <span className="pop__logo" aria-hidden="true">
          🎲
        </span>
        <h1 className="pop__title">Random Game Generator</h1>
        <button className="icon-btn" onClick={openFull} title="Abrir panel completo" aria-label="Abrir panel completo">
          ⚙️
        </button>
      </header>

      <div className="pop__body">
        {!ready ? (
          <p className="muted" style={{ padding: '18px 4px' }}>
            Cargando biblioteca…
          </p>
        ) : games.length === 0 ? (
          <EmptyState
            icon="🎮"
            title="Tu biblioteca está vacía"
            description="Añade juegos desde el panel completo y la suerte podrá elegir por ti."
            action={
              <button className="btn btn--primary btn--sm" onClick={openFull}>
                Abrir panel completo
              </button>
            }
          />
        ) : (
          <>
            <SpinButton
              compact
              phase={spin.phase}
              poolSize={spin.pool.length}
              teaser={spin.teaser}
              onSpin={() => void spin.roll()}
            />

            {spin.result && spin.result.game ? (
              <ResultCard
                compact
                game={spin.result.game}
                mode={spin.result.mode}
                note={
                  spin.result.reusedRecent
                    ? 'No había suficientes alternativas nuevas; reutilizamos un juego reciente.'
                    : null
                }
                actions={{
                  onPlay: (game) => void resultActions.onPlay(game, settings.autoMarkPlaying),
                  onReroll: () => void spin.roll(),
                  onToggleFavorite: (game) => void resultActions.onToggleFavorite(game),
                  onMarkPlaying: (game) => void resultActions.onMarkPlaying(game),
                }}
              />
            ) : spin.result ? (
              <EmptyState
                icon="🛑"
                title="No hay nada que sortear"
                description="Ningún juego cumple los filtros y el modo actuales. Ábrelos en el panel completo."
              />
            ) : null}

            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
            >
              {showFilters ? '▴ Ocultar filtros rápidos' : '▾ Filtros rápidos'}
            </button>

            {showFilters ? (
              <FiltersPanel
                compact
                filters={settings.filters}
                facets={facets}
                onChange={(patch) => void actions.patchFilters(patch)}
              />
            ) : null}
          </>
        )}
      </div>

      {ready && games.length > 0 ? (
        <footer className="pop__footer">
          <span>
            {stats.total} {stats.total === 1 ? 'juego' : 'juegos'}
          </span>
          <span>🏆 {stats.byStatus.completed} completados</span>
          <span>📚 {stats.byStatus.backlog} en backlog</span>
        </footer>
      ) : null}

      <div className="pop__hint">
        {games.length > 0 ? (
          <>
            Modo activo: {spin.mode.emoji} {spin.mode.label}
          </>
        ) : null}
      </div>
    </div>
  )
}
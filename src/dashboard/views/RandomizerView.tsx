import { useLibrary } from '@shared/hooks/use-library'
import { useSampleLibrary } from '@shared/hooks/use-sample-library'
import { useSpin } from '@shared/hooks/use-spin'
import { EmptyState } from '@shared/components/atoms'
import { FiltersPanel } from '@shared/components/FiltersPanel'
import { ModeSelector } from '@shared/components/ModeSelector'
import { ResultCard } from '@shared/components/ResultCard'
import { SpinButton } from '@shared/components/SpinButton'

export function RandomizerView() {
  const { games, settings, facets, stats, actions } = useLibrary()
  const sample = useSampleLibrary()
  const spin = useSpin()

  // Primer arranque: ni el selector de modos ni el botón de sorteo pueden hacer
  // nada con la biblioteca vacía, así que ofrecemos la única salida útil.
  if (!games.length) {
    return (
      <div className="stack" style={{ gap: 22 }}>
        <section className="hero">
          <h1 className="hero__title">🎲 ¿QUÉ JUGAMOS?</h1>
          <p className="hero__subtitle muted">
            Aún no hay nada que sortear. Registra tus juegos o carga una biblioteca de ejemplo para
            ver cómo funciona.
          </p>
        </section>

        <EmptyState
          icon="🎁"
          title="Empieza con una biblioteca de ejemplo"
          description={`${sample.size} juegos de muestra, elegidos para que todos los modos de selección tengan candidatos. Puedes borrarlos cuando quieras: van marcados con el tag «Ejemplo».`}
          action={
            <button
              className="btn btn--primary"
              onClick={() => void sample.load()}
              disabled={sample.loading}
            >
              {sample.loading ? 'Cargando…' : `🎁 Cargar ${sample.size} juegos de ejemplo`}
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="hero">
        <h1 className="hero__title">🎲 ¿QUÉ JUGAMOS?</h1>
        <p className="hero__subtitle muted">
          Filtra tu biblioteca, elige un modo y deja que la suerte decida. Ejemplo: “Quiero algo RPG,
          single-player y de menos de 30 horas”.
        </p>
      </section>

      <section>
        <div className="panel__title">Modo de selección</div>
        <ModeSelector
          games={games}
          filters={settings.filters}
          activeId={settings.defaultModeId}
          onSelect={(modeId) => void actions.updateSettings({ defaultModeId: modeId })}
        />
      </section>

      <SpinButton
        phase={spin.phase}
        poolSize={spin.pool.length}
        teaser={spin.teaser}
        onSpin={() => void spin.roll()}
      />

      {spin.result && spin.result.game ? (
        <ResultCard
          game={spin.result.game}
          mode={spin.result.mode}
          note={
            spin.result.reusedRecent
              ? 'No había suficientes alternativas nuevas; reutilizamos un juego reciente.'
              : null
          }
          actions={{
            onPlay: (game) => void actions.updateGame(game.id, { status: 'playing', lastPlayedAt: Date.now() }),
            onReroll: () => void spin.roll(),
            onToggleFavorite: (game) => void actions.updateGame(game.id, { favorite: !game.favorite }),
            onMarkPlaying: (game) =>
              void actions.updateGame(game.id, { status: 'playing', lastPlayedAt: Date.now() }),
          }}
        />
      ) : spin.result ? (
        <EmptyState
          icon="🛑"
          title="No hay nada que sortear"
          description="Ningún juego cumple los filtros y el modo actuales. Limpia filtros, cambia de modo o añade juegos en la pestaña Biblioteca."
        />
      ) : null}

      <FiltersPanel
        filters={settings.filters}
        facets={facets}
        onChange={(patch) => void actions.patchFilters(patch)}
      />

      <section className="mini-stats">
        <div className="mini-stats__item">
          <strong>{stats.total}</strong>
          <span>Juegos</span>
        </div>
        <div className="mini-stats__item">
          <strong>{stats.byStatus.completed}</strong>
          <span>Completados</span>
        </div>
        <div className="mini-stats__item">
          <strong>{stats.byStatus.backlog}</strong>
          <span>Backlog</span>
        </div>
        <div className="mini-stats__item">
          <strong>{stats.byStatus.playing}</strong>
          <span>Jugando</span>
        </div>
      </section>
    </div>
  )
}
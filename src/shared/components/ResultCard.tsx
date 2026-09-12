import {
  PLAYER_MODE_LABEL,
  STATUS_LABEL,
  formatHours,
  type Game,
  type SelectionMode,
} from '@core/index'
import { GameCover, Rating, StatusBadge } from './atoms'

export interface ResultActions {
  onPlay(game: Game): void
  onReroll(): void
  onToggleFavorite(game: Game): void
  onMarkPlaying(game: Game): void
}

/**
 * Ficha del juego sorteado. `compact` la adapta al ancho del popup sin
 * duplicar componente: mismos datos, menos aire.
 */
export function ResultCard({
  game,
  mode,
  compact = false,
  actions,
  note,
}: {
  game: Game
  mode: SelectionMode
  compact?: boolean
  actions: ResultActions
  note?: string | null
}) {
  const facts: Array<{ label: string; value: string }> = [
    { label: 'Plataforma', value: game.platform || '—' },
    { label: 'Género', value: game.genres[0] ?? '—' },
    { label: 'Duración', value: formatHours(game.estimatedHours) },
    { label: 'Jugado', value: formatHours(game.playedHours) },
    { label: 'Modo', value: PLAYER_MODE_LABEL[game.playerMode] },
  ]

  return (
    <article className={`result ${compact ? 'result--compact' : ''}`}>
      <GameCover name={game.name} url={game.coverUrl} />

      <div className="grow">
        <div className="result__mode">
          {mode.emoji} {mode.label}
        </div>
        <h2 className="result__title">{game.name}</h2>

        <div className="row row--wrap" style={{ gap: 8 }}>
          <StatusBadge status={game.status} />
          <Rating value={game.rating} />
          {game.favorite ? <span className="chip chip--static chip--tag">❤️ Favorito</span> : null}
        </div>

        <dl className="result__facts">
          {facts
            .filter((fact) => !compact || ['Plataforma', 'Duración', 'Género'].includes(fact.label))
            .map((fact) => (
              <div className="result__fact" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
        </dl>

        {note ? (
          <p className="faint" style={{ fontSize: 12, marginTop: 0 }}>
            {note}
          </p>
        ) : null}

        <div className="result__actions">
          <button className="btn btn--primary btn--sm" onClick={() => actions.onPlay(game)}>
            ▶ Jugar
          </button>
          <button className="btn btn--sm" onClick={actions.onReroll}>
            🎲 Volver a girar
          </button>
          <button
            className="btn btn--sm"
            onClick={() => actions.onToggleFavorite(game)}
            aria-pressed={game.favorite}
          >
            {game.favorite ? '💔 Quitar favorito' : '❤️ Favorito'}
          </button>
          {game.status !== 'playing' ? (
            <button className="btn btn--sm" onClick={() => actions.onMarkPlaying(game)}>
              🎮 Marcar como {STATUS_LABEL.playing}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

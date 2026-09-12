import { STATUS_EMOJI, STATUS_LABEL } from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { Progress, Stat } from '@shared/components/atoms'

export function StatsView() {
  const { stats } = useLibrary()
  const owned = stats.total - stats.byStatus.wishlist

  const byStatusTotal = Math.max(stats.total, 1)
  const statusBars = (
    Object.keys(stats.byStatus) as Array<keyof typeof stats.byStatus>
  ).map((status) => ({
    status,
    count: stats.byStatus[status],
    pct: Math.round((stats.byStatus[status] / byStatusTotal) * 100),
  }))

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="hero">
        <h1 className="hero__title">📊 ESTADÍSTICAS</h1>
        <p className="hero__subtitle muted">Tu colección y cuánto te queda por jugar, de un vistazo.</p>
      </section>

      <div className="stat-grid">
        <Stat value={stats.total} label="Total de juegos" />
        <Stat value={stats.byStatus.completed} label="Completados" />
        <Stat value={stats.byStatus.backlog} label="En backlog" />
        <Stat value={stats.byStatus.playing} label="Jugando" />
        <Stat value={stats.byStatus.dropped} label="Abandonados" />
        <Stat value={stats.byStatus.wishlist} label="Wishlist" />
      </div>

      <div className="stat-grid">
        <Stat value={`${stats.playedHours} h`} label="Horas jugadas" />
        <Stat value={`${stats.pendingHours} h`} label="Horas pendientes" hint="Backlog + jugando" />
        <Stat
          value={`${stats.completionRate}%`}
          label="Completado"
          hint={
            owned > 0
              ? `${stats.byStatus.completed} de ${owned} que tienes`
              : 'Sin juegos propios'
          }
        />
        <Stat value={stats.neverPlayed} label="Nunca jugados" />
        <Stat value={stats.favorites} label="Favoritos" />
        <Stat
          value={stats.averageRating != null ? `${stats.averageRating}` : '—'}
          label="Nota media"
          hint="Nota personal /10"
        />
      </div>

      <section className="panel">
        <div className="panel__title">Distribución por estado</div>
        <div className="bar-list">
          {statusBars.map(({ status, count, pct }) => (
            <div key={status} className="bar-list__row">
              <div>
                <span>
                  {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
                </span>
                <div className="bar-list__track">
                  <div className="bar-list__fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">
          Tasa de completado
          <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {stats.completionRate}%
          </span>
        </div>
        <Progress value={stats.completionRate} />
      </section>

      {stats.topPlatforms.length > 0 ? (
        <section className="panel">
          <div className="panel__title">Plataformas top</div>
          <div className="bar-list">
            {stats.topPlatforms.map(({ label, count }) => (
              <div key={label} className="bar-list__row">
                <div>
                  {label}
                  <div className="bar-list__track">
                    <div
                      className="bar-list__fill"
                      style={{ width: `${(count / Math.max(stats.total, 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {stats.topGenres.length > 0 ? (
        <section className="panel">
          <div className="panel__title">Géneros top</div>
          <div className="bar-list">
            {stats.topGenres.map(({ label, count }) => (
              <div key={label} className="bar-list__row">
                <div>
                  {label}
                  <div className="bar-list__track">
                    <div
                      className="bar-list__fill"
                      style={{ width: `${(count / Math.max(stats.total, 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
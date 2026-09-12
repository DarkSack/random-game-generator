import { useEffect, useState } from 'react'
import { takePendingView } from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { DiscoverView } from './views/DiscoverView'
import { RandomizerView } from './views/RandomizerView'
import { LibraryView } from './views/LibraryView'
import { StatsView } from './views/StatsView'
import { SettingsView } from './views/SettingsView'

type ViewId = 'randomizer' | 'discover' | 'library' | 'stats' | 'settings'

const VIEWS: Array<{ id: ViewId; label: string; emoji: string }> = [
  { id: 'randomizer', label: 'Randomizador', emoji: '🎲' },
  { id: 'discover', label: 'Descubrir', emoji: '🔎' },
  { id: 'library', label: 'Biblioteca', emoji: '📚' },
  { id: 'stats', label: 'Estadísticas', emoji: '📊' },
  { id: 'settings', label: 'Ajustes', emoji: '⚙️' },
]

function viewFromPending(value: string | null): ViewId {
  if (['randomizer', 'discover', 'library', 'stats', 'settings'].includes(value ?? '')) {
    return value as ViewId
  }
  return 'randomizer'
}

export function App() {
  const { ready, stats } = useLibrary()
  const [view, setView] = useState<ViewId>('randomizer')

  useEffect(() => {
    void takePendingView().then((pending) => {
      if (pending) setView(viewFromPending(pending))
    })
  }, [])

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            🎲
          </span>
          <div>
            <div className="app__name">Random Game Generator</div>
            <div className="app__tagline">Tu backlog, a suertes</div>
          </div>
        </div>

        <nav className="app__nav" aria-label="Secciones">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              className={`tab ${view === item.id ? 'tab--active' : ''}`}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {ready ? (
          <div className="app__badge" title="Juegos / Completados / Backlog">
            {stats.total} · {stats.byStatus.completed} · {stats.byStatus.backlog}
          </div>
        ) : null}
      </header>

      <main className="app__main">
        {!ready ? (
          <p className="muted">Cargando biblioteca…</p>
        ) : view === 'randomizer' ? (
          <RandomizerView />
        ) : view === 'discover' ? (
          <DiscoverView />
        ) : view === 'library' ? (
          <LibraryView />
        ) : view === 'stats' ? (
          <StatsView />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  )
}
import { useMemo, useState } from 'react'
import { buildBackup, parseImportFile, type Game, type ImportSummary } from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { sampleSummaryMessage, useSampleLibrary } from '@shared/hooks/use-sample-library'
import { EmptyState, GameCover, StatusBadge } from '@shared/components/atoms'
import { Modal } from '@shared/components/Modal'
import { GameForm } from '../components/GameForm'

type Toast = { kind: 'success' | 'error'; text: string } | null

function useToast(timeoutMs = 2600) {
  const [toast, setToast] = useState<Toast>(null)
  const show = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), timeoutMs)
  }
  return { toast, show }
}

export function LibraryView() {
  const { ready, games, settings, actions } = useLibrary()
  const { toast, show } = useToast()
  const sample = useSampleLibrary()

  const [editing, setEditing] = useState<Game | null | 'new'>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const query = settings.filters.search.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!query) return games
    return games.filter((game) =>
      [game.name, game.platform, ...game.genres, ...game.tags]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [games, query])

  const toggleExclude = async (game: Game) => {
    await actions.updateGame(game.id, { excluded: !game.excluded })
  }

  const requestDelete = (game: Game) => {
    if (settings.confirmBeforeDelete) setPendingDelete(game.id)
    else void actions.removeGame(game.id)
  }

  const onDelete = async () => {
    if (!pendingDelete) return
    await actions.removeGame(pendingDelete)
    setPendingDelete(null)
    show('success', 'Juego eliminado.')
  }

  const onImported = (summary: ImportSummary) => {
    setImportOpen(false)
    show('success', `Añadidos ${summary.added}, fusionados ${summary.merged}, omitidos ${summary.skipped}.`)
  }

  const loadSample = async () => {
    show('success', sampleSummaryMessage(await sample.load()))
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar">
        <input
          className="input grow"
          type="search"
          placeholder="Buscar por nombre, plataforma, género o tag…"
          value={settings.filters.search}
          onChange={(event) => void actions.patchFilters({ search: event.target.value })}
        />
        <button className="btn" onClick={() => setImportOpen(true)}>
          📥 Importar / Exportar
        </button>
        <button className="btn btn--primary" onClick={() => setEditing('new')}>
          ＋ Añadir juego
        </button>
      </div>

      {!ready ? (
        <p className="muted">Cargando…</p>
      ) : games.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Tu biblioteca está vacía"
          description="Añade juegos a mano, impórtalos desde un CSV/JSON o empieza con una biblioteca de ejemplo para probar el sorteo. Todo se guarda localmente en tu navegador."
          action={
            <div className="row row--wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn--primary" onClick={() => setEditing('new')}>
                ＋ Añadir tu primer juego
              </button>
              <button className="btn" onClick={() => void loadSample()} disabled={sample.loading}>
                🎁 Cargar biblioteca de ejemplo ({sample.size})
              </button>
            </div>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon="🔍" title="Sin resultados" description="Ningún juego coincide con tu búsqueda." />
      ) : (
        <div className="library-grid">
          {visible.map((game) => (
            <article
              key={game.id}
              className={`game-card ${game.excluded ? 'game-card--excluded' : ''}`}
              onClick={() => setEditing(game)}
            >
              <div className="game-card__cover-wrap">
                <GameCover name={game.name} url={game.coverUrl} className="game-card__cover" />
                {game.favorite ? (
                  <span className="game-card__fav" title="Favorito" aria-label="Favorito">
                    ❤️
                  </span>
                ) : null}
                {game.excluded ? (
                  <span className="game-card__excluded-badge" title="Excluido del sorteo">
                    ⛔
                  </span>
                ) : null}
              </div>
              <div className="game-card__body">
                <h3 className="game-card__title">{game.name}</h3>
                <StatusBadge status={game.status} />
                <div className="game-card__meta">
                  <span>{game.platform}</span>
                  <span>{game.playedHours.toFixed(0)} h</span>
                  {game.rating != null ? <span>★ {game.rating.toFixed(1)}</span> : null}
                </div>
                <div className="game-card__actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    className="icon-btn"
                    title={game.favorite ? 'Quitar favorito' : 'Marcar favorito'}
                    aria-label={game.favorite ? 'Quitar favorito' : 'Marcar favorito'}
                    onClick={() => void actions.updateGame(game.id, { favorite: !game.favorite })}
                  >
                    {game.favorite ? '💔' : '❤️'}
                  </button>
                  <button
                    className="icon-btn"
                    title={game.excluded ? 'Incluir en el sorteo' : 'Excluir del sorteo'}
                    aria-label={game.excluded ? 'Incluir en el sorteo' : 'Excluir del sorteo'}
                    onClick={() => void toggleExclude(game)}
                  >
                    ⛔
                  </button>
                  <button
                    className="icon-btn"
                    title="Editar"
                    aria-label="Editar"
                    onClick={() => setEditing(game)}
                  >
                    ✏️
                  </button>
                  <button
                    className="icon-btn"
                    title="Eliminar"
                    aria-label="Eliminar"
                    onClick={() => requestDelete(game)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing ? (
        <GameForm game={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}

      {pendingDelete ? (
        <Modal
          title="Eliminar juego"
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPendingDelete(null)}>
                Cancelar
              </button>
              <button className="btn btn--danger" onClick={() => void onDelete()}>
                Eliminar
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            ¿Seguro que quieres eliminar «{games.find((game) => game.id === pendingDelete)?.name}» de tu
            biblioteca?
          </p>
        </Modal>
      ) : null}

      {importOpen ? (
        <ImportExportModal
          onClose={() => setImportOpen(false)}
          onImported={onImported}
        />
      ) : null}

      {toast ? (
        <div className={`toast toast--${toast.kind}`} role="status">
          {toast.text}
        </div>
      ) : null}
    </div>
  )
}

/** Importación (CSV/JSON) y exportación/restauración de copia de seguridad. */
function ImportExportModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: (summary: ImportSummary) => void
}) {
  const { games, actions } = useLibrary()
  const [text, setText] = useState('')
  const [merge, setMerge] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const importCurrent = async (replace: boolean) => {
    if (!text.trim()) {
      setError('Pega un CSV o JSON o importa un archivo.')
      return
    }
    try {
      const drafts = parseImportFile('backup.json', text)
      if (replace) {
        await actions.clearLibrary()
        const summary = await actions.importGames(drafts, { merge: false })
        onImported(summary)
      } else {
        const summary = await actions.importGames(drafts, { merge })
        onImported(summary)
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Formato no válido.')
    }
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackup(games), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'random-game-generator-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File) => {
    setError(null)
    try {
      setText(await file.text())
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  return (
    <Modal
      title="Importar / Exportar"
      onClose={onClose}
      footer={
        <>
          <label className="btn">
            📁 Abrir archivo…
            <input
              type="file"
              accept=".csv,.json,application/json,text/csv"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onFile(file)
              }}
            />
          </label>
          <button className="btn" onClick={exportBackup}>
            💾 Exportar backup ({games.length})
          </button>
          <button
            className="btn btn--primary"
            onClick={() => void importCurrent(false)}
            disabled={!text.trim()}
          >
            Importar
          </button>
          <button
            className="btn btn--danger"
            onClick={() => void importCurrent(true)}
            disabled={!text.trim()}
            title="Sustituye toda la biblioteca por el contenido importado"
          >
            Restaurar copia completa
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
          Pega el contenido de un <strong>CSV</strong> o <strong>JSON</strong>, o abre un archivo. Campos
          reconocidos: name, platform, genres, status, playerMode, estimatedHours, playedHours, rating,
          tags, coverUrl, notes, addedAt. Los juegos existentes se fusionan sin pisar tus ediciones.
        </p>
        <textarea
          className="textarea"
          style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 12 }}
          placeholder={'name,platform,genres,status,estimatedHours\nPortal 2,PC,Acción,backlog,12'}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        {error ? <p style={{ margin: 0, color: 'var(--danger)', fontSize: 12 }}>{error}</p> : null}
        <label className="switch">
          <input type="checkbox" checked={merge} onChange={(event) => setMerge(event.target.checked)} />
          <span>Fusionar con la biblioteca actual (desmarcar para ignorar duplicados)</span>
        </label>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
          <strong>Restaurar copia completa</strong> sustituye toda la biblioteca por el contenido
          pegado (útil para volcar un backup exportado).
        </p>
      </div>
    </Modal>
  )
}
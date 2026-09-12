import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  collectFacets,
  computeStats,
  libraryRepository,
  type Facets,
  type FilterCriteria,
  type Game,
  type GameDraft,
  type ImportSummary,
  type LibraryStats,
  type SessionState,
  type Settings,
  type SpinRecord,
} from '@core/index'

interface LibraryActions {
  addGame(draft: GameDraft): Promise<Game>
  updateGame(id: string, patch: Partial<Game>): Promise<void>
  removeGame(id: string): Promise<void>
  removeMany(ids: string[]): Promise<void>
  importGames(drafts: GameDraft[], options?: { merge?: boolean }): Promise<ImportSummary>
  replaceAll(games: Game[]): Promise<void>
  clearLibrary(): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<void>
  resetSettings(): Promise<void>
  setFilters(filters: FilterCriteria): Promise<void>
  patchFilters(patch: Partial<FilterCriteria>): Promise<void>
  recordSpin(record: SpinRecord): Promise<void>
  clearSession(): Promise<void>
}

interface LibraryContextValue {
  ready: boolean
  games: Game[]
  settings: Settings
  session: SessionState
  facets: Facets
  stats: LibraryStats
  actions: LibraryActions
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

/**
 * Estado global de la extensión.
 *
 * Todo pasa por el repositorio y luego se recarga desde él: así el popup y el
 * dashboard abiertos a la vez ven siempre lo mismo, porque `chrome.storage`
 * notifica los cambios a ambos contextos.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [session, setSession] = useState<SessionState>(DEFAULT_SESSION)

  const reload = useCallback(async () => {
    const snapshot = await libraryRepository.snapshot()
    setGames(snapshot.games)
    setSettings(snapshot.settings)
    setSession(snapshot.session)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      await libraryRepository.ensureSchema()
      await reload()
      if (alive) setReady(true)
    })()
    const unsubscribe = libraryRepository.subscribe(() => {
      if (alive) void reload()
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [reload])

  const actions = useMemo<LibraryActions>(
    () => ({
      async addGame(draft) {
        const game = await libraryRepository.addGame(draft)
        await reload()
        return game
      },
      async updateGame(id, patch) {
        await libraryRepository.updateGame(id, patch)
        await reload()
      },
      async removeGame(id) {
        await libraryRepository.removeGame(id)
        await reload()
      },
      async removeMany(ids) {
        await libraryRepository.removeMany(ids)
        await reload()
      },
      async importGames(drafts, options) {
        const summary = await libraryRepository.importGames(drafts, { merge: true, ...options })
        await reload()
        return summary
      },
      async replaceAll(next) {
        await libraryRepository.replaceAll(next)
        await reload()
      },
      async clearLibrary() {
        await libraryRepository.clearLibrary()
        await reload()
      },
      async updateSettings(patch) {
        setSettings(await libraryRepository.updateSettings(patch))
      },
      async resetSettings() {
        setSettings(await libraryRepository.resetSettings())
      },
      async setFilters(filters) {
        setSettings(await libraryRepository.updateSettings({ filters }))
      },
      async patchFilters(patch) {
        const current = await libraryRepository.getSettings()
        setSettings(
          await libraryRepository.updateSettings({ filters: { ...current.filters, ...patch } }),
        )
      },
      async recordSpin(record) {
        setSession(await libraryRepository.recordSpin(record))
      },
      async clearSession() {
        setSession(await libraryRepository.clearSession())
      },
    }),
    [reload],
  )

  const facets = useMemo(() => collectFacets(games), [games])
  const stats = useMemo<LibraryStats>(() => computeStats(games), [games])

  const value = useMemo<LibraryContextValue>(
    () => ({ ready, games, settings, session, facets, stats, actions }),
    [ready, games, settings, session, facets, stats, actions],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary debe usarse dentro de <LibraryProvider>')
  return context
}

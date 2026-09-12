import { useState } from 'react'
import {
  DEFAULT_DISCOVER_API_URL,
  DEFAULT_FILTERS,
  SELECTION_MODES,
  countActiveFilters,
  listProviders,
} from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { useSampleLibrary } from '@shared/hooks/use-sample-library'

export function SettingsView() {
  const { games, session, settings, actions } = useLibrary()
  const sample = useSampleLibrary()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmSession, setConfirmSession] = useState(false)

  const modeOptions = SELECTION_MODES.map((mode) => (
    <option key={mode.id} value={mode.id}>
      {mode.emoji} {mode.label}
    </option>
  ))

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="hero">
        <h1 className="hero__title">⚙️ AJUSTES</h1>
        <p className="hero__subtitle muted">Preferencias del sorteo y datos de la extensión.</p>
      </section>

      <section className="panel">
        <div className="panel__title">Sorteo</div>
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="set-mode">
              Modo por defecto
            </label>
            <select
              id="set-mode"
              className="select"
              value={settings.defaultModeId}
              onChange={(event) => void actions.updateSettings({ defaultModeId: event.target.value })}
            >
              {modeOptions}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="set-repeats">
              Evitar repetir últimos
            </label>
            <input
              id="set-repeats"
              className="input"
              type="number"
              min={0}
              max={10}
              value={settings.avoidRepeatsCount}
              onChange={(event) =>
                void actions.updateSettings({
                  avoidRepeatsCount: Math.max(0, Math.min(10, Number(event.target.value) || 0)),
                })
              }
            />
            <span className="field__hint">Juegos recientes que el sorteo intenta no repetir.</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="set-duration">
              Duración de la animación (ms)
            </label>
            <input
              id="set-duration"
              className="input"
              type="number"
              min={200}
              max={4000}
              step={100}
              value={settings.spinDurationMs}
              onChange={(event) =>
                void actions.updateSettings({
                  spinDurationMs: Math.max(200, Math.min(4000, Number(event.target.value) || 1400)),
                })
              }
            />
          </div>

          <div className="field">
            <span className="field__label">Comportamiento</span>
            <div className="stack" style={{ gap: 8 }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoMarkPlaying}
                  onChange={(event) =>
                    void actions.updateSettings({ autoMarkPlaying: event.target.checked })
                  }
                />
                <span>“Jugar” marca el juego como jugando</span>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.confirmBeforeDelete}
                  onChange={(event) =>
                    void actions.updateSettings({ confirmBeforeDelete: event.target.checked })
                  }
                />
                <span>Preguntar antes de eliminar un juego</span>
              </label>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn btn--sm" onClick={() => void actions.resetSettings()}>
            Restablecer ajustes
          </button>
          <button
            className="btn btn--sm"
            onClick={() => void actions.setFilters({ ...DEFAULT_FILTERS })}
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">Descubrir</div>
        <div className="field">
          <label className="field__label" htmlFor="settings-discover-url">
            Servidor de recomendaciones
          </label>
          <input
            id="settings-discover-url"
            className="input"
            type="url"
            spellCheck={false}
            placeholder={DEFAULT_DISCOVER_API_URL}
            defaultValue={settings.discoverApiUrl}
            onBlur={(event) => {
              const value = event.target.value.trim().replace(/\/+$/, '') || DEFAULT_DISCOVER_API_URL
              if (value !== settings.discoverApiUrl) void actions.updateSettings({ discoverApiUrl: value })
            }}
          />
          <span className="field__hint">
            Descubrir es la única función que sale a internet, y solo cuando la usas. En desarrollo
            arranca el servidor con <code>npm run api:dev</code>; tras desplegarlo, pega aquí su URL.
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">Importadores de tiendas (próximamente)</div>
        <p className="field__hint">
          La biblioteca funciona 100 % offline. Estos orígenes están preparados en la arquitectura
          para una versión futura: al implementarse, tus juegos se importarán y fusionarán con esta
          misma biblioteca.
        </p>
        <div className="provider-list">
          {listProviders().map((provider) => (
            <div
              key={provider.id}
              className={`provider ${provider.status === 'planned' ? 'provider--planned' : ''}`}
            >
              <span className="provider__emoji" aria-hidden="true">
                {provider.emoji}
              </span>
              <div className="grow">
                <div className="provider__name">
                  {provider.label}
                  <span className="chip chip--static chip--tag">
                    {provider.status === 'available' ? 'Disponible' : 'Planeado'}
                  </span>
                </div>
                <div className="provider__desc">{provider.description}</div>
                <div className="provider__perms">
                  {provider.requiredPermissions.map((permission) => (
                    <code key={permission}>{permission}</code>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">Datos y privacidad</div>
        <p className="field__hint">
          {games.length} juegos, {session.history.length} giros registrados y{' '}
          {countActiveFilters(settings.filters)} filtros activos. Todo se guarda localmente en tu
          navegador con <code>chrome.storage.local</code>: nada sale de aquí.
        </p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn--sm" onClick={() => void sample.load()} disabled={sample.loading}>
            {sample.loading ? 'Cargando…' : `🎁 Cargar biblioteca de ejemplo (${sample.size})`}
          </button>
          <button
            className="btn btn--sm btn--danger"
            onClick={() => (confirmClear ? void actions.clearLibrary() : setConfirmClear(true))}
          >
            {confirmClear ? '¿Seguro? Pulsa otra vez' : `Vaciar biblioteca (${games.length})`}
          </button>
          {confirmClear ? (
            <button className="btn btn--sm" onClick={() => setConfirmClear(false)}>
              Cancelar
            </button>
          ) : null}
          <button
            className="btn btn--sm"
            onClick={() => (confirmSession ? void actions.clearSession() : setConfirmSession(true))}
          >
            {confirmSession ? '¿Seguro? Pulsa otra vez' : 'Borrar historial de sorteos'}
          </button>
          {confirmSession ? (
            <button className="btn btn--sm" onClick={() => setConfirmSession(false)}>
              Cancelar
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
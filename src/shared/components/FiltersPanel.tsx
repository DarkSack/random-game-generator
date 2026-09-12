import {
  DEFAULT_FILTERS,
  GAME_STATUSES,
  HOUR_PRESETS,
  PLAYER_MODES,
  PLAYER_MODE_LABEL,
  STATUS_LABEL,
  countActiveFilters,
  type Facets,
  type FilterCriteria,
} from '@core/index'

type Patch = Partial<FilterCriteria>

/** Grupo de chips multi-selección: click alterna, sin selección = "cualquiera". */
function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  renderLabel = (value: T) => value,
}: {
  label: string
  options: readonly T[]
  selected: readonly T[]
  onToggle: (value: T) => void
  renderLabel?: (value: T) => string
}) {
  if (!options.length) return null
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="row row--wrap" style={{ gap: 6 }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip ${selected.includes(option) ? 'chip--active' : ''}`}
            aria-pressed={selected.includes(option)}
            onClick={() => onToggle(option)}
          >
            {renderLabel(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

const BACKLOG_AGE_OPTIONS = [
  { label: 'Cualquiera', value: '' },
  { label: 'Más de 1 mes', value: '30' },
  { label: 'Más de 3 meses', value: '90' },
  { label: 'Más de 6 meses', value: '180' },
  { label: 'Más de 1 año', value: '365' },
]

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function activePreset(filters: FilterCriteria): number {
  return HOUR_PRESETS.findIndex(
    (preset) => preset.min === filters.minHours && preset.max === filters.maxHours,
  )
}

export function FiltersPanel({
  filters,
  facets,
  onChange,
  compact = false,
}: {
  filters: FilterCriteria
  facets: Facets
  onChange: (patch: Patch) => void
  compact?: boolean
}) {
  const activeCount = countActiveFilters(filters)
  const presetIndex = activePreset(filters)

  return (
    <section className={compact ? 'stack' : 'panel'} style={{ gap: 14 }}>
      <div className="panel__title">
        <span>Filtros {activeCount ? `· ${activeCount}` : ''}</span>
        {activeCount > 0 ? (
          <button className="btn btn--ghost btn--sm" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
            Limpiar
          </button>
        ) : null}
      </div>

      {!compact ? (
        <div className="field">
          <label className="field__label" htmlFor="filter-search">
            Buscar
          </label>
          <input
            id="filter-search"
            className="input"
            type="search"
            placeholder="Nombre, tag, nota…"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </div>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="filter-platform">
          Plataforma
        </label>
        <select
          id="filter-platform"
          className="select"
          value={filters.platforms[0] ?? ''}
          onChange={(event) =>
            onChange({ platforms: event.target.value ? [event.target.value] : [] })
          }
        >
          <option value="">Todas</option>
          {facets.platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="filter-genre">
          Género
        </label>
        <select
          id="filter-genre"
          className="select"
          value={filters.genres[0] ?? ''}
          onChange={(event) => onChange({ genres: event.target.value ? [event.target.value] : [] })}
        >
          <option value="">Todos</option>
          {facets.genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field__label">Duración</span>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {HOUR_PRESETS.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              className={`chip ${presetIndex === index ? 'chip--active' : ''}`}
              onClick={() => onChange({ minHours: preset.min, maxHours: preset.max })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <ChipGroup
        label="Estado"
        options={GAME_STATUSES}
        selected={filters.statuses}
        onToggle={(status) => onChange({ statuses: toggle(filters.statuses, status) })}
        renderLabel={(status) => STATUS_LABEL[status]}
      />

      <ChipGroup
        label="Jugadores"
        options={PLAYER_MODES.filter((mode) => mode !== 'unknown')}
        selected={filters.playerModes}
        onToggle={(mode) => onChange({ playerModes: toggle(filters.playerModes, mode) })}
        renderLabel={(mode) => PLAYER_MODE_LABEL[mode]}
      />

      {!compact ? (
        <>
          {facets.tags.length ? (
            <ChipGroup
              label="Tags"
              options={facets.tags}
              selected={filters.tags}
              onToggle={(tag) => onChange({ tags: toggle(filters.tags, tag) })}
            />
          ) : null}

          <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div className="field grow">
              <label className="field__label" htmlFor="filter-rating">
                Nota mínima
              </label>
              <select
                id="filter-rating"
                className="select"
                value={filters.minRating ?? ''}
                onChange={(event) =>
                  onChange({ minRating: event.target.value ? Number(event.target.value) : null })
                }
              >
                <option value="">Cualquiera</option>
                {[5, 6, 7, 8, 9].map((value) => (
                  <option key={value} value={value}>
                    {value}+
                  </option>
                ))}
              </select>
            </div>

            <div className="field grow">
              <label className="field__label" htmlFor="filter-age">
                En biblioteca desde
              </label>
              <select
                id="filter-age"
                className="select"
                value={filters.minBacklogDays ?? ''}
                onChange={(event) =>
                  onChange({ minBacklogDays: event.target.value ? Number(event.target.value) : null })
                }
              >
                {BACKLOG_AGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <label className="switch">
              <input
                type="checkbox"
                checked={filters.neverPlayed}
                onChange={(event) => onChange({ neverPlayed: event.target.checked })}
              />
              <span>Solo juegos nunca jugados</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={filters.startedNotFinished}
                onChange={(event) => onChange({ startedNotFinished: event.target.checked })}
              />
              <span>Solo juegos empezados sin terminar</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={filters.abandonedOnly}
                onChange={(event) => onChange({ abandonedOnly: event.target.checked })}
              />
              <span>Solo juegos abandonados</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={filters.favoritesOnly}
                onChange={(event) => onChange({ favoritesOnly: event.target.checked })}
              />
              <span>Solo favoritos</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={filters.includeUnknownDuration}
                onChange={(event) => onChange({ includeUnknownDuration: event.target.checked })}
              />
              <span>Incluir juegos sin duración estimada</span>
            </label>
          </div>
        </>
      ) : null}
    </section>
  )
}

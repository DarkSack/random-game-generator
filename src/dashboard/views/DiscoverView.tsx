import { useMemo, useRef, useState } from 'react'
import {
  DISCOVER_GENRES,
  DISCOVER_PLATFORMS,
  GENRE_LABEL,
  REGION_CURRENCY,
  currencyForRegion,
  discoverCacheKey,
  discoveryToDraft,
  excludeOwnedGames,
  fetchDiscover,
  normalizeTitle,
  pickDiscovery,
  type DiscoverCriteria,
  type DiscoverGame,
  type DiscoverPlatform,
  type DiscoverPlayerMode,
  type DiscoverResponse,
  type StoreOffer,
  type Storefront,
} from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { EmptyState, GameCover } from '@shared/components/atoms'

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

const PLATFORM_LABEL: Record<DiscoverPlatform, string> = {
  pc: '🖥️ PC',
  switch: '🔴 Switch',
  xbox: '🟢 Xbox',
  playstation: '🔵 PlayStation',
}

/** Plataformas que no se pueden consultar, con el motivo que ve el usuario. */
const UNAVAILABLE_PLATFORMS: Partial<Record<DiscoverPlatform, string>> = {
  playstation: 'Sony no permite consultar su tienda desde fuera de su web.',
}

const STORE_LABEL: Record<Storefront, string> = {
  steam: 'Steam',
  epic: 'Epic Games',
  gog: 'GOG',
  humble: 'Humble',
  fanatical: 'Fanatical',
  'other-pc': 'Otra tienda',
  nintendo: 'Nintendo eShop',
  xbox: 'Microsoft Store',
  playstation: 'PlayStation Store',
}

const PLAYER_LABEL: Record<DiscoverPlayerMode, string> = {
  single: 'Un jugador',
  multi: 'Multijugador',
  coop: 'Cooperativo',
}

const REGION_LABEL: Record<string, string> = {
  MX: '🇲🇽 México',
  US: '🇺🇸 Estados Unidos',
  ES: '🇪🇸 España',
  AR: '🇦🇷 Argentina',
  CO: '🇨🇴 Colombia',
  CL: '🇨🇱 Chile',
  BR: '🇧🇷 Brasil',
  GB: '🇬🇧 Reino Unido',
}

function formatPrice(offer: StoreOffer | null): string {
  if (!offer) return 'Sin oferta'
  if (offer.free) return 'Gratis'
  if (offer.price == null) return 'Precio no disponible'
  // Siempre con código de moneda: "$64.49" es ambiguo entre pesos y dólares.
  const amount = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(offer.price)
  return `${amount} ${offer.currency}`.trim()
}

/** Regiones donde Nintendo publica precio para los juegos de su índice europeo. */
const NINTENDO_PRICED_REGIONS = new Set(['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'GB'])

/**
 * Avisos que dependen de los criterios y no de la respuesta: explican por qué
 * una plataforma elegida puede no aportar resultados, antes de que el usuario
 * lo lea como un fallo.
 */
function criteriaWarnings(criteria: DiscoverCriteria): string[] {
  const warnings: string[] = []
  const priceRange = criteria.minPrice != null || criteria.maxPrice != null
  if (
    priceRange &&
    criteria.platforms.includes('switch') &&
    !NINTENDO_PRICED_REGIONS.has(criteria.region.toUpperCase())
  ) {
    warnings.push(
      `Switch: Nintendo solo publica precios europeos para su catálogo, así que con un rango en ${currencyForRegion(criteria.region)} no entran juegos de Switch (salvo gratuitos). Quita el rango de precio para verlos con precio de referencia en EUR.`,
    )
  }
  return warnings
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function minutesAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  return minutes < 1 ? 'hace un momento' : `hace ${minutes} min`
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; response: DiscoverResponse; pool: DiscoverGame[]; game: DiscoverGame; exhausted: boolean }
  | { kind: 'empty'; response: DiscoverResponse }
  | { kind: 'error'; message: string }

export function DiscoverView() {
  const { games: library, settings, actions } = useLibrary()
  const criteria = settings.discoverCriteria
  const currency = currencyForRegion(criteria.region)

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const seen = useRef(new Set<string>())
  /** Respuestas por criterios: "Otra sugerencia" no vuelve a llamar a las tiendas. */
  const responses = useRef(new Map<string, DiscoverResponse>())

  const libraryTitles = useMemo(() => new Set(library.map((game) => normalizeTitle(game.name))), [library])

  const update = (patch: Partial<DiscoverCriteria>) => {
    void actions.updateSettings({ discoverCriteria: { ...criteria, ...patch } })
  }

  const poolFrom = (response: DiscoverResponse) =>
    criteria.excludeOwned ? excludeOwnedGames(response.games, library) : response.games

  const choose = (response: DiscoverResponse) => {
    const pool = poolFrom(response)
    const { game, exhausted } = pickDiscovery(pool, seen.current)
    if (!game) {
      setPhase({ kind: 'empty', response })
      return
    }
    seen.current.add(game.id)
    setPhase({ kind: 'result', response, pool, game, exhausted })
  }

  const discover = async (forceRefresh = false) => {
    if (!criteria.platforms.length) {
      setPhase({ kind: 'error', message: 'Elige al menos una plataforma.' })
      return
    }
    const key = discoverCacheKey(criteria)
    const cached = forceRefresh ? undefined : responses.current.get(key)
    if (cached) {
      choose(cached)
      return
    }

    setPhase({ kind: 'loading' })
    try {
      const response = await fetchDiscover(settings.discoverApiUrl, criteria)
      responses.current.set(key, response)
      seen.current.clear()
      choose(response)
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const saveToWishlist = async (game: DiscoverGame) => {
    await actions.importGames([discoveryToDraft(game)])
    setSavedIds((current) => new Set(current).add(game.id))
  }

  const loading = phase.kind === 'loading'

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="hero">
        <h1 className="hero__title">🔎 DESCUBRIR</h1>
        <p className="hero__subtitle muted">
          Dinos qué te apetece y cuánto quieres gastar: buscamos en Steam, Epic, GOG, Nintendo y Xbox y
          te proponemos un juego que todavía no tienes.
        </p>
      </section>

      <section className="panel stack" style={{ gap: 16 }}>
        <div className="field">
          <span className="field__label">Plataformas</span>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {DISCOVER_PLATFORMS.map((platform) => {
              const reason = UNAVAILABLE_PLATFORMS[platform]
              const active = criteria.platforms.includes(platform)
              return (
                <button
                  key={platform}
                  type="button"
                  className={`chip ${active ? 'chip--active' : ''}`}
                  aria-pressed={active}
                  disabled={Boolean(reason)}
                  title={reason}
                  onClick={() => update({ platforms: toggle(criteria.platforms, platform) })}
                >
                  {PLATFORM_LABEL[platform]}
                  {reason ? ' · no disponible' : ''}
                </button>
              )
            })}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Géneros {criteria.genres.length ? `· ${criteria.genres.length}` : '· cualquiera'}</span>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {DISCOVER_GENRES.map((genre) => {
              const active = criteria.genres.includes(genre)
              return (
                <button
                  key={genre}
                  type="button"
                  className={`chip ${active ? 'chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => update({ genres: toggle(criteria.genres, genre) })}
                >
                  {GENRE_LABEL[genre]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="discover-grid">
          <div className="field">
            <label className="field__label" htmlFor="discover-min">
              Precio mínimo ({currency})
            </label>
            <input
              id="discover-min"
              className="input"
              type="number"
              min={0}
              placeholder="0"
              value={criteria.minPrice ?? ''}
              onChange={(event) =>
                update({ minPrice: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="discover-max">
              Precio máximo ({currency})
            </label>
            <input
              id="discover-max"
              className="input"
              type="number"
              min={0}
              placeholder="Sin límite"
              value={criteria.maxPrice ?? ''}
              onChange={(event) =>
                update({ maxPrice: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="discover-rating">
              Nota mínima
            </label>
            <select
              id="discover-rating"
              className="select"
              value={criteria.minRating ?? ''}
              onChange={(event) =>
                update({ minRating: event.target.value === '' ? null : Number(event.target.value) })
              }
            >
              <option value="">Cualquiera</option>
              {[6, 7, 8, 9].map((value) => (
                <option key={value} value={value}>
                  {value}+
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="discover-region">
              Región y moneda
            </label>
            <select
              id="discover-region"
              className="select"
              value={criteria.region}
              onChange={(event) => update({ region: event.target.value })}
            >
              {Object.keys(REGION_CURRENCY).map((region) => (
                <option key={region} value={region}>
                  {REGION_LABEL[region] ?? region} ({REGION_CURRENCY[region]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field__label">Jugadores</span>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {(Object.keys(PLAYER_LABEL) as DiscoverPlayerMode[]).map((mode) => {
              const active = criteria.playerModes.includes(mode)
              return (
                <button
                  key={mode}
                  type="button"
                  className={`chip ${active ? 'chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => update({ playerModes: toggle(criteria.playerModes, mode) })}
                >
                  {PLAYER_LABEL[mode]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="row row--wrap" style={{ gap: 18 }}>
          <label className="switch">
            <input
              type="checkbox"
              checked={criteria.onlyDeals}
              onChange={(event) => update({ onlyDeals: event.target.checked })}
            />
            <span>Solo con descuento</span>
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={criteria.includeFree}
              onChange={(event) => update({ includeFree: event.target.checked })}
            />
            <span>Incluir gratuitos</span>
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={criteria.excludeOwned}
              onChange={(event) => update({ excludeOwned: event.target.checked })}
            />
            <span>Ocultar lo que ya tengo</span>
          </label>
        </div>
      </section>

      <div className="spin">
        <button
          className={`spin__button ${loading ? 'spin__button--rolling' : ''}`}
          onClick={() => void discover()}
          disabled={loading || !criteria.platforms.length}
        >
          {loading ? (
            <>
              <span className="spin__dice">🔎</span>
              BUSCANDO EN TIENDAS…
            </>
          ) : (
            '🔎 ¿QUÉ DESCUBRO?'
          )}
        </button>
        <p className="spin__pool">
          {loading
            ? 'Consultando catálogos y precios; la primera búsqueda tarda unos segundos.'
            : 'Cada búsqueda se guarda: pedir otra sugerencia con los mismos criterios es instantáneo.'}
        </p>
      </div>

      {phase.kind === 'error' ? (
        <EmptyState
          icon="📡"
          title="No pudimos buscar"
          description={phase.message}
          action={
            <button className="btn" onClick={() => void discover(true)}>
              Reintentar
            </button>
          }
        />
      ) : null}

      {phase.kind === 'empty' ? (
        <>
          <FailureNotice response={phase.response} warnings={criteriaWarnings(criteria)} />
          <EmptyState
            icon="🧐"
            title="Nada encaja con esos criterios"
            description={
              phase.response.games.length
                ? 'Las tiendas devolvieron juegos, pero ya los tienes todos en tu biblioteca. Desactiva «Ocultar lo que ya tengo» o amplía la búsqueda.'
                : 'Prueba a quitar algún género, subir el precio máximo o añadir otra plataforma.'
            }
          />
        </>
      ) : null}

      {phase.kind === 'result' ? (
        <>
          <FailureNotice response={phase.response} warnings={criteriaWarnings(criteria)} />
          <DiscoveryCard
            game={phase.game}
            regionCurrency={currency}
            saved={savedIds.has(phase.game.id) || libraryTitles.has(normalizeTitle(phase.game.name))}
            onAnother={() => choose(phase.response)}
            onSave={() => void saveToWishlist(phase.game)}
          />
          <p className="faint" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>
            Elegido al azar entre {phase.pool.length} {phase.pool.length === 1 ? 'juego' : 'juegos'} de{' '}
            {phase.response.sources.map((store) => STORE_LABEL[store]).join(', ')} · precios{' '}
            {minutesAgo(phase.response.generatedAt)}
            {phase.exhausted ? ' · ya viste todas las sugerencias, empezamos a repetir' : ''}
          </p>
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function FailureNotice({ response, warnings = [] }: { response: DiscoverResponse; warnings?: string[] }) {
  if (!response.failures.length && !warnings.length) return null
  return (
    <div className="notice">
      {response.failures.map((failure) => (
        <div key={failure.store}>
          <strong>{STORE_LABEL[failure.store]}:</strong> {failure.reason}
        </div>
      ))}
      {warnings.map((warning) => (
        <div key={warning}>{warning}</div>
      ))}
    </div>
  )
}

function DiscoveryCard({
  game,
  regionCurrency,
  saved,
  onAnother,
  onSave,
}: {
  game: DiscoverGame
  regionCurrency: string
  saved: boolean
  onAnother: () => void
  onSave: () => void
}) {
  const cheapest = game.cheapest
  const foreignPrice =
    cheapest && !cheapest.free && cheapest.price != null && cheapest.currency !== regionCurrency

  return (
    <article className="discovery">
      <GameCover name={game.name} url={game.coverUrl} wide className="discovery__cover" />

      <div className="discovery__body">
        <div className="result__mode">{PLATFORM_LABEL[game.platform]}</div>
        <h2 className="result__title">{game.name}</h2>

        <div className="row row--wrap" style={{ gap: 6 }}>
          {game.genres.map((genre) => (
            <span key={genre} className="chip chip--static">
              {GENRE_LABEL[genre]}
            </span>
          ))}
          {game.rating != null ? <span className="rating">★ {game.rating.toFixed(1)}</span> : null}
          {game.releaseYear ? <span className="faint">{game.releaseYear}</span> : null}
        </div>

        {game.description ? <p className="discovery__description muted">{game.description}</p> : null}

        <div className="discovery__price">
          <span className="discovery__amount gradient-text">{formatPrice(cheapest)}</span>
          {cheapest && cheapest.discountPct > 0 ? (
            <span className="badge badge--completed">-{cheapest.discountPct}%</span>
          ) : null}
          {cheapest ? <span className="faint">en {STORE_LABEL[cheapest.store]}</span> : null}
        </div>
        {foreignPrice ? (
          <p className="faint" style={{ fontSize: 12, margin: 0 }}>
            Precio de referencia en {cheapest!.currency}: la tienda no publica precio en {regionCurrency}{' '}
            para tu región.
          </p>
        ) : null}

        {game.offers.length > 1 ? (
          <ul className="offers">
            {game.offers.map((offer) => (
              <li key={`${offer.store}-${offer.url}`}>
                <a href={offer.url} target="_blank" rel="noopener noreferrer">
                  {STORE_LABEL[offer.store]}
                </a>
                <span>
                  {formatPrice(offer)}
                  {offer.discountPct > 0 ? ` (-${offer.discountPct}%)` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="result__actions">
          {cheapest?.url ? (
            <a className="btn btn--primary btn--sm" href={cheapest.url} target="_blank" rel="noopener noreferrer">
              🛒 Ver en tienda
            </a>
          ) : null}
          <button className="btn btn--sm" onClick={onAnother}>
            🎲 Otra sugerencia
          </button>
          <button className="btn btn--sm" onClick={onSave} disabled={saved}>
            {saved ? '✓ En tu biblioteca' : '⭐ Guardar en wishlist'}
          </button>
        </div>
      </div>
    </article>
  )
}

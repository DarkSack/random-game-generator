import { useState, type ChangeEvent } from 'react'
import {
  GAME_STATUSES,
  PLAYER_MODES,
  PLAYER_MODE_LABEL,
  STATUS_LABEL,
  SUGGESTED_GENRES,
  SUGGESTED_PLATFORMS,
  type Game,
  type GameDraft,
  type GameStatus,
  type PlayerMode,
} from '@core/index'
import { useLibrary } from '@shared/hooks/use-library'
import { Modal } from '@shared/components/Modal'

interface FormState {
  name: string
  platform: string
  genres: string
  status: GameStatus
  playerMode: PlayerMode
  estimatedHours: string
  playedHours: string
  rating: string
  tags: string
  coverUrl: string
  notes: string
  favorite: boolean
  excluded: boolean
}

function initialState(game: Game | null): FormState {
  return {
    name: game?.name ?? '',
    platform: game?.platform ?? 'PC',
    genres: game?.genres.join(', ') ?? '',
    status: game?.status ?? 'backlog',
    playerMode: game?.playerMode ?? 'unknown',
    estimatedHours: game?.estimatedHours?.toString() ?? '',
    playedHours: game?.playedHours.toString() ?? '0',
    rating: game?.rating?.toString() ?? '',
    tags: game?.tags.join(', ') ?? '',
    coverUrl: game?.coverUrl ?? '',
    notes: game?.notes ?? '',
    favorite: game?.favorite ?? false,
    excluded: game?.excluded ?? false,
  }
}

const toNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

const splitList = (value: string): string[] =>
  value
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)

/** Reduce y recodifica una portada local para caber sin inflar el storage. */
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 480 / image.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('No se pudo procesar la imagen'))
        return
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Archivo de imagen inválido'))
    }
    image.src = url
  })
}

export function GameForm({
  game,
  onClose,
}: {
  game: Game | null
  onClose: () => void
}) {
  const { actions } = useLibrary()
  const [form, setForm] = useState<FormState>(() => initialState(game))
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const valid = form.name.trim().length > 0

  const onCoverFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCoverBusy(true)
    setCoverError(null)
    try {
      const dataUrl = await downscaleImage(file)
      set('coverUrl', dataUrl)
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'No se pudo leer la imagen')
    } finally {
      setCoverBusy(false)
    }
  }

  const buildDraft = (): GameDraft => {
    const estimated = toNumber(form.estimatedHours)
    const patch: GameDraft = {
      name: form.name,
      platform: form.platform,
      genres: splitList(form.genres),
      status: form.status,
      playerMode: form.playerMode,
      estimatedHours: estimated ?? null,
      playedHours: toNumber(form.playedHours) ?? 0,
      rating: toNumber(form.rating) ?? null,
      tags: splitList(form.tags),
      coverUrl: form.coverUrl || null,
      notes: form.notes.trim(),
      favorite: form.favorite,
      excluded: form.excluded,
    }
    if (estimated === undefined) patch.estimatedHours = null
    return patch
  }

  const onSave = async () => {
    if (!valid) return
    const draft = buildDraft()
    if (game) {
      await actions.updateGame(game.id, draft)
    } else {
      await actions.addGame(draft)
    }
    onClose()
  }

  return (
    <Modal
      title={game ? 'Editar juego' : 'Añadir juego'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={() => void onSave()} disabled={!valid}>
            {game ? 'Guardar cambios' : 'Añadir'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field form-grid__span">
          <label className="field__label" htmlFor="gf-name">
            Nombre *
          </label>
          <input
            id="gf-name"
            className="input"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Elden Ring, Hades II…"
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-platform">
            Plataforma
          </label>
          <input
            id="gf-platform"
            className="input"
            list="suggested-platforms"
            value={form.platform}
            onChange={(event) => set('platform', event.target.value)}
          />
          <datalist id="suggested-platforms">
            {SUGGESTED_PLATFORMS.map((platform) => (
              <option key={platform} value={platform} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-status">
            Estado
          </label>
          <select
            id="gf-status"
            className="select"
            value={form.status}
            onChange={(event) => set('status', event.target.value as GameStatus)}
          >
            {GAME_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-genres">
            Géneros
          </label>
          <input
            id="gf-genres"
            className="input"
            list="suggested-genres"
            value={form.genres}
            onChange={(event) => set('genres', event.target.value)}
            placeholder="RPG, Aventura…"
          />
          <datalist id="suggested-genres">
            {SUGGESTED_GENRES.map((genre) => (
              <option key={genre} value={genre} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-mode">
            Jugadores
          </label>
          <select
            id="gf-mode"
            className="select"
            value={form.playerMode}
            onChange={(event) => set('playerMode', event.target.value as PlayerMode)}
          >
            {PLAYER_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {PLAYER_MODE_LABEL[mode]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-estimated">
            Duración estimada (h)
          </label>
          <input
            id="gf-estimated"
            className="input"
            type="number"
            min={0}
            value={form.estimatedHours}
            onChange={(event) => set('estimatedHours', event.target.value)}
            placeholder="30"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-played">
            Horas jugadas
          </label>
          <input
            id="gf-played"
            className="input"
            type="number"
            min={0}
            value={form.playedHours}
            onChange={(event) => set('playedHours', event.target.value)}
            placeholder="0"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-rating">
            Nota personal (0–10)
          </label>
          <input
            id="gf-rating"
            className="input"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={form.rating}
            onChange={(event) => set('rating', event.target.value)}
            placeholder="8.5"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gf-tags">
            Tags (coma-separados)
          </label>
          <input
            id="gf-tags"
            className="input"
            value={form.tags}
            onChange={(event) => set('tags', event.target.value)}
            placeholder="difícil, corto, coop…"
          />
        </div>

        <div className="field form-grid__span">
          <label className="field__label" htmlFor="gf-cover">
            Portada (URL)
          </label>
          <input
            id="gf-cover"
            className="input"
            value={form.coverUrl}
            onChange={(event) => set('coverUrl', event.target.value)}
            placeholder="https://…/cover.jpg"
          />
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="btn btn--sm">
              {coverBusy ? 'Procesando…' : '📁 Subir desde el disco'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => void onCoverFile(event)}
                disabled={coverBusy}
              />
            </label>
            {form.coverUrl ? (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => set('coverUrl', '')}
                type="button"
              >
                Eliminar portada
              </button>
            ) : null}
            {coverError ? <span className="faint">{coverError}</span> : null}
          </div>
        </div>

        <div className="field form-grid__span">
          <label className="field__label" htmlFor="gf-notes">
            Notas
          </label>
          <textarea
            id="gf-notes"
            className="textarea"
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            placeholder="Mecánicas, dificultad, por qué lo quieres jugar…"
          />
        </div>

        <div className="form-grid__span">
          <div className="row" style={{ gap: 22, flexWrap: 'wrap' }}>
            <label className="switch">
              <input
                type="checkbox"
                checked={form.favorite}
                onChange={(event) => set('favorite', event.target.checked)}
              />
              <span>❤️ Favorito</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={form.excluded}
                onChange={(event) => set('excluded', event.target.checked)}
              />
              <span>⛔ Excluido del sorteo</span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  )
}
import type { Game, GameDraft, GameStatus, PlayerMode } from '../types/game'
import { GAME_STATUSES, PLAYER_MODES } from '../types/game'

/**
 * Importación y exportación por fichero: el camino offline para meter una
 * biblioteca grande sin escribirla a mano, y la copia de seguridad del usuario.
 */

export interface BackupFile {
  format: 'random-game-generator'
  version: number
  exportedAt: string
  games: Game[]
}

export const BACKUP_FORMAT = 'random-game-generator'
export const BACKUP_VERSION = 1

export function buildBackup(games: Game[]): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    games,
  }
}

const asStatus = (value: unknown): GameStatus | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return (GAME_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as GameStatus)
    : undefined
}

const asPlayerMode = (value: unknown): PlayerMode | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return (PLAYER_MODES as readonly string[]).includes(normalized)
    ? (normalized as PlayerMode)
    : undefined
}

const asNumber = (value: unknown): number | undefined => {
  if (value === '' || value == null) return undefined
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

const asList = (value: unknown): string[] | undefined => {
  if (value == null || value === '') return undefined
  if (Array.isArray(value)) return value.map(String)
  return String(value)
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Convierte un objeto arbitrario (JSON o fila de CSV) en un borrador válido. */
export function rowToDraft(row: Record<string, unknown>): GameDraft | null {
  const name = String(row.name ?? row.Name ?? row.title ?? row.Title ?? '').trim()
  if (!name) return null

  const draft: GameDraft = { name, source: 'file' }
  const platform = row.platform ?? row.Platform
  if (platform) draft.platform = String(platform)

  const genres = asList(row.genres ?? row.genre ?? row.Genre)
  if (genres) draft.genres = genres

  const tags = asList(row.tags ?? row.Tags)
  if (tags) draft.tags = tags

  const status = asStatus(row.status ?? row.Status)
  if (status) draft.status = status

  const playerMode = asPlayerMode(row.playerMode ?? row.mode)
  if (playerMode) draft.playerMode = playerMode

  const estimated = asNumber(row.estimatedHours ?? row.hours ?? row.length)
  if (estimated !== undefined) draft.estimatedHours = estimated

  const played = asNumber(row.playedHours ?? row.playtime)
  if (played !== undefined) draft.playedHours = played

  const rating = asNumber(row.rating ?? row.score)
  if (rating !== undefined) draft.rating = rating

  const cover = row.coverUrl ?? row.cover ?? row.image
  if (cover) draft.coverUrl = String(cover)

  const notes = row.notes ?? row.Notes
  if (notes) draft.notes = String(notes)

  if (row.favorite != null) draft.favorite = row.favorite === true || row.favorite === 'true'
  if (row.excluded != null) draft.excluded = row.excluded === true || row.excluded === 'true'
  if (row.externalId) draft.externalId = String(row.externalId)

  const addedAt = row.addedAt ? Date.parse(String(row.addedAt)) : NaN
  if (!Number.isNaN(addedAt)) draft.addedAt = addedAt

  return draft
}

/** Acepta tanto un backup completo como un array suelto de juegos. */
export function parseJsonImport(text: string): GameDraft[] {
  const parsed: unknown = JSON.parse(text)
  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as BackupFile)?.games)
      ? (parsed as BackupFile).games
      : []

  if (!rows.length) throw new Error('El archivo no contiene juegos reconocibles.')
  return rows
    .map((row) => rowToDraft(row as Record<string, unknown>))
    .filter((draft): draft is GameDraft => draft !== null)
}

/** Parser de CSV mínimo con soporte de comillas dobles y saltos de línea escapados. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',' || char === ';') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows.filter((entry) => entry.some((cell) => cell.trim() !== ''))
  if (!header) return []

  const keys = header.map((cell) => cell.trim())
  return body.map((cells) => {
    const record: Record<string, string> = {}
    keys.forEach((key, index) => {
      record[key] = (cells[index] ?? '').trim()
    })
    return record
  })
}

export function parseCsvImport(text: string): GameDraft[] {
  return parseCsv(text)
    .map((row) => rowToDraft(row))
    .filter((draft): draft is GameDraft => draft !== null)
}

/** Detecta el formato por la extensión del fichero y delega en el parser correcto. */
export function parseImportFile(fileName: string, text: string): GameDraft[] {
  return fileName.toLowerCase().endsWith('.csv') ? parseCsvImport(text) : parseJsonImport(text)
}

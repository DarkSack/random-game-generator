import type { GameDraft, GameSource } from '../types/game'

/** Campo que el usuario debe rellenar para autenticar o identificar su cuenta. */
export interface ProviderField {
  key: string
  label: string
  placeholder?: string
  help?: string
  secret?: boolean
}

export type ProviderStatus = 'available' | 'planned'

/**
 * Contrato de un origen de biblioteca externo.
 *
 * La v1 es 100 % offline: todos los proveedores de tiendas están en estado
 * `planned` y su `fetchGames` lanza `ProviderNotImplementedError`. Implementar
 * uno consiste en cambiar su `status`, declarar sus `host_permissions` en el
 * manifest y devolver `GameDraft[]`; ni el repositorio ni la UI cambian, porque
 * la deduplicación y el alta masiva ya viven en `libraryRepository.importGames`.
 */
export interface LibraryProvider {
  id: GameSource
  label: string
  emoji: string
  status: ProviderStatus
  description: string
  /** Permisos que habrá que añadir al manifest cuando se implemente. */
  requiredPermissions: string[]
  fields: ProviderField[]
  fetchGames(input: Record<string, string>): Promise<GameDraft[]>
}

export class ProviderNotImplementedError extends Error {
  constructor(public readonly providerId: string) {
    super(`El importador de ${providerId} todavía no está disponible.`)
    this.name = 'ProviderNotImplementedError'
  }
}

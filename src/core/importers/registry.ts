import { STORE_PROVIDERS } from './providers/store-providers'
import type { LibraryProvider } from './types'

/**
 * Registro de proveedores. Añadir una tienda nueva es registrar aquí su
 * definición: la UI de ajustes se genera a partir de esta lista.
 */
const REGISTRY = new Map<string, LibraryProvider>(
  STORE_PROVIDERS.map((provider) => [provider.id, provider]),
)

export function registerProvider(provider: LibraryProvider): void {
  REGISTRY.set(provider.id, provider)
}

export function getProvider(id: string): LibraryProvider | null {
  return REGISTRY.get(id) ?? null
}

export function listProviders(): LibraryProvider[] {
  return [...REGISTRY.values()]
}

export function listAvailableProviders(): LibraryProvider[] {
  return listProviders().filter((provider) => provider.status === 'available')
}

import type { DiscoverPlatform } from '../../../src/core/discover/types'
import type { CatalogProvider } from '../provider'
import { nintendoProvider } from './nintendo'
import { pcProvider } from './pc'
import { playstationProvider } from './playstation'
import { xboxProvider } from './xbox'

/** Un proveedor por plataforma. Añadir una tienda es registrarla aquí. */
const PROVIDERS: Record<DiscoverPlatform, CatalogProvider> = {
  pc: pcProvider,
  switch: nintendoProvider,
  xbox: xboxProvider,
  playstation: playstationProvider,
}

export function providerFor(platform: DiscoverPlatform): CatalogProvider {
  return PROVIDERS[platform]
}

export function listProviders(): CatalogProvider[] {
  return Object.values(PROVIDERS)
}

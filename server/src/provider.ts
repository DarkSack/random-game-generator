import type {
  DiscoverCriteria,
  DiscoverGame,
  DiscoverPlatform,
  Storefront,
} from '../../src/core/discover/types'

/**
 * Contrato de un proveedor de catálogo.
 *
 * Mismo patrón que los importadores de biblioteca: los proveedores que aún no
 * se pueden implementar se declaran igual y lanzan `ProviderUnavailableError`,
 * de forma que aparecen en la respuesta como un fallo explicado en lugar de
 * desaparecer en silencio.
 */
export interface CatalogProvider {
  id: Storefront
  platform: DiscoverPlatform
  label: string
  status: 'available' | 'planned'
  /** Motivo por el que no está disponible, cuando `status` es 'planned'. */
  unavailableReason?: string
  search(criteria: DiscoverCriteria, limit: number): Promise<DiscoverGame[]>
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly store: Storefront,
    reason: string,
  ) {
    super(reason)
    this.name = 'ProviderUnavailableError'
  }
}

/** Convierte un precio en texto ("MX$1,029.00", "7.99") a número. */
export function parsePrice(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const digits = String(raw).replace(/[^\d.,]/g, '')
  if (!digits) return null
  // Formatos mixtos: "1,029.00" (miles con coma) y "1.029,00" (miles con punto).
  const normalized =
    digits.lastIndexOf(',') > digits.lastIndexOf('.')
      ? digits.replace(/\./g, '').replace(',', '.')
      : digits.replace(/,/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function discountPct(price: number | null, normalPrice: number | null): number {
  if (price == null || normalPrice == null || normalPrice <= 0) return 0
  return Math.max(0, Math.round((1 - price / normalPrice) * 100))
}

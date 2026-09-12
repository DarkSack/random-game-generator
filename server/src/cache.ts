/**
 * Caché en memoria con caducidad.
 *
 * En serverless vive lo que viva la instancia caliente, y es suficiente: los
 * catálogos y precios cambian en horas, no en segundos, y lo que se quiere
 * evitar es martillear las tiendas con la misma búsqueda en cada clic de
 * "Volver a girar". La caché de borde la aportan las cabeceras HTTP del
 * endpoint, no esto.
 */

interface Entry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200,
  ) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= now) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, now = Date.now()): void {
    if (this.store.size >= this.maxEntries) {
      // Expulsa la entrada más antigua: Map conserva el orden de inserción.
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, { value, expiresAt: now + this.ttlMs })
  }

  clear(): void {
    this.store.clear()
  }
}

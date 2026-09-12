/**
 * Capa de persistencia de bajo nivel.
 *
 * La app solo conoce la interfaz `KeyValueStore`. En la extensión se resuelve a
 * `chrome.storage.local` (persiste al cerrar el navegador y se sincroniza entre
 * popup, dashboard y service worker). Fuera de la extensión —tests, `vite`
 * suelto, storybook— cae a `localStorage` o a memoria, de forma que todo el
 * núcleo se puede ejecutar sin las APIs de Chrome.
 */

export type StoreListener = (changedKeys: string[]) => void

export interface KeyValueStore {
  get<T>(key: string, fallback: T): Promise<T>
  getMany(keys: string[]): Promise<Record<string, unknown>>
  set(key: string, value: unknown): Promise<void>
  setMany(entries: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  /** Notifica cambios hechos desde cualquier contexto de la extensión. */
  subscribe(listener: StoreListener): () => void
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local
}

class ChromeStore implements KeyValueStore {
  async get<T>(key: string, fallback: T): Promise<T> {
    const result = await chrome.storage.local.get(key)
    return (result[key] as T) ?? fallback
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(keys)
  }

  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.set(entries)
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear()
  }

  subscribe(listener: StoreListener): () => void {
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return
      listener(Object.keys(changes))
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }
}

/** Fallback para entornos sin `chrome.*`. Usa localStorage si existe. */
class WebStore implements KeyValueStore {
  private memory = new Map<string, unknown>()
  private listeners = new Set<StoreListener>()

  private get backing(): Storage | null {
    try {
      if (
        typeof localStorage !== 'undefined' &&
        typeof localStorage.getItem === 'function' &&
        typeof localStorage.setItem === 'function'
      ) {
        return localStorage
      }
    } catch {
      /* sin acceso a localStorage: memoria pura */
    }
    return null
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    if (this.memory.has(key)) return this.memory.get(key) as T
    try {
      const raw = this.backing?.getItem(key)
      if (raw == null) return fallback
      try {
        return JSON.parse(raw) as T
      } catch {
        return fallback
      }
    } catch {
      /* backend indisponible (lea cuotas, APIs raras): memoria pura */
      return fallback
    }
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {}
    for (const key of keys) {
      const value = await this.get<unknown>(key, undefined)
      if (value !== undefined) out[key] = value
    }
    return out
  }

  async set(key: string, value: unknown): Promise<void> {
    this.memory.set(key, value)
    try {
      this.backing?.setItem(key, JSON.stringify(value))
    } catch {
      /* cuota agotada: nos quedamos con la copia en memoria */
    }
    this.emit([key])
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) await this.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.memory.delete(key)
    this.backing?.removeItem(key)
    this.emit([key])
  }

  async clear(): Promise<void> {
    const keys = [...this.memory.keys()]
    this.memory.clear()
    this.backing?.clear()
    this.emit(keys)
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(keys: string[]): void {
    for (const listener of this.listeners) listener(keys)
  }
}

export const kvStore: KeyValueStore = hasChromeStorage() ? new ChromeStore() : new WebStore()

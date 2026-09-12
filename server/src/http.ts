/**
 * Cliente HTTP del backend.
 *
 * Las tiendas responden con latencias muy dispares y algunas (CheapShark)
 * rechazan peticiones sin User-Agent descriptivo, así que todo el tráfico
 * saliente pasa por aquí: un sitio donde ajustar timeout, identificación y
 * reintentos sin tocar los proveedores.
 */

export const USER_AGENT =
  'RandomGameGenerator/0.1 (+https://github.com/DarkSack/random-game-generator)'

/** UA de navegador: algunos endpoints de storefront filtran clientes no-browser. */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export interface FetchOptions {
  timeoutMs?: number
  /** Usa UA de navegador en lugar del identificativo del proyecto. */
  browserAgent?: boolean
  headers?: Record<string, string>
  /** Reintentos ante fallo de red o 5xx. */
  retries?: number
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 8000, browserAgent = false, headers = {}, retries = 1 } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': browserAgent ? BROWSER_USER_AGENT : USER_AGENT,
          Accept: 'application/json',
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        // 4xx es culpa nuestra: reintentar no arregla una query mal formada.
        if (response.status < 500) {
          throw new HttpError(`HTTP ${response.status}`, response.status, url)
        }
        throw new HttpError(`HTTP ${response.status}`, response.status, url)
      }

      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (error instanceof HttpError && error.status < 500) throw error
      if (attempt === retries) break
      await sleep(250 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Ejecuta promesas con un límite de concurrencia.
 * Las fichas se piden juego a juego (Steam, Nintendo y Xbox no aceptan lotes
 * grandes), y disparar sesenta peticiones a la vez es la forma más rápida de
 * que una tienda nos corte.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null)
  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      try {
        results[index] = await worker(items[index]!, index)
      } catch {
        // Un juego que falla no puede tumbar la recomendación entera.
        results[index] = null
      }
    }
  })

  await Promise.all(runners)
  return results
}

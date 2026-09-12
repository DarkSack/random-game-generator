import { kvStore } from '../storage/kv-store'

/** Contrato de mensajes entre popup, dashboard y service worker. */

export type RuntimeMessage =
  | { type: 'open-dashboard'; view?: string }
  | { type: 'refresh-badge' }

export type RuntimeResponse = { ok: true } | { ok: false; error: string }

const isExtensionContext = () => typeof chrome !== 'undefined' && !!chrome?.runtime?.id

export async function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  if (!isExtensionContext()) return { ok: false, error: 'Fuera del contexto de la extensión' }
  try {
    return (await chrome.runtime.sendMessage(message)) ?? { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Vista que el dashboard debe abrir al arrancar, fijada desde el popup. */
export const PENDING_VIEW_KEY = 'rgg.pendingView'

/**
 * Abre la página completa. Se delega en `openOptionsPage` a propósito: es
 * independiente de cómo el bundler acabe nombrando el HTML compilado.
 */
export async function openDashboard(view?: string): Promise<void> {
  if (!isExtensionContext()) return
  if (view) await kvStore.set(PENDING_VIEW_KEY, view)
  chrome.runtime.openOptionsPage()
}

/** Lee y consume la vista pendiente. */
export async function takePendingView(): Promise<string | null> {
  const view = await kvStore.get<string | null>(PENDING_VIEW_KEY, null)
  if (view) await kvStore.remove(PENDING_VIEW_KEY)
  return view
}

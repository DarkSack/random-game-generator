import type { RuntimeMessage, RuntimeResponse } from '../core/messaging/messages'
import { libraryRepository } from '../core/storage/library-repository'
import { STORAGE_KEYS } from '../core/storage/schema'

/**
 * Service worker (MV3).
 *
 * Deliberadamente delgado: no contiene lógica de negocio, porque el popup y el
 * dashboard leen y escriben contra el mismo repositorio. Aquí solo vive lo que
 * necesita el ciclo de vida de la extensión: migraciones al instalar, el menú
 * contextual y el badge del icono.
 */

const BADGE_COLOR = '#7c5cff'

async function refreshBadge(): Promise<void> {
  try {
    const games = await libraryRepository.getGames()
    const pending = games.filter((game) => game.status === 'backlog' && !game.excluded).length
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR })
    await chrome.action.setBadgeText({ text: pending ? String(Math.min(pending, 999)) : '' })
  } catch {
    /* el badge es cosmético: nunca debe romper el arranque */
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await libraryRepository.ensureSchema()
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'rgg-open-dashboard',
      title: 'Abrir mi biblioteca de juegos',
      contexts: ['action'],
    })
  })
  await refreshBadge()
})

chrome.runtime.onStartup?.addListener(() => {
  void libraryRepository.ensureSchema().then(refreshBadge)
})

chrome.contextMenus?.onClicked.addListener((info) => {
  if (info.menuItemId === 'rgg-open-dashboard') chrome.runtime.openOptionsPage()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEYS.games in changes) void refreshBadge()
})

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (response: RuntimeResponse) => void) => {
    switch (message?.type) {
      case 'open-dashboard':
        chrome.runtime.openOptionsPage()
        sendResponse({ ok: true })
        return false
      case 'refresh-badge':
        void refreshBadge().then(() => sendResponse({ ok: true }))
        return true // respuesta asíncrona
      default:
        sendResponse({ ok: false, error: 'Mensaje desconocido' })
        return false
    }
  },
)

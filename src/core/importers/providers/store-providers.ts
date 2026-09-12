import type { GameDraft } from '../../types/game'
import { ProviderNotImplementedError, type LibraryProvider } from '../types'

/**
 * Definiciones de los proveedores de tiendas. Todas están declaradas pero
 * inactivas: la v1 funciona sin red. Cada entrada documenta qué hará falta
 * (permisos, credenciales) el día que se implemente, para que añadir la
 * integración no obligue a rediseñar nada.
 */

function planned(
  config: Omit<LibraryProvider, 'status' | 'fetchGames'>,
): LibraryProvider {
  return {
    ...config,
    status: 'planned',
    async fetchGames(): Promise<GameDraft[]> {
      throw new ProviderNotImplementedError(config.id)
    },
  }
}

export const STEAM_PROVIDER = planned({
  id: 'steam',
  label: 'Steam',
  emoji: '🟦',
  description:
    'Importa tu biblioteca y las horas jugadas vía IGetOwnedGames. Necesita tu SteamID64 y una API key de Steam.',
  requiredPermissions: ['https://api.steampowered.com/*'],
  fields: [
    { key: 'steamId', label: 'SteamID64', placeholder: '7656119...' },
    { key: 'apiKey', label: 'Steam API key', secret: true, help: 'steamcommunity.com/dev/apikey' },
  ],
})

export const EPIC_PROVIDER = planned({
  id: 'epic',
  label: 'Epic Games',
  emoji: '⬛',
  description: 'Importa la biblioteca desde la cuenta de Epic. Requiere iniciar sesión en el navegador.',
  requiredPermissions: ['https://*.epicgames.com/*'],
  fields: [],
})

export const GOG_PROVIDER = planned({
  id: 'gog',
  label: 'GOG',
  emoji: '🟣',
  description: 'Importa la biblioteca desde embed.gog.com usando la sesión activa de GOG.',
  requiredPermissions: ['https://embed.gog.com/*'],
  fields: [],
})

export const XBOX_PROVIDER = planned({
  id: 'xbox',
  label: 'Xbox / Game Pass',
  emoji: '🟩',
  description: 'Importa juegos y logros desde tu perfil de Xbox Live.',
  requiredPermissions: ['https://*.xboxlive.com/*'],
  fields: [{ key: 'gamertag', label: 'Gamertag' }],
})

export const PLAYSTATION_PROVIDER = planned({
  id: 'playstation',
  label: 'PlayStation',
  emoji: '🔵',
  description: 'Importa tu biblioteca de PSN a partir del token NPSSO de la sesión web.',
  requiredPermissions: ['https://*.playstation.com/*'],
  fields: [{ key: 'npsso', label: 'Token NPSSO', secret: true }],
})

export const NINTENDO_PROVIDER = planned({
  id: 'nintendo',
  label: 'Nintendo',
  emoji: '🔴',
  description:
    'Nintendo no expone una API pública de biblioteca: se importará desde el historial de compras exportado.',
  requiredPermissions: ['https://*.nintendo.com/*'],
  fields: [],
})

export const STORE_PROVIDERS: LibraryProvider[] = [
  STEAM_PROVIDER,
  EPIC_PROVIDER,
  GOG_PROVIDER,
  XBOX_PROVIDER,
  PLAYSTATION_PROVIDER,
  NINTENDO_PROVIDER,
]

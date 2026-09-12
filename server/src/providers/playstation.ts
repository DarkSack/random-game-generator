import { ProviderUnavailableError, type CatalogProvider } from '../provider'

/**
 * Catálogo de PlayStation. Declarado pero no operativo.
 *
 * El storefront de PSN solo acepta *persisted queries*: cada consulta GraphQL
 * debe ir acompañada del hash SHA-256 que Sony tiene en lista blanca, y esos
 * hashes cambian con cada despliegue de su web. Una petición sin hash válido
 * responde `{"message":"Query not whitelisted"}`, comprobado.
 *
 * Se deja declarado, igual que los importadores de biblioteca pendientes, para
 * que aparezca en la respuesta como un fallo explicado y no como una ausencia
 * silenciosa. Implementarlo exigiría una de estas vías:
 *
 * 1. Extraer los hashes del bundle de la web en cada arranque (frágil: se
 *    rompe en cada despliegue de Sony).
 * 2. Usar el feed regional de ofertas de PlayStation Store, más limitado.
 * 3. Una fuente de terceros con licencia de uso.
 */
export const playstationProvider: CatalogProvider = {
  id: 'playstation',
  platform: 'playstation',
  label: 'PlayStation Store',
  status: 'planned',
  unavailableReason:
    'PSN solo admite consultas con hash en lista blanca, y Sony los rota en cada despliegue.',

  async search() {
    throw new ProviderUnavailableError(
      'playstation',
      'PSN solo admite consultas con hash en lista blanca, y Sony los rota en cada despliegue.',
    )
  },
}

import { discover, parseCriteria } from '../src/discover'

/**
 * GET /api/discover
 *
 * Ejemplo:
 *   /api/discover?platforms=pc,switch&genres=rpg,indie&maxPrice=300&region=MX
 *
 * Datos públicos de catálogo, sin credenciales ni estado de usuario: por eso
 * el CORS es abierto y la respuesta se puede cachear en el borde.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...extra },
  })
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request): Promise<Response> {
  const criteria = parseCriteria(new URL(request.url).searchParams)

  try {
    const result = await discover(criteria)
    // Sin ninguna tienda operativa no hay nada que devolver: es un fallo real, no un vacío.
    if (!result.sources.length) {
      return json(result, 502, { 'Cache-Control': 'no-store' })
    }
    return json(result, 200, {
      // 10 min en el borde y 1 h sirviendo copia antigua mientras se regenera.
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    })
  } catch (error) {
    return json(
      { error: 'discover_failed', message: error instanceof Error ? error.message : String(error) },
      500,
      { 'Cache-Control': 'no-store' },
    )
  }
}

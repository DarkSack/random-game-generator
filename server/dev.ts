/**
 * Servidor local para desarrollar la extensión sin desplegar:
 *   npm run api:dev   ->  http://localhost:8787/api/discover?platforms=pc
 *
 * Adapta node:http a la firma Request -> Response que ejecuta Vercel, para
 * probar exactamente el mismo handler que irá a producción.
 */
import { createServer } from 'node:http'
import { GET, OPTIONS } from './api/discover'

const PORT = Number(process.env.PORT ?? 8787)

createServer(async (req, res) => {
  const url = `http://localhost:${PORT}${req.url ?? '/'}`
  if (!url.includes('/api/discover')) {
    res.writeHead(404).end('Not found')
    return
  }
  const request = new Request(url, { method: req.method })
  const response = req.method === 'OPTIONS' ? OPTIONS() : await GET(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(await response.text())
}).listen(PORT, () => console.log(`API local en http://localhost:${PORT}/api/discover`))

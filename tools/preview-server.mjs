/**
 * Servidor estático mínimo para previsualizar la UI compilada sin cargar la
 * extensión en Chrome. Fuera del contexto de extensión, `kv-store` cae a
 * localStorage, así que el dashboard y el popup funcionan igual.
 *
 *   node tools/preview-server.mjs        -> http://localhost:5599
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'chrome')
const PORT = Number(process.env.PORT ?? 5599)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.map': 'application/json; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
    let filePath = join(ROOT, relative || 'options_ui/page.html')

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden')
      return
    }

    const info = await stat(filePath).catch(() => null)
    if (info?.isDirectory()) filePath = join(filePath, 'index.html')

    const body = await readFile(filePath)
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('No encontrado')
  }
})

server.listen(PORT, () => {
  console.log(`Preview en http://localhost:${PORT}/options_ui/page.html`)
  console.log(`Popup en    http://localhost:${PORT}/action/default_popup.html`)
})

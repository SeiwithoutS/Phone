import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStorageHandler } from './storage.js'

const dist = fileURLToPath(new URL('../../dist', import.meta.url))
const port = Number(process.env.PORT ?? 8000)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.')

try {
  await access(resolve(dist, 'index.html'))
} catch {
  console.error('Build EPhone first with npm run build, start.bat, or bash start.sh.')
  process.exit(1)
}

const mime: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

async function serve(request: IncomingMessage, response: ServerResponse) {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405).end()
    return
  }
  let file
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
    file = resolve(dist, pathname === '/' ? 'index.html' : '.' + pathname)
    if (!file.startsWith(dist + sep) || !(await stat(file)).isFile()) throw new Error('File not found')
  } catch {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, {
    'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': file.includes(sep + 'assets' + sep) ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).on('error', () => response.destroy()).pipe(response)
}

const defaultDirectory = fileURLToPath(new URL('../../data/', import.meta.url))
const storage = createStorageHandler(process.env.EEPHONE_DATA_DIR || defaultDirectory)
const server = createServer((request, response) => {
  void storage(request, response, () => { void serve(request, response) })
})
server.on('error', error => {
  console.error(`Could not start EPhone: ${error.message}`)
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => console.log(`EPhone is running at http://127.0.0.1:${port}`))

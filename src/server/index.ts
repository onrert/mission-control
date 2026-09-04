import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distWebDir = path.join(__dirname, '..', '..', 'dist', 'web')
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  version: string
}

/**
 * Node sürümünün desteklenen minimum sürüm (>=20.11) olup olmadığını kontrol eder.
 * Saf fonksiyon: gerçek süreci öldürmeden birim testle doğrulanabilir.
 */
export function isSupportedNodeVersion(version: string): boolean {
  const cleaned = version.startsWith('v') ? version.slice(1) : version
  const parts = cleaned.split('.').map((n) => Number.parseInt(n, 10))
  const major = parts[0] ?? 0
  const minor = parts[1] ?? 0
  if (Number.isNaN(major) || Number.isNaN(minor)) return false
  if (major > 20) return true
  if (major === 20) return minor >= 11
  return false
}

/**
 * `MC_PORT` ortam değişkeninden port numarasını çözer. Geçersiz (sayı olmayan) veya boş/
 * yalnızca boşluk içeren bir değer verilirse varsayılana (7333) düşer ve stderr'e Türkçe bir
 * uyarı basar; süreci durdurmaz. Boş dizge (`Number('') === 0`) özel olarak reddedilir —
 * aksi halde sessizce efemeral porta (0) düşerdi.
 */
export function resolvePort(env: NodeJS.ProcessEnv): number {
  const defaultPort = 7333
  const raw = env.MC_PORT
  if (raw === undefined) return defaultPort
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    process.stderr.write(
      `Uyarı: MC_PORT değeri ("${raw}") geçersiz, varsayılan port ${defaultPort} kullanılıyor.\n`
    )
    return defaultPort
  }
  return parsed
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
}

function handleHealth(res: http.ServerResponse, port: number): void {
  const body = JSON.stringify({
    ok: true,
    version: pkg.version,
    port,
    node: process.version,
    uptime_s: process.uptime(),
  })
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(body)
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const requestUrl = req.url ?? '/'
  const pathname = requestUrl.split('?')[0] ?? '/'
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const filePath = path.join(distWebDir, relativePath)

  const relativeToRoot = path.relative(distWebDir, filePath)
  const isInside =
    relativeToRoot !== '' && !relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot)

  if (!isInside) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not Found')
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not Found')
      return
    }
    const ext = path.extname(filePath)
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'content-type': mime })
    res.end(data)
  })
}

/**
 * HTTP sunucusunu kurar (dinlemeye başlatmaz). `createServer(port).listen` çağıranın
 * sorumluluğundadır — ama bu fabrika fonksiyonu kendisi `listen`'i çağırır, böylece
 * testler `once(server, 'listening')` ile etkin bağlanma adresini ölçebilir.
 */
export function createServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? '/').split('?')[0]
    if (pathname === '/api/health') {
      handleHealth(res, port)
      return
    }
    if (pathname?.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'not_found' }))
      return
    }
    serveStatic(req, res)
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(`Hata: ${port} portu zaten kullanımda. Sunucu başlatılamadı.\n`)
      process.exit(1)
    }
    throw err
  })
  server.listen(port, '127.0.0.1')
  return server
}

function main(): void {
  if (!isSupportedNodeVersion(process.version)) {
    process.stderr.write(
      `Hata: Node ${process.version} desteklenmiyor. Node >=20.11 gerekli.\n`
    )
    process.exit(1)
  }
  const port = resolvePort(process.env)
  const server = createServer(port)
  server.once('listening', () => {
    process.stdout.write(`Mission Control API 127.0.0.1:${port} adresinde dinliyor.\n`)
  })
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  main()
}

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createJsonlStore } from './store/jsonl-store'
import { startRetentionScheduler } from './store/retention'
import { handleIngest } from '../features/events/server/ingest'
import { handleQuery } from '../features/events/server/query'

// QA düzeltme turu 1 (B1 madde f) — güvenlik ağı, ASIL çözüm değil: asıl çözüm `jsonl-store.ts`
// `append`'in kendi hata yakalamasıdır (kuyruk artık asla reddedilmiş kalmaz, `ingest.ts` her
// zaman bir yanıt döner). Bu yalnızca öngörülemeyen bir reddedilmiş promise sızarsa süreci
// Node'un varsayılan `exit(1)` davranışından korur. Modül birden çok kez import edilse bile
// (testler) yalnızca bir kez eklenir.
const UNHANDLED_REJECTION_GUARD = Symbol.for('mission-control.unhandledRejectionGuard')
if (!(globalThis as Record<symbol, boolean>)[UNHANDLED_REJECTION_GUARD]) {
  ;(globalThis as Record<symbol, boolean>)[UNHANDLED_REJECTION_GUARD] = true
  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`Beklenmeyen reddedilen promise (güvenlik ağı, B1): ${String(reason)}\n`)
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distWebDir = path.join(__dirname, '..', '..', 'dist', 'web')
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')
) as {
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

/**
 * Genel amaçlı, negatif olmayan tamsayı ortam değişkeni çözücü (`MC_RING_SIZE`,
 * `MC_RETENTION_DAYS`, `MC_RETENTION_EVENTS`, `MC_MAX_PAYLOAD`). `resolvePort`'un port'a özgü
 * üst sınırı (65535) burada yoktur; geçersiz/boş değer sessizce varsayılana düşer.
 */
export function resolveEnvInt(env: NodeJS.ProcessEnv, key: string, defaultValue: number): number {
  const raw = env[key]
  if (raw === undefined) return defaultValue
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0) return defaultValue
  return parsed
}

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/**
 * DNS-rebinding koruması (mimari §10, ADR-008 karar 1, CEO kararı R-1). **Port bileşeni
 * yok sayılır** — yalnızca ana bilgisayar adı beyaz listelenir (CEO kararı, `docs/qa/
 * F-002-contract.md` "CEO kararı — R-1"). `Host` başlığı yoksa `false`.
 */
export function isAllowedHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false
  const lower = hostHeader.trim().toLowerCase()
  if (lower.startsWith('[')) {
    const end = lower.indexOf(']')
    const bracketed = end === -1 ? lower : lower.slice(0, end + 1)
    return LOOPBACK_HOSTNAMES.has(bracketed)
  }
  const colonIndex = lower.lastIndexOf(':')
  const hostname = colonIndex === -1 ? lower : lower.slice(0, colonIndex)
  return LOOPBACK_HOSTNAMES.has(hostname)
}

const LOOPBACK_ORIGIN_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])

/**
 * Cross-origin CSRF koruması. `Origin` başlığı yoksa `true` (tarayıcı-dışı istemci — `curl`,
 * gelecekteki `send-event.js`). Varsa yalnızca loopback ana bilgisayar adı kabul edilir; port
 * yok sayılır (CEO kararı R-1).
 */
export function isAllowedOrigin(originHeader: string | undefined): boolean {
  if (originHeader === undefined) return true
  let url: URL
  try {
    url = new URL(originHeader)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return LOOPBACK_ORIGIN_HOSTNAMES.has(hostname)
}

function sendForbidden(res: http.ServerResponse): void {
  res.writeHead(403, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      success: false,
      error: { code: 'forbidden_origin', message: 'İstek kaynağı reddedildi.' },
    })
  )
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

function handleHealth(
  res: http.ServerResponse,
  port: number,
  instanceId: string,
  getCorruptLines: () => number,
  getWriteErrors: () => number
): void {
  const body = JSON.stringify({
    ok: true,
    version: pkg.version,
    port,
    node: process.version,
    uptime_s: process.uptime(),
    instance_id: instanceId,
    service: 'mission-control',
    corrupt_lines: getCorruptLines(),
    // QA düzeltme turu 1 (B1 madde e): kalıcı disk yazma hatası sayacı, gözlemlenebilir olsun.
    write_errors: getWriteErrors(),
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
 *
 * `dataDir` verilmezse `MC_DATA_DIR` (veya varsayılan `./data`) kullanılır — bu, F-002'nin
 * JSONL deposunu ve retention zamanlayıcısını burada başlatabilmesi ve AC-5'in aynı veri
 * dizinine karşı iki ayrı sunucu örneği kurabilmesi için gereklidir (sözleşme §2.2/§3 madde 9).
 */
export function createServer(port: number, dataDir?: string): http.Server {
  const resolvedDataDir = dataDir ?? process.env.MC_DATA_DIR ?? path.join(process.cwd(), 'data')
  const instanceId = crypto.randomUUID()

  const store = createJsonlStore(resolvedDataDir, {
    ringSize: resolveEnvInt(process.env, 'MC_RING_SIZE', 2000),
  })
  store.init()

  const stopRetention = startRetentionScheduler(resolvedDataDir, store, {
    retentionDays: resolveEnvInt(process.env, 'MC_RETENTION_DAYS', 30),
    retentionEvents: resolveEnvInt(process.env, 'MC_RETENTION_EVENTS', 20000),
  })

  const maxPayload = resolveEnvInt(process.env, 'MC_MAX_PAYLOAD', 65536)

  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? '/').split('?')[0]

    if (pathname?.startsWith('/api/')) {
      // Host/Origin koruması route dispatch'ten önce, en başta çalışır (sözleşme §3 madde 11).
      if (!isAllowedHost(req.headers.host)) {
        sendForbidden(res)
        return
      }
      if (req.method === 'POST' && pathname === '/api/events') {
        if (!isAllowedOrigin(req.headers.origin)) {
          sendForbidden(res)
          return
        }
      }
    }

    if (pathname === '/api/health') {
      handleHealth(
        res,
        port,
        instanceId,
        () => store.getCorruptLines(),
        () => store.getWriteErrors()
      )
      return
    }
    if (pathname === '/api/events' && req.method === 'GET') {
      handleQuery(req, res, store)
      return
    }
    if (pathname === '/api/events' && req.method === 'POST') {
      handleIngest(req, res, store, maxPayload)
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
  server.on('close', () => {
    stopRetention()
  })
  server.listen(port, '127.0.0.1')
  return server
}

function main(): void {
  if (!isSupportedNodeVersion(process.version)) {
    process.stderr.write(`Hata: Node ${process.version} desteklenmiyor. Node >=20.11 gerekli.\n`)
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

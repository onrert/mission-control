import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import { createJsonlStore } from './store/jsonl-store'
import { startRetentionScheduler } from './store/retention'
import { handleIngest } from '../features/events/server/ingest'
import { handleQuery } from '../features/events/server/query'
import { createSseHub } from './sse/hub'
import { handleStream } from './sse/stream'
import { createProjectsService } from '../features/projects/server/service'
import {
  handleListProjects,
  handleAddProject,
  handleRemoveProject,
} from '../features/projects/server/handlers'
import {
  handleListFeatures,
  handlePatchFeatureStatus,
  handleFeatureDetail,
} from '../features/kanban/server/handlers'
import { createChatSession } from '../features/chat/server/session'
import {
  handleChatStatus,
  handleChatHistory,
  handleChatMessage,
  handleChatInterrupt,
  handleChatPermission,
  handleChatRestart,
} from '../features/chat/server/handlers'
import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../shared/types'

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

/**
 * QA düzeltme turu 1 (BLOKLAYICI-1) — sistemik hata sınırı: dağıtıcıdan (`createServer`'ın
 * `http.createServer` geri çağrımı) SENKRON olarak fırlayan herhangi bir hatayı ("hangi handler
 * olursa olsun") yakalar, istemciye genel bir 500 döner, süreç ASLA `uncaughtException` ile
 * ölmez. Bu, `process.on('uncaughtException')` DEĞİLDİR (CLAUDE.md dersi: o "asıl çözüm olamaz",
 * `src/server/index.ts:19`'daki `unhandledRejection` güvenlik ağı yorumuyla aynı ders) — hata
 * kaynağın kendisinde (dağıtıcıda) yakalanır. Yalnızca dağıtıcının ÇAĞRI YIĞINI içinde senkron
 * fırlayan hataları kapsar; bir istek işleyicisinin kendi olay dinleyicisi (`req.on('end', ...)`
 * gibi, ayrı bir çağrı yığını/event-loop turu) içinde fırlayan asenkron hatalar bu sınırın
 * KAPSAMI DIŞINDADIR — o yol handler'ın kendi kaynağında yakalanır (`handlers.ts`'in
 * `handleAddProject`'i `service.addProject`'i çağırmadan önce `service.ts` bu hatayı zaten
 * yakalayıp asla fırlatmıyor; bu iki katman birlikte hem senkron hem asenkron yolu kapatır,
 * QA düzeltme turu 1 bulgusu). Doğrudan birim testlenebilmesi için export edilir
 * (`isSupportedNodeVersion` emsaliyle aynı stil).
 */
export function withDispatchErrorBoundary(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return (req, res) => {
    try {
      handler(req, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        `Hata: istek işlenirken beklenmeyen hata oluştu, 500 dönülüyor: ${message}\n`
      )
      if (res.headersSent) {
        res.end()
        return
      }
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Beklenmeyen bir sunucu hatası oluştu. Tekrar deneyin.',
          },
        })
      )
    }
  }
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

// ADR-013 + CEO Karar 1 (F-006 sözleşmesi §7): `POST /api/events` `x-mc-write`'tan MUAFTIR
// ama bunun yerine bu içerik tipi zorunludur — allowlist, denylist DEĞİL (CORS güvenli
// listesinin `multipart/form-data` üyesi sessizce geçmesin diye).
const ALLOWED_EVENT_CONTENT_TYPE = 'application/json'

function sendInvalidBody(res: http.ServerResponse): void {
  res.writeHead(400, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      success: false,
      error: { code: 'invalid_body', message: 'İçerik tipi desteklenmiyor.' },
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
  getWriteErrors: () => number,
  getWatcherCount: () => number
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
    // F-005 (sözleşme §7 "izleyici sayacı"): aktif project-watcher sayısı.
    watchers: getWatcherCount(),
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
/**
 * `createServer`'ın döndürdüğü sunucu, F-003'ün `shutdown()`'ının ihtiyaç duyduğu SSE hub'ını
 * da taşır — `main()` (`isMainModule` dalı) bunu `SIGINT`/`SIGTERM`'de kullanır. Sıradan
 * `createServer()` çağıranlar (testler) bu alanı görmezden gelebilir, tip genişlemesi
 * mevcut hiçbir kullanımı bozmaz.
 */
export interface ServerWithHub extends http.Server {
  readonly sseHub: import('./sse/hub').SseHub
  /** F-005 sözleşme §7: izleyici yaşam döngüsünün doğrudan (HTTP'siz) gözlemi için. */
  readonly projectsService: import('../features/projects/server/service').ProjectsService
}

export function createServer(
  port: number,
  dataDir?: string,
  chatQueryOverride?: Parameters<typeof createChatSession>[0]['query']
): ServerWithHub {
  const resolvedDataDir = dataDir ?? process.env.MC_DATA_DIR ?? path.join(process.cwd(), 'data')
  const instanceId = crypto.randomUUID()

  const ringSize = resolveEnvInt(process.env, 'MC_RING_SIZE', 2000)
  const store = createJsonlStore(resolvedDataDir, { ringSize })
  store.init()

  const stopRetention = startRetentionScheduler(resolvedDataDir, store, {
    retentionDays: resolveEnvInt(process.env, 'MC_RETENTION_DAYS', 30),
    retentionEvents: resolveEnvInt(process.env, 'MC_RETENTION_EVENTS', 20000),
  })

  const maxPayload = resolveEnvInt(process.env, 'MC_MAX_PAYLOAD', 65536)
  const hub = createSseHub()
  const projectsService = createProjectsService(resolvedDataDir, hub)

  // F-012 — `deps`'in alan kümesi KAPALI (Ö7): yalnızca bu beşi, `store`/`projectsService`
  // ASLA geçirilmez (K4, olay akışı CEO bağlamına beslenmez). Bootstrap arka planda,
  // engellemeden başlar (sözleşme §3).
  const chatSession = createChatSession({
    query: chatQueryOverride ?? sdkQuery,
    dataDir: resolvedDataDir,
    hub,
    now: () => new Date(),
    env: process.env,
  })
  void chatSession.bootstrap()

  const server = http.createServer(
    withDispatchErrorBoundary((req, res) => {
      const pathname = (req.url ?? '/').split('?')[0]

      if (pathname?.startsWith('/api/')) {
        // Host/Origin koruması route dispatch'ten önce, en başta çalışır (sözleşme §3 madde 11).
        if (!isAllowedHost(req.headers.host)) {
          sendForbidden(res)
          return
        }
        // F-005 sözleşme §3 madde 9: Origin kontrolü artık `POST /api/events` özel-durumundan
        // TÜM non-GET `/api/*` yazma uçlarına genelleşti (F-002 döneminde tek yazma ucu vardı,
        // özel-durum yeterliydi — ikinci/üçüncü yazma ucu eklenince sessizce delinirdi).
        if (req.method !== 'GET' && !isAllowedOrigin(req.headers.origin)) {
          sendForbidden(res)
          return
        }
        // ADR-013 (F-006 sözleşmesi §7) — tek yer, dağıtıcıda, route dispatch'ten önce.
        // `POST /api/events` içerik-tipi allowlist'iyle korunur (CEO Karar 1); diğer tüm
        // non-GET `/api/*` istekleri `x-mc-write` başlığını taşımak zorundadır.
        if (req.method === 'POST' && pathname === '/api/events') {
          const raw = req.headers['content-type']
          const normalized =
            typeof raw === 'string' ? raw.split(';')[0]?.trim().toLowerCase() : undefined
          if (normalized !== ALLOWED_EVENT_CONTENT_TYPE) {
            sendInvalidBody(res)
            return
          }
        } else if (req.method !== 'GET' && req.headers[WRITE_HEADER_NAME] !== WRITE_HEADER_VALUE) {
          sendForbidden(res)
          return
        }
      }

      if (pathname === '/api/health') {
        handleHealth(
          res,
          port,
          instanceId,
          () => store.getCorruptLines(),
          () => store.getWriteErrors(),
          () => projectsService.getActiveWatcherCount()
        )
        return
      }
      if (pathname === '/api/events' && req.method === 'GET') {
        handleQuery(req, res, store)
        return
      }
      if (pathname === '/api/events' && req.method === 'POST') {
        handleIngest(req, res, store, maxPayload, hub)
        return
      }
      if (pathname === '/api/stream' && req.method === 'GET') {
        handleStream(req, res, store, hub, ringSize)
        return
      }
      if (pathname === '/api/projects' && req.method === 'GET') {
        handleListProjects(res, projectsService)
        return
      }
      if (pathname === '/api/projects' && req.method === 'POST') {
        handleAddProject(req, res, projectsService)
        return
      }
      if (pathname === '/api/features' && req.method === 'GET') {
        handleListFeatures(req, res, projectsService)
        return
      }
      // F-013 sözleşme §2 — `/api/features/detail` PATCH prefix eşleşmesinden (`/api/features/`)
      // ÖNCE kontrol edilir; ikisi de farklı pathname/method kombinasyonları olduğu için çakışma
      // yok, ama okunabilirlik için burada, listeleme route'unun hemen altında tutuluyor.
      if (pathname === '/api/features/detail' && req.method === 'GET') {
        handleFeatureDetail(req, res, projectsService)
        return
      }
      if (pathname?.startsWith('/api/features/') && req.method === 'PATCH') {
        // `/api/features/:project_id/:file` — dosya adı `.md` uzantısı taşır, kendi içinde `/`
        // olamaz (write-gate `FILE_NAME_PATTERN`); yalnızca ilk `/`'e kadar project_id, kalanı
        // file (decodeURIComponent handler'da yapılır, sözleşme §4.2 adım 3).
        const rest = pathname.slice('/api/features/'.length)
        const sepIndex = rest.indexOf('/')
        if (sepIndex === -1) {
          res.writeHead(404, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              success: false,
              error: { code: 'not_found', message: 'Proje bulunamadı.' },
            })
          )
          return
        }
        const rawProjectId = rest.slice(0, sepIndex)
        const rawFile = rest.slice(sepIndex + 1)
        handlePatchFeatureStatus(req, res, projectsService, rawProjectId, rawFile)
        return
      }
      if (pathname === '/api/chat/status' && req.method === 'GET') {
        handleChatStatus(res, chatSession)
        return
      }
      if (pathname === '/api/chat/history' && req.method === 'GET') {
        handleChatHistory(req, res, chatSession)
        return
      }
      if (pathname === '/api/chat/message' && req.method === 'POST') {
        handleChatMessage(req, res, chatSession)
        return
      }
      if (pathname === '/api/chat/interrupt' && req.method === 'POST') {
        handleChatInterrupt(req, res, chatSession)
        return
      }
      if (pathname === '/api/chat/permission' && req.method === 'POST') {
        handleChatPermission(req, res, chatSession)
        return
      }
      if (pathname === '/api/chat/restart' && req.method === 'POST') {
        handleChatRestart(req, res, chatSession)
        return
      }
      if (pathname?.startsWith('/api/projects/') && req.method === 'DELETE') {
        const id = pathname.slice('/api/projects/'.length)
        if (id === '' || id.includes('/')) {
          res.writeHead(404, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              success: false,
              error: { code: 'not_found', message: 'Proje bulunamadı.' },
            })
          )
          return
        }
        handleRemoveProject(res, projectsService, id)
        return
      }
      if (pathname?.startsWith('/api/')) {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'not_found' }))
        return
      }
      serveStatic(req, res)
    })
  )
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(`Hata: ${port} portu zaten kullanımda. Sunucu başlatılamadı.\n`)
      process.exit(1)
    }
    throw err
  })
  server.on('close', () => {
    stopRetention()
    projectsService.stopAll()
    chatSession.stopAll()
  })
  server.listen(port, '127.0.0.1')
  return Object.assign(server, { sseHub: hub, projectsService })
}

/**
 * F-003 NOT-3 düzeltmesi: `hub.closeAll()`'ı gerçek bir kapanış yoluna bağlar (ölü kod
 * bırakmamak için, Karpathy §3). `hub.closeAll()` HER ZAMAN `server.close()`'dan ÖNCE
 * çağrılır — ters sıra, açık bir SSE soketi varken `server.close()`'un `'close'` olayını
 * hiç ateşlememesine (dolayısıyla süresiz beklemeye) yol açardı (sözleşme §3 madde 2, Bulgu
 * 1'in kaynağı). Saf/enjekte edilebilir tutulur (`exit` parametresi) — gerçek sinyal
 * göndermeden birim testlenebilir (`tests/server/graceful-shutdown.test.ts`).
 */
export function shutdown(
  server: { close(cb?: () => void): void },
  hub: Pick<import('./sse/hub').SseHub, 'closeAll'>,
  exit: (code: number) => void = process.exit
): void {
  hub.closeAll()
  server.close(() => exit(0))
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
  const onSignal = (): void => {
    process.stdout.write(`Sunucu 127.0.0.1:${port} adresinde kapatılıyor...\n`)
    shutdown(server, server.sseHub)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  main()
}

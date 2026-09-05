import type http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatSseFrame, type SseHub } from './hub'
import type { JsonlStore } from '../store/jsonl-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')
) as { version: string }

const KEEPALIVE_MS = 15000

export type ResyncDecision = { type: 'replay' } | { type: 'resync' } | { type: 'none' }

/**
 * `Last-Event-ID` header'ının ayrıştırma kuralı (sözleşme §4, Bulgu 7 düzeltmesi): yalnızca
 * rakamlardan oluşan, kırpılmamış bir dizge geçerlidir. `Number()`'ın gevşek semantiği
 * (`""` -> 0, `"1e3"` -> 1000, `" 12 "` -> 12) KULLANILMAZ. `Number.MAX_SAFE_INTEGER`'ı aşan
 * bir değer de geçersiz sayılır.
 */
export function parseLastEventId(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  if (!/^[0-9]+$/.test(raw)) return Number.NaN
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(parsed)) return Number.NaN
  return parsed
}

/**
 * Saf karar fonksiyonu (birim testi için dışa aktarılır, sözleşme §2.1). `lastEventId`
 * `undefined` ise header hiç yoktu (ilk bağlanma) — bu, `NaN` (geçersiz header) ile AYNI dal
 * değildir: ilk bağlanmada hiçbir şey yapılmaz (CEO kararı A, ilk yükleme REST'ten gelir),
 * geçersiz/eksik-aralık header'da ise `resync` (kayıpsız taraf) üretilir.
 */
export function computeResyncDecision(
  lastEventId: number | undefined,
  ringBounds: { from: number; to: number } | null
): ResyncDecision {
  if (lastEventId === undefined) return { type: 'none' }
  if (Number.isNaN(lastEventId)) return { type: 'resync' }
  if (ringBounds === null) return { type: 'resync' }
  if (lastEventId < ringBounds.from) return { type: 'resync' }
  if (lastEventId > ringBounds.to) return { type: 'resync' }
  return { type: 'replay' }
}

/**
 * `GET /api/stream` işleyicisi (sözleşme §2.1/§4). Host koruması çağırandan (`index.ts`)
 * miras alınır — bu fonksiyon zaten yalnızca izin verilen istekler için çağrılır.
 */
export function handleStream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  store: JsonlStore,
  hub: SseHub,
  ringSize: number
): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.flushHeaders()

  const ringBounds = store.getRingBounds()

  // `hello` — sözleşme §4: `id:` satırı YOK (Bulgu 2 düzeltmesi).
  res.write(
    formatSseFrame('hello', {
      seq: ringBounds?.to ?? null,
      server_version: pkg.version,
      ring_from: ringBounds?.from ?? null,
    })
  )

  const lastEventId = parseLastEventId(req.headers['last-event-id'] as string | undefined)
  const decision = computeResyncDecision(lastEventId, ringBounds)

  if (decision.type === 'resync') {
    res.write(formatSseFrame('resync', { reason: 'gap' }))
  } else if (decision.type === 'replay' && lastEventId !== undefined) {
    const { events } = store.read(lastEventId, ringSize)
    for (const event of events) {
      res.write(formatSseFrame('event', event, event.seq))
    }
  }

  // Aynı senkron blokta: replay/resync tamamlandıktan hemen sonra hub'a abone ol (sözleşme
  // §3 madde 8) — Node tek iş parçacıklı olduğu için bu pencerede hiçbir broadcast kaybolmaz.
  const unsubscribe = hub.subscribe(res)

  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, KEEPALIVE_MS)
  keepalive.unref()

  req.on('close', () => {
    clearInterval(keepalive)
    unsubscribe()
  })
}

import type http from 'node:http'
import { normalizeEvent } from './normalize'
import type { JsonlStore } from '../../../server/store/jsonl-store'
import type { ApiResponse } from '../../../shared/types'

/** İstek gövdesi üst sınırı — sabit, env ile değiştirilemez (mimari §6.1). */
const MAX_BODY_BYTES = 262144

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * `POST /api/events` işleyicisi: gövdeyi akış hâlinde okur (256 KB aşımında hemen keser,
 * olay hiç kaydedilmez), normalize eder, depoya ekler. Asla 5xx dönmez (PRD F1/AC5).
 */
export function handleIngest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  store: JsonlStore,
  maxPayload: number
): void {
  const chunks: Buffer[] = []
  let totalBytes = 0
  let aborted = false

  req.on('data', (chunk: Buffer) => {
    if (aborted) return
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      aborted = true
      const body: ApiResponse<never> = {
        success: false,
        error: { code: 'invalid_body', message: 'İstek gövdesi çok büyük.' },
      }
      // Yanıt tamamen soket'e yazılana kadar `req.destroy()` çağrılmaz — aksi hâlde istemci
      // (aynı soketi paylaşan) 400 gövdesini hiç göremeden bağlantının kesildiğini görür.
      res.writeHead(400, { 'content-type': 'application/json', connection: 'close' })
      res.end(JSON.stringify(body))
      res.once('finish', () => req.destroy())
      return
    }
    chunks.push(chunk)
  })

  req.on('error', () => {
    aborted = true
  })

  req.on('end', () => {
    if (aborted) return
    void (async () => {
      try {
        const rawBody = Buffer.concat(chunks).toString('utf8')
        const normalized = normalizeEvent(rawBody, new Date(), maxPayload)
        const { seq, id } = await store.append(normalized)
        const body: ApiResponse<{ id: string; seq: number; flags: string[] }> = {
          success: true,
          data: { id, seq, flags: normalized.flags },
        }
        sendJson(res, 202, body)
      } catch (err) {
        // QA düzeltme turu 1 (B1): gerçek bir disk yazma hatası (ör. gün dosyası yolunda bir
        // dizin, disk dolu) — istemci HER ZAMAN bir yanıt alır, süreç çökmez. Bu, PRD F1/AC5'in
        // "5xx dönmez" kuralını ihlal etmez: o kural yalnızca payload kaynaklı sorunlar
        // (eksik/bilinmeyen alan → 202 + missing_fields) içindir, gerçek depolama arızası
        // değil (bkz. `docs/qa/F-002-contract.md` "Kod turu notu — B1"). Olay gerçekten
        // saklanamadığı için 202 dönüp saklandı numarası yapmıyoruz.
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(`Hata: olay saklanamadı, istemciye 503 dönülüyor: ${message}\n`)
        const body: ApiResponse<never> = {
          success: false,
          error: { code: 'storage_unavailable', message: 'Olay şu anda saklanamadı.' },
        }
        sendJson(res, 503, body)
      }
    })()
  })
}

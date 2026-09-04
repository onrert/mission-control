import type http from 'node:http'
import type { JsonlStore } from '../../../server/store/jsonl-store'
import type { ApiResponse, EventRecord } from '../../../shared/types'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

/** `since_seq` yoksa -1 (tüm ring'i kapsar); sayı değilse veya negatifse `'invalid'`. */
export function parseSinceSeq(raw: string | null): number | 'invalid' {
  if (raw === null) return -1
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return 'invalid'
  return n
}

/** `limit` sayı değilse/0'dan küçükse/1000'den büyükse sınıra kırpılır — 400 verilmez. */
export function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  const truncated = Math.trunc(n)
  if (truncated < 1) return DEFAULT_LIMIT
  if (truncated > MAX_LIMIT) return MAX_LIMIT
  return truncated
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** `GET /api/events` işleyicisi — yalnızca `since_seq` + `limit`, kaynak ring buffer. */
export function handleQuery(req: http.IncomingMessage, res: http.ServerResponse, store: JsonlStore): void {
  const url = new URL(req.url ?? '/', 'http://internal.invalid')
  const since = parseSinceSeq(url.searchParams.get('since_seq'))
  if (since === 'invalid') {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: 'invalid_body', message: 'since_seq geçersiz.' },
    }
    sendJson(res, 400, body)
    return
  }
  const limit = parseLimit(url.searchParams.get('limit'))
  const { events, nextSeq } = store.read(since, limit)
  const body: ApiResponse<EventRecord[]> = {
    success: true,
    data: events,
    meta: { total: events.length, next_seq: nextSeq },
  }
  sendJson(res, 200, body)
}

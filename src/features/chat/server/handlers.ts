import type http from 'node:http'
import type { ChatSession } from './session'
import type { ApiResponse, ChatLogEntry, ErrorCode } from '../../../shared/types'

const MAX_BODY_BYTES = 65536

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendError(
  res: http.ServerResponse,
  status: number,
  code: ErrorCode,
  message: string
): void {
  const body: ApiResponse<never> = { success: false, error: { code, message } }
  sendJson(res, status, body)
}

/** `ingest.ts`'in async-IIFE deseniyle BİREBİR aynı — gövdeyi okur, boyutu aşarsa keser. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let aborted = false
    req.on('data', (chunk: Buffer) => {
      if (aborted) return
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        aborted = true
        reject(new Error('body_too_large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('error', (err) => {
      aborted = true
      reject(err)
    })
    req.on('end', () => {
      if (aborted) return
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
  })
}

function chatDisabledOr(res: http.ServerResponse, errorCode: string): boolean {
  if (errorCode === 'chat_disabled') {
    sendError(res, 503, 'chat_disabled', 'Sohbet özelliği kapalı.')
    return true
  }
  return false
}

export function handleChatStatus(res: http.ServerResponse, session: ChatSession): void {
  const body: ApiResponse<ReturnType<ChatSession['getStatus']>> = {
    success: true,
    data: session.getStatus(),
  }
  sendJson(res, 200, body)
}

export function handleChatHistory(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  session: ChatSession
): void {
  try {
    if (!session.getStatus().chat_enabled) {
      sendError(res, 503, 'chat_disabled', 'Sohbet özelliği kapalı.')
      return
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const limitRaw = url.searchParams.get('limit')
    const beforeSeqRaw = url.searchParams.get('before_seq')
    const limit =
      limitRaw !== null && /^[0-9]+$/.test(limitRaw) ? Number.parseInt(limitRaw, 10) : undefined
    const beforeSeq =
      beforeSeqRaw !== null && /^[0-9]+$/.test(beforeSeqRaw)
        ? Number.parseInt(beforeSeqRaw, 10)
        : undefined
    const page = session.getHistoryPage({ limit, beforeSeq })
    const body: ApiResponse<{ entries: ChatLogEntry[]; has_more: boolean }> = {
      success: true,
      data: page,
    }
    sendJson(res, 200, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Hata: sohbet geçmişi okunamadı: ${message}\n`)
    sendError(res, 500, 'internal_error', 'Beklenmeyen bir sunucu hatası oluştu.')
  }
}

export function handleChatMessage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  session: ChatSession
): void {
  void (async () => {
    try {
      const raw = await readBody(req)
      let parsed: unknown
      try {
        parsed = raw === '' ? {} : JSON.parse(raw)
      } catch {
        sendError(res, 400, 'invalid_body', 'Gövde geçerli JSON değil.')
        return
      }
      const text = (parsed as { text?: unknown })?.text
      if (typeof text !== 'string' || text.trim() === '' || text.length > 8000) {
        sendError(
          res,
          400,
          'invalid_body',
          'text 1-8000 karakter arası, boş olmayan bir dize olmalı.'
        )
        return
      }
      const result = session.sendMessage(text)
      if ('errorCode' in result) {
        if (chatDisabledOr(res, result.errorCode)) return
        sendError(res, 503, 'session_not_ready', 'Oturum hazır değil.')
        return
      }
      const body: ApiResponse<{ turn_id: string; queued: boolean }> = {
        success: true,
        data: { turn_id: result.turn_id, queued: true },
      }
      sendJson(res, 202, body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: sohbet mesajı işlenemedi: ${message}\n`)
      sendError(res, 500, 'internal_error', 'Beklenmeyen bir sunucu hatası oluştu.')
    }
  })()
}

export function handleChatInterrupt(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  session: ChatSession
): void {
  void (async () => {
    try {
      await readBody(req)
      const result = await session.interrupt()
      if ('errorCode' in result) {
        if (chatDisabledOr(res, result.errorCode)) return
        sendError(res, 409, 'no_active_turn', 'Şu anda işlenen bir tur yok.')
        return
      }
      const body: ApiResponse<{ interrupted: true }> = {
        success: true,
        data: { interrupted: true },
      }
      sendJson(res, 200, body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: kesme isteği işlenemedi: ${message}\n`)
      sendError(res, 500, 'internal_error', 'Beklenmeyen bir sunucu hatası oluştu.')
    }
  })()
}

export function handleChatPermission(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  session: ChatSession
): void {
  void (async () => {
    try {
      const raw = await readBody(req)
      let parsed: unknown
      try {
        parsed = raw === '' ? {} : JSON.parse(raw)
      } catch {
        sendError(res, 400, 'invalid_body', 'Gövde geçerli JSON değil.')
        return
      }
      const requestId = (parsed as { request_id?: unknown })?.request_id
      if (typeof requestId !== 'string' || requestId === '') {
        sendError(res, 400, 'invalid_body', 'request_id zorunlu.')
        return
      }
      const result = (parsed as { result?: unknown })?.result
      const outcome = session.resolvePermission(requestId, result)
      if ('errorCode' in outcome) {
        if (chatDisabledOr(res, outcome.errorCode)) return
        sendError(res, 404, 'request_not_found', 'Bilinen bir bekleyen izin isteği değil.')
        return
      }
      const body: ApiResponse<{ resolved: true }> = { success: true, data: { resolved: true } }
      sendJson(res, 200, body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: izin yanıtı işlenemedi: ${message}\n`)
      sendError(res, 500, 'internal_error', 'Beklenmeyen bir sunucu hatası oluştu.')
    }
  })()
}

export function handleChatRestart(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  session: ChatSession
): void {
  void (async () => {
    try {
      await readBody(req)
      const result = await session.restart()
      if ('errorCode' in result) {
        if (chatDisabledOr(res, result.errorCode)) return
        sendError(res, 500, 'internal_error', 'Oturum yeniden başlatılamadı.')
        return
      }
      const body: ApiResponse<{ session_id: string | undefined }> = {
        success: true,
        data: { session_id: result.session_id },
      }
      sendJson(res, 200, body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: yeniden başlatma isteği işlenemedi: ${message}\n`)
      sendError(res, 500, 'internal_error', 'Beklenmeyen bir sunucu hatası oluştu.')
    }
  })()
}

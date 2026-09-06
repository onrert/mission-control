import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { createServer } from '../../src/server/index'
import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../../src/shared/types'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { createFakeQueryFactory, type FakeQueryHandle } from '../helpers/fake-chat-query'
import { connectSse } from '../helpers/sse-client'

// F-012 sözleşme §4/§11 — gerçek `createServer()` + gerçek HTTP + enjekte edilmiş sahte
// `query()`. Hiçbir test gerçek `@anthropic-ai/claude-agent-sdk` `query()`'sini çağırmaz
// (bkz. `tests/setup/chat-disabled-by-default.ts` — bu dosya `MC_CHAT_ENABLED='1'`'i her
// testte açıkça set eder, ama `createServer`'ın 3. parametresi her zaman sahte factory'dir).

type FakeFactory = ReturnType<typeof createFakeQueryFactory>

interface ServerHandle {
  server: ReturnType<typeof createServer>
  port: number
  base: string
}

async function startServer(
  dataDir: string,
  queryFn?: FakeFactory['queryFn']
): Promise<ServerHandle> {
  const server = createServer(0, dataDir, queryFn)
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  return { server, port: address.port, base: `http://127.0.0.1:${address.port}` }
}

async function stopServer(handle: ServerHandle): Promise<void> {
  handle.server.closeAllConnections()
  handle.server.close()
  await once(handle.server, 'close')
}

function writeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'content-type': 'application/json', [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE, ...extra }
}

let dataDir: string
let previousChatEnabled: string | undefined

beforeEach(() => {
  previousChatEnabled = process.env.MC_CHAT_ENABLED
  process.env.MC_CHAT_ENABLED = '1'
  dataDir = createTempDataDir()
})

afterEach(async () => {
  // history-log.ts'in yazma kuyruğu fire-and-forget'tir (session.test.ts'in aynı deseni) —
  // dataDir'i hemen silmek kuyrukta bekleyen bir `appendFile`'ı ENOENT'e düşürüp gürültülü ama
  // zararsız bir stderr satırı üretir; kısa bir bekleme bunu önler.
  await new Promise((resolve) => setTimeout(resolve, 30))
  removeTempDataDir(dataDir)
  if (previousChatEnabled === undefined) delete process.env.MC_CHAT_ENABLED
  else process.env.MC_CHAT_ENABLED = previousChatEnabled
})

describe('chat API — AC1/mutasyon 6 (x-mc-write)', () => {
  it('POST /api/chat/message — x-mc-write yoksa 403, varsa 202 + turn_id döner', async () => {
    const { queryFn } = createFakeQueryFactory()
    const handle = await startServer(dataDir, queryFn)
    try {
      const noHeader = await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'merhaba' }),
      })
      expect(noHeader.status).toBe(403)

      const res = await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ text: 'merhaba' }),
      })
      expect(res.status).toBe(202)
      const body = (await res.json()) as {
        success: boolean
        data: { turn_id: string; queued: boolean }
      }
      expect(body.success).toBe(true)
      expect(body.data.queued).toBe(true)
      expect(typeof body.data.turn_id).toBe('string')
    } finally {
      await stopServer(handle)
    }
  })

  it('POST /api/chat/interrupt, /permission, /restart — x-mc-write yoksa 403', async () => {
    const handle = await startServer(dataDir)
    try {
      for (const p of ['/api/chat/interrupt', '/api/chat/permission', '/api/chat/restart']) {
        const res = await fetch(`${handle.base}${p}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        expect(res.status).toBe(403)
      }
    } finally {
      await stopServer(handle)
    }
  })

  it('GET /api/chat/status, /api/chat/history — header olmadan da servis edilir (GET muaf)', async () => {
    const handle = await startServer(dataDir)
    try {
      const statusRes = await fetch(`${handle.base}/api/chat/status`)
      expect(statusRes.status).toBe(200)
      const historyRes = await fetch(`${handle.base}/api/chat/history`)
      expect(historyRes.status).toBe(200)
    } finally {
      await stopServer(handle)
    }
  })
})

describe('chat API — mutasyon 2 (env bariyeri görünür şekilde raporlanır)', () => {
  it('ANTHROPIC_API_KEY temizlenir ve /api/chat/status bunu görünür şekilde raporlar', async () => {
    const previousKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-test-secret'
    try {
      const handle = await startServer(dataDir)
      try {
        const res = await fetch(`${handle.base}/api/chat/status`)
        const body = (await res.json()) as {
          data: { api_key_barrier_tripped: boolean; stripped_env_vars: string[] }
        }
        expect(body.data.api_key_barrier_tripped).toBe(true)
        expect(body.data.stripped_env_vars).toContain('ANTHROPIC_API_KEY')
      } finally {
        await stopServer(handle)
      }
    } finally {
      if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY
      else process.env.ANTHROPIC_API_KEY = previousKey
    }
  })
})

describe('chat API — mutasyon 5 (canUseTool bekler, K3)', () => {
  it('izin isteği SSE ile yayınlanır, /api/chat/permission çağrılana kadar sonuçlanmaz', async () => {
    const { queryFn, getHandles } = createFakeQueryFactory()
    const handle = await startServer(dataDir, queryFn)
    try {
      const sse = await connectSse(handle.port)
      await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ text: 'bir komut çalıştır' }),
      })

      const fakeHandles: FakeQueryHandle[] = getHandles()
      expect(fakeHandles).toHaveLength(1)
      const fake = fakeHandles[0]!

      let resolvedResult: unknown
      const permPromise = fake.options!.canUseTool!(
        'Bash',
        { command: 'echo hi' },
        {
          signal: new AbortController().signal,
          toolUseID: 'tu1',
          requestId: 'req-1',
        }
      ).then((r) => {
        resolvedResult = r
      })

      const requestFrame = await sse.waitForFrame((f) => f.event === 'chat_permission_request')
      const requestData = JSON.parse(requestFrame.data) as { request_id: string }
      expect(requestData.request_id).toBe('req-1')

      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(resolvedResult).toBeUndefined()

      const permRes = await fetch(`${handle.base}/api/chat/permission`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ request_id: 'req-1', result: { behavior: 'allow' } }),
      })
      expect(permRes.status).toBe(200)
      await permPromise
      expect(resolvedResult).toEqual({ behavior: 'allow' })

      const resolvedFrame = await sse.waitForFrame((f) => f.event === 'chat_permission_resolved')
      const resolvedData = JSON.parse(resolvedFrame.data) as { outcome: string }
      expect(resolvedData.outcome).toBe('allow')

      sse.close()
    } finally {
      await stopServer(handle)
    }
  })
})

describe("chat API — mutasyon 7 (asenkron handler kendi try/catch'ini taşır)", () => {
  it('bozuk JSON gövdesi 2 saniye içinde 400 döner, asılı kalmaz (iç try/catch)', async () => {
    const handle = await startServer(dataDir)
    try {
      const start = Date.now()
      const res = await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: '{ bozuk json',
      })
      const elapsed = Date.now() - start
      expect(res.status).toBe(400)
      expect(elapsed).toBeLessThan(2000)
    } finally {
      await stopServer(handle)
    }
  })

  // Yukarıdaki test yalnızca `JSON.parse`'ın kendi İÇ try/catch'ini ölçer (mutasyon 7 dış
  // try/catch'i kaldırırsa bile bu test yeşil kalır — dış try/catch'i gerçekten ölçmek için
  // hatanın İÇ try'ın dışında (readBody'nin `body_too_large` reddi) oluşması gerekir).
  it('65536 baytı aşan gövde 2 saniye içinde yanıtlanır, asılı kalmaz (dış try/catch)', async () => {
    const handle = await startServer(dataDir)
    try {
      const oversized = JSON.stringify({ text: 'x'.repeat(70000) })
      const start = Date.now()
      const res = await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: oversized,
      })
      const elapsed = Date.now() - start
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(elapsed).toBeLessThan(2000)
    } finally {
      await stopServer(handle)
    }
  })
})

describe("chat API — mutasyon 12 (chat_tool kapalı alan allowlist'i, B7/S2)", () => {
  it('chat_tool yayını yalnızca izin verilen alanları taşır', async () => {
    const { queryFn, getHandles } = createFakeQueryFactory()
    const handle = await startServer(dataDir, queryFn)
    try {
      const sse = await connectSse(handle.port)
      await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ text: 'çalıştır' }),
      })
      const fake = getHandles()[0]!
      fake.emit({
        type: 'assistant',
        parent_tool_use_id: null,
        message: {
          content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { description: 'test' } }],
        },
      })
      const frame = await sse.waitForFrame((f) => f.event === 'chat_tool')
      const data = JSON.parse(frame.data) as Record<string, unknown>
      const allowed = new Set([
        'tool_use_id',
        'tool_name',
        'description',
        'status',
        'elapsed_ms',
        'parent_tool_use_id',
      ])
      for (const key of Object.keys(data)) {
        expect(allowed.has(key)).toBe(true)
      }
      sse.close()
    } finally {
      await stopServer(handle)
    }
  })
})

describe('chat API — AC7 (kalıcı geçmiş)', () => {
  it('mesaj gönderildikten sonra /api/chat/history bu turu döner', async () => {
    const { queryFn } = createFakeQueryFactory()
    const handle = await startServer(dataDir, queryFn)
    try {
      await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ text: 'merhaba' }),
      })
      const res = await fetch(`${handle.base}/api/chat/history?limit=10`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        data: { entries: Array<{ text?: string }>; has_more: boolean }
      }
      expect(body.data.entries.length).toBeGreaterThan(0)
      expect(body.data.entries.some((e) => e.text === 'merhaba')).toBe(true)
    } finally {
      await stopServer(handle)
    }
  })
})

describe('chat API — AC8 (oturum çökse bile panel ayakta kalır)', () => {
  it('sahte query hata fırlatınca /api/health hâlâ 200 döner', async () => {
    const { queryFn, getHandles } = createFakeQueryFactory()
    const handle = await startServer(dataDir, queryFn)
    try {
      const fake = getHandles()[0]!
      fake.throwError(new Error('boom'))
      await new Promise((resolve) => setTimeout(resolve, 30))
      const res = await fetch(`${handle.base}/api/health`)
      expect(res.status).toBe(200)
    } finally {
      await stopServer(handle)
    }
  })
})

describe('chat API — mutasyon 9 / AC10 (MC_CHAT_ENABLED=0 zarif davranış)', () => {
  beforeEach(() => {
    process.env.MC_CHAT_ENABLED = '0'
  })

  it('GET /api/chat/status → 200, chat_enabled:false', async () => {
    const handle = await startServer(dataDir)
    try {
      const res = await fetch(`${handle.base}/api/chat/status`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { data: { chat_enabled: boolean } }
      expect(body.data.chat_enabled).toBe(false)
    } finally {
      await stopServer(handle)
    }
  })

  it('GET /api/chat/history → 503 chat_disabled', async () => {
    const handle = await startServer(dataDir)
    try {
      const res = await fetch(`${handle.base}/api/chat/history`)
      expect(res.status).toBe(503)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('chat_disabled')
    } finally {
      await stopServer(handle)
    }
  })

  // `errorCode: 'session_not_ready'` de 503 döner (handlers.ts) — yalnızca durum kodunu
  // kontrol etmek `isChatEnabled` kaldırılırsa (mutasyon 9) hâlâ 503 verip yeşil kalabilir
  // (totoloji, D9 uyarısı). Gövdedeki `error.code`'un gerçekten `chat_disabled` OLDUĞUNU da
  // assert ederek bu ayrım netleştirilir.
  it("POST /api/chat/message, /interrupt, /permission, /restart → 503 error.code:'chat_disabled' (500/çökme değil)", async () => {
    const handle = await startServer(dataDir)
    try {
      const msgRes = await fetch(`${handle.base}/api/chat/message`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ text: 'x' }),
      })
      expect(msgRes.status).toBe(503)
      expect(((await msgRes.json()) as { error: { code: string } }).error.code).toBe(
        'chat_disabled'
      )

      const intRes = await fetch(`${handle.base}/api/chat/interrupt`, {
        method: 'POST',
        headers: writeHeaders(),
        body: '{}',
      })
      expect(intRes.status).toBe(503)
      expect(((await intRes.json()) as { error: { code: string } }).error.code).toBe(
        'chat_disabled'
      )

      const permRes = await fetch(`${handle.base}/api/chat/permission`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ request_id: 'x' }),
      })
      expect(permRes.status).toBe(503)
      expect(((await permRes.json()) as { error: { code: string } }).error.code).toBe(
        'chat_disabled'
      )

      const restartRes = await fetch(`${handle.base}/api/chat/restart`, {
        method: 'POST',
        headers: writeHeaders(),
        body: '{}',
      })
      expect(restartRes.status).toBe(503)
      expect(((await restartRes.json()) as { error: { code: string } }).error.code).toBe(
        'chat_disabled'
      )
    } finally {
      await stopServer(handle)
    }
  })
})

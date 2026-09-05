import { afterEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import net from 'node:net'
import http from 'node:http'
import { createServer } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { runHook, SEND_EVENT_SCRIPT_PATH } from '../helpers/emit-hook'

interface ServerHandle {
  server: http.Server
  port: number
  baseUrl: string
}

async function startServer(dataDir: string): Promise<ServerHandle> {
  const server = createServer(0, dataDir)
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  return { server, port: address.port, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function stopServer(handle: ServerHandle): Promise<void> {
  handle.server.close()
  await once(handle.server, 'close')
}

interface RecordedEvent {
  hook_event_name: string
  transcript_path?: string
  summary: string
  flags: string[]
  raw: Record<string, unknown>
}

async function getEvents(baseUrl: string): Promise<RecordedEvent[]> {
  const res = await fetch(`${baseUrl}/api/events`)
  const body = (await res.json()) as { data: RecordedEvent[] }
  return body.data
}

async function getEventCount(baseUrl: string): Promise<number> {
  const res = await fetch(`${baseUrl}/api/events`)
  const body = (await res.json()) as { meta: { total: number } }
  return body.meta.total
}

/** Genuinely closed port — nothing is listening, real ECONNREFUSED. */
async function getClosedPort(): Promise<number> {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('beklenmeyen adres türü')
  const port = address.port
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

/** Accepts a connection and immediately destroys the socket -> ECONNRESET on the client side. */
function startResetServer(): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on('error', () => {})
      socket.destroy()
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('beklenmeyen adres türü')
      resolve({ server, port: address.port })
    })
  })
}

/**
 * Accepts a connection and never writes a single byte -> only the idle guard can save us.
 * `socketLifetimeMs` resolves with the real wall-clock time between TCP accept and socket close
 * (i.e. when the script's process exit closes its end of the connection) — measured from the
 * connection itself, so it is unaffected by Node process-startup jitter. Used to tell the idle
 * guard (~100ms) apart from the idle-independent total guard (~150ms) — bulgu Ö1. `socket.resume()`
 * is required: an unconsumed (paused) incoming stream can delay/suppress the socket's own
 * `'close'` event, independent of when the remote side actually closes the connection.
 */
function startSilentServer(): Promise<{
  server: net.Server
  port: number
  socketLifetimeMs: Promise<number>
}> {
  return new Promise((resolve) => {
    let resolveLifetime: (ms: number) => void
    const socketLifetimeMs = new Promise<number>((res) => {
      resolveLifetime = res
    })
    const server = net.createServer((socket) => {
      const acceptedAt = Date.now()
      socket.on('error', () => {})
      socket.resume()
      socket.on('close', () => resolveLifetime(Date.now() - acceptedAt))
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('beklenmeyen adres türü')
      resolve({ server, port: address.port, socketLifetimeMs })
    })
  })
}

/**
 * Accepts a connection and drips one byte every 40ms *forever* (no upper bound) until the
 * client closes the socket — only the idle-independent total-time guard can save us here
 * (40ms < 100ms idle threshold, so the idle guard never fires). Server-side `socket.on('error')`
 * is required (QA tur2 "Kod turuna devredilen notlar" madde 1): once the script exits it closes
 * its end, and further `socket.write()` calls would otherwise crash this test process.
 *
 * `socketLifetimeMs` resolves with the real wall-clock time between TCP accept and socket close
 * (i.e. when the script's process exit closes its end of the connection) — measured from the
 * connection itself, so it is unaffected by Node process-startup jitter. Used as a lower-bound
 * proof that the script really lived until the total-time guard (~150ms), not until the orphaned
 * stdin guard (~120ms) — bulgu B1.
 */
function startDripServer(): Promise<{
  server: net.Server
  port: number
  socketLifetimeMs: Promise<number>
}> {
  return new Promise((resolve) => {
    let resolveLifetime: (ms: number) => void
    const socketLifetimeMs = new Promise<number>((res) => {
      resolveLifetime = res
    })
    const server = net.createServer((socket) => {
      const acceptedAt = Date.now()
      socket.on('error', () => {})
      socket.resume()
      // A valid status line + an unterminated header keeps Node's HTTP parser waiting for
      // more (no parse error, no completed headers, no `response` event) while each written
      // byte still counts as socket activity for the idle guard. Raw non-HTTP bytes would
      // trigger an immediate `req.on('error')` HTTP parse error instead of exercising the
      // total-time guard.
      socket.write('HTTP/1.1 200 OK\r\nX-Drip: ')
      const interval = setInterval(() => {
        if (socket.destroyed) {
          clearInterval(interval)
          return
        }
        socket.write('x')
      }, 40)
      socket.on('close', () => {
        clearInterval(interval)
        resolveLifetime(Date.now() - acceptedAt)
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('beklenmeyen adres türü')
      resolve({ server, port: address.port, socketLifetimeMs })
    })
  })
}

describe('AC1: geçerli payload → sunucuya 202, transcript_path korunur', () => {
  it('gerçek sunucuya POST 403 almaz, transcript_path ve summary doğru kaydedilir', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const payload = {
        hook_event_name: 'PreToolUse',
        cwd: 'C:\\dev\\apps\\demo',
        session_id: 's1',
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        transcript_path: 'C:\\Users\\pc\\.claude\\projects\\abc\\session.jsonl',
      }
      const result = await runHook(JSON.stringify(payload), {
        env: { MC_PORT: String(handle.port) },
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')

      const events = await getEvents(handle.baseUrl)
      expect(events).toHaveLength(1)
      expect(events[0]?.hook_event_name).toBe('PreToolUse')
      expect(events[0]?.transcript_path).toBe(payload.transcript_path)
      expect(events[0]?.summary).toBe('npm test')
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })
})

describe('AC2: sunucuya erişilemezse hata basmaz, oturumu bloklamaz, exit 0', () => {
  it('ECONNREFUSED — kapalı port', async () => {
    const port = await getClosedPort()
    const result = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
      env: { MC_PORT: String(port) },
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    // Sert kapı (CI-güvenli): 1000 ms aşılırsa gerçek bir gerileme var demektir (ADR-006 eşiği).
    expect(result.elapsedMs).toBeLessThan(1000)
  })

  it('ECONNRESET — sunucu bağlantıyı hemen kesiyor', async () => {
    const { server, port } = await startResetServer()
    try {
      const result = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
        env: { MC_PORT: String(port) },
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.elapsedMs).toBeLessThan(1000)
    } finally {
      server.close()
    }
  })

  it('sessiz sunucu (a) — yalnızca idle bekçisi tetiklenir', async () => {
    const { server, port, socketLifetimeMs } = await startSilentServer()
    try {
      const result = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
        env: { MC_PORT: String(port) },
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.elapsedMs).toBeLessThan(1000)
      // Üst sınır (ayırt edici, bulgu Ö1): idle bekçisi (~100ms) toplam bekçiden (~150ms) ÖNCE
      // ateşlemeli. `req.setTimeout(IDLE_TIMEOUT_MS, …)` kaldırılırsa yalnızca toplam bekçi
      // kalır ve bağlantı ~150ms+ yaşar — eşik ikisini ayırır (QA F-004-2026-09-05.md §6:
      // düzeltme yerinde 153-175ms ölçülmüştü; idle çalışıyorsa bundan belirgin şekilde erken
      // kapanmalıdır).
      const lifetimeMs = await socketLifetimeMs
      expect(lifetimeMs).toBeLessThan(145)
    } finally {
      server.close()
    }
  })

  it('damla sunucu (b) — yalnızca toplam süre bekçisi tetiklenir', async () => {
    const { server, port, socketLifetimeMs } = await startDripServer()
    try {
      const result = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
        env: { MC_PORT: String(port) },
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.elapsedMs).toBeLessThan(1000)
      // Alt sınır (bulgu B1): bağlantı TCP kabulünden sokete kadar gerçekten toplam süre
      // bekçisine (TOTAL_TIMEOUT_MS=150ms) kadar yaşamalı. `stdin.on('end', …)` içindeki
      // `clearTimeout(stdinGuard)` satırı silinirse yetim stdin zamanlayıcısı süreci ~120ms'de
      // erken sonlandırır — bu ölçüm (spawn'dan değil, TCP kabulünden itibaren) Node soğuk
      // başlangıç jitter'ından bağımsızdır. QA'nın ölçtüğü ampirik dağılım (F-004-2026-09-05.md
      // §6): düzeltme yerinde 153-175ms, mutasyonlu 118-141ms — 145ms eşiği ikisini ~8ms payla
      // net ayırır.
      const lifetimeMs = await socketLifetimeMs
      expect(lifetimeMs).toBeGreaterThanOrEqual(145)
    } finally {
      server.close()
    }
  })

  it('503 dönen sunucu (gerçek F-002 davranışı) — durum kodu hiç okunmaz, yine exit 0', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const eventsDir = `${dataDir}/events`
      fs.mkdirSync(eventsDir, { recursive: true })
      const now = new Date()
      const dayFileName = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}.jsonl`
      // Gün dosyası adında bir DİZİN oluştur — F-002'nin B1 senaryosuyla birebir aynı, sunucu
      // gerçekten 503 storage_unavailable döner.
      fs.mkdirSync(`${eventsDir}/${dayFileName}`)

      const result = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
        env: { MC_PORT: String(handle.port) },
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.elapsedMs).toBeLessThan(1000)
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })

  it('(c) stdin hiç kapanmıyor — stdin bekçisi tetiklenir, hiç ağ isteği gönderilmez', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const before = await getEventCount(handle.baseUrl)
      const result = await runHook('', { env: { MC_PORT: String(handle.port) }, closeStdin: false })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.elapsedMs).toBeLessThan(1000)
      const after = await getEventCount(handle.baseUrl)
      expect(after).toBe(before)
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })
})

describe('AC3: eksik/bilinmeyen/bozuk alanlarda çökmez', () => {
  let dataDir: string
  let handle: ServerHandle

  afterEach(async () => {
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('boş stdin → yine 202', async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
    const result = await runHook('', { env: { MC_PORT: String(handle.port) } })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    const events = await getEvents(handle.baseUrl)
    expect(events).toHaveLength(1)
    expect(events[0]?.flags).toContain('missing_fields')
  })

  it('bilinmeyen alanlar (ör. x_custom_field) sunucudaki raw da görünür', async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
    const result = await runHook(
      JSON.stringify({
        hook_event_name: 'PreToolUse',
        cwd: 'C:\\dev\\apps\\demo',
        x_custom_field: 'xyz123',
      }),
      { env: { MC_PORT: String(handle.port) } }
    )
    expect(result.exitCode).toBe(0)
    const events = await getEvents(handle.baseUrl)
    expect(events[0]?.raw.x_custom_field).toBe('xyz123')
  })

  it('bozuk JSON stdin → 202 + sunucuda raw.raw_text görünür', async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
    const malformed = '{ this is not valid json'
    const result = await runHook(malformed, { env: { MC_PORT: String(handle.port) } })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    const events = await getEvents(handle.baseUrl)
    expect(events).toHaveLength(1)
    expect(events[0]?.hook_event_name).toBe('unknown')
    expect(events[0]?.raw.raw_text).toBe(malformed)
  })
})

describe("AC6 smoke: emit-hook.ts ile sahte payload, GET /api/events'te görünür", () => {
  it('sahte hook payload çalıştırılınca olay sunucuda görünür', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const before = await getEventCount(handle.baseUrl)
      const result = await runHook(
        JSON.stringify({
          hook_event_name: 'UserPromptSubmit',
          cwd: 'C:\\dev\\apps\\demo',
          user_input: 'merhaba',
        }),
        { env: { MC_PORT: String(handle.port) } }
      )
      expect(result.exitCode).toBe(0)
      const after = await getEventCount(handle.baseUrl)
      expect(after).toBe(before + 1)
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })
})

describe('MC_DISABLE=1', () => {
  it('MC_DISABLE=1 → sunucuya hiç istek gitmez (pozitif kontrol: önce +1, sonra değişmez)', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const before = await getEventCount(handle.baseUrl)
      const enabledResult = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
        env: { MC_PORT: String(handle.port) },
      })
      expect(enabledResult.exitCode).toBe(0)
      const afterEnabled = await getEventCount(handle.baseUrl)
      expect(afterEnabled).toBe(before + 1)

      const disabledResult = await runHook(JSON.stringify({ hook_event_name: 'PreToolUse' }), {
        env: { MC_PORT: String(handle.port), MC_DISABLE: '1' },
      })
      expect(disabledResult.exitCode).toBe(0)
      expect(disabledResult.stdout).toBe('')
      expect(disabledResult.stderr).toBe('')
      const afterDisabled = await getEventCount(handle.baseUrl)
      expect(afterDisabled).toBe(afterEnabled)
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })
})

describe('MC_MAX_PAYLOAD aşımı — Karar C kompakt zarf', () => {
  it('200 KB tool_input (Bash) → istemci kırpar, olay kaydedilir, summary boş değil', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const bigCommand = 'x'.repeat(200_000)
      const payload = {
        hook_event_name: 'PreToolUse',
        cwd: 'C:\\dev\\apps\\demo',
        tool_name: 'Bash',
        tool_input: { command: bigCommand },
      }
      const result = await runHook(JSON.stringify(payload), {
        env: { MC_PORT: String(handle.port) },
      })
      expect(result.exitCode).toBe(0)
      const events = await getEvents(handle.baseUrl)
      expect(events).toHaveLength(1)
      expect(events[0]?.raw.mc_client_truncated).toBe(true)
      expect(events[0]?.summary).not.toBe('')
      expect(events[0]?.summary).toBe(bigCommand.slice(0, 200))
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })

  it('200 KB user_input (UserPromptSubmit) → aynı doğrulama', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const bigInput = 'y'.repeat(200_000)
      const payload = {
        hook_event_name: 'UserPromptSubmit',
        cwd: 'C:\\dev\\apps\\demo',
        user_input: bigInput,
      }
      const result = await runHook(JSON.stringify(payload), {
        env: { MC_PORT: String(handle.port) },
      })
      expect(result.exitCode).toBe(0)
      const events = await getEvents(handle.baseUrl)
      expect(events).toHaveLength(1)
      expect(events[0]?.raw.mc_client_truncated).toBe(true)
      expect(events[0]?.summary).not.toBe('')
      expect(events[0]?.summary).toBe(bigInput.slice(0, 200))
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })

  it('400 KB tool_input → istemci önceden kırpar, sunucu 400 hiç almaz, olay kaydedilir', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const huge = 'z'.repeat(400_000)
      const payload = {
        hook_event_name: 'PreToolUse',
        cwd: 'C:\\dev\\apps\\demo',
        tool_name: 'Bash',
        tool_input: { command: huge },
      }
      const result = await runHook(JSON.stringify(payload), {
        env: { MC_PORT: String(handle.port) },
      })
      expect(result.exitCode).toBe(0)
      const events = await getEvents(handle.baseUrl)
      expect(events).toHaveLength(1)
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })

  it('MC_MAX_PAYLOAD=0 → her olay zarfa düşer, summary yine dolu kalır', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    try {
      const payload = {
        hook_event_name: 'PreToolUse',
        cwd: 'C:\\dev\\apps\\demo',
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
      }
      const result = await runHook(JSON.stringify(payload), {
        env: { MC_PORT: String(handle.port), MC_MAX_PAYLOAD: '0' },
      })
      expect(result.exitCode).toBe(0)
      const events = await getEvents(handle.baseUrl)
      expect(events).toHaveLength(1)
      expect(events[0]?.raw.mc_client_truncated).toBe(true)
      expect(events[0]?.summary).toBe('npm test')
    } finally {
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })
})

describe('zamanlayıcı sabitleri (deterministik, saat kullanmaz)', () => {
  it('stdin=120 · idle=100 · toplam=150 sabitleri script kaynağında tanımlı', () => {
    const source = fs.readFileSync(SEND_EVENT_SCRIPT_PATH, 'utf8')
    expect(source).toMatch(/STDIN_TIMEOUT_MS\s*=\s*120\b/)
    expect(source).toMatch(/IDLE_TIMEOUT_MS\s*=\s*100\b/)
    expect(source).toMatch(/TOTAL_TIMEOUT_MS\s*=\s*150\b/)
  })
})

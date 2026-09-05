import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { createServer, type ServerWithHub } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { connectSse, type SseClient } from '../helpers/sse-client'

interface ServerHandle {
  server: ServerWithHub
  port: number
  baseUrl: string
}

async function startServer(
  dataDir: string,
  env: Record<string, string> = {}
): Promise<ServerHandle> {
  const original: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) {
    original[key] = process.env[key]
    process.env[key] = value
  }
  const server = createServer(0, dataDir)
  await once(server, 'listening')
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  return { server, port: address.port, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function stopServer(handle: ServerHandle): Promise<void> {
  handle.server.closeAllConnections()
  handle.server.close()
  await once(handle.server, 'close')
}

function postEvent(baseUrl: string, body: unknown): Promise<number> {
  return fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.status)
}

describe('GET /api/stream — SSE entegrasyonu', () => {
  let dataDir: string
  let handle: ServerHandle

  beforeEach(async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
  })

  afterEach(async () => {
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('AC1: hello çerçevesi id: taşımaz, gövdesi {seq,server_version,ring_from}', async () => {
    const client = await connectSse(handle.port)
    const hello = await client.waitForFrame((f) => f.event === 'hello')
    expect(hello.id).toBeUndefined()
    const data = JSON.parse(hello.data) as {
      seq: number | null
      server_version: string
      ring_from: number | null
    }
    expect(data.seq).toBeNull()
    expect(data.ring_from).toBeNull()
    expect(typeof data.server_version).toBe('string')
    client.close()
  })

  it('AC1: hello çerçevesi ring dolu iken de id: taşımaz (mutasyon 7 hedefi — boş ringde ringBounds.to undefined olduğu için mutasyonu yakalamaz, dolu ring zorunlu)', async () => {
    const postStatus = await postEvent(handle.baseUrl, {
      hook_event_name: 'PreToolUse',
      project_name: 'p',
      session_id: 's',
    })
    expect(postStatus).toBe(202)

    const client = await connectSse(handle.port)
    const hello = await client.waitForFrame((f) => f.event === 'hello')
    expect(hello.id).toBeUndefined()
    const data = JSON.parse(hello.data) as { seq: number | null; ring_from: number | null }
    expect(data.seq).toBe(0)
    expect(data.ring_from).toBe(0)
    client.close()
  })

  it('AC1: POST sonrası event çerçevesi 2000 ms içinde gelir, id = seq', async () => {
    const client = await connectSse(handle.port)
    await client.waitForFrame((f) => f.event === 'hello')

    const status = await postEvent(handle.baseUrl, {
      hook_event_name: 'PreToolUse',
      project_path: 'p',
    })
    expect(status).toBe(202)

    const frame = await client.waitForFrame((f) => f.event === 'event', 2000)
    expect(frame.id).toBe('0')
    const record = JSON.parse(frame.data) as { seq: number }
    expect(record.seq).toBe(0)
    client.close()
  })

  it('reconnect: Last-Event-ID aralıkta ise yalnızca eksik olaylar replay edilir, id<=L hiçbir çerçeve yok', async () => {
    await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' }) // seq 0
    await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' }) // seq 1
    await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' }) // seq 2

    const client = await connectSse(handle.port, { 'last-event-id': '0' })
    const first = await client.waitForFrame((f) => f.event === 'event')
    expect(first.id).toBe('1')

    // ikinci replay çerçevesi de gelene kadar bekle
    await client.waitForFrame((f) => f.event === 'event' && f.id === '2')

    const noResync = client.frames.filter((f) => f.event === 'resync')
    expect(noResync).toHaveLength(0)
    const ids = client.frames.filter((f) => f.event === 'event').map((f) => Number(f.id))
    for (const id of ids) expect(id).toBeGreaterThan(0)
    client.close()
  })

  it('resync: düşük MC_RING_SIZE ile budanmış aralık istenirse resync döner', async () => {
    await stopServer(handle)
    dataDir = createTempDataDir()
    handle = await startServer(dataDir, { MC_RING_SIZE: '3' })

    for (let i = 0; i < 5; i++) {
      await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' })
    }
    // ring artık yalnızca seq 2,3,4'ü tutuyor; L=0 ring dışında kaldı.
    const client = await connectSse(handle.port, { 'last-event-id': '0' })
    const resync = await client.waitForFrame((f) => f.event === 'resync')
    expect(JSON.parse(resync.data)).toEqual({ reason: 'gap' })
    client.close()
  })

  it('resync: L > ring.to (istemci ileride) kendiliğinden toparlanır (Bulgu 3)', async () => {
    await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' }) // seq 0

    const client = await connectSse(handle.port, { 'last-event-id': '9999' })
    const resync = await client.waitForFrame((f) => f.event === 'resync')
    expect(JSON.parse(resync.data)).toEqual({ reason: 'gap' })
    client.close()
  })

  it.each(['', 'abc', '1e3'])('bozuk Last-Event-ID (%s) resync üretir', async (raw) => {
    await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' })
    const headers: Record<string, string> = raw === '' ? {} : { 'last-event-id': raw }
    const client = await connectSse(handle.port, headers)
    if (raw === '') {
      // header hiç yoksa ilk bağlanma dalı — resync gelmemeli.
      await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' })
      const frame = await client.waitForFrame((f) => f.event === 'event')
      expect(frame).toBeDefined()
    } else {
      const resync = await client.waitForFrame((f) => f.event === 'resync')
      expect(JSON.parse(resync.data)).toEqual({ reason: 'gap' })
    }
    client.close()
  })

  it('N-1: 503 dönen olay 300 ms içinde hiçbir event çerçevesi üretmez, sonraki geçerli olay aynı bağlantıda gelir', async () => {
    const client = await connectSse(handle.port)
    await client.waitForFrame((f) => f.event === 'hello')

    const eventsDir = path.join(dataDir, 'events')
    const dayFilePath = path.join(eventsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`)
    fs.mkdirSync(dayFilePath)

    const failStatus = await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' })
    expect(failStatus).toBe(503)

    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(client.frames.filter((f) => f.event === 'event')).toHaveLength(0)

    fs.rmdirSync(dayFilePath)
    const okStatus = await postEvent(handle.baseUrl, { hook_event_name: 'PreToolUse' })
    expect(okStatus).toBe(202)

    const frame = await client.waitForFrame((f) => f.event === 'event')
    // seq 0 başarısız yazımda "tüketildi", bir daha verilmez (F-002 kararı) — ilk gerçek
    // olay seq 1'dir.
    expect(frame.id).toBe('1')
    client.close()
  })

  it('bağlantı req.destroy() ile koparılınca hub abone sayısı düşer, istemci akışın bittiğini gözlemler', async () => {
    const client = await connectSse(handle.port)
    await client.waitForFrame((f) => f.event === 'hello')
    expect(handle.server.sseHub.subscriberCount()).toBe(1)

    client.close()
    await client.closed
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(handle.server.sseHub.subscriberCount()).toBe(0)
  })

  it('Bulgu 1: açık bir SSE bağlantısı varken stopServer 2 sn içinde döner', async () => {
    const client: SseClient = await connectSse(handle.port)
    await client.waitForFrame((f) => f.event === 'hello')

    const start = Date.now()
    await stopServer(handle)
    expect(Date.now() - start).toBeLessThan(2000)

    // yeniden başlat ki afterEach kendi stopServer'ını çağırabilsin
    handle = await startServer(dataDir)
  })
})

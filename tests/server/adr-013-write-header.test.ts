import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { createServer } from '../../src/server/index'
import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../../src/shared/types'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'

// ADR-013 + CEO Karar 1 (F-006 sözleşmesi §7) — rota başına çit tablosu. Gerçek `createServer`
// kullanılır; `withDispatchErrorBoundary`'nin gerçekten bağlı olduğunu (mutasyon 5/7/13) da
// dolaylı olarak kanıtlar.

describe('ADR-013 — x-mc-write + /api/events içerik tipi allowlist', () => {
  let dataDir: string
  let server: ReturnType<typeof createServer>
  let base: string

  beforeEach(async () => {
    dataDir = createTempDataDir()
    server = createServer(0, dataDir)
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('beklenmeyen adres türü')
    }
    base = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    server.close()
    await once(server, 'close')
    removeTempDataDir(dataDir)
  })

  it('POST /api/projects — x-mc-write yok → 403', async () => {
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'C:/nope' }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('forbidden_origin')
  })

  it('POST /api/projects — x-mc-write: 1 → dispatch edilir (header engellemedi)', async () => {
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE },
      body: JSON.stringify({ path: 'C:/nope-yolu-yok' }),
    })
    expect(res.status).not.toBe(403)
  })

  it('DELETE /api/projects/:id — x-mc-write yok → 403', async () => {
    const res = await fetch(`${base}/api/projects/abc`, { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('DELETE /api/projects/:id — x-mc-write: 1 → dispatch edilir', async () => {
    const res = await fetch(`${base}/api/projects/abc`, {
      method: 'DELETE',
      headers: { [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE },
    })
    expect(res.status).not.toBe(403)
  })

  it('POST /api/events — content-type: text/plain → 400 invalid_body', async () => {
    const res = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_body')
  })

  it('POST /api/events — content-type yok → 400 invalid_body', async () => {
    const res = await fetch(`${base}/api/events`, { method: 'POST', body: '{}' })
    expect(res.status).toBe(400)
  })

  it('POST /api/events — content-type: multipart/form-data → 400 invalid_body', async () => {
    const res = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body: '{}',
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/events — content-type: application/json → dispatch edilir (x-mc-write yoksa da)', async () => {
    const res = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'Test' }),
    })
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(400)
  })

  it('POST /api/events — content-type: application/json; charset=utf-8 → dispatch edilir', async () => {
    const res = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ hook_event_name: 'Test' }),
    })
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(400)
  })

  it('GET /api/events — header yok → 200 (GET zaten muaf, regresyon kontrolü)', async () => {
    const res = await fetch(`${base}/api/events`)
    expect(res.status).toBe(200)
  })

  it('GET /api/stream — header yok → bağlantı kurulur (regresyon, F-003 dersi)', async () => {
    const controller = new AbortController()
    const res = await fetch(`${base}/api/stream`, { signal: controller.signal })
    expect(res.status).toBe(200)
    controller.abort()
  })

  it('GET /api/projects — header yok → 200 (regresyon)', async () => {
    const res = await fetch(`${base}/api/projects`)
    expect(res.status).toBe(200)
  })
})

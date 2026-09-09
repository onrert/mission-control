import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import http from 'node:http'
import {
  createServer,
  isAllowedHost,
  isAllowedOrigin,
  isSupportedNodeVersion,
  resolveEnvInt,
  resolvePort,
} from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'

describe('isSupportedNodeVersion', () => {
  it('20.11.0 destekleniyor', () => {
    expect(isSupportedNodeVersion('20.11.0')).toBe(true)
  })
  it('20.10.9 desteklenmiyor', () => {
    expect(isSupportedNodeVersion('20.10.9')).toBe(false)
  })
  it('22.0.0 destekleniyor', () => {
    expect(isSupportedNodeVersion('22.0.0')).toBe(true)
  })
  it('18.19.0 desteklenmiyor', () => {
    expect(isSupportedNodeVersion('18.19.0')).toBe(false)
  })
})

describe('resolvePort', () => {
  it('MC_PORT yoksa 7333 döner', () => {
    expect(resolvePort({})).toBe(7333)
  })
  it('MC_PORT geçerliyse onu döner', () => {
    expect(resolvePort({ MC_PORT: '18333' })).toBe(18333)
  })
  it('MC_PORT geçersizse (sayı değilse) varsayılana düşer', () => {
    expect(resolvePort({ MC_PORT: 'abc' })).toBe(7333)
  })
  it('MC_PORT "0" ise efemeral port için 0 döner', () => {
    expect(resolvePort({ MC_PORT: '0' })).toBe(0)
  })
  it('MC_PORT boş dizgeyse (Number("") === 0 tuzağı) varsayılana düşer, sessizce 0 dönmez', () => {
    expect(resolvePort({ MC_PORT: '' })).toBe(7333)
  })
  it('MC_PORT yalnızca boşluktan oluşuyorsa varsayılana düşer', () => {
    expect(resolvePort({ MC_PORT: '   ' })).toBe(7333)
  })
})

describe('resolveEnvInt', () => {
  it('değişken yoksa varsayılanı döner', () => {
    expect(resolveEnvInt({}, 'MC_RING_SIZE', 2000)).toBe(2000)
  })
  it('geçerli değeri döner', () => {
    expect(resolveEnvInt({ MC_RING_SIZE: '50' }, 'MC_RING_SIZE', 2000)).toBe(50)
  })
  it('geçersiz/boş/negatif değerde varsayılana düşer', () => {
    expect(resolveEnvInt({ MC_RETENTION_DAYS: 'abc' }, 'MC_RETENTION_DAYS', 30)).toBe(30)
    expect(resolveEnvInt({ MC_RETENTION_DAYS: '' }, 'MC_RETENTION_DAYS', 30)).toBe(30)
    expect(resolveEnvInt({ MC_RETENTION_DAYS: '-5' }, 'MC_RETENTION_DAYS', 30)).toBe(30)
  })
})

describe('isAllowedHost/isAllowedOrigin (CEO kararı R-1 — port yok sayılır)', () => {
  it.each([
    ['127.0.0.1:7333', true],
    ['127.0.0.1:54321', true],
    ['localhost:7434', true],
    ['127.0.0.1', true],
    ['[::1]:7333', true],
    ['evil.com', false],
    ['evil.com:7333', false],
    ['192.168.1.10:7333', false],
    [undefined, false],
  ] as const)('isAllowedHost(%s) -> %s', (host, expected) => {
    expect(isAllowedHost(host)).toBe(expected)
  })

  it.each([
    [undefined, true],
    ['http://localhost:7434', true],
    ['http://127.0.0.1:5173', true],
    ['https://evil.com', false],
    ['null', false],
    ['not a url', false],
  ] as const)('isAllowedOrigin(%s) -> %s', (origin, expected) => {
    expect(isAllowedOrigin(origin)).toBe(expected)
  })
})

// `fetch`/undici, Host başlığını istemci tarafında yönetir ve kullanıcı geçersiz kılmasına
// izin vermez (bağlantı kurulan gerçek adresle değiştirir) — bu yüzden Host başlığını sahte
// bir değerle göndermek için `node:http.request` kullanılır (ham soket seviyesi).
function requestWithHost(
  port: number,
  targetPath: string,
  hostHeader: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: targetPath,
        method: 'GET',
        headers: { Host: hostHeader },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

describe('createServer', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = createTempDataDir()
  })

  afterEach(() => {
    removeTempDataDir(dataDir)
  })

  it('yalnızca 127.0.0.1 arabirimine bağlanır (efemeral port)', async () => {
    const server = createServer(0, dataDir)
    await once(server, 'listening')
    expect(server.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })
    server.close()
    await once(server, 'close')
  })

  it('GET /api/health 200 döner ve on alanı içerir (write_errors — QA düzeltme turu 1, B1 madde e; transcript_reader — F-009 T5)', async () => {
    const server = createServer(0, dataDir)
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('beklenmeyen adres türü')
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/api/health`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as {
      ok: boolean
      version: string
      port: number
      node: string
      uptime_s: number
      instance_id: string
      service: string
      corrupt_lines: number
      write_errors: number
      transcript_reader: { files_seen: number; lines_ok: number; lines_bad: number }
    }
    expect(body.ok).toBe(true)
    expect(typeof body.version).toBe('string')
    expect(typeof body.port).toBe('number')
    expect(typeof body.node).toBe('string')
    expect(typeof body.uptime_s).toBe('number')
    expect(typeof body.instance_id).toBe('string')
    expect(body.instance_id.length).toBeGreaterThan(0)
    expect(body.service).toBe('mission-control')
    expect(typeof body.corrupt_lines).toBe('number')
    expect(body.corrupt_lines).toBe(0)
    expect(typeof body.write_errors).toBe('number')
    expect(body.write_errors).toBe(0)
    // F-009 T5 — bu turda hiçbir üretim kodu transkript okumuyor, üçü de dürüstçe sıfır.
    expect(body.transcript_reader).toEqual({ files_seen: 0, lines_ok: 0, lines_bad: 0 })
    server.close()
    await once(server, 'close')
  })

  it('bilinmeyen /api/ yolu 404 döner', async () => {
    const server = createServer(0, dataDir)
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('beklenmeyen adres türü')
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/api/nope`)
    expect(res.status).toBe(404)
    server.close()
    await once(server, 'close')
  })

  it('yabancı Host başlığıyla /api/health 403 forbidden_origin döner', async () => {
    const server = createServer(0, dataDir)
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('beklenmeyen adres türü')
    }
    const { status, body: rawBody } = await requestWithHost(address.port, '/api/health', 'evil.com')
    expect(status).toBe(403)
    const body = JSON.parse(rawBody) as { success: boolean; error: { code: string } }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('forbidden_origin')
    server.close()
    await once(server, 'close')
  })

  it('geçerli Host başlığıyla /api/health 200 döner (regresyon)', async () => {
    const server = createServer(0, dataDir)
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('beklenmeyen adres türü')
    }
    const { status } = await requestWithHost(
      address.port,
      '/api/health',
      `127.0.0.1:${address.port}`
    )
    expect(status).toBe(200)
    server.close()
    await once(server, 'close')
  })

  it('bozuk satır içeren bir gün dosyasıyla açılırsa corrupt_lines uçtan uca doğru sayılır', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { dayFileName } = await import('../../src/server/store/jsonl-store')

    const eventsDir = path.join(dataDir, 'events')
    fs.mkdirSync(eventsDir, { recursive: true })
    const file = path.join(eventsDir, dayFileName(new Date()))
    const validLines = Array.from({ length: 8 }, (_, i) =>
      JSON.stringify({ seq: i, id: `${i}-a`, ts: new Date().toISOString() })
    )
    const lines = [...validLines, 'bozuk satır 1', '{ bozuk json', ''].join('\n')
    fs.writeFileSync(file, lines)

    const server = createServer(0, dataDir)
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('beklenmeyen adres türü')
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/api/health`)
    const body = (await res.json()) as { corrupt_lines: number }
    expect(body.corrupt_lines).toBe(2)
    server.close()
    await once(server, 'close')
  })
})

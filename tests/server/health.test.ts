import { describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { createServer, isSupportedNodeVersion, resolvePort } from '../../src/server/index'

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

describe('createServer', () => {
  it('yalnızca 127.0.0.1 arabirimine bağlanır (efemeral port)', async () => {
    const server = createServer(0)
    await once(server, 'listening')
    expect(server.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })
    server.close()
    await once(server, 'close')
  })

  it('GET /api/health 200 döner ve beş alanı içerir', async () => {
    const server = createServer(0)
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
    }
    expect(body.ok).toBe(true)
    expect(typeof body.version).toBe('string')
    expect(typeof body.port).toBe('number')
    expect(typeof body.node).toBe('string')
    expect(typeof body.uptime_s).toBe('number')
    server.close()
    await once(server, 'close')
  })

  it('bilinmeyen /api/ yolu 404 döner', async () => {
    const server = createServer(0)
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
})

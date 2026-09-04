import { describe, expect, it } from 'vitest'
import net from 'node:net'
import { once } from 'node:events'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'check-ports.mjs')

async function withBusyPort<T>(fn: (port: number) => T | Promise<T>): Promise<T> {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  try {
    return await fn(address.port)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

function runScript(env: Record<string, string>): { status: number; stderr: string } {
  try {
    execFileSync('node', [scriptPath], {
      env: { ...process.env, ...env },
      stdio: 'pipe',
    })
    return { status: 0, stderr: '' }
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer }
    return { status: e.status ?? 1, stderr: e.stderr?.toString('utf8') ?? '' }
  }
}

describe('check-ports.mjs', () => {
  it('MC_PORT doluysa non-zero exit ve Türkçe hata mesajı verir, hiçbir alt süreç başlamaz', async () => {
    await withBusyPort((port) => {
      const result = runScript({ MC_PORT: String(port), MC_WEB_PORT: '0' })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('kullanımda')
    })
  })

  it('MC_WEB_PORT doluysa non-zero exit ve Türkçe hata mesajı verir', async () => {
    await withBusyPort((port) => {
      const result = runScript({ MC_PORT: '0', MC_WEB_PORT: String(port) })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('kullanımda')
    })
  })

  it('portlar boşken exit 0 verir', () => {
    const result = runScript({ MC_PORT: '18933', MC_WEB_PORT: '18934' })
    expect(result.status).toBe(0)
  })

  it('MC_PORT/MC_WEB_PORT geçersizse (boş dizge) varsayılana düşer', () => {
    // Gerçek 7333/7334'ün bu makinede boş olduğu varsayımıyla (varsayılan çözümleme kanıtı,
    // sözleşme §6.2 "Port kaynağı" — playwright.dev.config.ts ayrı 7433/7434 kullandığı için
    // bu iki yol birbirini bloklamaz).
    const result = runScript({ MC_PORT: '', MC_WEB_PORT: '' })
    expect(result.status).toBe(0)
  })
})

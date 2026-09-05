import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { createServer, type ServerWithHub } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../../src/shared/types'

function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

interface ServerHandle {
  server: ServerWithHub
  baseUrl: string
}

async function startServer(dataDir: string): Promise<ServerHandle> {
  const server = createServer(0, dataDir)
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function stopServer(handle: ServerHandle): Promise<void> {
  handle.server.closeAllConnections()
  handle.server.close()
  await once(handle.server, 'close')
}

function request(
  baseUrl: string,
  method: string,
  urlPath: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl)
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const headers: Record<string, string> = { ...extraHeaders }
    if (payload !== undefined) headers['content-type'] = 'application/json'
    const req = http.request(
      { host: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            resolve({ status: res.statusCode ?? 0, json: text ? JSON.parse(text) : undefined })
          } catch (err) {
            reject(err)
          }
        })
      }
    )
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

function writeRequest(
  baseUrl: string,
  method: string,
  urlPath: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; json: unknown }> {
  return request(baseUrl, method, urlPath, body, {
    [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE,
    ...extraHeaders,
  })
}

let dataDir: string
let projectDir: string
let handle: ServerHandle
let projectId: string

beforeEach(async () => {
  dataDir = createTempDataDir()
  projectDir = createTempDataDir()
  fs.mkdirSync(path.join(projectDir, 'docs', 'features'), { recursive: true })
  fs.writeFileSync(
    path.join(projectDir, 'docs', 'features', 'F-001.md'),
    '---\nid: F-001\ntitle: Test\nstatus: todo\nowner: developer\ndeps: []\nsprint: 1\n---\nbody\n'
  )
  handle = await startServer(dataDir)
  const added = handle.server.projectsService.addProject(projectDir, 'fixture')
  if (!added.ok) throw new Error('proje eklenemedi')
  projectId = added.item.id
})

afterEach(async () => {
  await stopServer(handle)
  removeTempDataDir(dataDir)
  removeTempDataDir(projectDir)
})

describe('GET /api/features (AC1)', () => {
  it('project_id verilince yalnızca o projenin kartlarını döner', async () => {
    const res = await request(handle.baseUrl, 'GET', `/api/features?project_id=${projectId}`)
    expect(res.status).toBe(200)
    const body = res.json as { success: boolean; data: Array<{ file: string; status: string }> }
    expect(body.success).toBe(true)
    expect(body.data.length).toBe(1)
    expect(body.data[0]?.status).toBe('todo')
  })

  it('project_id verilmezse tüm var olan projelerin kartları döner', async () => {
    const res = await request(handle.baseUrl, 'GET', '/api/features')
    expect(res.status).toBe(200)
    const body = res.json as { success: boolean; data: unknown[] }
    expect(body.data.length).toBe(1)
  })
})

describe('PATCH /api/features/:project_id/:file — mutlu yol (§4.2)', () => {
  it('doğru expected_hash → 200, disk üzerinden yeniden okunmuş FeatureCard döner', async () => {
    const filePath = path.join(projectDir, 'docs', 'features', 'F-001.md')
    const hash = sha256(fs.readFileSync(filePath))
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: 'qa',
      expected_hash: hash,
    })
    expect(res.status).toBe(200)
    const body = res.json as { success: boolean; data: { status: string; content_hash: string } }
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('qa')
    expect(fs.readFileSync(filePath, 'utf8')).toContain('status: qa')
    // Dönen hash gerçekten diskteki yeni içeriğin hash'iyle eşleşir.
    expect(body.data.content_hash).toBe(sha256(fs.readFileSync(filePath)))
  })
})

describe('PATCH /api/features/:project_id/:file — çakışma (AC4, mutasyon 3)', () => {
  it('yanlış expected_hash → 409 conflict, dosya değişmez, disk-güncel FeatureCard döner', async () => {
    const filePath = path.join(projectDir, 'docs', 'features', 'F-001.md')
    const before = fs.readFileSync(filePath, 'utf8')
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: 'qa',
      expected_hash: 'bayat-hash',
    })
    expect(res.status).toBe(409)
    const body = res.json as {
      success: boolean
      error: { code: string }
      data: { status: string }
    }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('conflict')
    expect(body.data.status).toBe('todo')
    expect(fs.readFileSync(filePath, 'utf8')).toBe(before)
  })
})

describe('PATCH /api/features/:project_id/:file — yazma hatası (mutasyon 4: mesaj sızmaz)', () => {
  it('write_failed → 500, sabit Türkçe mesaj (ham describeError() sızdırılmaz)', async () => {
    const filePath = path.join(projectDir, 'docs', 'features', 'F-001.md')
    const hash = sha256(fs.readFileSync(filePath))
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('ÇOK GİZLİ İÇ HATA METNİ, İSTEMCİYE SIZMAMALI')
    })
    try {
      const res = await writeRequest(
        handle.baseUrl,
        'PATCH',
        `/api/features/${projectId}/F-001.md`,
        { status: 'qa', expected_hash: hash }
      )
      expect(res.status).toBe(500)
      const body = res.json as { success: boolean; error: { code: string; message: string } }
      expect(body.error.code).toBe('write_failed')
      expect(body.error.message).toBe('Dosyaya yazma izni reddedildi.')
      expect(body.error.message).not.toContain('ÇOK GİZLİ')
    } finally {
      renameSpy.mockRestore()
    }
  })
})

describe('PATCH /api/features/:project_id/:file — write_denied (ata dizin symlink)', () => {
  it("docs/features gerçek kök dışına symlink'lenmişse write_denied (403)", async () => {
    const realDir = path.join(projectDir, 'real-features')
    fs.mkdirSync(realDir, { recursive: true })
    fs.writeFileSync(path.join(realDir, 'F-002.md'), '---\nid: F-002\nstatus: todo\n---\n')
    const featuresLink = path.join(projectDir, 'docs', 'features-2')
    fs.symlinkSync(realDir, featuresLink, 'junction')
    // F-002 projesini bu ikinci (symlink'li) docs/features-2 dizininden DEĞİL, write-gate'in
    // gerçek `docs/features` sabit yol varsayımından test etmek için doğrudan `docs/features`
    // dizinini bir junction ile değiştiriyoruz (write-gate.test.ts ile aynı desen).
    fs.rmSync(featuresLink, { recursive: true, force: true })
    const featuresPath = path.join(projectDir, 'docs', 'features')
    const backup = path.join(projectDir, 'docs', 'features-backup')
    fs.renameSync(featuresPath, backup)
    fs.symlinkSync(realDir, featuresPath, 'junction')
    fs.writeFileSync(path.join(realDir, 'F-001.md'), '---\nid: F-001\nstatus: todo\n---\n')
    try {
      const hash = sha256(fs.readFileSync(path.join(realDir, 'F-001.md')))
      const res = await writeRequest(
        handle.baseUrl,
        'PATCH',
        `/api/features/${projectId}/F-001.md`,
        { status: 'qa', expected_hash: hash }
      )
      expect(res.status).toBe(403)
      const body = res.json as { success: boolean; error: { code: string } }
      expect(body.error.code).toBe('write_denied')
    } finally {
      fs.rmSync(featuresPath, { recursive: true, force: true })
      fs.renameSync(backup, featuresPath)
    }
  })
})

describe('PATCH /api/features/:project_id/:file — invalid_body (400: boş/>64/CRLF)', () => {
  it('status boş → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: '',
      expected_hash: 'x',
    })
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })

  it('status 64 karakterden uzun → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: 'x'.repeat(65),
      expected_hash: 'x',
    })
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })

  it('status satır sonu içeriyor → 400 invalid_body (write-gate D38/Ö2 zinciri)', async () => {
    const filePath = path.join(projectDir, 'docs', 'features', 'F-001.md')
    const hash = sha256(fs.readFileSync(filePath))
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: 'x\n---\nBODY',
      expected_hash: hash,
    })
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })

  it('gövde geçerli JSON değil → 400 invalid_body', async () => {
    const res = await request(
      handle.baseUrl,
      'PATCH',
      `/api/features/${projectId}/F-001.md`,
      undefined,
      { [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE, 'content-type': 'application/json' }
    )
    // gövde göndermeden bitir (undefined payload → boş gövde → JSON.parse('') hata verir)
    expect(res.status).toBe(400)
  })

  it('expected_hash eksik → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: 'qa',
    })
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })
})

describe('PATCH /api/features/:project_id/:file — not_found', () => {
  it('bilinmeyen project_id → 404 not_found', async () => {
    const res = await writeRequest(handle.baseUrl, 'PATCH', `/api/features/hic-yok/F-001.md`, {
      status: 'qa',
      expected_hash: 'x',
    })
    expect(res.status).toBe(404)
    expect((res.json as { error: { code: string } }).error.code).toBe('not_found')
  })
})

describe('x-mc-write eksikliği (ADR-013 regresyon çiti — F-007 uçları da kapsanıyor)', () => {
  it('x-mc-write başlığı olmadan PATCH → 403 forbidden_origin', async () => {
    const res = await request(handle.baseUrl, 'PATCH', `/api/features/${projectId}/F-001.md`, {
      status: 'qa',
      expected_hash: 'x',
    })
    expect(res.status).toBe(403)
    expect((res.json as { error: { code: string } }).error.code).toBe('forbidden_origin')
  })

  it('GET /api/features x-mc-write GEREKTİRMEZ (salt okunur)', async () => {
    const res = await request(handle.baseUrl, 'GET', '/api/features')
    expect(res.status).toBe(200)
  })
})

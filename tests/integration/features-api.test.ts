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

describe('PATCH /api/features/:project_id/:file — yazma başarılı ama yeniden okuma başarısız (D46/B1, yarı-başarı)', () => {
  it('rereadCard fırlarsa: yazma DİSKE UYGULANIR, istemci YANITSIZ KALMAZ (200, data yok), süreç ayakta kalır', async () => {
    const filePath = path.join(projectDir, 'docs', 'features', 'F-001.md')
    const hash = sha256(fs.readFileSync(filePath))
    const originalReadFileSync = fs.readFileSync.bind(fs)
    let matchingReadCalls = 0
    // `rereadCard`'ın (handler seviyesi) ikinci okuması hedeflenir — write-gate'in yazmadan
    // ÖNCEKİ ilk okuması (hash karşılaştırması) etkilenmez, böylece yazma GERÇEKTEN başarılı
    // olur ve yalnızca yazmadan SONRAKİ okuma arızalanır (QA'nın ölçtüğü gerçek senaryo:
    // AV programının dosyayı kısa süreliğine kilitlediği pencere).
    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockImplementation((...args: Parameters<typeof fs.readFileSync>) => {
        const target = args[0]
        const isTargetFile =
          typeof target === 'string' && path.resolve(target) === path.resolve(filePath)
        if (isTargetFile) {
          matchingReadCalls += 1
          if (matchingReadCalls === 2) {
            const err = new Error('EBUSY: fault injection (test, D46)') as NodeJS.ErrnoException
            err.code = 'EBUSY'
            throw err
          }
        }
        return originalReadFileSync(...args)
      })
    try {
      const res = await writeRequest(
        handle.baseUrl,
        'PATCH',
        `/api/features/${projectId}/F-001.md`,
        { status: 'qa', expected_hash: hash }
      )
      // Bloklayıcının özü: istemci bir yanıt ALIR (önceden `HTTP=000`/10sn zaman aşımı idi).
      expect(res.status).toBe(200)
      const body = res.json as { success: boolean; data?: unknown }
      expect(body.success).toBe(true)
      // Yarı-başarı dürüst raporlanır: `data` YOK (istemci bunu "yazıldı ama tazeleme
      // yapılamadı" olarak yorumlar, `useFeatures.ts`).
      expect(body.data).toBeUndefined()
      // Yazma GERÇEKTEN diske uygulandı — sessizce "olmadı" denmiyor.
      expect(fs.readFileSync(filePath, 'utf8')).toContain('status: qa')
    } finally {
      readSpy.mockRestore()
    }

    // Süreç/sunucu ayakta ve yanıt vermeye devam ediyor (B1'in ikinci iddiası).
    const followUp = await request(handle.baseUrl, 'GET', `/api/features?project_id=${projectId}`)
    expect(followUp.status).toBe(200)
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
      const body = res.json as { success: boolean; error: { code: string; message: string } }
      expect(body.error.code).toBe('write_denied')
      // QA düzeltme turu 1 (N1) — 403 artık 500 (write_failed) ile AYNI metni döndürmüyor;
      // kullanıcı güvenlik reddiyle disk hatasını ayırt edebilsin (sözleşme §4.3, CEO Karar 2).
      expect(body.error.message).toBe('Dosya biçimi tanınamadı. Tekrar deneyin.')
      expect(body.error.message).not.toBe('Dosyaya yazma izni reddedildi.')
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

describe('GET /api/features/detail — F-013 sözleşme §2 mutlu yol', () => {
  it('gövde + sözleşme + QA raporları döner', async () => {
    fs.mkdirSync(path.join(projectDir, 'docs', 'qa'), { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'docs', 'qa', 'F-001-contract.md'), 'sözleşme metni')
    fs.writeFileSync(path.join(projectDir, 'docs', 'qa', 'F-001-2026-09-01.md'), 'qa turu 1')

    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/features/detail?project_id=${projectId}&file=F-001.md`
    )
    expect(res.status).toBe(200)
    const body = res.json as {
      success: boolean
      data: {
        content_hash: string
        body: { exists: boolean; content?: string }
        contract: { exists: boolean; content?: string }
        qa_reports: Array<{ file: string; exists: boolean; content?: string }>
      }
    }
    expect(body.success).toBe(true)
    expect(body.data.body.exists).toBe(true)
    expect(body.data.body.content).toBe('body\n')
    expect(body.data.contract).toEqual({
      exists: true,
      content: 'sözleşme metni',
      truncated: false,
    })
    expect(body.data.qa_reports).toEqual([
      { file: 'F-001-2026-09-01.md', exists: true, content: 'qa turu 1', truncated: false },
    ])
    expect(body.data.content_hash).toBe(
      sha256(fs.readFileSync(path.join(projectDir, 'docs', 'features', 'F-001.md')))
    )
  })

  it('sözleşme/QA raporu yoksa "yok" durumu döner, panel bozulmaz', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/features/detail?project_id=${projectId}&file=F-001.md`
    )
    expect(res.status).toBe(200)
    const body = res.json as {
      success: boolean
      data: { contract: { exists: boolean }; qa_reports: unknown[] }
    }
    expect(body.data.contract).toEqual({ exists: false })
    expect(body.data.qa_reports).toEqual([])
  })

  it('x-mc-write GEREKTİRMEZ (salt okunur GET)', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/features/detail?project_id=${projectId}&file=F-001.md`
    )
    expect(res.status).toBe(200)
  })

  it('project_id/file eksikse 400 invalid_body', async () => {
    const res = await request(handle.baseUrl, 'GET', `/api/features/detail?project_id=${projectId}`)
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })

  it('geçersiz dosya adı (yol parçası içeriyor) → 400 invalid_body', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/features/detail?project_id=${projectId}&file=${encodeURIComponent('../F-001.md')}`
    )
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })

  it('bilinmeyen project_id → 404 not_found', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/features/detail?project_id=hic-yok&file=F-001.md`
    )
    expect(res.status).toBe(404)
    expect((res.json as { error: { code: string } }).error.code).toBe('not_found')
  })

  it('gövde dosyası yoksa 404 not_found', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/features/detail?project_id=${projectId}&file=F-999.md`
    )
    expect(res.status).toBe(404)
    expect((res.json as { error: { code: string } }).error.code).toBe('not_found')
  })
})

describe('GET /api/features/detail — MUTASYON (a) hedefi: docs/qa symlink ile kök dışına kaçış', () => {
  it('docs/qa gerçek kökün DIŞINA symlink\'lenmişse sözleşme SIZMAZ ("yok" döner)', async () => {
    const outsideDir = path.join(projectDir, '..', `mc-outside-${crypto.randomUUID()}`)
    fs.mkdirSync(outsideDir, { recursive: true })
    fs.writeFileSync(path.join(outsideDir, 'F-001-contract.md'), 'DIŞARIDAN SIZDIRILAN İÇERİK')
    const qaPath = path.join(projectDir, 'docs', 'qa')
    try {
      fs.symlinkSync(outsideDir, qaPath, 'junction')
      const res = await request(
        handle.baseUrl,
        'GET',
        `/api/features/detail?project_id=${projectId}&file=F-001.md`
      )
      expect(res.status).toBe(200)
      const body = res.json as { data: { contract: { exists: boolean; content?: string } } }
      // symlink reddedildiği için tamamen "yok" döner — dışarıdaki metin hiçbir şekilde SIZMAZ.
      expect(body.data.contract).toEqual({ exists: false })
    } finally {
      fs.rmSync(qaPath, { force: true })
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })
})

describe('GET /api/features/detail — MUTASYON (e) hedefi: dağıtıcının genel hata sınırı', () => {
  it('handler senkron fırlatırsa dağıtıcı 500 döner, panel çökmez, süreç yaşar', async () => {
    const listSpy = vi.spyOn(handle.server.projectsService, 'list').mockImplementation(() => {
      throw new Error('ÇOK GİZLİ İÇ HATA, İSTEMCİYE SIZMAMALI')
    })
    try {
      const res = await request(
        handle.baseUrl,
        'GET',
        `/api/features/detail?project_id=${projectId}&file=F-001.md`
      )
      expect(res.status).toBe(500)
      const body = res.json as { success: boolean; error: { code: string; message: string } }
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('internal_error')
      expect(body.error.message).not.toContain('ÇOK GİZLİ')
    } finally {
      listSpy.mockRestore()
    }
    // Süreç ayakta, yanıt vermeye devam ediyor.
    const followUp = await request(handle.baseUrl, 'GET', '/api/health')
    expect(followUp.status).toBe(200)
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

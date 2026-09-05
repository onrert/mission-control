import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import http from 'node:http'
import { createServer, withDispatchErrorBoundary, type ServerWithHub } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { connectSse } from '../helpers/sse-client'
import type { ProjectListItem } from '../../src/shared/types'

interface ServerHandle {
  server: ServerWithHub
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
  handle.server.closeAllConnections()
  handle.server.close()
  await once(handle.server, 'close')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const projectDirs: string[] = []

function makeProjectDir(prefix = 'mc-proj-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  projectDirs.push(dir)
  return dir
}

/** CEO kararı C — "zengin bir fixture proje" (sözleşme §7 manifest testi adım 1). */
function createFixtureProject(): string {
  const dir = makeProjectDir()
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'docs', 'approvals'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs', 'features', 'F-001.md'), '# F-001\n')
  fs.writeFileSync(path.join(dir, 'docs', 'features', 'F-002.md'), '# F-002\n')
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export {}\n')
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n')
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{}\n')
  return dir
}

interface ManifestEntry {
  relPath: string
  /** QA düzeltme turu 1 (ÖNEMLİ-4): boş dizinler de manifeste girer (öncesinde yalnızca dosyalar
   *  taranıyordu — `docs/approvals/` gibi boş bir dizin silinse manifest bunu hiç yakalamazdı). */
  kind: 'file' | 'dir'
  size?: number
  sha256?: string
}

/** `(göreli yol, [dosyaysa boyut+sha256])` manifesti — CEO kararı C, sözleşme §7. */
function snapshotManifest(root: string): ManifestEntry[] {
  const out: ManifestEntry[] = []
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const relPath = path.relative(root, full)
      if (entry.isDirectory()) {
        out.push({ relPath, kind: 'dir' })
        walk(full)
      } else {
        const content = fs.readFileSync(full)
        out.push({
          relPath,
          kind: 'file',
          size: content.length,
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
        })
      }
    }
  }
  if (fs.existsSync(root)) walk(root)
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

afterEach(() => {
  while (projectDirs.length > 0) {
    const dir = projectDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('POST/GET/DELETE /api/projects — entegrasyon (sözleşme §4)', () => {
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

  it('AC3: path eksikse invalid_body, geçersiz yolda invalid_path (okunabilir Türkçe hata)', async () => {
    const missingBody = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({}),
    })
    expect(missingBody.status).toBe(400)
    const missingJson = (await missingBody.json()) as { error: { code: string } }
    expect(missingJson.error.code).toBe('invalid_body')

    const noFeatures = makeProjectDir()
    const invalidRes = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: noFeatures }),
    })
    expect(invalidRes.status).toBe(400)
    const invalidJson = (await invalidRes.json()) as { error: { code: string; message: string } }
    expect(invalidJson.error.code).toBe('invalid_path')
    expect(invalidJson.error.message).toBe(
      'Bu klasörde docs/features bulunamadı. Yolu kontrol edin.'
    )
  })

  it('AC3/D17: aynı proje ikinci kez eklenirse 409 conflict', async () => {
    const project = createFixtureProject()
    const first = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    expect(first.status).toBe(201)

    const second = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project.toUpperCase() }),
    })
    expect(second.status).toBe(409)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('conflict')
  })

  it('AC1: proje eklenip docs/features değişince features SSE sinyali 5 sn içinde gelir', async () => {
    const project = createFixtureProject()
    const sse = await connectSse(handle.port)
    try {
      const addRes = await fetch(`${handle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
        body: JSON.stringify({ path: project }),
      })
      expect(addRes.status).toBe(201)
      const addBody = (await addRes.json()) as { data: ProjectListItem }
      const projectId = addBody.data.id

      // chokidar'ın alt katman kurulumu asenkron — gerçekçi bir aralık (bkz. project-watcher.test.ts).
      await sleep(500)
      fs.writeFileSync(path.join(project, 'docs', 'features', 'F-003.md'), '# yeni\n')

      const frame = await sse.waitForFrame((f) => f.event === 'features', 5000)
      const data = JSON.parse(frame.data) as { project_id: string }
      expect(data.project_id).toBe(projectId)
    } finally {
      sse.close()
    }
  }, 15000)

  it('AC2: kaldırma sonrası projects listesi güncellenir, disk hiç değişmez, izleme durur', async () => {
    const project = createFixtureProject()
    const before = snapshotManifest(project)

    const addRes = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    const addBody = (await addRes.json()) as { data: ProjectListItem }
    const projectId = addBody.data.id

    const sse = await connectSse(handle.port)
    try {
      const removeRes = await fetch(`${handle.baseUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'x-mc-write': '1' },
      })
      expect(removeRes.status).toBe(200)

      const frame = await sse.waitForFrame((f) => f.event === 'projects', 5000)
      const list = JSON.parse(frame.data) as ProjectListItem[]
      expect(list.find((p) => p.id === projectId)).toBeUndefined()

      const listRes = await fetch(`${handle.baseUrl}/api/projects`)
      const listBody = (await listRes.json()) as { data: ProjectListItem[] }
      expect(listBody.data).toHaveLength(0)

      // İzleme durdu mu? Kaldırmadan sonra dosya değişikliği artık `features` yaymaz.
      await sleep(500)
      sse.frames.length = 0
      fs.writeFileSync(path.join(project, 'docs', 'features', 'F-004.md'), '# sonra\n')
      await sleep(800)
      const sawFeatures = sse.frames.some((f) => f.event === 'features')
      expect(sawFeatures).toBe(false)

      const after = snapshotManifest(project)
      // Kaldırdıktan sonra harici olarak eklenen F-004.md dışında hiçbir dosya değişmedi.
      const beforeMap = new Map(before.map((e) => [e.relPath, e]))
      for (const entry of after) {
        if (entry.relPath === path.join('docs', 'features', 'F-004.md')) continue
        const prior = beforeMap.get(entry.relPath)
        expect(prior).toBeDefined()
        expect(entry.sha256).toBe(prior!.sha256)
        expect(entry.size).toBe(prior!.size)
      }
      expect(after.length).toBe(before.length + 1)
    } finally {
      sse.close()
    }
  }, 15000)

  it('AC2: DELETE bilinmeyen id -> 404 not_found', async () => {
    const res = await fetch(`${handle.baseUrl}/api/projects/p_yok`, {
      method: 'DELETE',
      headers: { 'x-mc-write': '1' },
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('AC4: 3 proje eşzamanlı — kayıt defteri 3 ayrı kayıt döner, izleme izole (bir projedeki değişiklik diğerlerine sızmaz)', async () => {
    const projects = [createFixtureProject(), createFixtureProject(), createFixtureProject()]
    const ids: string[] = []
    for (const p of projects) {
      const res = await fetch(`${handle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
        body: JSON.stringify({ path: p }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { data: ProjectListItem }
      ids.push(body.data.id)
    }

    const listRes = await fetch(`${handle.baseUrl}/api/projects`)
    const listBody = (await listRes.json()) as { data: ProjectListItem[] }
    expect(listBody.data).toHaveLength(3)

    const sse = await connectSse(handle.port)
    try {
      await sleep(500)
      fs.writeFileSync(path.join(projects[1]!, 'docs', 'features', 'F-999.md'), '# sadece bu\n')

      const frame = await sse.waitForFrame((f) => f.event === 'features', 5000)
      const data = JSON.parse(frame.data) as { project_id: string }
      expect(data.project_id).toBe(ids[1])

      // Kısa bir süre daha bekleyip diğer iki projenin id'siyle bir sinyal gelmediğini doğrula.
      await sleep(500)
      const leaked = sse.frames.filter(
        (f) =>
          f.event === 'features' &&
          (JSON.parse(f.data) as { project_id: string }).project_id !== ids[1]
      )
      expect(leaked).toHaveLength(0)
    } finally {
      sse.close()
    }
  }, 15000)

  it('izleyici sayacı: N proje eklendikten sonra /api/health.watchers === N', async () => {
    const projects = [createFixtureProject(), createFixtureProject()]
    for (const p of projects) {
      const res = await fetch(`${handle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
        body: JSON.stringify({ path: p }),
      })
      expect(res.status).toBe(201)
    }
    const healthRes = await fetch(`${handle.baseUrl}/api/health`)
    const health = (await healthRes.json()) as { watchers: number }
    expect(health.watchers).toBe(2)
  })

  // QA düzeltme turu 1 (ÖNEMLİ-1): M7 mutasyonu (`watchers.delete(id)` kaldırılması) önceden
  // 425/425 yeşil kalıyordu — hiçbir test kaldırma SONRASI sayacın AZALDIĞINI ölçmüyordu.
  it('izleyici sayacı: kaldırma sonrası /api/health.watchers === N-1 (QA M7 çiti)', async () => {
    const projects = [createFixtureProject(), createFixtureProject()]
    const ids: string[] = []
    for (const p of projects) {
      const res = await fetch(`${handle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
        body: JSON.stringify({ path: p }),
      })
      const body = (await res.json()) as { data: ProjectListItem }
      ids.push(body.data.id)
    }
    const beforeRes = await fetch(`${handle.baseUrl}/api/health`)
    expect(((await beforeRes.json()) as { watchers: number }).watchers).toBe(2)

    const removeRes = await fetch(`${handle.baseUrl}/api/projects/${ids[0]}`, {
      method: 'DELETE',
      headers: { 'x-mc-write': '1' },
    })
    expect(removeRes.status).toBe(200)

    const afterRes = await fetch(`${handle.baseUrl}/api/health`)
    expect(((await afterRes.json()) as { watchers: number }).watchers).toBe(1)
  })

  it('Host/Origin: GET /api/projects de isAllowedHost çitine tabi (QA Bulgu 13b)', async () => {
    // `fetch` (undici) `Host` başlığının elle ayarlanmasına izin vermiyor (forbidden header) —
    // bu yüzden ham `node:http` kullanılır (events-api.test.ts'in `postJson` deseniyle aynı).
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: handle.port,
          path: '/api/projects',
          method: 'GET',
          headers: { host: 'evil.example.com' },
        },
        (res) => {
          res.resume()
          resolve(res.statusCode ?? 0)
        }
      )
      req.on('error', reject)
      req.end()
    })
    expect(status).toBe(403)
  })

  it('Host/Origin: cross-origin POST/DELETE -> 403, aynı origin/Origin yoksa normal işlenir (genelleşme regresyonu)', async () => {
    const project = createFixtureProject()
    const badOriginPost = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'http://evil.com' },
      body: JSON.stringify({ path: project }),
    })
    expect(badOriginPost.status).toBe(403)

    const okPost = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    expect(okPost.status).toBe(201)
    const okBody = (await okPost.json()) as { data: ProjectListItem }

    const badOriginDelete = await fetch(`${handle.baseUrl}/api/projects/${okBody.data.id}`, {
      method: 'DELETE',
      headers: { Origin: 'http://evil.com' },
    })
    expect(badOriginDelete.status).toBe(403)

    const okDelete = await fetch(`${handle.baseUrl}/api/projects/${okBody.data.id}`, {
      method: 'DELETE',
      headers: { Origin: handle.baseUrl, 'x-mc-write': '1' },
    })
    expect(okDelete.status).toBe(200)
  })
})

describe('AC5: kayıt defteri kalıcı, restart sonrası otomatik yeniden izleme', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = createTempDataDir()
  })

  afterEach(() => {
    removeTempDataDir(dataDir)
  })

  it('aynı MC_DATA_DIR üzerinde ikinci sunucu örneği kayıtları korur ve otomatik yeniden izler', async () => {
    const project = createFixtureProject()
    const first = await startServer(dataDir)
    const addRes = await fetch(`${first.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    expect(addRes.status).toBe(201)
    const addBody = (await addRes.json()) as { data: ProjectListItem }
    await stopServer(first)

    const second = await startServer(dataDir)
    try {
      const listRes = await fetch(`${second.baseUrl}/api/projects`)
      const listBody = (await listRes.json()) as { data: ProjectListItem[] }
      expect(listBody.data).toHaveLength(1)
      expect(listBody.data[0]?.id).toBe(addBody.data.id)

      const healthRes = await fetch(`${second.baseUrl}/api/health`)
      const health = (await healthRes.json()) as { watchers: number }
      expect(health.watchers).toBe(1)

      const sse = await connectSse(second.port)
      try {
        await sleep(500)
        fs.writeFileSync(path.join(project, 'docs', 'features', 'F-005.md'), '# yeniden izleme\n')
        const frame = await sse.waitForFrame((f) => f.event === 'features', 5000)
        const data = JSON.parse(frame.data) as { project_id: string }
        expect(data.project_id).toBe(addBody.data.id)
      } finally {
        sse.close()
      }
    } finally {
      await stopServer(second)
    }
  }, 15000)
})

describe('İzleyici yaşam döngüsünün gerçek kapanışı (sözleşme §7, mutasyon 10)', () => {
  it("server.close() sonrası projectsService.getActiveWatcherCount() doğrudan (HTTP'siz) 0", async () => {
    const dataDir = createTempDataDir()
    const project = createFixtureProject()
    try {
      const handle = await startServer(dataDir)
      const addRes = await fetch(`${handle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
        body: JSON.stringify({ path: project }),
      })
      expect(addRes.status).toBe(201)
      expect(handle.server.projectsService.getActiveWatcherCount()).toBe(1)

      await stopServer(handle)
      expect(handle.server.projectsService.getActiveWatcherCount()).toBe(0)
    } finally {
      removeTempDataDir(dataDir)
    }
  })
})

// QA düzeltme turu 1 (BLOKLAYICI-1) — QA'nın birebir ölçtüğü senaryo: `projects.json`'ın
// rename hedefi bir dizinle işgal edilir (registry unit testindeki teknikle aynı, ölçülmüş ve
// güvenilir), böylece `writeAtomic` fırlar. Önceden bu, `req.on('end')`/dağıtıcı çağrı yığınında
// yakalanmadığı için süreç `uncaughtException` ile ölüyordu — düzeltme (`service.ts`'in kendi
// try/catch'i, "yerel" katman) bu istisnayı asla dışarı sızdırmaz.
describe('BLOKLAYICI-1 düzeltmesi: kayıt defteri yazma hatasında istemci 500 alır, süreç yaşar (D20)', () => {
  let dataDir: string
  let handle: ServerHandle
  let filePath: string

  beforeEach(async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
    filePath = path.join(dataDir, 'projects.json')
  })

  afterEach(async () => {
    // Engel hâlâ ayaktaysa (bir test başarısız olup erken çıkarsa) temizliği garanti et.
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      fs.rmdirSync(filePath)
    }
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('POST: rename hedefi dizinle işgal edilirse 500 storage_unavailable döner, süreç yaşar, engel kalkınca sonraki istek başarılı olur, bellek diskle tutarlı kalır', async () => {
    const project = createFixtureProject()
    // `projects.json` henüz hiç yok (init() dosya yoksa yazmaz) — rename hedefini BAŞTAN bir
    // dizinle işgal ediyoruz (registry unit testindeki `mkdirSync(filePath)` deseniyle aynı).
    fs.mkdirSync(filePath)

    const res = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('storage_unavailable')
    expect(body.error.message).toBe('Liste kaydedilemedi, tekrar deneyin.')

    // Süreç yaşıyor mu?
    const health = await fetch(`${handle.baseUrl}/api/health`)
    expect(health.status).toBe(200)

    // `.tmp` artığı temizlenmiş mi?
    const leftovers = fs
      .readdirSync(dataDir)
      .filter((name) => name.startsWith('.projects.') && name.endsWith('.tmp'))
    expect(leftovers).toHaveLength(0)

    // Bellek diskten ÖNCE güncellenmedi mi? Liste hâlâ boş görünmeli.
    const listRes = await fetch(`${handle.baseUrl}/api/projects`)
    const listBody = (await listRes.json()) as { data: unknown[] }
    expect(listBody.data).toHaveLength(0)

    // Engel kalkınca sonraki istek başarılı olur.
    fs.rmdirSync(filePath)
    const retryRes = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    expect(retryRes.status).toBe(201)
  })

  it('DELETE: başarılı ekleme sonrası projects.json bir dizinle işgal edilirse 500 storage_unavailable döner, süreç yaşar, bellek diskle tutarlı kalır', async () => {
    const project = createFixtureProject()
    const addRes = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mc-write': '1' },
      body: JSON.stringify({ path: project }),
    })
    expect(addRes.status).toBe(201)
    const addBody = (await addRes.json()) as { data: ProjectListItem }

    // Şimdi `projects.json` gerçek bir dosya — onu bir dizinle DEĞİŞTİRİYORUZ (rename hedefi
    // yine bir dizin olacak, `writeAtomic` yine fırlayacak).
    fs.rmSync(filePath)
    fs.mkdirSync(filePath)

    const removeRes = await fetch(`${handle.baseUrl}/api/projects/${addBody.data.id}`, {
      method: 'DELETE',
      headers: { 'x-mc-write': '1' },
    })
    expect(removeRes.status).toBe(500)
    const removeBody = (await removeRes.json()) as { error: { code: string; message: string } }
    expect(removeBody.error.code).toBe('storage_unavailable')
    expect(removeBody.error.message).toBe('Liste kaydedilemedi, tekrar deneyin.')

    // Süreç yaşıyor mu?
    const health = await fetch(`${handle.baseUrl}/api/health`)
    expect(health.status).toBe(200)

    // `.tmp` artığı temizlenmiş mi?
    const leftovers = fs
      .readdirSync(dataDir)
      .filter((name) => name.startsWith('.projects.') && name.endsWith('.tmp'))
    expect(leftovers).toHaveLength(0)

    // Bellek diskten ÖNCE güncellenmedi mi? Kayıt hâlâ listede görünmeli (silinmiş sayılmamalı).
    fs.rmdirSync(filePath)
    const listRes = await fetch(`${handle.baseUrl}/api/projects`)
    const listBody = (await listRes.json()) as { data: ProjectListItem[] }
    expect(listBody.data.find((p) => p.id === addBody.data.id)).toBeDefined()

    // Engel kalkınca sonraki istek başarılı olur.
    const retryRes = await fetch(`${handle.baseUrl}/api/projects/${addBody.data.id}`, {
      method: 'DELETE',
      headers: { 'x-mc-write': '1' },
    })
    expect(retryRes.status).toBe(200)
  })
})

// QA düzeltme turu 1 (BLOKLAYICI-1) — sistemik katman: dağıtıcının kendi çağrı yığınında senkron
// fırlayan HERHANGİ bir handler'ı (yukarıdaki `service.ts`'in "yerel" katmanından bağımsız
// olarak) 500'e çevirir, exception dışarı sızmaz. Gerçek HTTP/süreç riski almadan (bir
// `uncaughtException`'ın vitest worker'ının kendisini çökertme ihtimaline karşı) doğrudan,
// deterministik bir birim testle kanıtlanır.
describe('sistemik hata sınırı: withDispatchErrorBoundary (D20)', () => {
  it('senkron olarak fırlayan herhangi bir handler 500 internal_error döner, exception dışarı sızmaz', () => {
    const throwingHandler = (): void => {
      throw new Error('boom')
    }
    const wrapped = withDispatchErrorBoundary(throwingHandler)

    let statusCode = 0
    let endedBody = ''
    const fakeRes = {
      headersSent: false,
      writeHead(status: number) {
        statusCode = status
      },
      end(body?: string) {
        endedBody = body ?? ''
      },
    } as unknown as import('node:http').ServerResponse

    expect(() => wrapped({} as import('node:http').IncomingMessage, fakeRes)).not.toThrow()
    expect(statusCode).toBe(500)
    const parsed = JSON.parse(endedBody) as { success: boolean; error: { code: string } }
    expect(parsed.success).toBe(false)
    expect(parsed.error.code).toBe('internal_error')
  })

  it('headers zaten gönderilmişse yalnızca res.end() çağrılır, ikinci writeHead denenmez', () => {
    const throwingHandler = (): void => {
      throw new Error('boom, ama başlıklar zaten yazıldı')
    }
    const wrapped = withDispatchErrorBoundary(throwingHandler)

    let writeHeadCalls = 0
    let endCalls = 0
    const fakeRes = {
      headersSent: true,
      writeHead() {
        writeHeadCalls += 1
      },
      end() {
        endCalls += 1
      },
    } as unknown as import('node:http').ServerResponse

    expect(() => wrapped({} as import('node:http').IncomingMessage, fakeRes)).not.toThrow()
    expect(writeHeadCalls).toBe(0)
    expect(endCalls).toBe(1)
  })
})

// QA düzeltme turu 1 doğrulaması ÖNEMLİ-1: yukarıdaki birim testleri `withDispatchErrorBoundary`'nin
// KENDİ mantığını çitliyor ama `createServer`'ın gerçek dağıtıcısına BAĞLI olduğunu hiç ölçmüyordu
// (`index.ts:288`'deki sarmalayıcı kaldırılınca — M1 mutasyonu — tüm süit 430/430 yeşil kalıyordu).
// Bu test, statik metin taraması DEĞİL: gerçek `createServer()` + gerçek HTTP isteği kullanır.
// Üretim kodu hiç değişmez — `handleHealth`'in senkron olarak çağırdığı gerçek
// `projectsService.getActiveWatcherCount()` metodu, dağıtıcının kendi çağrı yığınında fırlayacak
// şekilde geçici olarak değiştirilir (test sonunda birebir geri alınır).
describe('sistemik hata sınırı: createServer gerçekten sarmalanmış dağıtıcıyı kullanıyor (D20/ÖNEMLİ-1 bağlantı kanıtı)', () => {
  it('gerçek HTTP isteğinde dağıtıcı yığınında fırlayan senkron hata 500 internal_error döner, süreç yaşar', async () => {
    const dataDir = createTempDataDir()
    const handle = await startServer(dataDir)
    const original = handle.server.projectsService.getActiveWatcherCount
    try {
      handle.server.projectsService.getActiveWatcherCount = () => {
        throw new Error('qa-probe-sync')
      }

      const res = await fetch(`${handle.baseUrl}/api/health`)
      expect(res.status).toBe(500)
      const body = (await res.json()) as { success: boolean; error: { code: string } }
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('internal_error')

      // Süreç yaşıyor mu? Sınır olmadan (M1 mutasyonu) bu senkron throw süreci
      // `uncaughtException` ile düşürürdü — bu istekten sonraki hiçbir istek yanıt alamazdı.
      handle.server.projectsService.getActiveWatcherCount = original
      const health2 = await fetch(`${handle.baseUrl}/api/health`)
      expect(health2.status).toBe(200)
    } finally {
      handle.server.projectsService.getActiveWatcherCount = original
      await stopServer(handle)
      removeTempDataDir(dataDir)
    }
  })
})

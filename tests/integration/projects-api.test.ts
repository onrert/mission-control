import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import http from 'node:http'
import { createServer, type ServerWithHub } from '../../src/server/index'
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
  size: number
  sha256: string
}

/** `(göreli yol, boyut, sha256)` manifesti — CEO kararı C, sözleşme §7. */
function snapshotManifest(root: string): ManifestEntry[] {
  const out: ManifestEntry[] = []
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else {
        const content = fs.readFileSync(full)
        out.push({
          relPath: path.relative(root, full),
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(missingBody.status).toBe(400)
    const missingJson = (await missingBody.json()) as { error: { code: string } }
    expect(missingJson.error.code).toBe('invalid_body')

    const noFeatures = makeProjectDir()
    const invalidRes = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: project }),
    })
    expect(first.status).toBe(201)

    const second = await fetch(`${handle.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
        headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: project }),
    })
    const addBody = (await addRes.json()) as { data: ProjectListItem }
    const projectId = addBody.data.id

    const sse = await connectSse(handle.port)
    try {
      const removeRes = await fetch(`${handle.baseUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
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
    const res = await fetch(`${handle.baseUrl}/api/projects/p_yok`, { method: 'DELETE' })
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
        headers: { 'content-type': 'application/json' },
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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: p }),
      })
      expect(res.status).toBe(201)
    }
    const healthRes = await fetch(`${handle.baseUrl}/api/health`)
    const health = (await healthRes.json()) as { watchers: number }
    expect(health.watchers).toBe(2)
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
      headers: { 'content-type': 'application/json' },
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
      headers: { Origin: handle.baseUrl },
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
      headers: { 'content-type': 'application/json' },
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
        headers: { 'content-type': 'application/json' },
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

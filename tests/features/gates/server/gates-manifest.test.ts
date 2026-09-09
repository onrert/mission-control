import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createServer, type ServerWithHub } from '../../../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'
import { snapshotDir, type ManifestEntry } from '../../../helpers/manifest'
import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../../../../src/shared/types'
import { buildApprovalBody } from '../../../../src/features/gates/shared/format-approval'

// S1 (F-008 sözleşmesi §13) — sunucu `expectedBody`'yi kendi ürettiğiyle karşılaştırır; bu
// fixture'da `docs/PROCESS.md` yok, etiketler `list-gates.ts`'in gömülü yedeğinden gelir
// (G1 → 'PRD', G2 → 'Mimari'), proje etiketi `addProject(..., 'fixture')`'tan.
function approveBody(gateId: string, label: string, decision: string) {
  return {
    confirmed: true,
    decision,
    expectedBody: buildApprovalBody(
      gateId,
      label,
      'fixture',
      new Date().toISOString().slice(0, 10),
      decision
    ),
  }
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

function writeRequest(
  baseUrl: string,
  urlPath: string,
  body: unknown
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl)
    const payload = JSON.stringify(body)
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE,
        },
      },
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
    req.write(payload)
    req.end()
  })
}

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function byPath(entries: ManifestEntry[]): Map<string, ManifestEntry> {
  return new Map(entries.map((e) => [e.relPath, e]))
}

let dataDir: string
let projectDir: string
let handle: ServerHandle
let projectId: string

beforeEach(async () => {
  dataDir = createTempDataDir()
  projectDir = createTempDataDir()
  fs.mkdirSync(path.join(projectDir, 'docs', 'features'), { recursive: true })
  fs.mkdirSync(path.join(projectDir, 'docs', 'approvals'), { recursive: true })
  writeFile(projectDir, 'README.md', '# proje')
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

describe('gates manifest testi (F-008 sözleşmesi §10.1) — gerçek fs, gerçek HTTP akışı', () => {
  it('AC7/AC9: onay + red + arşivleme akışı — izin verilenler dışında hiçbir dosya değişmez', async () => {
    // Sahne: G2 daha önce reddedilmiş (arşivleme + AC9 sırasını tetiklemek için).
    writeFile(projectDir, 'docs/approvals/G2.deny.md', 'önceki red gerekçesi')

    // Before anlık görüntüsü TÜM çağrılardan ÖNCE alınır.
    const before = snapshotDir(projectDir, { includeMtime: true })
    const beforeByPath = byPath(before)
    const g2DenyBefore = beforeByPath.get('docs/approvals/G2.deny.md')
    if (!g2DenyBefore) throw new Error('fixture eksik')

    // 1) Pending bir kapıyı onayla (G1).
    const approveRes = await writeRequest(
      handle.baseUrl,
      `/api/gates/${projectId}/G1/approve`,
      approveBody('G1', 'PRD', 'G1 onaylandı')
    )
    expect(approveRes.status).toBe(200)

    // 2) Pending bir kapıyı reddet (G3).
    const denyRes = await writeRequest(handle.baseUrl, `/api/gates/${projectId}/G3/deny`, {
      reason: 'G3 reddedildi',
    })
    expect(denyRes.status).toBe(200)

    // 3) Daha önce reddedilmiş bir kapıyı onayla (G2) — AC9: arşivle, sonra onayı yaz.
    const reapproveRes = await writeRequest(
      handle.baseUrl,
      `/api/gates/${projectId}/G2/approve`,
      approveBody('G2', 'Mimari', 'G2 yeniden onaylandı')
    )
    expect(reapproveRes.status).toBe(200)

    const after = snapshotDir(projectDir, { includeMtime: true })
    const afterByPath = byPath(after)

    // G2.deny.md ARTIK YOK (taşındı, silinmedi — arşiv hedefinde AYNI içerikle var).
    expect(afterByPath.has('docs/approvals/G2.deny.md')).toBe(false)
    const archiveEntry = after.find(
      (e) => e.relPath.startsWith('docs/approvals/archive/G2-') && e.relPath.endsWith('.deny.md')
    )
    expect(archiveEntry).toBeDefined()
    expect(archiveEntry?.sha256).toBe(g2DenyBefore.sha256)
    expect(archiveEntry?.size).toBe(g2DenyBefore.size)

    // İzin verilen değişen/eklenen kümenin DIŞINDA hiçbir dosya değişmedi.
    const allowedChangedOrAdded = new Set([
      'docs/approvals/G1.ok',
      'docs/approvals/G3.deny.md',
      'docs/approvals/G2.ok',
      archiveEntry!.relPath,
    ])
    const removedBySource = new Set(['docs/approvals/G2.deny.md'])
    for (const [relPath, beforeEntry] of beforeByPath) {
      if (allowedChangedOrAdded.has(relPath) || removedBySource.has(relPath)) continue
      const afterEntry = afterByPath.get(relPath)
      expect(afterEntry).toEqual(beforeEntry)
    }
    for (const entry of after) {
      const wasPresent = beforeByPath.has(entry.relPath)
      const beforeEntry = beforeByPath.get(entry.relPath)
      const changed =
        !wasPresent || beforeEntry?.sha256 !== entry.sha256 || beforeEntry?.size !== entry.size
      if (changed) {
        expect(allowedChangedOrAdded.has(entry.relPath)).toBe(true)
      }
    }

    // Onaylanan/reddedilen dosyaların içeriği gerçekten yazıldı (pozitif iddia).
    expect(fs.readFileSync(path.join(projectDir, 'docs/approvals/G1.ok'), 'utf8')).toContain(
      'G1 onaylandı'
    )
    expect(fs.readFileSync(path.join(projectDir, 'docs/approvals/G3.deny.md'), 'utf8')).toContain(
      'G3 reddedildi'
    )
    expect(fs.readFileSync(path.join(projectDir, 'docs/approvals/G2.ok'), 'utf8')).toContain(
      'G2 yeniden onaylandı'
    )
  })

  it('AC3: boş gerekçeyle deny çağrısı sonrası hiçbir dosya değişmedi', async () => {
    const before = snapshotDir(projectDir)
    const res = await writeRequest(handle.baseUrl, `/api/gates/${projectId}/G1/deny`, {
      reason: '   ',
    })
    expect(res.status).toBe(400)
    const after = snapshotDir(projectDir)
    expect(after).toEqual(before)
  })

  it('B6: onaylı bir kapıda deny çağrısı 409 döner, dosya yazılmaz', async () => {
    writeFile(projectDir, 'docs/approvals/G1.ok', 'onaylandı')
    const before = snapshotDir(projectDir)
    const res = await writeRequest(handle.baseUrl, `/api/gates/${projectId}/G1/deny`, {
      reason: 'reddetmeye çalışıyorum',
    })
    expect(res.status).toBe(409)
    const after = snapshotDir(projectDir)
    expect(after).toEqual(before)
  })

  it('MUTASYON kanıtı: manifest diff gerçekten izin verilmeyen bir değişikliği yakalar', () => {
    const before = snapshotDir(projectDir)
    writeFile(projectDir, 'README.md', '# BOZULDU (izin verilmeyen değişiklik simülasyonu)')
    const after = snapshotDir(projectDir)
    const beforeByPath = byPath(before)
    const afterByPath = byPath(after)
    let sawUnexpectedChange = false
    for (const [relPath, beforeEntry] of beforeByPath) {
      const afterEntry = afterByPath.get(relPath)
      if (JSON.stringify(afterEntry) !== JSON.stringify(beforeEntry)) {
        sawUnexpectedChange = true
      }
    }
    expect(sawUnexpectedChange).toBe(true)
  })

  it('M11: includeMtime olmadan mtime-only dokunuş görünmez, includeMtime:true ile görünür', async () => {
    writeFile(projectDir, 'docs/approvals/G1.ok', 'onaylandı')
    const filePath = path.join(projectDir, 'docs', 'approvals', 'G1.ok')

    const beforeWithMtime = snapshotDir(projectDir, { includeMtime: true })
    const beforeWithoutMtime = snapshotDir(projectDir)

    // mtime-only dokunuş: içerik/boyut/sha256 AYNI kalır, yalnızca mtime değişir.
    const future = new Date(Date.now() + 10_000)
    fs.utimesSync(filePath, future, future)

    const afterWithMtime = snapshotDir(projectDir, { includeMtime: true })
    const afterWithoutMtime = snapshotDir(projectDir)

    const g1Before = beforeWithMtime.find((e) => e.relPath === 'docs/approvals/G1.ok')
    const g1After = afterWithMtime.find((e) => e.relPath === 'docs/approvals/G1.ok')
    // includeMtime:true İLE fark görülür (TEK çit budur).
    expect(g1After?.mtimeMs).not.toBe(g1Before?.mtimeMs)
    expect(g1After?.sha256).toBe(g1Before?.sha256)
    expect(g1After?.size).toBe(g1Before?.size)

    // includeMtime OLMADAN (varsayılan) aynı dokunuş HİÇBİR KATMANDAN kırmızı almaz.
    expect(afterWithoutMtime).toEqual(beforeWithoutMtime)
  })
})

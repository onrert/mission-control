import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createServer, type ServerWithHub } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { connectSse } from '../helpers/sse-client'
import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../../src/shared/types'
import { buildApprovalBody } from '../../src/features/gates/shared/format-approval'

// S1 (F-008 sözleşmesi §13, QA Bulgu 2 düzeltmesi) — sunucu `expectedBody`'yi KENDİ ürettiği
// içerikle karşılaştırır; testler bu yüzden gerçek `buildApprovalBody` çıktısını göndermeli
// (fixture'larda `docs/PROCESS.md` YOK, bu yüzden etiketler `FALLBACK_LABELS`'tan gelir —
// `list-gates.ts`'in gömülü yedeği: G1 → 'PRD', G2 → 'Mimari').
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function approveBody(
  gateId: string,
  label: string,
  projectLabel: string,
  decision: string
): { confirmed: true; decision: string; expectedBody: string } {
  return {
    confirmed: true,
    decision,
    expectedBody: buildApprovalBody(gateId, label, projectLabel, todayIso(), decision),
  }
}

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

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
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

describe('GET /api/gates (AC1)', () => {
  it('project_id eksik → 400 invalid_body', async () => {
    const res = await request(handle.baseUrl, 'GET', '/api/gates')
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
  })

  it('bilinmeyen project_id → 404 not_found', async () => {
    const res = await request(handle.baseUrl, 'GET', '/api/gates?project_id=hic-yok')
    expect(res.status).toBe(404)
    expect((res.json as { error: { code: string } }).error.code).toBe('not_found')
  })

  it('mutlu yol → 200, temel katalog + process_doc_readable + unrecognized', async () => {
    const res = await request(handle.baseUrl, 'GET', `/api/gates?project_id=${projectId}`)
    expect(res.status).toBe(200)
    const body = res.json as {
      success: boolean
      data: { gates: Array<{ id: string; status: string }>; process_doc_readable: boolean }
    }
    expect(body.success).toBe(true)
    expect(body.data.gates.map((g) => g.id)).toEqual(['G0', 'G1', 'G2', 'G3', 'ASSETS', 'G5', 'G6'])
    expect(body.data.gates.every((g) => g.status === 'pending')).toBe(true)
  })

  it('x-mc-write GEREKMEZ (salt okunur GET)', async () => {
    const res = await request(handle.baseUrl, 'GET', `/api/gates?project_id=${projectId}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/gates/:project_id/:gate/approve — doğrulama', () => {
  it('x-mc-write eksik → 403 forbidden_origin, dosya yazılmaz', async () => {
    const res = await request(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
      confirmed: true,
      decision: 'karar',
    })
    expect(res.status).toBe(403)
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.ok'))).toBe(false)
  })

  it('confirmed eksik/false → 400 invalid_body, dosya yazılmaz (M1)', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
      confirmed: false,
      decision: 'karar',
    })
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.ok'))).toBe(false)
  })

  it('decision boş/whitespace → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
      confirmed: true,
      decision: '   ',
    })
    expect(res.status).toBe(400)
  })

  it('decision > 4000 karakter → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
      confirmed: true,
      decision: 'x'.repeat(4001),
    })
    expect(res.status).toBe(400)
  })

  it('geçersiz kapı id → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G99/approve`, {
      confirmed: true,
      decision: 'karar',
      expectedBody: 'ilgisiz — gate id kontrolü expectedBody karşılaştırmasından ÖNCE çalışır',
    })
    expect(res.status).toBe(400)
  })

  it('bilinmeyen project_id → 404 not_found', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/hic-yok/G1/approve`, {
      confirmed: true,
      decision: 'karar',
      expectedBody: 'ilgisiz — proje bulunamadı kontrolü karşılaştırmadan ÖNCE çalışır',
    })
    expect(res.status).toBe(404)
  })

  it('expectedBody eksik/string değil → 400 invalid_body, dosya yazılmaz (S1)', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
      confirmed: true,
      decision: 'karar',
    })
    expect(res.status).toBe(400)
    expect((res.json as { error: { code: string } }).error.code).toBe('invalid_body')
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.ok'))).toBe(false)
  })
})

describe('POST approve — önizleme ≡ diske yazılan bayt eşitliği (S1, QA Bulgu 2)', () => {
  it('expectedBody sunucunun üreteceğinden farklıysa 409 conflict, dosya yazılmaz', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
      confirmed: true,
      decision: 'gerçek karar',
      expectedBody: buildApprovalBody('G1', 'PRD', 'fixture', todayIso(), 'BAŞKA BİR KARAR METNİ'),
    })
    expect(res.status).toBe(409)
    const body = res.json as { success: boolean; error: { code: string } }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('conflict')
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.ok'))).toBe(false)
  })

  it(
    'QA-B sınıfı: decision gönderilmeden hemen önce değiştirilirse (önizlemeyle uyuşmaz), ' +
      'yazma engellenir',
    async () => {
      // `ApproveModal.tsx`'in `onConfirm(decision, preview)` çağrısında `decision`'ın önizleme
      // render edildikten SONRA bir mutasyonla değiştirildiği senaryonun sunucu tarafı ölçümü:
      // `expectedBody` (önizleme) ORİJİNAL karar metniyle üretildi, `decision` (gönderilen)
      // FARKLI — sunucu ikisinin uyuşmadığını görüp reddetmeli.
      const originalDecision = 'onaylıyorum'
      const tamperedDecision = originalDecision + ' [QA gizli ek]'
      const preview = buildApprovalBody('G1', 'PRD', 'fixture', todayIso(), originalDecision)
      const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
        confirmed: true,
        decision: tamperedDecision,
        expectedBody: preview,
      })
      expect(res.status).toBe(409)
      expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.ok'))).toBe(false)
    }
  )

  it('expectedBody sunucununkiyle BİREBİR eşleşirse 200, .ok yazılır (mutlu yol regresyonu)', async () => {
    const res = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${projectId}/G1/approve`,
      approveBody('G1', 'PRD', 'fixture', 'onaylıyorum')
    )
    expect(res.status).toBe(200)
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.ok'))).toBe(true)
  })
})

describe('POST /api/gates/:project_id/:gate/approve — mutlu yol (AC2/AC7)', () => {
  it('geçerli istek → 200, .ok yazılır, içerik PROCESS.md formatında', async () => {
    const res = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${projectId}/G1/approve`,
      approveBody('G1', 'PRD', 'fixture', 'G1 onaylandı, ilerleyelim')
    )
    expect(res.status).toBe(200)
    const body = res.json as { success: boolean; data: { id: string; status: string } }
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('approved')
    const content = fs.readFileSync(path.join(projectDir, 'docs/approvals/G1.ok'), 'utf8')
    expect(content).toContain('G1 — PRD kapısı ONAYLANDI')
    expect(content).toContain('Kullanıcının kararı: G1 onaylandı, ilerleyelim')
  })

  it('M9: başarılı onay sonrası "gates" SSE kanalında {project_id} yayınlanır', async () => {
    // İZOLASYON NOTU: bu proje `docs/approvals` OLMADAN eklenir — aksi hâlde `gates-watcher.ts`
    // (§7, dosya sistemi izleyicisi) da AYNI SSE olayını kendi başına yayınlar ve handler'ın
    // KENDİ `hub.broadcast(...)` çağrısı silinse bile bu test yanlışlıkla YEŞİL kalır (ölçüldü —
    // ilk yazımda izleyici maskelemesi yüzünden M9 mutasyonu KIRMIZI vermiyordu). `docs/approvals`
    // yokken proje eklendiği için izleyici hiç başlamaz (§7); `writeGateApproval` dizini kendisi
    // `mkdirSync(recursive:true)` ile oluşturur, bu yüzden onay akışı yine de başarılı olur.
    const isolatedProjectDir = createTempDataDir()
    fs.mkdirSync(path.join(isolatedProjectDir, 'docs', 'features'), { recursive: true })
    const added = handle.server.projectsService.addProject(isolatedProjectDir, 'izole')
    if (!added.ok) throw new Error('izole proje eklenemedi')
    expect(fs.existsSync(path.join(isolatedProjectDir, 'docs', 'approvals'))).toBe(false)

    const client = await connectSse(handle.port)
    await client.waitForFrame((f) => f.event === 'hello')

    const res = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${added.item.id}/G1/approve`,
      approveBody('G1', 'PRD', 'izole', 'karar')
    )
    expect(res.status).toBe(200)

    const frame = await client.waitForFrame((f) => f.event === 'gates')
    expect(JSON.parse(frame.data)).toEqual({ project_id: added.item.id })
    client.close()
    removeTempDataDir(isolatedProjectDir)
  })
})

describe('S1 borç kapatma — kanonik olmayan harfli onay dosyası varken yazma kalıcı 500 vermemeli', () => {
  // `docs/blockers.md` "F-008 kapanışından taşınan iki borç" madde 1: `docs/approvals/g2.ok`
  // (küçük harf) varken `write-gate.ts`'in `resolveInsideRoot`'u adım 5'te `realpathSync.native`
  // ile diskteki GERÇEK (küçük harfli) adı döndürüyor, ama `OPERATION_PATTERNS.approval` harfe
  // duyarlıydı ve `g2.ok` ile eşleşmiyordu → `write_denied` → handler bunu 500 `write_failed`'e
  // çeviriyordu. Dosya diskte kalıcı olduğu için bu her denemede TEKRARLANIYORDU (kalıcı 500).
  it('g2.ok küçük harfle mevcutken G2 onayı 200 döner, dosya güncellenir (ilk deneme)', async () => {
    writeFile(projectDir, 'docs/approvals/g2.ok', 'eski küçük harfli içerik\n')

    const res = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${projectId}/G2/approve`,
      approveBody('G2', 'Mimari', 'fixture', 'kanonik olmayan dosya varken onay')
    )

    expect(res.status).toBe(200)
    const body = res.json as { success: boolean; data: { status: string } }
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('approved')
    expect(fs.readFileSync(path.join(projectDir, 'docs/approvals/g2.ok'), 'utf8')).toContain(
      'kanonik olmayan dosya varken onay'
    )
  })

  it('kalıcılık: g2.ok varken İKİNCİ deneme de 200 döner (bir öncekinin şansı değil)', async () => {
    writeFile(projectDir, 'docs/approvals/g2.ok', 'eski küçük harfli içerik\n')

    const first = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${projectId}/G2/approve`,
      approveBody('G2', 'Mimari', 'fixture', 'birinci deneme')
    )
    expect(first.status).toBe(200)

    const second = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${projectId}/G2/approve`,
      approveBody('G2', 'Mimari', 'fixture', 'ikinci deneme')
    )
    expect(second.status).toBe(200)
    expect(fs.readFileSync(path.join(projectDir, 'docs/approvals/g2.ok'), 'utf8')).toContain(
      'ikinci deneme'
    )
  })

  it('GET /api/gates de g2.ok varken G2 durumunu "approved" gösterir (S2 emsaliyle tutarlı)', async () => {
    writeFile(projectDir, 'docs/approvals/g2.ok', 'içerik\n')
    const res = await request(handle.baseUrl, 'GET', `/api/gates?project_id=${projectId}`)
    expect(res.status).toBe(200)
    const body = res.json as { data: { gates: Array<{ id: string; status: string }> } }
    const g2 = body.data.gates.find((g) => g.id === 'G2')
    expect(g2?.status).toBe('approved')
  })
})

describe('POST /api/gates/:project_id/:gate/deny — doğrulama + mutlu yol (AC3/AC8)', () => {
  it('reason boş/whitespace → 400 invalid_body, dosya yazılmaz (M5)', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G3/deny`, {
      reason: '   ',
    })
    expect(res.status).toBe(400)
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G3.deny.md'))).toBe(false)
  })

  it('reason > 4000 karakter → 400 invalid_body', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G3/deny`, {
      reason: 'x'.repeat(4001),
    })
    expect(res.status).toBe(400)
  })

  it('geçerli istek → 200, .deny.md yazılır, gerekçe olduğu gibi geçer', async () => {
    const reason = 'Bütçe onaylanmadı.\nTekrar değerlendirilecek.'
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G3/deny`, {
      reason,
    })
    expect(res.status).toBe(200)
    const body = res.json as { success: boolean; data: { status: string } }
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('denied')
    const content = fs.readFileSync(path.join(projectDir, 'docs/approvals/G3.deny.md'), 'utf8')
    expect(content).toContain(reason)
  })

  it('B6: onaylı kapıda deny → 409 conflict, dosya yazılmaz, taze data döner', async () => {
    writeFile(projectDir, 'docs/approvals/G1.ok', 'zaten onaylı')
    const before = fs.readFileSync(path.join(projectDir, 'docs/approvals/G1.ok'), 'utf8')
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/deny`, {
      reason: 'reddetmeye çalışıyorum',
    })
    expect(res.status).toBe(409)
    const body = res.json as {
      success: boolean
      error: { code: string; message: string }
      data: { status: string }
    }
    expect(body.error.code).toBe('conflict')
    expect(body.error.message).toBe('Bu kapı zaten onaylı, reddedilemez.')
    expect(body.data.status).toBe('approved')
    expect(fs.readFileSync(path.join(projectDir, 'docs/approvals/G1.ok'), 'utf8')).toBe(before)
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G1.deny.md'))).toBe(false)
  })
})

describe('AC9 — arşivle sonra onayla (sıra + M6 fault injection)', () => {
  it('mutlu yol: önce arşivlenir, sonra onay yazılır, .ok içeriği doğru', async () => {
    writeFile(projectDir, 'docs/approvals/G2.deny.md', 'önceki red')
    const res = await writeRequest(
      handle.baseUrl,
      'POST',
      `/api/gates/${projectId}/G2/approve`,
      approveBody('G2', 'Mimari', 'fixture', 'yeniden onaylandı')
    )
    expect(res.status).toBe(200)
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G2.deny.md'))).toBe(false)
    expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G2.ok'))).toBe(true)
    const archiveDir = path.join(projectDir, 'docs/approvals/archive')
    const archived = fs.readdirSync(archiveDir).filter((f) => f.startsWith('G2-'))
    expect(archived.length).toBe(1)
  })

  it(
    'M6: writeGateApproval başarısız olsa bile arşivleme ZATEN gerçekleşmiş olur ' +
      '(§6 yarı-başarı — 500, kapı "pending", data + arşiv yolunu içeren mesaj döner)',
    async () => {
      writeFile(projectDir, 'docs/approvals/G2.deny.md', 'önceki red')
      const originalOpenSync = fs.openSync.bind(fs)
      const openSpy = vi
        .spyOn(fs, 'openSync')
        .mockImplementation((...args: Parameters<typeof fs.openSync>) => {
          const target = args[0]
          // Yalnızca G2'nin ONAY tmp dosyasını hedefler (`.G2.ok.<pid>-<hex>.tmp`) —
          // archiveDenial'ın kendi `renameSync`'i (tmp dosyası KULLANMAZ) etkilenmez.
          if (typeof target === 'string' && path.basename(target).includes('.G2.ok.')) {
            throw new Error('simüle edilmiş disk hatası (test, M6)')
          }
          return originalOpenSync(...args)
        })
      try {
        const res = await writeRequest(
          handle.baseUrl,
          'POST',
          `/api/gates/${projectId}/G2/approve`,
          approveBody('G2', 'Mimari', 'fixture', 'yeniden onaylandı')
        )
        expect(res.status).toBe(500)
        const body = res.json as {
          success: boolean
          error: { code: string; message: string }
          data: { status: string }
        }
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('write_failed')
        expect(body.error.message).toContain('altına taşındı ama onay yazılamadı')
        expect(body.error.message).toContain('archive/G2-')
        // M8: yarı-başarı `data` alanı düşürülmedi, taze durumu yansıtıyor.
        expect(body.data.status).toBe('pending')

        // Asıl kanıt: .deny.md ZATEN arşive taşınmış (onay başarısız olsa da) — AC9 sırası.
        expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G2.deny.md'))).toBe(false)
        const archiveDir = path.join(projectDir, 'docs/approvals/archive')
        const archived = fs.readdirSync(archiveDir).filter((f) => f.startsWith('G2-'))
        expect(archived.length).toBe(1)
        expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G2.ok'))).toBe(false)
      } finally {
        openSpy.mockRestore()
      }

      // Yeniden deneme güvenli/idempotenttir (§6): ikinci istekte artık `.deny.md` yok,
      // yalnızca onay yazılır.
      const retryRes = await writeRequest(
        handle.baseUrl,
        'POST',
        `/api/gates/${projectId}/G2/approve`,
        approveBody('G2', 'Mimari', 'fixture', 'tekrar deneniyor')
      )
      expect(retryRes.status).toBe(200)
      expect(fs.existsSync(path.join(projectDir, 'docs/approvals/G2.ok'))).toBe(true)
    }
  )
})

describe("AC5 — beklenmeyen hata (dağıtıcının genel sınırı DEĞİL, handler kendi try/catch'i)", () => {
  it('projectsService.list() fırlarsa 500 write_failed döner, süreç yaşar, ham hata sızmaz', async () => {
    const listSpy = vi.spyOn(handle.server.projectsService, 'list').mockImplementation(() => {
      throw new Error('ÇOK GİZLİ İÇ HATA, İSTEMCİYE SIZMAMALI')
    })
    try {
      const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/approve`, {
        confirmed: true,
        decision: 'karar',
        expectedBody:
          'ilgisiz — projectsService.list() expectedBody karşılaştırmasından ÖNCE fırlar',
      })
      expect(res.status).toBe(500)
      const body = res.json as { success: boolean; error: { code: string; message: string } }
      expect(body.success).toBe(false)
      // Q6: bu, dağıtıcının SENKRON sınırı (`internal_error`) DEĞİL — `projectsService.list()`
      // çağrısı `req.on('end', ...)` içinde (asenkron), handler'ın KENDİ try/catch'i yakalar.
      expect(body.error.code).toBe('write_failed')
      expect(body.error.message).not.toContain('ÇOK GİZLİ')
    } finally {
      listSpy.mockRestore()
    }
    const followUp = await request(handle.baseUrl, 'GET', '/api/health')
    expect(followUp.status).toBe(200)
  })
})

describe('geçersiz /api/gates/... yolu → 404', () => {
  it('eksik segment → 404 not_found', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1`, {})
    expect(res.status).toBe(404)
  })

  it('bilinmeyen aksiyon → 404 not_found', async () => {
    const res = await writeRequest(handle.baseUrl, 'POST', `/api/gates/${projectId}/G1/sil`, {})
    expect(res.status).toBe(404)
  })
})

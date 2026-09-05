import type http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { setFeatureStatus } from '../../../server/write-gate'
import { listFeaturesDetailed } from './list-features'
import { parseFeatureCard } from './parse-feature'
import type { ApiResponse, FeatureCard, ProjectListItem } from '../../../shared/types'
import type { ProjectsService } from '../../projects/server/service'

const MAX_BODY_BYTES = 65536
const MAX_STATUS_LENGTH = 64

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendInvalidBody(res: http.ServerResponse, message: string): void {
  sendJson(res, 400, { success: false, error: { code: 'invalid_body', message } })
}

/** `GET /api/features?project_id=…` (sözleşme §4.1). */
export function handleListFeatures(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  projectsService: ProjectsService
): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const projectId = url.searchParams.get('project_id')
  const allProjects = projectsService.list().items
  const projects = projectId === null ? allProjects : allProjects.filter((p) => p.id === projectId)

  const { cards, unreadableProjects } = listFeaturesDetailed(projects)
  const body: ApiResponse<FeatureCard[]> = { success: true, data: cards }
  if (unreadableProjects.length > 0) {
    body.meta = { unreadable_projects: unreadableProjects }
  }
  sendJson(res, 200, body)
}

/** Diskten güncel `FeatureCard`'ı yeniden okur (§4.2 adım 5 — write-gate `FeatureCard` üretmiyor). */
function rereadCard(project: ProjectListItem, fileName: string): FeatureCard {
  const filePath = path.join(project.path, 'docs', 'features', fileName)
  const buffer = fs.readFileSync(filePath)
  const mtimeMs = fs.statSync(filePath).mtimeMs
  return parseFeatureCard(buffer, project.id, fileName, mtimeMs)
}

interface PatchBody {
  status?: unknown
  expected_hash?: unknown
}

/** `PATCH /api/features/:project_id/:file` (sözleşme §4.2). */
export function handlePatchFeatureStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  projectsService: ProjectsService,
  rawProjectId: string,
  rawFile: string
): void {
  const chunks: Buffer[] = []
  let totalBytes = 0
  let aborted = false

  req.on('data', (chunk: Buffer) => {
    if (aborted) return
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      aborted = true
      sendInvalidBody(res, 'İstek gövdesi çok büyük.')
      return
    }
    chunks.push(chunk)
  })

  req.on('error', () => {
    aborted = true
  })

  req.on('end', () => {
    if (aborted) return

    let parsed: PatchBody
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as PatchBody
    } catch {
      sendInvalidBody(res, 'İstek gövdesi geçerli JSON değil.')
      return
    }

    const status = parsed.status
    const expectedHash = parsed.expected_hash
    if (typeof status !== 'string' || status.length === 0 || status.length > MAX_STATUS_LENGTH) {
      sendInvalidBody(res, 'Dosya biçimi tanınamadı.')
      return
    }
    if (typeof expectedHash !== 'string' || expectedHash.length === 0) {
      sendInvalidBody(res, 'Dosya biçimi tanınamadı.')
      return
    }

    let projectId: string
    let fileName: string
    try {
      projectId = decodeURIComponent(rawProjectId)
      fileName = decodeURIComponent(rawFile)
    } catch {
      sendInvalidBody(res, 'Dosya biçimi tanınamadı.')
      return
    }

    const project = projectsService.list().items.find((p) => p.id === projectId)
    if (!project) {
      sendJson(res, 404, {
        success: false,
        error: { code: 'not_found', message: 'Proje bulunamadı.' },
      })
      return
    }

    void (async () => {
      // QA düzeltme turu 1 (BLOKLAYICI B1) — bu IIFE'nin GÖVDESİ tamamı `try/catch` içine
      // alındı: `rereadCard` (senkron `fs` çağrıları) fırlatırsa `withDispatchErrorBoundary`
      // (yalnızca SENKRON dağıtımı sarar) bunu YAKALAYAMIYORDU — istek sonsuza kadar yanıtsız
      // kalıyor, istemcinin `pendingKeys`'i hiç temizlenmiyordu (QA'nın fault injection'ı,
      // `docs/qa/F-007-2026-09-06.md` B1). Artık HANGİ HATA olursa olsun istemciye bir yanıt
      // gider, süreç yaşamaya devam eder.
      try {
        const result = await setFeatureStatus(project.path, fileName, status, expectedHash)

        if (result.ok) {
          try {
            const data = rereadCard(project, fileName)
            const body: ApiResponse<FeatureCard> = { success: true, data }
            sendJson(res, 200, body)
          } catch (rereadErr) {
            // Yarı-başarı (CEO kararı D46 madde 2): disk yazması BAŞARILI oldu ama en güncel
            // hâli okunamadı (ör. AV programı dosyayı kısa süreliğine kilitledi — tam da
            // ADR-005 madde 5'in yazma tarafı için zaten kabul ettiği EPERM/EBUSY penceresinin
            // okuma eşdeğeri). İstemciye sessizce 500 dönüp "olmadı" dedirtmek YANLIŞ olurdu —
            // yazma gerçekten oldu. `data` OLMADAN `success:true` dönülür; istemci
            // (`useFeatures.ts` `patchStatus`) bunu "yazıldı, iyimser görünüm korunur, chokidar
            // `features` echo'su birkaç saniye içinde gerçek `content_hash`'i getirip
            // düzeltecek" (AC3, ≤2sn) olarak yorumlar — rollback YAPILMAZ.
            const message = rereadErr instanceof Error ? rereadErr.message : String(rereadErr)
            process.stderr.write(
              `Uyarı: durum yazıldı ama güncel kart okunamadı (${fileName}): ${message}\n`
            )
            sendJson(res, 200, { success: true } satisfies ApiResponse<FeatureCard>)
          }
          return
        }

        if (result.code === 'conflict') {
          try {
            const data = rereadCard(project, fileName)
            const body: ApiResponse<FeatureCard> = {
              success: false,
              error: { code: 'conflict', message: 'Dosya değişti, güncel hali yüklendi.' },
              data,
            }
            sendJson(res, 409, body)
          } catch (rereadErr) {
            const message = rereadErr instanceof Error ? rereadErr.message : String(rereadErr)
            process.stderr.write(
              `Hata: çakışma sonrası güncel kart okunamadı (${fileName}): ${message}\n`
            )
            sendJson(res, 500, {
              success: false,
              error: {
                code: 'write_failed',
                message: 'Dosya değişti ama güncel hâli okunamadı. Tekrar deneyin.',
              },
            })
          }
          return
        }

        if (result.code === 'write_denied') {
          sendJson(res, 403, {
            success: false,
            error: { code: 'write_denied', message: 'Dosyaya yazma izni reddedildi.' },
          })
          return
        }

        if (result.code === 'write_failed') {
          // write-gate'in ham `describeError()` metni istemciye SIZDIRILMAZ (mimari §6) —
          // yalnızca sunucu stderr'ine loglanır, sabit UX metni döner.
          process.stderr.write(`Hata: özellik durumu yazılamadı (${fileName}): ${result.message}\n`)
          sendJson(res, 500, {
            success: false,
            error: { code: 'write_failed', message: 'Dosyaya yazma izni reddedildi.' },
          })
          return
        }

        // result.code === 'invalid_body'
        sendInvalidBody(res, 'Dosya biçimi tanınamadı.')
      } catch (err) {
        // Güvenlik ağı (CEO kararı D46 madde 1, BLOKLAYICI): `setFeatureStatus`'un kendisi
        // veya yukarıdaki dallardan biri öngörülemeyen bir hata fırlatırsa istemci ASLA
        // yanıtsız kalmaz — genel 500, ham hata metni sızmaz.
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(
          `Hata: özellik durumu güncellenirken beklenmeyen hata oluştu (${fileName}): ${message}\n`
        )
        sendJson(res, 500, {
          success: false,
          error: { code: 'write_failed', message: 'Dosyaya yazma izni reddedildi.' },
        })
      }
    })()
  })
}

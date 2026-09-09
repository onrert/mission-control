import type http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { archiveDenial, writeGateApproval, writeGateDenial } from '../../../server/write-gate'
import { isValidGateId } from '../shared/gate-id'
import { buildApprovalBody, buildDenialBody } from '../shared/format-approval'
import { getGateStatus, listGates } from './list-gates'
import type { SseHub } from '../../../server/sse/hub'
import type { ApiResponse, GateStatusItem, GatesListResponse } from '../../../shared/types'
import type { ProjectsService } from '../../projects/server/service'

const MAX_BODY_BYTES = 65536
const MAX_TEXT_LENGTH = 4000

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendInvalidBody(res: http.ServerResponse, message: string): void {
  sendJson(res, 400, { success: false, error: { code: 'invalid_body', message } })
}

function isBlankOrTooLong(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '' || value.length > MAX_TEXT_LENGTH
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * §7 "Canlı güncelleme" — panelin kendi yazması sonrası `gates` kanalında yayın. `service.ts`'in
 * `safelyNotify` deseniyle AYNI ilke (D27/NOT-4): yazma zaten başarılı olduktan SONRA çalışan bu
 * yan etki fırlarsa sonucu DEĞİŞTİRMEZ, süreci düşürmez, yalnızca loglanır.
 */
function safelyBroadcastGates(hub: SseHub, projectId: string): void {
  try {
    hub.broadcast('gates', { project_id: projectId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Uyarı: gates SSE yayını başarısız oldu (süreç etkilenmedi): ${message}\n`)
  }
}

/** İki yazma ucunun (`approve`/`deny`) paylaştığı, gövde okuma/JSON ayrıştırma iskeleti. */
function readJsonBody<T>(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  onBody: (body: T) => void
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
    let parsed: T
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
    } catch {
      sendInvalidBody(res, 'İstek gövdesi geçerli JSON değil.')
      return
    }
    onBody(parsed)
  })
}

/** `GET /api/gates?project_id=…` (§4). */
export function handleListGates(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  projectsService: ProjectsService
): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const projectId = url.searchParams.get('project_id')
  if (projectId === null || projectId === '') {
    sendInvalidBody(res, 'project_id zorunludur.')
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
  const data: GatesListResponse = listGates(project.path)
  const body: ApiResponse<GatesListResponse> = { success: true, data }
  sendJson(res, 200, body)
}

interface ApproveBody {
  confirmed?: unknown
  decision?: unknown
  expectedBody?: unknown
}

/** `POST /api/gates/:project_id/:gate/approve` (§4). */
export function handleApproveGate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  projectsService: ProjectsService,
  hub: SseHub,
  rawProjectId: string,
  rawGate: string
): void {
  readJsonBody<ApproveBody>(req, res, (parsed) => {
    if (parsed.confirmed !== true) {
      sendInvalidBody(res, 'Onay doğrulanmadı.')
      return
    }
    if (isBlankOrTooLong(parsed.decision)) {
      sendInvalidBody(res, 'Karar metni zorunludur.')
      return
    }
    // S1 (QA Bulgu 2 düzeltmesi) — `expectedBody` istemcinin GÖSTERDİĞİ önizlemenin kendisi;
    // aşağıda sunucunun kendi ürettiği `bodyText`'le TAM EŞİTLİK karşılaştırılır (herhangi bir
    // dosya mutasyonundan ÖNCE). Eksik/yanlış tipte gelirse istemci bozuk demektir — 400.
    if (typeof parsed.expectedBody !== 'string') {
      sendInvalidBody(res, 'Beklenen içerik eksik.')
      return
    }
    const decision = parsed.decision as string
    const expectedBody = parsed.expectedBody

    // NOT (Q6 — asenkron handler kendi try/catch'ini taşır): `req.on('end', ...)` zaten
    // dağıtıcının SENKRON çağrı yığınının DIŞINDADIR (`withDispatchErrorBoundary` bunu
    // KAPSAMAZ). Bu yüzden `decodeURIComponent`/`projectsService.list()` dahil TÜM gövde,
    // aşağıdaki tek `try/catch`'in İÇİNDE — kanban'ın `handlePatchFeatureStatus`'unun bu
    // sınırı `projectsService.list()`'ten SONRA çizen (ve bu çağrı fırlarsa yakalamayan) dar
    // kapsamı BİLEREK tekrarlanmadı.
    let gateForLog: string | undefined
    void (async () => {
      try {
        let projectId: string
        let rawDecodedGate: string
        try {
          projectId = decodeURIComponent(rawProjectId)
          rawDecodedGate = decodeURIComponent(rawGate)
        } catch {
          sendInvalidBody(res, 'Geçersiz istek.')
          return
        }
        gateForLog = rawDecodedGate
        if (!isValidGateId(rawDecodedGate)) {
          sendInvalidBody(res, 'Geçersiz kapı tanımlayıcısı.')
          return
        }
        const gate: string = rawDecodedGate
        const project = projectsService.list().items.find((p) => p.id === projectId)
        if (!project) {
          sendJson(res, 404, {
            success: false,
            error: { code: 'not_found', message: 'Proje bulunamadı.' },
          })
          return
        }

        const label = getGateStatus(project.path, gate).label
        const bodyText = buildApprovalBody(gate, label, project.label, isoDate(), decision)

        // S1 (QA Bulgu 2 düzeltmesi) — istemcinin gösterdiği önizleme (`expectedBody`) sunucunun
        // KENDİ ürettiği içerikle uyuşmuyorsa (ör. `decision` önizleme render edildikten SONRA
        // değişti, ya da etiket modal açıkken güncellendi) hiçbir dosyaya dokunmadan (arşivleme
        // DAHİL) 409 döner — sözleşme §13 S1, mutasyon: QA-B sınıfı.
        if (bodyText !== expectedBody) {
          const staleData = getGateStatus(project.path, gate, label)
          sendJson(res, 409, {
            success: false,
            error: {
              code: 'conflict',
              message:
                'Onay önizlemesi güncelliğini yitirdi (gösterilen bilgiler değişmiş olabilir); ' +
                'pencereyi kapatıp tekrar deneyin.',
            },
            data: staleData,
          } satisfies ApiResponse<GateStatusItem>)
          return
        }

        const denyPath = path.join(project.path, 'docs', 'approvals', `${gate}.deny.md`)
        let archivedPath = ''
        if (fs.existsSync(denyPath)) {
          // §6 "Sıra": deny varsa önce arşivle, SONRA onayı yaz — asla ters sıra (§11 M6).
          const archiveResult = archiveDenial(project.path, gate)
          if (!archiveResult.ok) {
            process.stderr.write(
              `Hata: kapı red kaydı arşivlenemedi (${gate}): ${archiveResult.message}\n`
            )
            sendJson(res, 500, {
              success: false,
              error: { code: 'write_failed', message: 'Kaydedilemedi, tekrar deneyin.' },
            } satisfies ApiResponse<never>)
            return
          }
          archivedPath = archiveResult.path
        }

        const writeResult = await writeGateApproval(project.path, gate, bodyText)

        if (writeResult.ok) {
          const data = getGateStatus(project.path, gate, label)
          sendJson(res, 200, { success: true, data } satisfies ApiResponse<GateStatusItem>)
          safelyBroadcastGates(hub, project.id)
          return
        }

        process.stderr.write(`Hata: kapı onayı yazılamadı (${gate}): ${writeResult.message}\n`)
        const data = getGateStatus(project.path, gate, label)
        if (archivedPath !== '') {
          // §6 "Yarı-başarı" — arşivleme başarılı, onay yazımı başarısız: kapı şu an `pending`,
          // gerçek arşiv yolu metne gömülür (Ö9 düzeltmesi).
          const archiveRel = path.relative(project.path, archivedPath).split(path.sep).join('/')
          sendJson(res, 500, {
            success: false,
            error: {
              code: 'write_failed',
              message:
                `Red kaydı ${archiveRel} altına taşındı ama onay yazılamadı; kapı şu an ` +
                `"Bekliyor" durumunda. Tekrar deneyin.`,
            },
            data,
          } satisfies ApiResponse<GateStatusItem>)
          return
        }
        sendJson(res, 500, {
          success: false,
          error: { code: 'write_failed', message: 'Kaydedilemedi, tekrar deneyin.' },
          data,
        } satisfies ApiResponse<GateStatusItem>)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(
          `Hata: kapı onaylanırken beklenmeyen hata oluştu (${gateForLog}): ${message}\n`
        )
        sendJson(res, 500, {
          success: false,
          error: { code: 'write_failed', message: 'Kaydedilemedi, tekrar deneyin.' },
        } satisfies ApiResponse<never>)
      }
    })()
  })
}

interface DenyBody {
  reason?: unknown
}

/** `POST /api/gates/:project_id/:gate/deny` (§4). */
export function handleDenyGate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  projectsService: ProjectsService,
  hub: SseHub,
  rawProjectId: string,
  rawGate: string
): void {
  readJsonBody<DenyBody>(req, res, (parsed) => {
    if (isBlankOrTooLong(parsed.reason)) {
      sendInvalidBody(res, 'Red gerekçesi zorunludur.')
      return
    }
    const reason = parsed.reason as string

    // NOT (Q6, gerekçe handleApproveGate'teki AYNI notla birebir) — TÜM gövde tek
    // `try/catch`'in içinde, `projectsService.list()` dahil.
    let gateForLog: string | undefined
    void (async () => {
      try {
        let projectId: string
        let rawDecodedGate: string
        try {
          projectId = decodeURIComponent(rawProjectId)
          rawDecodedGate = decodeURIComponent(rawGate)
        } catch {
          sendInvalidBody(res, 'Geçersiz istek.')
          return
        }
        gateForLog = rawDecodedGate
        if (!isValidGateId(rawDecodedGate)) {
          sendInvalidBody(res, 'Geçersiz kapı tanımlayıcısı.')
          return
        }
        const gate: string = rawDecodedGate
        const project = projectsService.list().items.find((p) => p.id === projectId)
        if (!project) {
          sendJson(res, 404, {
            success: false,
            error: { code: 'not_found', message: 'Proje bulunamadı.' },
          })
          return
        }

        // §4 "Aksiyon durum makinesi" — B6 düzeltmesi: taze bir `.ok` varsa 409 `conflict`,
        // dosya yazılmaz (onaylı bir kapı panelden reddedilemez).
        const okPath = path.join(project.path, 'docs', 'approvals', `${gate}.ok`)
        if (fs.existsSync(okPath)) {
          const data = getGateStatus(project.path, gate)
          sendJson(res, 409, {
            success: false,
            error: { code: 'conflict', message: 'Bu kapı zaten onaylı, reddedilemez.' },
            data,
          } satisfies ApiResponse<GateStatusItem>)
          return
        }

        const label = getGateStatus(project.path, gate).label
        const bodyText = buildDenialBody(gate, label, project.label, isoDate(), reason)
        const writeResult = await writeGateDenial(project.path, gate, bodyText)

        if (writeResult.ok) {
          const data = getGateStatus(project.path, gate, label)
          sendJson(res, 200, { success: true, data } satisfies ApiResponse<GateStatusItem>)
          safelyBroadcastGates(hub, project.id)
          return
        }

        process.stderr.write(`Hata: kapı reddi yazılamadı (${gate}): ${writeResult.message}\n`)
        sendJson(res, 500, {
          success: false,
          error: { code: 'write_failed', message: 'Kaydedilemedi, tekrar deneyin.' },
        } satisfies ApiResponse<never>)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(
          `Hata: kapı reddedilirken beklenmeyen hata oluştu (${gateForLog}): ${message}\n`
        )
        sendJson(res, 500, {
          success: false,
          error: { code: 'write_failed', message: 'Kaydedilemedi, tekrar deneyin.' },
        } satisfies ApiResponse<never>)
      }
    })()
  })
}

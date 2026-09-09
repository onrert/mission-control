import type http from 'node:http'
import { isValidFeatureFileName } from '../../kanban/server/feature-detail'
import { buildThreadDetail } from './thread-detail'
import type { TranscriptReaderStatsTracker } from './transcript-reader'
import type { ApiResponse, ThreadDetail } from '../../../shared/types'
import type { ProjectsService } from '../../projects/server/service'

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendInvalidBody(res: http.ServerResponse, message: string): void {
  sendJson(res, 400, { success: false, error: { code: 'invalid_body', message } })
}

/**
 * `GET /api/thread/detail?project_id=…&file=…` (F-010 sözleşmesi §1/§3.4). Salt okunur —
 * `buildThreadDetail`'in kendisi hiçbir `fs` yazma çağrısı yapmaz. `/api/features/detail`
 * (F-013) ile BİREBİR aynı hata sözleşmesi (`not_found`/`invalid_path`) — ikinci bir desen icat
 * edilmedi.
 */
export function handleThreadDetail(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  projectsService: ProjectsService,
  claudeProjectsRoot: string,
  statsTracker: TranscriptReaderStatsTracker
): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const projectId = url.searchParams.get('project_id')
  const file = url.searchParams.get('file')

  if (projectId === null || projectId === '' || file === null || file === '') {
    sendInvalidBody(res, 'project_id ve file zorunludur.')
    return
  }
  if (!isValidFeatureFileName(file)) {
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

  const result = buildThreadDetail(project.path, claudeProjectsRoot, file, statsTracker)
  if (result.status === 'not_found') {
    sendJson(res, 404, { success: false, error: { code: 'not_found', message: result.message } })
    return
  }
  if (result.status === 'invalid_path') {
    sendJson(res, 400, {
      success: false,
      error: { code: 'invalid_path', message: result.message },
    })
    return
  }

  const body: ApiResponse<ThreadDetail> = { success: true, data: result.detail }
  sendJson(res, 200, body)
}

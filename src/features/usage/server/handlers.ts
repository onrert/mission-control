import type http from 'node:http'
import { computeUsageReport } from './usage-aggregator'
import type { ApiResponse, UsageReport } from '../../../shared/types'
import type { ProjectsService } from '../../projects/server/service'

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * `GET /api/usage` (F-011 sözleşmesi §1). Proje filtresi yok — tüm izlenen projelerin transkript
 * token toplamını tek yanıtta döner. `computeUsageReport` ASLA throw etmez (best-effort, F-009/
 * F-010 emsali), bu yüzden bu handler her zaman 200 döner; "okunamadı" durumu gövdenin
 * `source_unreadable` alanıyla taşınır (PRD F6/AC2).
 */
export function handleUsageReport(
  res: http.ServerResponse,
  projectsService: ProjectsService,
  claudeProjectsRoot: string
): void {
  const projects = projectsService
    .list()
    .items.map((p) => ({ id: p.id, label: p.label, path: p.path }))
  const report = computeUsageReport(claudeProjectsRoot, projects)
  const body: ApiResponse<UsageReport> = { success: true, data: report }
  sendJson(res, 200, body)
}

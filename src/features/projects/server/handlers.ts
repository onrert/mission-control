import type http from 'node:http'
import type { ApiResponse, ProjectListItem } from '../../../shared/types'
import type { ProjectsService } from './service'

const MAX_BODY_BYTES = 65536

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** `GET /api/projects` (sözleşme §4.3). */
export function handleListProjects(res: http.ServerResponse, service: ProjectsService): void {
  const { items, registryCorrupt } = service.list()
  const body: ApiResponse<ProjectListItem[]> & { registry_corrupt?: true } = {
    success: true,
    data: items,
  }
  if (registryCorrupt) body.registry_corrupt = true
  sendJson(res, 200, body)
}

/** `POST /api/projects` — gövde `{ path: string, label?: string }` (sözleşme §4.3). */
export function handleAddProject(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: ProjectsService
): void {
  const chunks: Buffer[] = []
  let totalBytes = 0
  let aborted = false

  req.on('data', (chunk: Buffer) => {
    if (aborted) return
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      aborted = true
      sendJson(res, 400, {
        success: false,
        error: { code: 'invalid_body', message: 'İstek gövdesi çok büyük.' },
      })
      return
    }
    chunks.push(chunk)
  })

  req.on('error', () => {
    aborted = true
  })

  req.on('end', () => {
    if (aborted) return
    let parsed: unknown
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      sendJson(res, 400, {
        success: false,
        error: { code: 'invalid_body', message: 'İstek gövdesi geçerli JSON değil.' },
      })
      return
    }
    const body = parsed as { path?: unknown; label?: unknown }
    const label =
      typeof body.label === 'string' && body.label.trim() !== '' ? body.label : undefined
    const result = service.addProject(body.path, label)
    if (!result.ok) {
      const status = result.code === 'conflict' ? 409 : 400
      sendJson(res, status, {
        success: false,
        error: { code: result.code, message: result.message },
      })
      return
    }
    const responseBody: ApiResponse<ProjectListItem> = { success: true, data: result.item }
    sendJson(res, 201, responseBody)
  })
}

/** `DELETE /api/projects/:id` (sözleşme §4.3). `id` boşsa çağıran (`index.ts`) 404 döner. */
export function handleRemoveProject(
  res: http.ServerResponse,
  service: ProjectsService,
  id: string
): void {
  const removed = service.removeProject(id)
  if (!removed) {
    sendJson(res, 404, {
      success: false,
      error: { code: 'not_found', message: 'Proje bulunamadı.' },
    })
    return
  }
  const body: ApiResponse<{ removed: true }> = { success: true, data: { removed: true } }
  sendJson(res, 200, body)
}

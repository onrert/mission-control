import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createServer, type ServerWithHub } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { encodeProjectDirName } from '../../src/features/thread/server/transcript-reader'
import type { ApiResponse, UsageReport } from '../../src/shared/types'

// F-011 sözleşmesi §3 — `GET /api/usage`'ın gerçek HTTP üzerinden uçtan uca doğrulaması.
// `tests/integration/thread-api.test.ts`'in AYNI sunucu-başlatma iskeleti (Karpathy §2 — ikinci
// bir harness icat edilmedi, dosya bağımsız yazıldı çünkü o dosya F-010'un sahipliğinde).

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
  urlPath: string
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl)
    const req = http.request(
      { host: url.hostname, port: url.port, path: url.pathname + url.search, method },
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
    req.end()
  })
}

let dataDir: string
let projectDir: string
let claudeProjectsRoot: string
let originalClaudeRootEnv: string | undefined
let handle: ServerHandle
let projectId: string

beforeEach(async () => {
  dataDir = createTempDataDir()
  projectDir = createTempDataDir()
  claudeProjectsRoot = createTempDataDir()
  originalClaudeRootEnv = process.env.MC_CLAUDE_PROJECTS_ROOT
  process.env.MC_CLAUDE_PROJECTS_ROOT = claudeProjectsRoot

  fs.mkdirSync(path.join(projectDir, 'docs', 'features'), { recursive: true })

  handle = await startServer(dataDir)
  const added = handle.server.projectsService.addProject(projectDir, 'fixture-usage')
  if (!added.ok) throw new Error('proje eklenemedi')
  projectId = added.item.id
})

afterEach(async () => {
  await stopServer(handle)
  removeTempDataDir(dataDir)
  removeTempDataDir(projectDir)
  removeTempDataDir(claudeProjectsRoot)
  if (originalClaudeRootEnv === undefined) {
    delete process.env.MC_CLAUDE_PROJECTS_ROOT
  } else {
    process.env.MC_CLAUDE_PROJECTS_ROOT = originalClaudeRootEnv
  }
})

describe('GET /api/usage', () => {
  it('200 — gerçek bir transkript dosyasından token toplamı hesaplanır', async () => {
    const encoded = encodeProjectDirName(projectDir)
    const sessionFile = path.join(claudeProjectsRoot, encoded, 'sess-1.jsonl')
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true })
    fs.writeFileSync(
      sessionFile,
      `${JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 42, output_tokens: 8 } } })}\n`
    )

    const res = await request(handle.baseUrl, 'GET', '/api/usage')
    expect(res.status).toBe(200)
    const body = res.json as ApiResponse<UsageReport>
    expect(body.success).toBe(true)
    expect(body.data!.source_unreadable).toBe(false)
    expect(body.data!.usage.input_tokens).toBe(42)
    expect(body.data!.usage.output_tokens).toBe(8)
    const proj = body.data!.projects.find((p) => p.project_id === projectId)
    expect(proj).toBeDefined()
    expect(proj!.project_label).toBe('fixture-usage')
  })

  it('200 — hiçbir izlenen projede transkript yoksa boş `projects` dizisi döner (çökmez)', async () => {
    const res = await request(handle.baseUrl, 'GET', '/api/usage')
    expect(res.status).toBe(200)
    const body = res.json as ApiResponse<UsageReport>
    expect(body.success).toBe(true)
    expect(body.data!.projects).toEqual([])
    expect(body.data!.source_unreadable).toBe(false)
  })

  it('200 — `MC_CLAUDE_PROJECTS_ROOT` bulunamazsa 500 DEĞİL, `source_unreadable:true` döner (AC2)', async () => {
    removeTempDataDir(claudeProjectsRoot)
    const res = await request(handle.baseUrl, 'GET', '/api/usage')
    expect(res.status).toBe(200)
    const body = res.json as ApiResponse<UsageReport>
    expect(body.data!.source_unreadable).toBe(true)
    expect(body.data!.projects).toEqual([])
  })

  it('POST/PATCH/DELETE 404 veya desteklenmez — yalnızca GET tanımlı (salt okunur uç)', async () => {
    const res = await request(handle.baseUrl, 'POST', '/api/usage')
    // Dağıtıcı POST için `x-mc-write` başlığı zorunlu kılar (ADR-013); başlıksız istek 403 alır,
    // route'un kendisi hiç GET dışı bir davranış tanımlamaz.
    expect(res.status).toBe(403)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createServer, type ServerWithHub } from '../../src/server/index'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'
import { encodeProjectDirName } from '../../src/features/thread/server/transcript-reader'
import type { ApiResponse, ThreadDetail } from '../../src/shared/types'

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
  fs.writeFileSync(
    path.join(projectDir, 'docs', 'features', 'F-001.md'),
    '---\nid: F-001\ntitle: Test\nstatus: todo\n---\ngövde metni\n'
  )
  fs.mkdirSync(path.join(projectDir, 'docs', 'qa'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'docs', 'qa', 'F-001-contract.md'), 'sözleşme metni')
  fs.writeFileSync(
    path.join(projectDir, 'docs', 'qa', 'F-001-2026-09-01.md'),
    'KARAR: KALDI\n\n# F-001 QA\nilk tur'
  )
  fs.writeFileSync(
    path.join(projectDir, 'docs', 'qa', 'latest.md'),
    'KARAR: KALDI\nESKALE: true\n\n# F-001 QA — kapanış\n'
  )

  handle = await startServer(dataDir)
  const added = handle.server.projectsService.addProject(projectDir, 'fixture')
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

describe('GET /api/thread/detail (AC1, AC4, AC5)', () => {
  it('200 — bölümler kronolojik, ESKALE=true, sınırlı param eksikse 400', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/thread/detail?project_id=${projectId}&file=F-001.md`
    )
    expect(res.status).toBe(200)
    const body = res.json as ApiResponse<ThreadDetail>
    expect(body.success).toBe(true)
    expect(body.data?.feature_id).toBe('F-001')
    expect(body.data?.eskale).toBe(true)
    expect(body.data?.sections.map((s) => s.kind)).toEqual([
      'ceo_brief',
      'developer_report',
      'qa_verdict',
      'transcript',
    ])

    const missingParam = await request(
      handle.baseUrl,
      'GET',
      `/api/thread/detail?project_id=${projectId}`
    )
    expect(missingParam.status).toBe(400)
  })

  it('bilinmeyen proje → 404 not_found', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/thread/detail?project_id=yok&file=F-001.md`
    )
    expect(res.status).toBe(404)
  })

  it('bilinmeyen dosya → 404 not_found', async () => {
    const res = await request(
      handle.baseUrl,
      'GET',
      `/api/thread/detail?project_id=${projectId}&file=F-099.md`
    )
    expect(res.status).toBe(404)
  })

  it('AC5 — GET dışında hiçbir metod bu uca kayıtlı değil (yazma yapılamaz)', async () => {
    const res = await request(
      handle.baseUrl,
      'POST',
      `/api/thread/detail?project_id=${projectId}&file=F-001.md`
    )
    expect(res.status).not.toBe(200)
  })
})

describe('W2 — /api/health.transcript_reader gerçek okumalarla besleniyor', () => {
  it('geçerli bir transkript varsa health sayaçları GERÇEKTEN artar (sıfırda kalmaz)', async () => {
    const before = await request(handle.baseUrl, 'GET', '/api/health')
    const beforeStats = (
      before.json as { transcript_reader: { files_seen: number; lines_ok: number } }
    ).transcript_reader
    expect(beforeStats.files_seen).toBe(0)
    expect(beforeStats.lines_ok).toBe(0)

    const encoded = encodeProjectDirName(fs.realpathSync.native(projectDir))
    const sessionDir = path.join(claudeProjectsRoot, encoded)
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(
      path.join(sessionDir, 'session-1.jsonl'),
      `${JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 7, output_tokens: 3 } } })}\n`
    )

    const detailRes = await request(
      handle.baseUrl,
      'GET',
      `/api/thread/detail?project_id=${projectId}&file=F-001.md`
    )
    expect(detailRes.status).toBe(200)
    const body = detailRes.json as ApiResponse<ThreadDetail>
    const transcriptSection = body.data?.sections.find((s) => s.kind === 'transcript')
    expect(transcriptSection?.readable).toBe(true)

    const after = await request(handle.baseUrl, 'GET', '/api/health')
    const afterStats = (
      after.json as { transcript_reader: { files_seen: number; lines_ok: number } }
    ).transcript_reader
    expect(afterStats.files_seen).toBe(1)
    expect(afterStats.lines_ok).toBe(1)
  })
})

describe('X1/B1 — transkript okuma yolu EPERM fırlatırsa HTTP 500 DEĞİL, 200 + "okunamadı" bölümü döner', () => {
  it('gerçek dispatcher üzerinden: realpathSync.native fırlar, diğer bölümler dolu kalır', async () => {
    const encoded = encodeProjectDirName(fs.realpathSync.native(projectDir))
    const sessionDir = path.join(claudeProjectsRoot, encoded)
    fs.mkdirSync(sessionDir, { recursive: true })
    const transcriptFile = path.join(sessionDir, 'session-1.jsonl')
    fs.writeFileSync(
      transcriptFile,
      `${JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1 } } })}\n`
    )

    // QA'nın gerçek reprosu (icacls /deny → EPERM) — yalnızca transkript dosyası için taklit
    // edilir, `resolveInsideRootForRead`'in (CEO brief/sözleşme okuması) kullandığı ÇAĞRILAR
    // etkilenmez.
    const originalRealpathNative = fs.realpathSync.native
    const realpathSpy = vi.spyOn(fs.realpathSync, 'native').mockImplementation((p: fs.PathLike) => {
      if (path.resolve(p.toString()) === path.resolve(transcriptFile)) {
        throw new Error('EPERM: operation not permitted, realpath')
      }
      return originalRealpathNative(p as fs.PathLike)
    })

    try {
      const res = await request(
        handle.baseUrl,
        'GET',
        `/api/thread/detail?project_id=${projectId}&file=F-001.md`
      )
      // Bloklayıcının özü buydu: eskiden bu 500 dönüyordu (ekranın TAMAMI kayboluyordu).
      expect(res.status).toBe(200)
      const body = res.json as ApiResponse<ThreadDetail>
      expect(body.success).toBe(true)
      const ceo = body.data?.sections.find((s) => s.kind === 'ceo_brief')
      const dev = body.data?.sections.find((s) => s.kind === 'developer_report')
      const transcript = body.data?.sections.find((s) => s.kind === 'transcript')
      expect(ceo?.readable).toBe(true)
      expect(dev?.readable).toBe(true)
      expect(transcript?.readable).toBe(false)
      expect(transcript?.content).toBeNull()
    } finally {
      realpathSpy.mockRestore()
    }
  })
})

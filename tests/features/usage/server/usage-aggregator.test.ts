import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { computeUsageReport } from '../../../../src/features/usage/server/usage-aggregator'
import { encodeProjectDirName } from '../../../../src/features/thread/server/transcript-reader'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

// F-011 sözleşmesi §3 — Y4 doğruluk çiti: fixture'daki her sayı ELLE hesaplanmış, `computeUsageReport`
// yalnızca bu elle hesaplanmış toplamlarla karşılaştırılır (kod okuyarak "doğru görünüyor" değil).

const dirs: string[] = []
function tempDir(): string {
  const d = createTempDataDir()
  dirs.push(d)
  return d
}
afterEach(() => {
  while (dirs.length > 0) removeTempDataDir(dirs.pop()!)
  vi.restoreAllMocks()
})

function assistantLine(usage: {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}): string {
  return JSON.stringify({ type: 'assistant', message: { usage } })
}

function writeWithMtime(filePath: string, content: string, mtimeIso: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  const t = new Date(mtimeIso)
  fs.utimesSync(filePath, t, t)
}

describe('computeUsageReport — Y4 doğruluk', () => {
  it('ana oturum + subagent dosyalarının token toplamını proje/gün/oturum/agent bazında ELLE hesaplanan değerlerle eşleştirir', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)

    // Ana oturum dosyası — `session_id: "sess-1"`, agent: "ana oturum". İki assistant satırı.
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 10, output_tokens: 2 })}\n${assistantLine({ input_tokens: 5, output_tokens: 1, cache_creation_input_tokens: 3, cache_read_input_tokens: 7 })}\n`,
      '2026-09-04T10:00:00Z'
    )
    // ELLE HESAPLANAN ana oturum toplamı: input=15, output=3, cache_creation=3, cache_read=7.

    // Subagent dosyası — `sess-1/subagents/agent-a.jsonl` + meta.json {agentType:'developer'}.
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 100, output_tokens: 40 })}\n`,
      '2026-09-04T11:00:00Z'
    )
    fs.writeFileSync(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'),
      JSON.stringify({ agentType: 'developer' })
    )
    // ELLE HESAPLANAN agent-a toplamı: input=100, output=40.

    // İkinci subagent — meta.json YOK → "bilinmiyor".
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-b.jsonl'),
      `${assistantLine({ input_tokens: 9, output_tokens: 1 })}\n`,
      '2026-09-04T11:05:00Z'
    )
    // ELLE HESAPLANAN agent-b (bilinmiyor) toplamı: input=9, output=1.

    // "memory" gibi subagents/ TAŞIMAYAN bir alt dizin — sessizce atlanmalı (gerçek makinede
    // gözlenen desen, `docs/qa/F-011-contract.md`).
    fs.mkdirSync(path.join(projDir, 'memory'), { recursive: true })
    fs.writeFileSync(path.join(projDir, 'memory', 'not-a-transcript.json'), '{}')

    const report = computeUsageReport(claudeRoot, [
      { id: 'p1', label: 'mission-control', path: project },
    ])

    expect(report.source_unreadable).toBe(false)
    expect(report.projects).toHaveLength(1)
    const proj = report.projects[0]!
    expect(proj.project_id).toBe('p1')
    expect(proj.project_label).toBe('mission-control')

    // Toplam proje kullanımı = 15+100+9=124 giriş, 3+40+1=44 çıkış, 3 cache_creation, 7 cache_read.
    expect(proj.usage).toEqual({
      input_tokens: 124,
      output_tokens: 44,
      cache_creation_input_tokens: 3,
      cache_read_input_tokens: 7,
    })
    expect(report.usage).toEqual(proj.usage)

    // Hepsi aynı güne (mtime 2026-09-04) düşer.
    expect(proj.days).toHaveLength(1)
    const day = proj.days[0]!
    expect(day.day).toBe('2026-09-04')
    expect(day.usage).toEqual(proj.usage)

    // Tek oturum (sess-1), üç agent: "ana oturum", "developer", "bilinmiyor".
    expect(day.sessions).toHaveLength(1)
    const session = day.sessions[0]!
    expect(session.session_id).toBe('sess-1')
    const agentsByName = Object.fromEntries(session.agents.map((a) => [a.agent, a.usage]))
    expect(agentsByName['ana oturum']).toEqual({
      input_tokens: 15,
      output_tokens: 3,
      cache_creation_input_tokens: 3,
      cache_read_input_tokens: 7,
    })
    expect(agentsByName['developer']).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
    expect(agentsByName['bilinmiyor']).toEqual({
      input_tokens: 9,
      output_tokens: 1,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })

    expect(report.lines_ok).toBe(4)
    expect(report.lines_bad).toBe(0)
    expect(report.degraded).toBe(false)
  })

  it('iki farklı mtime günü ayrı gün grubuna düşer', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)

    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-01T00:00:00Z'
    )
    writeWithMtime(
      path.join(projDir, 'sess-2.jsonl'),
      `${assistantLine({ input_tokens: 2, output_tokens: 2 })}\n`,
      '2026-09-02T00:00:00Z'
    )

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    const days = report.projects[0]!.days.map((d) => d.day)
    expect(days).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('meta.json bozuksa (geçersiz JSON) agent "bilinmiyor" olur, çökmez', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    fs.writeFileSync(path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'), '{ bozuk')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    const session = report.projects[0]!.days[0]!.sessions[0]!
    expect(session.agents.map((a) => a.agent)).toEqual(['bilinmiyor'])
  })

  it('meta.json var ama agentType alanı yoksa/boşsa agent "bilinmiyor" olur (Y2, uydurma yok)', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    fs.writeFileSync(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'),
      JSON.stringify({ description: 'meta var ama agentType yok' })
    )

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.projects[0]!.days[0]!.sessions[0]!.agents[0]!.agent).toBe('bilinmiyor')
  })
})

describe('computeUsageReport — yalnızca type:"assistant" satırları sayılır', () => {
  it('user/system gibi diğer tipler usage toplamına katılmaz (reused reader garantisi, uçtan uca kanıt)', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const lines = [
      assistantLine({ input_tokens: 10, output_tokens: 5 }),
      // "user" tipi, usage alanı taşısa bile SAYILMAMALI.
      JSON.stringify({
        type: 'user',
        message: { usage: { input_tokens: 999, output_tokens: 999 } },
      }),
      // "system" tipi de aynı şekilde sayılmamalı.
      JSON.stringify({
        type: 'system',
        message: { usage: { input_tokens: 999, output_tokens: 999 } },
      }),
    ].join('\n')
    writeWithMtime(path.join(projDir, 'sess-1.jsonl'), `${lines}\n`, '2026-09-04T00:00:00Z')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.usage).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
  })
})

describe('computeUsageReport — Y8: kaynak okunamazsa çökmez ("bulunamadı" ile "fırlattı" AYRI)', () => {
  it('claudeProjectsRoot bulunamadı (existsSync=false) → source_unreadable:true, boş rapor', () => {
    const missingRoot = path.join(tempDir(), 'hic-var-olmayan-alt-dizin')
    const report = computeUsageReport(missingRoot, [{ id: 'p1', label: 'p', path: tempDir() }])
    expect(report.source_unreadable).toBe(true)
    expect(report.projects).toEqual([])
    expect(report.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
  })

  it('claudeProjectsRoot VAR ama listelenirken FIRLIYOR (ör. EPERM) → source_unreadable:true, çökmez', () => {
    const claudeRoot = tempDir()
    const originalReaddir = fs.readdirSync.bind(fs)
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: fs.PathLike, options?: unknown) => {
      if (p === claudeRoot) {
        const err = new Error('EPERM: yapay') as NodeJS.ErrnoException
        err.code = 'EPERM'
        throw err
      }
      return (originalReaddir as (p: fs.PathLike, options?: unknown) => unknown)(p, options)
    }) as typeof fs.readdirSync)

    let report: ReturnType<typeof computeUsageReport> | undefined
    expect(() => {
      report = computeUsageReport(claudeRoot, [])
    }).not.toThrow()
    expect(report!.source_unreadable).toBe(true)
    expect(report!.projects).toEqual([])
  })

  it("tek bir dosyanın fs.statSync'i FIRLARSA (yarış durumu) yalnızca o dosya atlanır, rapor çökmez", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const badFile = path.join(projDir, 'sess-bad.jsonl')
    const goodFile = path.join(projDir, 'sess-good.jsonl')
    writeWithMtime(
      badFile,
      `${assistantLine({ input_tokens: 111, output_tokens: 111 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    writeWithMtime(
      goodFile,
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const originalStat = fs.statSync.bind(fs)
    vi.spyOn(fs, 'statSync').mockImplementation((p: fs.PathLike) => {
      if (p === badFile) {
        const err = new Error('EPERM: yapay') as NodeJS.ErrnoException
        err.code = 'EPERM'
        throw err
      }
      return originalStat(p)
    })

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    // yalnızca `goodFile` sayılır — `badFile` sessizce atlanır, throw dışarı SIZMAZ.
    expect(report.usage.input_tokens).toBe(1)
  })
})

describe('computeUsageReport — Y5: tanınan satır oranı düşerse degraded:true', () => {
  it("bozuk satır oranı %1'i aşarsa degraded:true olur", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    // 10 satır: 1 assistant + 8 iyi ayrıştırılan (user) + 1 bozuk JSON → lines_ok=9, lines_bad=1
    // → oran 9/10=0.9 < 0.99 → degraded:true.
    const goodLines = Array.from({ length: 8 }, () => JSON.stringify({ type: 'user' })).join('\n')
    const content = `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n${goodLines}\nBOZUK {{{\n`
    writeWithMtime(path.join(projDir, 'sess-1.jsonl'), content, '2026-09-04T00:00:00Z')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.lines_ok).toBe(9)
    expect(report.lines_bad).toBe(1)
    expect(report.degraded).toBe(true)
  })

  it('hiç bozuk satır yoksa degraded:false kalır', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.degraded).toBe(false)
  })
})

describe('computeUsageReport — Y3: ağ isteği yok', () => {
  it('fetch/http.request/https.request çağrılmadan gerçek fixture verisi doğru hesaplanır', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 7, output_tokens: 3 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Y3 İHLALİ: fetch çağrıldı')
    })
    const httpSpy = vi.spyOn(http, 'request').mockImplementation(() => {
      throw new Error('Y3 İHLALİ: http.request çağrıldı')
    })
    const httpsSpy = vi.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('Y3 İHLALİ: https.request çağrıldı')
    })

    let report
    expect(() => {
      report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    }).not.toThrow()
    expect(report!.usage).toEqual({
      input_tokens: 7,
      output_tokens: 3,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(httpSpy).not.toHaveBeenCalled()
    expect(httpsSpy).not.toHaveBeenCalled()
  })
})

describe('computeUsageReport — boş/izlenmeyen durumlar', () => {
  it('hiç transkript bulunamayan proje `projects` dizisinde YER ALMAZ', () => {
    const claudeRoot = tempDir()
    const project = tempDir() // claudeRoot altında hiçbir karşılığı yok
    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.projects).toEqual([])
    expect(report.source_unreadable).toBe(false)
  })

  it('izlenen proje listesi boşsa boş rapor döner, çökmez', () => {
    const claudeRoot = tempDir()
    const report = computeUsageReport(claudeRoot, [])
    expect(report.projects).toEqual([])
  })
})

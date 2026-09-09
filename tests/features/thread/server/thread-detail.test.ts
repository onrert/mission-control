import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildThreadDetail,
  resolveClaudeProjectsRoot,
} from '../../../../src/features/thread/server/thread-detail'
import { encodeProjectDirName } from '../../../../src/features/thread/server/transcript-reader'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, ...relPath.split('/'))
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function fakeStatsTracker() {
  const record = vi.fn()
  return {
    record,
    getStats: () => ({ files_seen: 0, lines_ok: 0, lines_bad: 0 }),
  }
}

const dirs: string[] = []

function tempDir(): string {
  const d = createTempDataDir()
  dirs.push(d)
  return d
}

afterEach(() => {
  while (dirs.length > 0) removeTempDataDir(dirs.pop()!)
})

describe('resolveClaudeProjectsRoot', () => {
  it('MC_CLAUDE_PROJECTS_ROOT verilirse onu kullanır', () => {
    expect(resolveClaudeProjectsRoot({ MC_CLAUDE_PROJECTS_ROOT: 'C:\\fake\\root' })).toBe(
      'C:\\fake\\root'
    )
  })

  it('boş/tanımsızsa ev dizini altındaki varsayılana düşer', () => {
    const resolved = resolveClaudeProjectsRoot({})
    expect(resolved.endsWith(path.join('.claude', 'projects'))).toBe(true)
  })
})

describe('buildThreadDetail — AC1: docs/qa bölümleri kronolojik sırayla', () => {
  it('gövde (CEO brief) + sözleşme (Developer raporu) + QA raporları (mtime artan) sırayla listelenir', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(
      project,
      'docs/features/F-001.md',
      '---\nid: F-001\ntitle: Test\nstatus: todo\n---\nCEO brief gövdesi.\n'
    )
    writeFile(project, 'docs/qa/F-001-contract.md', 'Sözleşme metni.')
    const older = path.join(project, 'docs', 'qa', 'F-001-2026-09-01.md')
    fs.mkdirSync(path.dirname(older), { recursive: true })
    fs.writeFileSync(older, 'KARAR: KALDI\n\n# F-001 QA — kod turu\nİlk tur.')
    const olderTime = new Date('2026-09-01T00:00:00Z')
    fs.utimesSync(older, olderTime, olderTime)
    const newer = path.join(project, 'docs', 'qa', 'F-001-2026-09-02.md')
    fs.writeFileSync(newer, 'KARAR: GEÇTİ\n\n# F-001 QA — düzeltme\nİkinci tur.')
    const newerTime = new Date('2026-09-02T00:00:00Z')
    fs.utimesSync(newer, newerTime, newerTime)

    const tracker = fakeStatsTracker()
    const result = buildThreadDetail(project, claudeRoot, 'F-001.md', tracker)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.feature_id).toBe('F-001')

    const kinds = result.detail.sections.map((s) => s.kind)
    expect(kinds).toEqual([
      'ceo_brief',
      'developer_report',
      'qa_verdict',
      'qa_verdict',
      'transcript',
    ])

    const ceo = result.detail.sections[0]!
    expect(ceo.content).toContain('CEO brief gövdesi.')
    expect(ceo.readable).toBe(true)

    const dev = result.detail.sections[1]!
    expect(dev.content).toBe('Sözleşme metni.')
    expect(dev.readable).toBe(true)

    const qa1 = result.detail.sections[2]!
    expect(qa1.verdict).toBe('KALDI')
    expect(qa1.title).toBe('QA kararı: KALDI')
    const qa2 = result.detail.sections[3]!
    expect(qa2.verdict).toBe('GEÇTİ')
    // mtime artan sırayla: eski KALDI önce, yeni GEÇTİ sonra.
    expect(new Date(qa1.timestamp!).getTime()).toBeLessThan(new Date(qa2.timestamp!).getTime())
  })

  it('AC1 boş durum: hiç docs/qa yoksa yalnızca CEO brief + okunamayan transkript kalır', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-002.md', '---\nid: F-002\nstatus: todo\n---\ngövde\n')

    const tracker = fakeStatsTracker()
    const result = buildThreadDetail(project, claudeRoot, 'F-002.md', tracker)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.sections.map((s) => s.kind)).toEqual(['ceo_brief', 'transcript'])
    expect(result.detail.sections[1]!.readable).toBe(false)
    expect(tracker.record).not.toHaveBeenCalled()
  })
})

describe('buildThreadDetail — AC2/AC3/W4: transkript best-effort, diğer bölümler etkilenmez', () => {
  it('W4 — claudeProjectsRoot hiç yoksa (dizin dahi yok) CEO brief/contract/QA bölümleri hâlâ dolu, yalnızca transkript "okunamadı"', () => {
    const project = tempDir()
    const missingClaudeRoot = path.join(project, 'hic-yok', 'claude-projects')
    writeFile(project, 'docs/features/F-003.md', '---\nid: F-003\nstatus: todo\n---\ngövde\n')
    writeFile(project, 'docs/qa/F-003-contract.md', 'sözleşme')

    const tracker = fakeStatsTracker()
    const result = buildThreadDetail(project, missingClaudeRoot, 'F-003.md', tracker)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return

    const ceo = result.detail.sections.find((s) => s.kind === 'ceo_brief')!
    const dev = result.detail.sections.find((s) => s.kind === 'developer_report')!
    const transcript = result.detail.sections.find((s) => s.kind === 'transcript')!
    expect(ceo.readable).toBe(true)
    expect(ceo.content).toContain('gövde')
    expect(dev.readable).toBe(true)
    expect(transcript.readable).toBe(false)
    expect(transcript.content).toBeNull()
    expect(tracker.record).not.toHaveBeenCalled()
  })

  it('geçerli bir transkript bulunursa okunur, token toplamı içerikte görünür ve record() çağrılır (W2)', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-004.md', '---\nid: F-004\nstatus: todo\n---\ngövde\n')
    const encoded = encodeProjectDirName(project)
    const sessionDir = path.join(claudeRoot, encoded)
    fs.mkdirSync(sessionDir, { recursive: true })
    const line = JSON.stringify({
      type: 'assistant',
      message: { usage: { input_tokens: 100, output_tokens: 40 } },
    })
    fs.writeFileSync(path.join(sessionDir, 'session-1.jsonl'), `${line}\n`)

    const tracker = fakeStatsTracker()
    const result = buildThreadDetail(project, claudeRoot, 'F-004.md', tracker)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    const transcript = result.detail.sections.find((s) => s.kind === 'transcript')!
    expect(transcript.readable).toBe(true)
    expect(transcript.content).toContain('100')
    expect(transcript.content).toContain('40')
    expect(tracker.record).toHaveBeenCalledTimes(1)
    expect(tracker.record).toHaveBeenCalledWith(
      expect.objectContaining({ lines_ok: 1, lines_bad: 0 })
    )
  })

  it('AC3 — bozuk satırlar sunucu logunda tutulur, ham hata/stack UI içeriğine sızmaz', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-005.md', '---\nid: F-005\nstatus: todo\n---\ngövde\n')
    const encoded = encodeProjectDirName(project)
    const sessionDir = path.join(claudeRoot, encoded)
    fs.mkdirSync(sessionDir, { recursive: true })
    const validLine = JSON.stringify({
      type: 'assistant',
      message: { usage: { input_tokens: 5, output_tokens: 5 } },
    })
    fs.writeFileSync(
      path.join(sessionDir, 'session-1.jsonl'),
      `${validLine}\nBOZUK JSON DEĞİL {{{\n`
    )

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const tracker = fakeStatsTracker()
      const result = buildThreadDetail(project, claudeRoot, 'F-005.md', tracker)
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      const transcript = result.detail.sections.find((s) => s.kind === 'transcript')!
      expect(transcript.readable).toBe(true)
      // Ham hata/stack trace içeriğe SIZMAZ — yalnızca sabit, önceden yazılmış Türkçe metin.
      expect(transcript.content).not.toContain('BOZUK JSON')
      expect(transcript.content).not.toContain('SyntaxError')
      expect(tracker.record).toHaveBeenCalledWith(
        expect.objectContaining({ lines_ok: 1, lines_bad: 1 })
      )
      // Bozuk satır sayısı yalnızca sunucu logunda.
      const logged = stderrSpy.mock.calls.some((call) =>
        String(call[0]).includes('ayrıştırılamadı')
      )
      expect(logged).toBe(true)
    } finally {
      stderrSpy.mockRestore()
    }
  })
})

describe('buildThreadDetail — AC4: ESKALE rozeti', () => {
  it('docs/qa/latest.md AYNI feature id + ESKALE:true ise eskale=true', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-006.md', '---\nid: F-006\nstatus: todo\n---\ngövde\n')
    writeFile(project, 'docs/qa/latest.md', 'KARAR: KALDI\nESKALE: true\n\n# F-006 QA — kapanış\n')

    const result = buildThreadDetail(project, claudeRoot, 'F-006.md', fakeStatsTracker())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.eskale).toBe(true)
  })

  it('W6 — latest.md BAŞKA bir feature`a aitse (ESKALE:true olsa bile) rozet sızmaz', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-007.md', '---\nid: F-007\nstatus: todo\n---\ngövde\n')
    writeFile(project, 'docs/qa/latest.md', 'KARAR: KALDI\nESKALE: true\n\n# F-999 QA — kapanış\n')

    const result = buildThreadDetail(project, claudeRoot, 'F-007.md', fakeStatsTracker())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.eskale).toBe(false)
  })

  it('ESKALE: false ise (aynı feature olsa bile) rozet gösterilmez', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-008.md', '---\nid: F-008\nstatus: todo\n---\ngövde\n')
    writeFile(project, 'docs/qa/latest.md', 'KARAR: GEÇTİ\nESKALE: false\n\n# F-008 QA\n')

    const result = buildThreadDetail(project, claudeRoot, 'F-008.md', fakeStatsTracker())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.eskale).toBe(false)
  })

  it('latest.md hiç yoksa eskale=false, panel çökmez', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-009.md', '---\nid: F-009\nstatus: todo\n---\ngövde\n')

    const result = buildThreadDetail(project, claudeRoot, 'F-009.md', fakeStatsTracker())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.eskale).toBe(false)
  })
})

describe('buildThreadDetail — hata durumları (feature-detail ile aynı sözleşme)', () => {
  it('dosya yoksa not_found', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    fs.mkdirSync(path.join(project, 'docs', 'features'), { recursive: true })
    const result = buildThreadDetail(project, claudeRoot, 'F-099.md', fakeStatsTracker())
    expect(result.status).toBe('not_found')
  })

  it('kök dışına çıkan bir dosya adı invalid_path', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    fs.mkdirSync(path.join(project, 'docs', 'features'), { recursive: true })
    const result = buildThreadDetail(
      project,
      claudeRoot,
      '..%2f..%2fpackage.json',
      fakeStatsTracker()
    )
    expect(result.status === 'not_found' || result.status === 'invalid_path').toBe(true)
  })
})

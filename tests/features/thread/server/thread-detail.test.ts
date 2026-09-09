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
    const contract = path.join(project, 'docs', 'qa', 'F-001-contract.md')
    fs.mkdirSync(path.dirname(contract), { recursive: true })
    fs.writeFileSync(contract, 'Sözleşme metni.')
    // Normal senaryo: sözleşme QA raporlarından ÖNCE yazılır (X5 — F-012 anomalisi ayrı testte).
    const contractTime = new Date('2026-08-31T00:00:00Z')
    fs.utimesSync(contract, contractTime, contractTime)
    const older = path.join(project, 'docs', 'qa', 'F-001-2026-09-01.md')
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
    // X5/Ö6 — başlık artık dosya adını da taşır (ayırt edici etiket).
    expect(qa1.title).toBe('QA kararı: KALDI · F-001-2026-09-01.md')
    const qa2 = result.detail.sections[3]!
    expect(qa2.verdict).toBe('GEÇTİ')
    expect(qa2.title).toBe('QA kararı: GEÇTİ · F-001-2026-09-02.md')
    // mtime artan sırayla: eski KALDI önce, yeni GEÇTİ sonra.
    expect(new Date(qa1.timestamp!).getTime()).toBeLessThan(new Date(qa2.timestamp!).getTime())
  })

  it('X5/Ö5 — sözleşme QA raporlarından SONRA güncellenirse (F-012 deseni), developer raporu ilgili QA kararlarından SONRA görünür', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-012.md', '---\nid: F-012\nstatus: todo\n---\ngövde\n')

    const review1 = path.join(project, 'docs', 'qa', 'F-012-contract-review-1.md')
    fs.mkdirSync(path.dirname(review1), { recursive: true })
    fs.writeFileSync(review1, 'KARAR: KALDI\n\nİlk inceleme notu.')
    fs.utimesSync(review1, new Date('2026-09-06T04:15:00Z'), new Date('2026-09-06T04:15:00Z'))

    const review2 = path.join(project, 'docs', 'qa', 'F-012-contract-review-2.md')
    fs.writeFileSync(review2, 'KARAR: KALDI\n\nİkinci inceleme notu.')
    fs.utimesSync(review2, new Date('2026-09-06T05:08:00Z'), new Date('2026-09-06T05:08:00Z'))

    // Sözleşme, İKİ inceleme notundan SONRA (nihai hâle getirilince) güncellendi — gerçek F-012
    // deseni. Eski (rol'e sabit) davranış bunu yine de İLK QA notundan önce gösterirdi.
    const contract = path.join(project, 'docs', 'qa', 'F-012-contract.md')
    fs.writeFileSync(contract, 'Nihai sözleşme metni.')
    fs.utimesSync(contract, new Date('2026-09-06T05:29:00Z'), new Date('2026-09-06T05:29:00Z'))

    const result = buildThreadDetail(project, claudeRoot, 'F-012.md', fakeStatsTracker())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return

    const kinds = result.detail.sections.map((s) => s.kind)
    expect(kinds).toEqual([
      'ceo_brief',
      'qa_verdict',
      'qa_verdict',
      'developer_report',
      'transcript',
    ])
    expect(result.detail.sections[1]!.title).toContain('F-012-contract-review-1.md')
    expect(result.detail.sections[2]!.title).toContain('F-012-contract-review-2.md')
    expect(result.detail.sections[3]!.kind).toBe('developer_report')
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
      // X6/Ö1 — kısmi başarı (degraded) artık arayüzde de görünür, yalnızca logda değil.
      expect(transcript.content).toContain('1 satırı')
      expect(transcript.content).toContain('veri eksik olabilir')
      expect(tracker.record).toHaveBeenCalledWith(
        expect.objectContaining({ lines_ok: 1, lines_bad: 1 })
      )
      // Bozuk satır sayısı yalnızca sunucu logunda DEĞİL — hem logda hem UI'da.
      const logged = stderrSpy.mock.calls.some((call) =>
        String(call[0]).includes('ayrıştırılamadı')
      )
      expect(logged).toBe(true)
    } finally {
      stderrSpy.mockRestore()
    }
  })

  it('X6/Ö1 — dosyanın TÜM satırları bozuksa (lines_ok===0) bölüm "okunamadı" olur, uyarı metni değil', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-010.md', '---\nid: F-010\nstatus: todo\n---\ngövde\n')
    const encoded = encodeProjectDirName(project)
    const sessionDir = path.join(claudeRoot, encoded)
    fs.mkdirSync(sessionDir, { recursive: true })
    // Tek satır, ve o da bozuk — `lines_ok` sıfır kalır (M10'un sildiği dal tam olarak burada
    // devreye girer).
    fs.writeFileSync(path.join(sessionDir, 'session-1.jsonl'), 'BOZUK JSON DEĞİL {{{\n')

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const result = buildThreadDetail(project, claudeRoot, 'F-010.md', fakeStatsTracker())
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      const transcript = result.detail.sections.find((s) => s.kind === 'transcript')!
      expect(transcript.readable).toBe(false)
      expect(transcript.content).toBeNull()
    } finally {
      stderrSpy.mockRestore()
    }
  })

  it('X1/B1 — transkript okuma yolu (realpathSync.native) EPERM fırlatırsa yalnızca transkript "okunamadı" olur, diğer bölümler dolu kalır', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-011.md', '---\nid: F-011\nstatus: todo\n---\ngövde\n')
    writeFile(project, 'docs/qa/F-011-contract.md', 'sözleşme metni')
    const encoded = encodeProjectDirName(project)
    const sessionDir = path.join(claudeRoot, encoded)
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(
      path.join(sessionDir, 'session-1.jsonl'),
      `${JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1 } } })}\n`
    )

    // Gerçek Windows koşulunu (AV kilidi / ACL / ağ sürücüsü — QA'nın `icacls /deny` ile
    // ölçtüğü EPERM) taklit eder: `resolveAllowedTranscriptPath`'in son adımı olan
    // `fs.realpathSync.native` fırlar. YALNIZCA transkript dosyası için — `resolveInsideRootForRead`
    // (F-013) da aynı fonksiyonu (CEO brief/sözleşme okuması için) kullanıyor, o çağrılar gerçek
    // davranışına devam etmeli.
    const transcriptFile = path.join(sessionDir, 'session-1.jsonl')
    const originalRealpathNative = fs.realpathSync.native
    const realpathSpy = vi.spyOn(fs.realpathSync, 'native').mockImplementation((p: fs.PathLike) => {
      if (path.resolve(p.toString()) === path.resolve(transcriptFile)) {
        throw new Error('EPERM: operation not permitted, realpath')
      }
      return originalRealpathNative(p as fs.PathLike)
    })
    try {
      const tracker = fakeStatsTracker()
      const result = buildThreadDetail(project, claudeRoot, 'F-011.md', tracker)
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      const ceo = result.detail.sections.find((s) => s.kind === 'ceo_brief')!
      const dev = result.detail.sections.find((s) => s.kind === 'developer_report')!
      const transcript = result.detail.sections.find((s) => s.kind === 'transcript')!
      expect(ceo.readable).toBe(true)
      expect(dev.readable).toBe(true)
      expect(transcript.readable).toBe(false)
      expect(transcript.content).toBeNull()
      // Sayaç fırlayan okuma için ÇAĞRILMAZ (gerçek bir okuma hiç gerçekleşmedi).
      expect(tracker.record).not.toHaveBeenCalled()
    } finally {
      realpathSpy.mockRestore()
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

  it('X2/Ö4 — latest.md gerçek başlığı ESKALE:false ama GÖVDESİ formatı alıntılıyorsa (ESKALE:true içeren kod bloğu) rozet sızmaz', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-010.md', '---\nid: F-010\nstatus: todo\n---\ngövde\n')
    // Bu depoda gerçekten olan senaryo (QA'nın kendi raporu): gerçek başlık ESKALE:false, ama
    // gövdede raporun kendi formatını gösteren bir kod bloğu ESKALE:true İÇERİYOR.
    writeFile(
      project,
      'docs/qa/latest.md',
      'KARAR: KALDI\nESKALE: false\n\n' +
        '---\nfeature: F-010\n---\n\n' +
        '# F-010 QA\n\nBir önceki turun formatı örnek:\n```\nKARAR: KALDI\nESKALE: true\n```\n'
    )

    const result = buildThreadDetail(project, claudeRoot, 'F-010.md', fakeStatsTracker())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.detail.eskale).toBe(false)
  })

  it('X2/M11 — başlık bloğunun İÇİNDE bile "ESKALE: true" bir cümlenin parçası olarak geçerse (tam satır eşleşmesi yoksa) tetiklenmez', () => {
    const project = tempDir()
    const claudeRoot = tempDir()
    writeFile(project, 'docs/features/F-013.md', '---\nid: F-013\nstatus: todo\n---\ngövde\n')
    // Başlık bloğunun (ilk `---`den önceki satırlar) İÇİNDE "ESKALE: true" geçiyor ama TAM SATIR
    // olarak değil — anchor'lar (`^…$`/`m`) bu satırı reddetmeli. Anchor'lar kaldırılırsa (M11)
    // bu test KIRMIZI verir.
    writeFile(
      project,
      'docs/qa/latest.md',
      'KARAR: KALDI\nESKALE: false\nNot: önceki turda ESKALE: true idi, artık düzeltildi.\n\n' +
        '---\nfeature: F-013\n---\n\n# F-013 QA\n'
    )

    const result = buildThreadDetail(project, claudeRoot, 'F-013.md', fakeStatsTracker())
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

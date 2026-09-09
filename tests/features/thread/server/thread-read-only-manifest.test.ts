import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildThreadDetail } from '../../../../src/features/thread/server/thread-detail'
import { encodeProjectDirName } from '../../../../src/features/thread/server/transcript-reader'
import { snapshotDir } from '../../../helpers/manifest'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, ...relPath.split('/'))
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function fakeStatsTracker() {
  return { record: vi.fn(), getStats: () => ({ files_seen: 0, lines_ok: 0, lines_bad: 0 }) }
}

/**
 * W3 (CEO kararı) — F-013'ün Ö1 dersi birebir uygulanır: anlık görüntü (`before`) TÜM
 * `buildThreadDetail` çağrılarından ÖNCE alınır, ondan SONRA değil. Aksi halde ölçülen
 * fonksiyonun kendi yazması bile karşılaştırmaya hiç girmez (F-013'ün eski, sahte testinin
 * tam olarak düştüğü tuzak, `CLAUDE.md`).
 */
describe('buildThreadDetail salt okunurluk manifest testi (W3) — gerçek fs', () => {
  it('mutlu yol + not_found + invalid_path + transkript okuması hiçbir dosyayı değiştirmez/oluşturmaz/silmez', () => {
    const project = createTempDataDir()
    const claudeRoot = createTempDataDir()
    try {
      writeFile(project, 'docs/features/F-001.md', '---\nid: F-001\nstatus: todo\n---\ngövde\n')
      writeFile(project, 'docs/qa/F-001-contract.md', 'sözleşme')
      writeFile(project, 'docs/qa/F-001-2026-09-01.md', 'KARAR: KALDI\nqa turu 1')
      writeFile(project, 'docs/qa/latest.md', 'KARAR: KALDI\nESKALE: true\n\n# F-001 QA\n')
      const encoded = encodeProjectDirName(project)
      fs.mkdirSync(path.join(claudeRoot, encoded), { recursive: true })
      fs.writeFileSync(
        path.join(claudeRoot, encoded, 'session-1.jsonl'),
        `${JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1 } } })}\n`
      )

      // Anlık görüntü TÜM çağrılardan ÖNCE (F-013/Ö1 dersi) — hem proje hem claude kökü.
      const beforeProject = snapshotDir(project)
      const beforeClaude = snapshotDir(claudeRoot)

      const tracker = fakeStatsTracker()
      buildThreadDetail(project, claudeRoot, 'F-001.md', tracker) // mutlu yol
      buildThreadDetail(project, claudeRoot, 'F-099.md', tracker) // not_found
      buildThreadDetail(project, claudeRoot, '..%2f..%2fpackage.json', tracker) // invalid_path/not_found

      const afterProject = snapshotDir(project)
      const afterClaude = snapshotDir(claudeRoot)

      expect(afterProject).toEqual(beforeProject)
      expect(afterClaude).toEqual(beforeClaude)
    } finally {
      removeTempDataDir(project)
      removeTempDataDir(claudeRoot)
    }
  })

  it('MUTASYON emsali: buildThreadDetail içine geçici bir fs.writeFileSync eklenseydi bu test KIRMIZI verirdi', () => {
    const project = createTempDataDir()
    const claudeRoot = createTempDataDir()
    try {
      writeFile(project, 'docs/features/F-001.md', '---\nid: F-001\nstatus: todo\n---\ngövde\n')
      const before = snapshotDir(project)

      // Üretim kodu DEĞİŞTİRİLMEDEN — bir yazma sızıntısını simüle eder (F-013/M3a emsali).
      buildThreadDetail(project, claudeRoot, 'F-001.md', fakeStatsTracker())
      fs.mkdirSync(path.join(project, 'docs', 'qa'), { recursive: true })
      fs.writeFileSync(path.join(project, 'docs', 'qa', '.mc-read.log'), 'okundu: F-001.md')

      const after = snapshotDir(project)
      expect(after).not.toEqual(before)
    } finally {
      removeTempDataDir(project)
      removeTempDataDir(claudeRoot)
    }
  })
})

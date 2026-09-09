import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { computeUsageReport } from '../../../../src/features/usage/server/usage-aggregator'
import { encodeProjectDirName } from '../../../../src/features/thread/server/transcript-reader'
import { snapshotDir } from '../../../helpers/manifest'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

/**
 * F-011 QA düzeltme turu (Z3) — QA ölçtü: statik dizge taraması (`no-write-gate-bypass.test.ts`)
 * dolaylı bir yazma çağrısıyla (`fs['w'+'riteFileSync'](…)`) aşılabiliyordu ve mutasyon GERÇEKTEN
 * dosya yazdı, 1255/1255 test yeşil kalmıştı (Ö6). Thread'in emsali
 * (`tests/features/thread/server/thread-read-only-manifest.test.ts`) SONUCA bakar, çağrının ADINA
 * değil: `computeUsageReport` çağrılarından ÖNCE ve SONRA gerçek `fs` üzerinde bir dosya sistemi
 * anlık görüntüsü alınır ve TAM EŞİTLİK aranır — dosya HANGİ yolla yazılırsa yazılsın (doğrudan,
 * dolaylı, `Function('...')`, ne olursa olsun) anlık görüntü değişir ve bu test KIRMIZI verir.
 */
describe('computeUsageReport salt okunurluk manifest testi (Z3) — gerçek fs, çağrı adına değil sonuca bakar', () => {
  it('mutlu yol + kaynak yok + subagent meta okuması hiçbir dosyayı değiştirmez/oluşturmaz/silmez', () => {
    const claudeRoot = createTempDataDir()
    const project = createTempDataDir()
    try {
      const encoded = encodeProjectDirName(project)
      const projDir = path.join(claudeRoot, encoded)
      fs.mkdirSync(path.join(projDir, 'sess-1', 'subagents'), { recursive: true })
      fs.writeFileSync(
        path.join(projDir, 'sess-1.jsonl'),
        `${JSON.stringify({
          type: 'assistant',
          message: { id: 'm1', usage: { input_tokens: 1, output_tokens: 1 } },
          requestId: 'r1',
        })}\n`
      )
      fs.writeFileSync(
        path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
        `${JSON.stringify({
          type: 'assistant',
          message: { id: 'm2', usage: { input_tokens: 2, output_tokens: 2 } },
          requestId: 'r2',
        })}\n`
      )
      fs.writeFileSync(
        path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'),
        JSON.stringify({ agentType: 'developer' })
      )

      // Anlık görüntü TÜM çağrılardan ÖNCE (F-013/Ö1 dersi, thread-read-only-manifest.test.ts
      // emsali) — hem proje hem claude kökü.
      const beforeProject = snapshotDir(project)
      const beforeClaude = snapshotDir(claudeRoot)

      computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }]) // mutlu yol
      computeUsageReport(path.join(claudeRoot, 'yok-boyle-bir-kok'), [
        { id: 'p1', label: 'p', path: project },
      ]) // kaynak yok (source_unreadable)
      computeUsageReport(claudeRoot, []) // boş proje listesi

      const afterProject = snapshotDir(project)
      const afterClaude = snapshotDir(claudeRoot)

      expect(afterProject).toEqual(beforeProject)
      expect(afterClaude).toEqual(beforeClaude)
    } finally {
      removeTempDataDir(project)
      removeTempDataDir(claudeRoot)
    }
  })

  it('MUTASYON emsali: computeUsageReport çağrısından hemen sonra sızan bir fs.writeFileSync bu testi KIRMIZI yapardı', () => {
    const claudeRoot = createTempDataDir()
    const project = createTempDataDir()
    try {
      const before = snapshotDir(claudeRoot)
      computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
      // Üretim kodu DEĞİŞTİRİLMEDEN — bir yazma sızıntısını simüle eder (F-013/M3a emsali,
      // thread-read-only-manifest.test.ts'in aynı deseni). Guard'ın SONUCA baktığını, çağrı ADINA
      // değil, kanıtlar — QA'nın Ö6 bulgusunun (dolaylı yazma statik taramayı aşıyordu) tam
      // simetriği.
      fs.writeFileSync(path.join(claudeRoot, '.mc-usage-leak.log'), 'sizinti')
      const after = snapshotDir(claudeRoot)
      expect(after).not.toEqual(before)
    } finally {
      removeTempDataDir(project)
      removeTempDataDir(claudeRoot)
    }
  })
})

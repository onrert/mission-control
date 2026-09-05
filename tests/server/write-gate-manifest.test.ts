import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  archiveDenial,
  setFeatureStatus,
  writeGateApproval,
  writeGateDenial,
} from '../../src/server/write-gate'
import { snapshotDir, type ManifestEntry } from '../helpers/manifest'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function byPath(entries: ManifestEntry[]): Map<string, ManifestEntry> {
  return new Map(entries.map((e) => [e.relPath, e]))
}

let root: string

beforeEach(() => {
  root = createTempDataDir()
  // Zenginleştirilmiş fixture (sözleşme §6, QA Bulgu 10 kapanışı). `docs/approvals/archive/`
  // BİLİNÇLİ OLARAK oluşturulmuyor — `archiveDenial`'ın kendi ilk-kez-oluşturma mkdirSync
  // yolunu koşturmak için.
  writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\nbody\n')
  writeFile(root, 'docs/approvals/G1.ok', 'onaylandı')
  writeFile(root, 'docs/approvals/G2.deny.md', 'red sebebi')
  writeFile(root, 'src/index.ts', 'export {}')
  writeFile(root, 'README.md', '# proje')
  writeFile(root, 'package.json', '{"name":"fixture"}')
  writeFile(root, '.claude/settings.json', '{}')
  writeFile(root, 'docs/qa/latest.md', '# qa notları')
})

afterEach(() => {
  removeTempDataDir(root)
})

describe('write-gate manifest testi (F-006 sözleşmesi §6) — gerçek fs, tam kullanıcı akışı', () => {
  it('izin verilenler dışında hiçbir dosya değişmez; pozitif assert de her yazmayı doğrular', async () => {
    const before = snapshotDir(root)
    const beforeByPath = byPath(before)

    const f001Before = beforeByPath.get('docs/features/F-001.md')
    const g1Before = beforeByPath.get('docs/approvals/G1.ok')
    if (!f001Before || !g1Before) throw new Error('fixture eksik')

    // Senaryo — pozitif ve negatif yollar birlikte.
    const r1 = await setFeatureStatus(root, 'F-001.md', 'qa', f001Before.sha256)
    expect(r1.ok).toBe(true) // İDDİA E parçası

    const r2 = await setFeatureStatus(root, 'F-001.md', 'ikinci-durum', 'bayat-hash')
    expect(r2).toMatchObject({ ok: false, code: 'conflict' })

    const r3 = await setFeatureStatus(root, '../../../etc/passwd', 'qa', 'x')
    expect(r3).toMatchObject({ ok: false, code: 'invalid_body' })

    const r4 = await writeGateApproval(root, 'G1', 'tekrar onay')
    expect(r4.ok).toBe(true) // İDDİA E parçası

    const r5 = await writeGateDenial(root, 'G3', 'red sebebi 3')
    expect(r5.ok).toBe(true) // İDDİA E parçası

    const r6 = archiveDenial(root, 'G2')
    expect(r6.ok).toBe(true) // İDDİA E parçası
    const archivedPath = r6.ok ? r6.path : ''
    expect(archivedPath).not.toBe('')

    const after = snapshotDir(root)
    const afterByPath = byPath(after)

    // İDDİA A: değişen/eklenen relPath kümesi ⊆ izinliler.
    // `docs/approvals/archive/` kendisi manifestte AYRI bir girdi olarak GÖRÜNMEZ (yalnızca
    // BOŞ dizinler `snapshotDir`'de `relPath` sonu `/` ile ayrı girdi olur — archive/ arşivlenen
    // dosyayı içerdiği için boş değil).
    const archivedRel = path.relative(root, archivedPath).split(path.sep).join('/')
    const allowedChangedOrAdded = new Set([
      'docs/features/F-001.md',
      'docs/approvals/G1.ok',
      'docs/approvals/G3.deny.md',
      archivedRel,
    ])
    const beforePaths = new Set(beforeByPath.keys())
    for (const entry of after) {
      const wasPresent = beforePaths.has(entry.relPath)
      const beforeEntry = beforeByPath.get(entry.relPath)
      const changed = !wasPresent || beforeEntry?.sha256 !== entry.sha256
      if (changed) {
        expect(allowedChangedOrAdded.has(entry.relPath)).toBe(true)
      }
    }

    // İDDİA B (R2 düzeltmesi): before'daki, İDDİA A'nın değişen/eklenen kümesi + arşivlenip
    // taşınan kaynak (`G2.deny.md`, İDDİA C'de ayrıca doğrulanıyor) DIŞINDA kalan her relPath
    // after'da AYNI (relPath,size,sha256) ile var.
    const removedBySource = new Set(['docs/approvals/G2.deny.md'])
    for (const [relPath, beforeEntry] of beforeByPath) {
      if (allowedChangedOrAdded.has(relPath) || removedBySource.has(relPath)) continue
      const afterEntry = afterByPath.get(relPath)
      expect(afterEntry).toEqual(beforeEntry)
    }

    // İDDİA C: G2.deny.md before'da var, after'da YOK; arşiv hedefinde AYNI içerikle var.
    expect(afterByPath.has('docs/approvals/G2.deny.md')).toBe(false)
    const archivedEntry = afterByPath.get(archivedRel)
    const g2Before = beforeByPath.get('docs/approvals/G2.deny.md')
    expect(archivedEntry?.sha256).toBe(g2Before?.sha256)
    expect(archivedEntry?.size).toBe(g2Before?.size)

    // İDDİA D: uzunluk yalnızca beklenen kadar farklı (G3.deny.md + arşivlenen dosya eklendi
    // = +2, G2.deny.md kaynağı silindi = -1 → net +1).
    expect(after.length).toBe(before.length + 1)

    // İDDİA E (pozitif, ayrı ayrı): F-001.md ve G1.ok'un içeriği GERÇEKTEN değişti.
    expect(afterByPath.get('docs/features/F-001.md')?.sha256).not.toBe(f001Before.sha256)
    expect(afterByPath.get('docs/approvals/G1.ok')?.sha256).not.toBe(g1Before.sha256)
  })

  it('MUTASYON kanıtı: writeGateApproval hedefi README.md olsaydı İDDİA B KIRMIZI verirdi', () => {
    // Bu test mutasyonu simüle ETMEZ (kaynak kodu değiştirmeden) — yalnızca İDDİA B'nin
    // gerçekten "izin verilmeyenler değişmedi"yi ölçtüğünü, README.md'yi elle bozarak kanıtlar.
    const before = snapshotDir(root)
    const beforeByPath = byPath(before)
    writeFile(root, 'README.md', '# BOZULDU (izin verilmeyen değişiklik simülasyonu)')
    const after = snapshotDir(root)
    const afterByPath = byPath(after)
    const allowedChangedOrAdded = new Set(['docs/features/F-001.md']) // README burada YOK
    let sawUnexpectedChange = false
    for (const [relPath, beforeEntry] of beforeByPath) {
      if (allowedChangedOrAdded.has(relPath)) continue
      const afterEntry = afterByPath.get(relPath)
      if (JSON.stringify(afterEntry) !== JSON.stringify(beforeEntry)) {
        sawUnexpectedChange = true
      }
    }
    expect(sawUnexpectedChange).toBe(true)
  })
})

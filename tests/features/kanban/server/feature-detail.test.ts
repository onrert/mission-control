import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildFeatureDetail,
  isValidFeatureFileName,
  truncateDocument,
  MAX_DOCUMENT_CHARS,
} from '../../../../src/features/kanban/server/feature-detail'
import { resolveInsideRootForRead } from '../../../../src/features/kanban/server/read-guard'
import { snapshotDir } from '../../../helpers/manifest'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

describe('isValidFeatureFileName', () => {
  it('geçerli dosya adları', () => {
    expect(isValidFeatureFileName('F-013.md')).toBe(true)
    expect(isValidFeatureFileName('F-013-feature-detay.md')).toBe(true)
  })
  it('geçersiz dosya adları (yol parçası, uzantı yok, gizli karakter)', () => {
    expect(isValidFeatureFileName('../F-013.md')).toBe(false)
    expect(isValidFeatureFileName('docs/F-013.md')).toBe(false)
    expect(isValidFeatureFileName('F-013')).toBe(false)
    expect(isValidFeatureFileName('F 013.md')).toBe(false)
  })
})

describe('truncateDocument — J4 boyut sınırı', () => {
  it('sınır altındaysa truncated:false, içerik olduğu gibi', () => {
    const doc = truncateDocument('kısa metin')
    expect(doc).toEqual({ exists: true, content: 'kısa metin', truncated: false })
  })

  it('sınır aşılırsa kırpılır VE truncated:true (sessiz kırpma YASAK)', () => {
    const text = 'a'.repeat(MAX_DOCUMENT_CHARS + 500)
    const doc = truncateDocument(text)
    expect(doc.truncated).toBe(true)
    expect(doc.content?.length).toBe(MAX_DOCUMENT_CHARS)
  })

  it('MUTASYON (b) emsali: truncated bayrağı sabit false dönseydi bu test KIRMIZI verirdi', () => {
    const text = 'a'.repeat(MAX_DOCUMENT_CHARS + 500)
    const doc = truncateDocument(text)
    // Bilinçli olarak `truncated`'ın GERÇEKTEN true olduğunu ayrı bir assert ile ölçüyoruz —
    // bu ikinci assert `.toEqual`'e gömülü olsaydı bir refactor onu sessizce silebilirdi.
    expect(doc.truncated).not.toBe(false)
  })
})

describe('buildFeatureDetail — mutlu yol + yok/hata durumları', () => {
  let root: string

  it('gövde + sözleşme + QA raporları (mtime artan sıralı) döner', () => {
    root = createTempDataDir()
    try {
      writeFile(
        root,
        'docs/features/F-001.md',
        '---\nid: F-001\nstatus: todo\n---\n## Açıklama\nİçerik.\n'
      )
      writeFile(root, 'docs/qa/F-001-contract.md', 'sözleşme metni')
      writeFile(root, 'docs/qa/F-001-2026-09-01.md', 'ilk qa turu')
      fs.utimesSync(
        path.join(root, 'docs/qa/F-001-2026-09-01.md'),
        new Date('2026-09-01'),
        new Date('2026-09-01')
      )
      writeFile(root, 'docs/qa/F-001-2026-09-01-tur2.md', 'ikinci qa turu')
      fs.utimesSync(
        path.join(root, 'docs/qa/F-001-2026-09-01-tur2.md'),
        new Date('2026-09-02'),
        new Date('2026-09-02')
      )

      const result = buildFeatureDetail(root, 'F-001.md')
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') throw new Error('beklenmedik durum')
      expect(result.detail.body.exists).toBe(true)
      expect(result.detail.body.content).toBe('## Açıklama\nİçerik.\n')
      expect(result.detail.contract).toEqual({
        exists: true,
        content: 'sözleşme metni',
        truncated: false,
      })
      expect(result.detail.qa_reports.map((r) => r.file)).toEqual([
        'F-001-2026-09-01.md',
        'F-001-2026-09-01-tur2.md',
      ])
      expect(result.detail.content_hash).toHaveLength(64)
    } finally {
      removeTempDataDir(root)
    }
  })

  it('sözleşme/QA raporu yoksa "yok" durumu (exists:false / boş dizi), hata değil', () => {
    root = createTempDataDir()
    try {
      writeFile(root, 'docs/features/F-002.md', '---\nid: F-002\nstatus: todo\n---\ngövde\n')
      const result = buildFeatureDetail(root, 'F-002.md')
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') throw new Error('beklenmedik durum')
      expect(result.detail.contract).toEqual({ exists: false })
      expect(result.detail.qa_reports).toEqual([])
    } finally {
      removeTempDataDir(root)
    }
  })

  it('docs/qa hiç yoksa (dizin bile yok) çökmez, "yok" döner', () => {
    root = createTempDataDir()
    try {
      writeFile(root, 'docs/features/F-003.md', '---\nid: F-003\nstatus: todo\n---\ngövde\n')
      const result = buildFeatureDetail(root, 'F-003.md')
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') throw new Error('beklenmedik durum')
      expect(result.detail.contract).toEqual({ exists: false })
      expect(result.detail.qa_reports).toEqual([])
    } finally {
      removeTempDataDir(root)
    }
  })

  it('gövde dosyası yoksa not_found (yarış durumu — kart listelendi, dosya silindi)', () => {
    root = createTempDataDir()
    try {
      fs.mkdirSync(path.join(root, 'docs', 'features'), { recursive: true })
      const result = buildFeatureDetail(root, 'F-099.md')
      expect(result).toEqual({ status: 'not_found', message: 'Özellik dosyası bulunamadı.' })
    } finally {
      removeTempDataDir(root)
    }
  })

  it('id güvenli karakter kümesi dışındaysa sözleşme/QA arama yolu HİÇ kurulmaz (yok döner, hata değil)', () => {
    root = createTempDataDir()
    try {
      writeFile(
        root,
        'docs/features/F-004.md',
        '---\nid: "../../etc/passwd"\nstatus: todo\n---\ngövde\n'
      )
      writeFile(root, 'docs/qa/notes.md', 'ilgisiz')
      const result = buildFeatureDetail(root, 'F-004.md')
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') throw new Error('beklenmedik durum')
      expect(result.detail.contract).toEqual({ exists: false })
      expect(result.detail.qa_reports).toEqual([])
    } finally {
      removeTempDataDir(root)
    }
  })
})

describe('resolveInsideRootForRead — MUTASYON (a) hedefi: symlink/kapsam savunması', () => {
  let root: string

  it("docs/qa gerçek kökün DIŞINA symlink'lenmişse okuma reddedilir (invalid_path)", () => {
    root = createTempDataDir()
    const outsideDir = createTempDataDir()
    try {
      writeFile(root, 'docs/features/F-005.md', '---\nid: F-005\nstatus: todo\n---\ngövde\n')
      writeFile(outsideDir, 'F-005-contract.md', 'DIŞARIDAN SIZDIRILAN SÖZLEŞME')
      const qaPath = path.join(root, 'docs', 'qa')
      fs.mkdirSync(path.dirname(qaPath), { recursive: true })
      fs.symlinkSync(outsideDir, qaPath, 'junction')

      // Doğrudan guard: symlink hedefi reddedilir.
      const guard = resolveInsideRootForRead(root, ['docs', 'qa'])
      expect(guard).toEqual({ ok: false, reason: 'symlink' })

      // Uçtan uca: `buildFeatureDetail` symlink'li docs/qa'yı hiç OKUMAZ — "yok" döner,
      // dışarıdaki içerik SIZMAZ.
      const result = buildFeatureDetail(root, 'F-005.md')
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') throw new Error('beklenmedik durum')
      expect(result.detail.contract).toEqual({ exists: false })
    } finally {
      fs.rmSync(path.join(root, 'docs', 'qa'), { force: true })
      removeTempDataDir(root)
      removeTempDataDir(outsideDir)
    }
  })

  it('MUTASYON (a) emsali: symlink kontrolü kaldırılsaydı yukarıdaki test KIRMIZI verirdi', () => {
    root = createTempDataDir()
    const outsideDir = createTempDataDir()
    try {
      writeFile(outsideDir, 'secret.md', 'x')
      const linkPath = path.join(root, 'link')
      fs.symlinkSync(outsideDir, linkPath, 'junction')

      // Kasıtlı olarak GÜVENSİZ bir kontrol (symlink savunması OLMADAN) — yalnızca gerçek
      // guard'ın bunu YAKALADIĞINI göstermek için, üretim kodu DEĞİŞTİRİLMEDEN.
      const unsafeResolved = path.join(root, 'link')
      const unsafeReal = fs.realpathSync.native(unsafeResolved)
      expect(path.relative(root, unsafeReal).startsWith('..')).toBe(true) // gerçekten dışarı çıkıyor

      // Gerçek guard bunu reddeder (mutasyon UYGULANMADI, karşılaştırma için).
      const guard = resolveInsideRootForRead(root, ['link'])
      expect(guard.ok).toBe(false)
    } finally {
      fs.rmSync(path.join(root, 'link'), { force: true })
      removeTempDataDir(root)
      removeTempDataDir(outsideDir)
    }
  })
})

describe('feature-detail manifest testi (F-013 sözleşme §5, J3) — gerçek fs, salt okunurluk kanıtı', () => {
  it('buildFeatureDetail çağrıları (mutlu yol + yok + geçersiz id) hiçbir dosyayı değiştirmez', () => {
    const root = createTempDataDir()
    try {
      writeFile(root, 'docs/features/F-001.md', '---\nid: F-001\nstatus: todo\n---\ngövde\n')
      writeFile(root, 'docs/qa/F-001-contract.md', 'sözleşme')
      writeFile(root, 'docs/qa/F-001-2026-09-01.md', 'qa turu 1')

      const before = snapshotDir(root)

      buildFeatureDetail(root, 'F-001.md')
      buildFeatureDetail(root, 'F-099.md') // not_found dalı
      writeFile(root, 'docs/features/F-invalid-id.md', '---\nid: "../x"\nstatus: todo\n---\n')
      const beforeInvalid = snapshotDir(root)
      buildFeatureDetail(root, 'F-invalid-id.md') // geçersiz id dalı

      const after = snapshotDir(root)
      // İkinci fixture eklemesi HARİÇ (test kurulumunun kendi yazması, ölçülen fonksiyonun değil)
      // geri kalan hiçbir dosya değişmedi.
      expect(after).toEqual(beforeInvalid)
      expect(
        before.every((e) => after.some((a) => a.relPath === e.relPath && a.sha256 === e.sha256))
      ).toBe(true)
    } finally {
      removeTempDataDir(root)
    }
  })

  it('MUTASYON (c) emsali: buildFeatureDetail içine geçici bir fs.writeFileSync eklenseydi manifest testi bunu yakalardı', () => {
    const root = createTempDataDir()
    try {
      writeFile(root, 'docs/features/F-001.md', '---\nid: F-001\nstatus: todo\n---\ngövde\n')
      const before = snapshotDir(root)

      // Üretim kodu DEĞİŞTİRİLMEDEN — yalnızca "eğer bir yazma sızsaydı manifest testi bunu
      // yakalardı" iddiasını, testin KENDİ ölçüm yönteminin duyarlılığını kanıtlayarak gösterir.
      fs.writeFileSync(path.join(root, 'docs', 'features', 'F-001.md'), 'BOZULDU (simülasyon)')
      const after = snapshotDir(root)
      expect(after).not.toEqual(before)
    } finally {
      removeTempDataDir(root)
    }
  })
})

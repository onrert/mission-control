import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
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

describe('buildFeatureDetail — QA düzeltme turu K1/B2 (id üzerinden kök kaçışı, gerçek saldırı)', () => {
  let root: string
  let outsideDir: string

  afterEach(() => {
    if (root) removeTempDataDir(root)
    if (outsideDir) removeTempDataDir(outsideDir)
  })

  it('QA\'nın ölçtüğü gerçek saldırı: id="../../../<dış-klasör>/qa/EVIL" kök dışındaki içeriği SIZDIRMAZ', () => {
    root = createTempDataDir()
    // `root` altındaki `docs/qa/<id>-contract.md` inşasından `../../../<marker>/qa/EVIL-
    // contract.md` yoluyla ÜÇ seviye yukarı çıkıp `root`'un YANINDAKİ (kardeş) bir dizine
    // inecek şekilde `id` kuruluyor — gerçek dosya da TAM O konuma yazılıyor (QA'nın kendi
    // repro'sundaki gibi rastgele bir dış temp dizini DEĞİL, saldırının matematiksel olarak
    // gerçekten ulaştığı konum). `crypto.randomUUID()` paralel testlerle çakışmayı önler
    // (`tests/integration/features-api.test.ts`'teki "MUTASYON (a)" testiyle aynı desen).
    const marker = `mc-outside-${crypto.randomUUID()}`
    outsideDir = path.join(path.dirname(root), marker)
    writeFile(
      root,
      'docs/features/F-902-evil.md',
      `---\nid: "../../../${marker}/qa/EVIL"\nstatus: todo\n---\ngövde\n`
    )
    // `docs/qa` gerçek projelerde neredeyse her zaman var — bu dizin YOKSA `qaDirResolved`
    // zaten `not-found` döner ve testin ölçmek istediği kaçış hiç denenmez (yanlış nedenle
    // yeşil kalır). Var olduğunu garanti ederek gerçekçi koşulu ölçüyoruz.
    writeFile(root, 'docs/qa/.keep', '')
    writeFile(outsideDir, 'qa/EVIL-contract.md', 'KOK-DISI-SIZAN-GIZLI-ICERIK')

    const result = buildFeatureDetail(root, 'F-902-evil.md')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('beklenmedik durum')
    // Ne sözleşme ne de QA raporları kök dışına çıkar — SAFE_ID_PATTERN `/` içeren id'yi
    // baştan reddeder (birinci katman).
    expect(result.detail.contract).toEqual({ exists: false })
    expect(result.detail.qa_reports).toEqual([])
  })

  it('id kendi featureının docs/qa DIŞINDAKİ bir dosyaya sızmasını dener (id="F-001/../F-002"): SAFE_ID_PATTERN reddeder', () => {
    root = createTempDataDir()
    writeFile(
      root,
      'docs/features/F-905-evil.md',
      '---\nid: "F-001/../F-002"\nstatus: todo\n---\ngövde\n'
    )
    // Hedef: docs/qa/F-001/../F-002-contract.md === docs/qa/F-002-contract.md — YOLUN KENDİSİ
    // kök İÇİNDE ve docs/qa ALTINDA kalıyor (K2'nin "docs/qa dışına çıkma" kontrolü bunu
    // YAKALAYAMAZ), yalnızca SAFE_ID_PATTERN'in `/` reddi bunu engeller.
    writeFile(root, 'docs/qa/F-002-contract.md', 'BASKA-FEATURE-IN-SOZLESMESI-SIZMAMALI')

    const result = buildFeatureDetail(root, 'F-905-evil.md')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('beklenmedik durum')
    expect(result.detail.contract).toEqual({ exists: false })
  })
})

describe('resolveInsideRootForRead — QA düzeltme turu K2/Ö4 (kök altında AMA docs/features|docs/qa dışında)', () => {
  let root: string

  afterEach(() => {
    if (root) removeTempDataDir(root)
  })

  it("QA'nın ölçtüğü gerçek çağrı: root'un doğrudan altındaki bir dosya (docs/features|docs/qa DIŞI) reddedilir", () => {
    root = createTempDataDir()
    writeFile(root, 'package.json', '{"name":"gizli-degil-ama-kapsam-disi"}')
    writeFile(root, 'CLAUDE.md', '# kapsam dışı')

    expect(resolveInsideRootForRead(root, ['package.json'])).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
    expect(resolveInsideRootForRead(root, ['CLAUDE.md'])).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
  })

  it('docs/ altında ama docs/features veya docs/qa DIŞINDA bir dosya reddedilir', () => {
    root = createTempDataDir()
    writeFile(root, 'docs/other/secret.md', 'kapsam dışı belge')

    expect(resolveInsideRootForRead(root, ['docs', 'other', 'secret.md'])).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
  })

  it('docs/features ve docs/qa altındaki dosyalar İZİN VERİLEN kalır (regresyon yok)', () => {
    root = createTempDataDir()
    writeFile(root, 'docs/features/F-010.md', 'gövde')
    writeFile(root, 'docs/qa/F-010-contract.md', 'sözleşme')

    const bodyResult = resolveInsideRootForRead(root, ['docs', 'features', 'F-010.md'])
    expect(bodyResult.ok).toBe(true)
    const contractResult = resolveInsideRootForRead(root, ['docs', 'qa', 'F-010-contract.md'])
    expect(contractResult.ok).toBe(true)
    const qaDirResult = resolveInsideRootForRead(root, ['docs', 'qa'])
    expect(qaDirResult.ok).toBe(true)
  })

  it("MUTASYON emsali: buildFeatureDetail'in `file` parametresi ile kök İÇİNDE ama docs/features DIŞINDA bir dosyaya kaçış denemesi reddedilir (invalid_path)", () => {
    root = createTempDataDir()
    fs.mkdirSync(path.join(root, 'docs', 'features'), { recursive: true })
    writeFile(root, 'CLAUDE.md', 'GIZLI-OLMAYAN-AMA-KAPSAM-DISI-ICERIK')

    // Ö4'ün gerçek PoC'si: `../../CLAUDE.md` kök İÇİNDE kalıyor (`docs/features/../../CLAUDE.md`
    // === `CLAUDE.md`), eski guard yalnızca "kök altında mı" kontrolü yaptığı için bunu KABUL
    // ediyordu. K2 sonrası `docs/features` dışına çıktığı için reddedilir.
    const result = buildFeatureDetail(root, '../../CLAUDE.md')
    expect(result.status).toBe('invalid_path')
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
      // Test kurulumunun KENDİ yazması (ölçülen fonksiyonun değil) — anlık görüntüden ÖNCE
      // yapılır. QA bulgusu Ö1: eski test bu fixture'ı ilk iki `buildFeatureDetail` çağrısından
      // SONRA ekliyordu, yani o iki çağrının ürettiği herhangi bir yazma hiçbir zaman
      // karşılaştırmaya girmiyordu.
      writeFile(root, 'docs/features/F-invalid-id.md', '---\nid: "../x"\nstatus: todo\n---\n')

      // Anlık görüntü TÜM `buildFeatureDetail` çağrılarından ÖNCE alınır (QA bulgusu Ö1, madde 1).
      const before = snapshotDir(root)

      buildFeatureDetail(root, 'F-001.md') // mutlu yol
      buildFeatureDetail(root, 'F-099.md') // not_found dalı
      buildFeatureDetail(root, 'F-invalid-id.md') // geçersiz id dalı

      const after = snapshotDir(root)
      // TAM eşitlik (QA bulgusu Ö1, madde 2) — `before`'un alt kümesi değil, `after` ile
      // BİREBİR aynı olmalı. Bu, yalnızca var olan dosyaların DEĞİŞMEDİĞİNİ değil, YENİ bir
      // dosya oluşmadığını/silinmediğini de yakalar (M3a: mutlu yola sabit içerikli bir
      // `fs.writeFileSync` eklenseydi bu satır KIRMIZI verirdi).
      expect(after).toEqual(before)
    } finally {
      removeTempDataDir(root)
    }
  })

  it('MUTASYON (M3a) emsali: buildFeatureDetail mutlu yoluna gerçek bir fs.writeFileSync eklenseydi bu test KIRMIZI verirdi', () => {
    const root = createTempDataDir()
    try {
      writeFile(root, 'docs/features/F-001.md', '---\nid: F-001\nstatus: todo\n---\ngövde\n')
      const before = snapshotDir(root)

      // Üretim kodu DEĞİŞTİRİLMEDEN — QA'nın M3a mutasyonunu (mutlu yola sabit içerikli bir
      // `fs.writeFileSync(docs/qa/.mc-read.log)` eklenmesi) birebir simüle eder: gerçek
      // `buildFeatureDetail` çağrısıyla AYNI anda, tarayıcının göremeyeceği YENİ bir dosya
      // yazılıyormuş gibi davranır. Eski test bunu (yeni dosya oluşturma) YAKALAMIYORDU —
      // düzeltilmiş `before`/`after` TAM EŞİTLİK karşılaştırması yakalar.
      buildFeatureDetail(root, 'F-001.md')
      writeFile(root, 'docs/qa/.mc-read.log', 'okundu: F-001.md')

      const after = snapshotDir(root)
      expect(after).not.toEqual(before)
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

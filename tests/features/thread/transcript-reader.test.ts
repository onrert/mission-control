import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createTranscriptReaderStatsTracker,
  encodeProjectDirName,
  findAllowedTranscriptDirectories,
  readAllowedTranscript,
  readTranscript,
  resolveAllowedTranscriptPath,
} from '../../../src/features/thread/server/transcript-reader'

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'transcripts')

function fixture(name: string): string {
  return path.join(FIXTURES_DIR, name)
}

function mkTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

// -------------------------------------------------------------------------------------------
// T2 + T5 — 5 zorunlu fixture, hiçbirinde throw yok, `degraded` dürüst.
// Beklenen sayılar `scripts/gen-fixtures.mjs`'in (fixture üretim scripti, repoya dahil değil)
// yorumlarıyla birebir eşleşir — fixture içeriği değişirse bu testler de güncellenmeli.
// -------------------------------------------------------------------------------------------
describe('readTranscript — 5 dondurulmuş fixture, throw etmez (T2), degraded dürüst (T5)', () => {
  it('valid.jsonl — 8 satırın hepsi geçerli JSON, 4 tanınmayan type, throw yok', () => {
    let result: ReturnType<typeof readTranscript> | undefined
    expect(() => {
      result = readTranscript(fixture('valid.jsonl'))
    }).not.toThrow()
    expect(result).toMatchObject({
      lines_ok: 8,
      lines_bad: 0,
      unknown_type_lines: 4,
      degraded: false,
      file_read_failed: false,
      usage: {
        input_tokens: 150,
        output_tokens: 60,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 800,
      },
    })
  })

  it('truncated-last-line.jsonl — son satır kesik, lines_bad=1, degraded=true, throw yok', () => {
    let result: ReturnType<typeof readTranscript> | undefined
    expect(() => {
      result = readTranscript(fixture('truncated-last-line.jsonl'))
    }).not.toThrow()
    expect(result).toMatchObject({
      lines_ok: 3,
      lines_bad: 1,
      unknown_type_lines: 1,
      degraded: true,
      file_read_failed: false,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    })
  })

  it('unknown-schema.jsonl — bilinmeyen/bozuk şema, usage alanları savunmalı, throw yok', () => {
    let result: ReturnType<typeof readTranscript> | undefined
    expect(() => {
      result = readTranscript(fixture('unknown-schema.jsonl'))
    }).not.toThrow()
    expect(result).toMatchObject({
      lines_ok: 4,
      lines_bad: 0,
      unknown_type_lines: 2,
      degraded: false,
      file_read_failed: false,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    })
  })

  it('empty.jsonl — boş dosya, her şey sıfır, throw yok', () => {
    let result: ReturnType<typeof readTranscript> | undefined
    expect(() => {
      result = readTranscript(fixture('empty.jsonl'))
    }).not.toThrow()
    expect(result).toMatchObject({
      lines_ok: 0,
      lines_bad: 0,
      unknown_type_lines: 0,
      degraded: false,
      file_read_failed: false,
    })
  })

  it('bom-crlf.jsonl — UTF-8 BOM + CRLF, ilk satır BOM yüzünden bozulmaz, throw yok', () => {
    let result: ReturnType<typeof readTranscript> | undefined
    expect(() => {
      result = readTranscript(fixture('bom-crlf.jsonl'))
    }).not.toThrow()
    expect(result).toMatchObject({
      lines_ok: 3,
      lines_bad: 0,
      unknown_type_lines: 1,
      degraded: false,
      file_read_failed: false,
      usage: {
        input_tokens: 7,
        output_tokens: 3,
        cache_creation_input_tokens: 1,
        cache_read_input_tokens: 2,
      },
    })
  })

  it('MUTASYON hedefi (T2) — satır bazlı try/catch kaldırılırsa truncated-last-line gerçek SyntaxError fırlatır', () => {
    // Bu test mutasyonu SİMÜLE ETMEZ (kod değişmiyor); üretim kodundaki try/catch kaldırıldığında
    // JSON.parse'ın gerçekten fırlattığını (guard'ın maskelemediğini) doğrudan kanıtlar.
    const raw = fs.readFileSync(fixture('truncated-last-line.jsonl'), 'utf8')
    const lastLine =
      raw
        .split('\n')
        .filter((l) => l.trim() !== '')
        .at(-1) ?? ''
    expect(() => JSON.parse(lastLine)).toThrow(SyntaxError)
  })

  it('var olmayan dosya — throw etmez, file_read_failed:true, tüm sayaçlar 0', () => {
    let result: ReturnType<typeof readTranscript> | undefined
    expect(() => {
      result = readTranscript(path.join(FIXTURES_DIR, 'yok-boyle-bir-dosya.jsonl'))
    }).not.toThrow()
    expect(result).toMatchObject({
      lines_ok: 0,
      lines_bad: 0,
      unknown_type_lines: 0,
      degraded: true,
      file_read_failed: true,
    })
  })
})

describe('64 MB üstü dosyalarda yalnızca kuyruk okunur (ADR-007 §9.4)', () => {
  it('maxBytesBeforeTail aşılınca yalnızca son tailBytes okunur (satır sınırına hizalı)', () => {
    const dir = mkTempRoot('mc-transcript-tail-')
    try {
      const file = path.join(dir, 'big.jsonl')
      const early = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 999 } } })
      const kept = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 5 } } })
      // "early" satırı düşük eşik altında kalacak şekilde önce yazılır; sonra eşiği aşacak
      // kadar dolgu + "kept" satırı eklenir. Küçük eşikler (`maxBytesBeforeTail`/`tailBytes`)
      // enjekte edilerek gerçek 64 MB dosya üretmeden davranış test edilir.
      const padding = 'x'.repeat(200)
      const content = early + '\n' + padding + '\n' + kept + '\n'
      fs.writeFileSync(file, content, 'utf8')

      const result = readTranscript(file, { maxBytesBeforeTail: 10, tailBytes: 100 })
      // early satırının input_tokens:999'u toplama YANSIMAMALI (kuyruk dışında kaldı).
      expect(result.usage.input_tokens).toBe(5)
      expect(result.file_read_failed).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it("QA U4/B5 — kuyrukta satır sınırı HİÇ bulunamazsa (tüm kuyruk newline'sız) degraded:true döner, sessizce sağlıklı görünmez", () => {
    // QA'nın bire bir tekrar ürettiği senaryo: geçerli bir satır + eşiği aşan, hiç `\n` içermeyen
    // dev bir kuyruk. Düzeltmeden önce bu `{lines_ok:0,lines_bad:0,degraded:false}` döndürüyordu —
    // dosyanın TAMAMI kayboldu ama sonuç "sorun yok" diyordu.
    const dir = mkTempRoot('mc-transcript-tail-loss-')
    try {
      const file = path.join(dir, 'no-boundary.jsonl')
      const validLine = JSON.stringify({ type: 'user' })
      const newlineLessTail = 'y'.repeat(4096) // eşiği aşıyor, hiç \n yok
      fs.writeFileSync(file, validLine + '\n' + newlineLessTail, 'utf8')

      const result = readTranscript(file, { maxBytesBeforeTail: 100, tailBytes: 64 })
      expect(result.lines_ok).toBe(0)
      expect(result.lines_bad).toBe(0)
      expect(result.file_read_failed).toBe(false)
      expect(result.degraded).toBe(true) // MUTASYON hedefi: `dataLostNoLineBoundary` çıkarılırsa KIRMIZI
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})

// -------------------------------------------------------------------------------------------
// F-011 QA düzeltme turu (Z1, BLOKLAYICI B1) — tek bir asistan yanıtı BİRDEN FAZLA
// `type:"assistant"` satırı olarak yazılıyor (her içerik bloğu kendi satırı), HER satır aynı
// `message.usage`'ı taşıyor (aynı `message.id`+`requestId`). Önceki davranış her satırı ayrı ayrı
// sayıyordu → gerçek veride +%101,3 şişme (`docs/qa/F-011-2026-09-10.md`). Yeni, DONDURULMUŞ bir
// fixture eklendi (mevcut 5 fixture DEĞİŞTİRİLMEDİ — CLAUDE.md: "yeni bir fixture ekle, mevcutları
// değiştirme").
// -------------------------------------------------------------------------------------------
describe('readTranscript — aynı message.id+requestId taşıyan çok bloklu yanıt tekilleştirilir (Z1)', () => {
  it('duplicate-usage.jsonl — 2 satır aynı yanıtın parçası (yalnızca 1 kez sayılır), 1 farklı yanıt + 2 anahtarsız satır ayrı sayılır', () => {
    const result = readTranscript(fixture('duplicate-usage.jsonl'))
    expect(result.lines_ok).toBe(5)
    expect(result.lines_bad).toBe(0)
    expect(result.file_read_failed).toBe(false)
    // ELLE HESAPLANAN: (msg_dup_1 BİR KEZ: 100/20/5/9) + (msg_dup_2: 7/3/0/0) +
    // (anahtarsız satır 1: 1/1/0/0) + (anahtarsız satır 2: 2/2/0/0) = 110/26/5/9.
    expect(result.usage).toEqual({
      input_tokens: 110,
      output_tokens: 26,
      cache_creation_input_tokens: 5,
      cache_read_input_tokens: 9,
    })
  })

  it('MUTASYON hedefi (Z1) — tekilleştirme kaldırılıp satır bazlı koşulsuz toplama yapılsaydı toplam BUNDAN FARKLI (yanlış) çıkardı', () => {
    // Üretim kodu DEĞİŞTİRİLMEDEN: aynı fixture'ı, tekilleştirme YAPMADAN (eski, bozuk davranışı
    // taklit ederek) elle topluyoruz — gerçek `readTranscript` bu naif toplamdan FARKLI (ve doğru)
    // bir sonuç vermeli. Tekilleştirme kaldırılırsa `readTranscript`'in sonucu bu naif toplamla
    // AYNI olur ve bu test KIRMIZI verir.
    const raw = fs.readFileSync(fixture('duplicate-usage.jsonl'), 'utf8')
    const naiveInputTotal = raw
      .split('\n')
      .filter((l) => l.trim() !== '')
      .reduce((sum, line) => {
        const obj = JSON.parse(line) as {
          type: string
          message?: { usage?: { input_tokens?: number } }
        }
        if (obj.type !== 'assistant') return sum
        return sum + (obj.message?.usage?.input_tokens ?? 0)
      }, 0)
    expect(naiveInputTotal).toBe(210) // eski (tekilleştirmesiz) davranışın vereceği YANLIŞ toplam

    const result = readTranscript(fixture('duplicate-usage.jsonl'))
    expect(result.usage.input_tokens).toBe(110)
    expect(result.usage.input_tokens).not.toBe(naiveInputTotal)
  })
})

// -------------------------------------------------------------------------------------------
// F-011 QA düzeltme turu (Z4/Ö3) — 64 MB+ kuyruk kırpması UYGULANDIĞINDA (satır sınırı bulunsa
// da) `truncated:true` — önceki davranış bu durumda hiçbir sinyal vermiyordu (QA: 70 MB'lık gerçek
// bir dosyada verinin %54,4'ü sessizce düştü, `degraded:false` kalıyordu).
// -------------------------------------------------------------------------------------------
describe('readTranscript — truncated bayrağı (Z4/Ö3)', () => {
  it('dosya eşiği aşmazsa truncated:false', () => {
    const result = readTranscript(fixture('valid.jsonl'))
    expect(result.truncated).toBe(false)
  })

  it('dosya eşiği aşıp satır sınırı BULUNURSA truncated:true (degraded false kalsa bile)', () => {
    const dir = mkTempRoot('mc-transcript-truncated-')
    try {
      const file = path.join(dir, 'big.jsonl')
      const early = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 999 } } })
      const kept = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 5 } } })
      const padding = 'x'.repeat(200)
      const content = early + '\n' + padding + '\n' + kept + '\n'
      fs.writeFileSync(file, content, 'utf8')

      const result = readTranscript(file, { maxBytesBeforeTail: 10, tailBytes: 100 })
      expect(result.truncated).toBe(true)
      expect(result.degraded).toBe(false) // satır sınırı bulundu — Y8/T5 semantiği değişmedi
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('dosya eşiği aşıp satır sınırı HİÇ bulunamazsa truncated:true VE degraded:true', () => {
    const dir = mkTempRoot('mc-transcript-truncated-loss-')
    try {
      const file = path.join(dir, 'no-boundary.jsonl')
      const validLine = JSON.stringify({ type: 'user' })
      const newlineLessTail = 'y'.repeat(4096)
      fs.writeFileSync(file, validLine + '\n' + newlineLessTail, 'utf8')

      const result = readTranscript(file, { maxBytesBeforeTail: 100, tailBytes: 64 })
      expect(result.truncated).toBe(true)
      expect(result.degraded).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})

describe('encodeProjectDirName (ADR-007 §9.1 kodlaması)', () => {
  it('sürücü iki noktası ve ayraçlar "-" olur', () => {
    expect(encodeProjectDirName('C:\\dev\\apps\\mission-control')).toBe(
      'C--dev-apps-mission-control'
    )
  })
  it('ileri eğik çizgi de "-" olur', () => {
    expect(encodeProjectDirName('C:/dev/apps/mission-control')).toBe('C--dev-apps-mission-control')
  })
})

// -------------------------------------------------------------------------------------------
// T3 — yedek yol, harf duyarsız dizin taraması. Gerçek `~/.claude/projects/` KULLANILMAZ
// (makineye özgü, ilgisiz projeler barındırıyor) — geçici, hermetik bir kök kurulur.
// -------------------------------------------------------------------------------------------
describe('findAllowedTranscriptDirectories (T3 — yedek yol, harf duyarsız)', () => {
  it('yalnızca izin verilen projelerin dizinlerini döner, harf duyarsız eşleşir', () => {
    const claudeRoot = mkTempRoot('mc-claude-projects-')
    try {
      const allowedPath = 'C:\\dev\\apps\\ornek-izlenen-proje'
      const encodedMixedCase = 'c--dev-apps-ORNEK-izlenen-proje' // ADR-007 §9.1: harf tutarsızlığı gözlemlendi
      fs.mkdirSync(path.join(claudeRoot, encodedMixedCase))
      fs.mkdirSync(path.join(claudeRoot, 'C--dev-apps-ilgisiz-baska-proje')) // izin listesinde YOK

      const found = findAllowedTranscriptDirectories(claudeRoot, [allowedPath])
      expect(found).toEqual([path.join(claudeRoot, encodedMixedCase)])
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('claudeProjectsRoot yoksa throw etmez, boş dizi döner', () => {
    expect(
      findAllowedTranscriptDirectories(path.join(os.tmpdir(), 'yok-boyle-bir-kok'), [])
    ).toEqual([])
  })

  it('MUTASYON hedefi (T3) — harf duyarsız karşılaştırma kaldırılırsa (case-sensitive) karışık harfli dizin kaçırılır', () => {
    // Üretim kodunu değiştirmeden, aynı mutasyonu burada taklit ederek "gerçekten ölçülüyor mu"
    // kanıtlanır: case-sensitive bir eşleştirici, üretim kodunun bulduğu dizini KAÇIRIR.
    const claudeRoot = mkTempRoot('mc-claude-projects-case-')
    try {
      const allowedPath = 'C:\\dev\\apps\\ornek-izlenen-proje'
      const encodedMixedCase = 'c--dev-apps-ORNEK-izlenen-proje'
      fs.mkdirSync(path.join(claudeRoot, encodedMixedCase))

      const caseSensitiveEncoded = new Set([encodeProjectDirName(allowedPath)]) // .toLowerCase() YOK
      const entries = fs.readdirSync(claudeRoot, { withFileTypes: true })
      const naiveMatches = entries.filter(
        (e) => e.isDirectory() && caseSensitiveEncoded.has(e.name)
      )
      expect(naiveMatches).toHaveLength(0) // case-sensitive olsaydı KIRMIZI kalırdı — üretim kodu bunu YAKALAR

      const actual = findAllowedTranscriptDirectories(claudeRoot, [allowedPath])
      expect(actual).toHaveLength(1)
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})

// -------------------------------------------------------------------------------------------
// T4 — en küçük yetki. "Kaçış denemesi": izlenmeyen (ilgisiz) bir projenin transkriptini okumaya
// çalışmak reddedilmeli. Gerçek makinedeki `hayat-mentoru`/`video-factory` KULLANILMAZ — sahte,
// hermetik bir "ilgisiz proje" kurulur.
// -------------------------------------------------------------------------------------------
describe('resolveAllowedTranscriptPath (T4 — en küçük yetki)', () => {
  function setup() {
    const claudeRoot = mkTempRoot('mc-claude-projects-guard-')
    const allowedProjectPath = 'C:\\dev\\apps\\izlenen-proje'
    const foreignProjectPath = 'C:\\dev\\apps\\ilgisiz-proje' // izlenmeyen — "kaçış" hedefi

    const allowedDir = path.join(claudeRoot, encodeProjectDirName(allowedProjectPath))
    const foreignDir = path.join(claudeRoot, encodeProjectDirName(foreignProjectPath))
    fs.mkdirSync(allowedDir, { recursive: true })
    fs.mkdirSync(foreignDir, { recursive: true })

    const allowedFile = path.join(allowedDir, 'session-a.jsonl')
    const foreignFile = path.join(foreignDir, 'session-b.jsonl')
    fs.writeFileSync(allowedFile, '{"type":"user"}\n')
    fs.writeFileSync(foreignFile, '{"type":"user"}\n')

    return { claudeRoot, allowedProjectPath, allowedFile, foreignFile }
  }

  it('izin verilen projenin transkripti kabul edilir', () => {
    const { claudeRoot, allowedProjectPath, allowedFile } = setup()
    try {
      const result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], allowedFile)
      expect(result).toMatchObject({ ok: true })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('KAÇIŞ DENEMESİ — izlenmeyen (ilgisiz) bir projenin transkripti reddedilir (not-allowed)', () => {
    const { claudeRoot, allowedProjectPath, foreignFile } = setup()
    try {
      const result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], foreignFile)
      expect(result).toEqual({ ok: false, reason: 'not-allowed' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('claudeProjectsRoot dışındaki mutlak yol reddedilir (outside-root)', () => {
    const { claudeRoot, allowedProjectPath } = setup()
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-outside-'))
    const outsideFile = path.join(outside, 'not-a-transcript.jsonl')
    fs.writeFileSync(outsideFile, '{}')
    try {
      const result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], outsideFile)
      expect(result).toEqual({ ok: false, reason: 'outside-root' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(outside, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('var olmayan dosya reddedilir (not-found), throw etmez', () => {
    const { claudeRoot, allowedProjectPath } = setup()
    try {
      const missing = path.join(claudeRoot, encodeProjectDirName(allowedProjectPath), 'yok.jsonl')
      let result: ReturnType<typeof resolveAllowedTranscriptPath> | undefined
      expect(() => {
        result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], missing)
      }).not.toThrow()
      expect(result).toEqual({ ok: false, reason: 'not-found' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('göreli yol reddedilir (path-invalid)', () => {
    const { claudeRoot, allowedProjectPath } = setup()
    try {
      const result = resolveAllowedTranscriptPath(
        claudeRoot,
        [allowedProjectPath],
        'gorece\\yol.jsonl'
      )
      expect(result).toEqual({ ok: false, reason: 'path-invalid' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  // QA U7/B6 — burada duran "MUTASYON hedefi (T4)" testi kendi kendine referans veriyordu
  // (kendi tanımladığı `alwaysAllowed` sabitini doğruluyordu). Gerçek koruma zaten yukarıdaki
  // "KAÇIŞ DENEMESİ" testinde var (GERÇEK `resolveAllowedTranscriptPath` çağrısı, `not-allowed`
  // reddi) — izin listesi kontrolü kaldırılırsa o test KIRMIZI olur. Dekoratif kopya kaldırıldı.

  // ------------------------------------------------------------------------------------------
  // QA U3/B4 — dört savunma katmanının (ata-symlink/L2, hedef-symlink/L3, realpath-öncesi
  // kapsama/L1, realpath-sonrası kapsama/L4) HİÇBİRİNİN kendi testi yoktu; M6/M6b/M10/M11
  // mutasyonlarının hepsi "69 passed" ile fark edilmeden geçti çünkü tek iddia `ok:false`'du —
  // hangi katman reddettiği önemli değildi. Aşağıdaki testler `reason` alanını KESİN olarak
  // iddia eder: bir katman kaldırılırsa akış BİR SONRAKİ katmana düşer ve reason DEĞİŞİR.
  // ------------------------------------------------------------------------------------------

  it('M6 hedefi — proje dizini İÇİNDEKİ bir ATA dizin junction ise reason KESİNLİKLE "symlink" (ata kontrolü, L2)', () => {
    const { claudeRoot, allowedProjectPath } = setup()
    const realOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-real-outside-'))
    const realOutsideFile = path.join(realOutsideDir, 'session-c.jsonl')
    fs.writeFileSync(realOutsideFile, '{"type":"user"}\n')
    // Junction ATA dizin konumunda (final segment DEĞİL) — yalnızca L2 (ata-symlink kontrolü)
    // bunu yakalayabilir. L2 kaldırılırsa (M6) akış L4'e düşer ve reason 'outside-root' olur —
    // bu test o farkı KESİN reason iddiasıyla yakalar (eski test yalnızca `ok:false` bakıyordu).
    const junctionDir = path.join(
      claudeRoot,
      encodeProjectDirName(allowedProjectPath),
      'evil-junction'
    )
    try {
      fs.symlinkSync(realOutsideDir, junctionDir, 'junction')
      const candidate = path.join(junctionDir, 'session-c.jsonl')
      const result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], candidate)
      expect(result).toEqual({ ok: false, reason: 'symlink' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(realOutsideDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('M6b hedefi — adayın KENDİSİ (final segment) junction ise reason KESİNLİKLE "symlink" (hedef kontrolü, L3)', () => {
    const { claudeRoot, allowedProjectPath } = setup()
    const realOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-real-outside-'))
    // Bu kez junction'ın KENDİSİ aday yol (ata değil, final segment) — yalnızca L3 (hedef-symlink
    // kontrolü) bunu yakalayabilir; ata döngüsü final segmenti hiç kontrol etmez (kod yorumu:
    // "son segment HARİÇ"). L3 kaldırılırsa (M6b) akış L4'e düşer, reason 'outside-root' olur.
    const junctionAsFinalSegment = path.join(
      claudeRoot,
      encodeProjectDirName(allowedProjectPath),
      'leak-target'
    )
    try {
      fs.symlinkSync(realOutsideDir, junctionAsFinalSegment, 'junction')
      const result = resolveAllowedTranscriptPath(
        claudeRoot,
        [allowedProjectPath],
        junctionAsFinalSegment
      )
      expect(result).toEqual({ ok: false, reason: 'symlink' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(realOutsideDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('M6+M11 birleşik (QA bulgusu, GERÇEK kaçış) — REAL fonksiyon güvenli kalır, iki katman birlikte kaldırılmış bir taklit KAÇAR', () => {
    // QA bulgusu: M6 (ata-symlink kontrolü kaldırıldı) VE M11 (realpath-sonrası kapsama
    // `resolved` yerine `candidatePath` kullanıyor) AYNI ANDA uygulanınca izin verilen proje
    // içindeki bir junction, kökün TAMAMEN DIŞINDAKİ bir dosyayı OKUTTU (ok:true). Üretim kodu
    // (`transcript-reader.ts`) DEĞİŞTİRİLMEDEN, bu iki katmanın birlikte kaldırıldığı bir taklidi
    // burada yeniden üretip GERÇEK kaçışın koşulunu kanıtlıyoruz; ardından REAL fonksiyonun AYNI
    // fixture'da güvenli kaldığını (ok:false) doğruluyoruz. `M6 hedefi`/`M6b hedefi` testleri
    // yukarıda TEK BAŞINA her katmanın reason'ını zaten çitliyor.
    const { claudeRoot, allowedProjectPath } = setup()
    const realOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-real-outside-combo-'))
    const realOutsideFile = path.join(realOutsideDir, 'session-c.jsonl')
    fs.writeFileSync(realOutsideFile, '{"type":"user"}\n')
    const junctionDir = path.join(
      claudeRoot,
      encodeProjectDirName(allowedProjectPath),
      'evil-junction-combo'
    )
    try {
      fs.symlinkSync(realOutsideDir, junctionDir, 'junction')
      const candidate = path.join(junctionDir, 'session-c.jsonl')

      function resolveWithM6AndM11Removed(
        root: string,
        allowed: readonly string[],
        candidatePath: string
      ): { ok: true; targetPath: string } | { ok: false; reason: string } {
        if (!path.isAbsolute(candidatePath)) return { ok: false, reason: 'path-invalid' }
        if (!fs.existsSync(root)) return { ok: false, reason: 'path-invalid' }
        const relFromRootRaw = path.relative(root, candidatePath)
        if (
          relFromRootRaw === '' ||
          relFromRootRaw.startsWith('..') ||
          path.isAbsolute(relFromRootRaw)
        ) {
          return { ok: false, reason: 'outside-root' }
        }
        // M6: ata-dizin symlink kontrolü (L2) KALDIRILDI — normalde burada olan lstat döngüsü yok.
        if (!fs.existsSync(candidatePath)) return { ok: false, reason: 'not-found' }
        if (fs.lstatSync(candidatePath).isSymbolicLink()) return { ok: false, reason: 'symlink' } // L3 hâlâ aktif
        // M11: realpath-sonrası kapsama `resolved` yerine `candidatePath` (lexical) ile yapılıyor.
        const relFromRoot = path.relative(root, candidatePath)
        if (relFromRoot === '' || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
          return { ok: false, reason: 'outside-root' }
        }
        return { ok: true, targetPath: fs.realpathSync.native(candidatePath) }
      }

      const simulatedBypass = resolveWithM6AndM11Removed(
        claudeRoot,
        [allowedProjectPath],
        candidate
      )
      expect(simulatedBypass.ok).toBe(true) // taklit KAÇAR — QA'nın bulduğu gerçek zafiyet budur
      if (simulatedBypass.ok) {
        expect(path.resolve(simulatedBypass.targetPath)).toBe(path.resolve(realOutsideFile))
      }

      const real = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], candidate)
      expect(real.ok).toBe(false) // GERÇEK fonksiyon güvenli — M6 hedefi testiyle aynı fixture
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(realOutsideDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})

describe('readAllowedTranscript (guard + okuyucu tek giriş noktası)', () => {
  it('izin verilen dosya okunur', () => {
    const claudeRoot = mkTempRoot('mc-claude-projects-access-')
    const allowedProjectPath = 'C:\\dev\\apps\\izlenen-proje'
    const dir = path.join(claudeRoot, encodeProjectDirName(allowedProjectPath))
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'session.jsonl')
    fs.writeFileSync(file, '{"type":"user"}\n')
    try {
      const access = readAllowedTranscript(claudeRoot, [allowedProjectPath], file)
      expect(access).toMatchObject({ ok: true, result: { lines_ok: 1, lines_bad: 0 } })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('izin verilmeyen dosya için readTranscript hiç çağrılmaz, reddedilir', () => {
    const claudeRoot = mkTempRoot('mc-claude-projects-access-deny-')
    const allowedProjectPath = 'C:\\dev\\apps\\izlenen-proje'
    const foreignDir = path.join(claudeRoot, encodeProjectDirName('C:\\dev\\apps\\ilgisiz-proje'))
    fs.mkdirSync(foreignDir, { recursive: true })
    const foreignFile = path.join(foreignDir, 'session.jsonl')
    fs.writeFileSync(foreignFile, '{"type":"user"}\n')
    try {
      const access = readAllowedTranscript(claudeRoot, [allowedProjectPath], foreignFile)
      expect(access).toEqual({ ok: false, reason: 'not-allowed' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})

describe('createTranscriptReaderStatsTracker (T5 — /api/health sayaçları)', () => {
  it('hiç record() çağrılmazsa dürüstçe sıfır döner', () => {
    const tracker = createTranscriptReaderStatsTracker()
    expect(tracker.getStats()).toEqual({ files_seen: 0, lines_ok: 0, lines_bad: 0 })
  })

  it('record() çağrıldıkça birikir', () => {
    const tracker = createTranscriptReaderStatsTracker()
    tracker.record({ lines_ok: 5, lines_bad: 1 })
    tracker.record({ lines_ok: 3, lines_bad: 0 })
    expect(tracker.getStats()).toEqual({ files_seen: 2, lines_ok: 8, lines_bad: 1 })
  })

  // QA U7/B6 — burada duran "MUTASYON hedefi (T5)" testi kendi kendine referans veriyordu
  // (`mutatedDegraded=false` sabitiyle karşılaştırma, hiçbir gerçek kod yolunu ölçmüyordu).
  // Gerçek koruma zaten yukarıdaki ilk `describe` bloğundaki fixture testlerinde var:
  // `truncated-last-line.jsonl` → `degraded:true`, `valid.jsonl` → `degraded:false` — ikisi de
  // GERÇEK `readTranscript` çağrısını doğruluyor; `degraded: linesBad > 0 → false` mutasyonu bu
  // iki testten en az birini KIRMIZI yapar. Tekrar eden dekoratif test kaldırıldı.
})

// -------------------------------------------------------------------------------------------
// QA round-2 (KALDI, Y3) — M10/M11 için önceki turdaki kod-ŞEKLİ çiti REDDEDİLDİ. QA ölçtü:
// (a) gerekçe ("davranışla ayırt edilemez") yanlıştı — S1/S3 senaryoları M10/M11'i davranışla
//     ayırt ediyor (M6/M6b'nin kesin-`reason` deseninin birer satırlık uygulaması);
// (b) kod-şekli çitinin kendisi hem YANLIŞ NEGATİF verdi (M10'u `//` ile yorum satırına almak,
//     metni yerinde bırakarak, 51/51 yeşil kaldı — regex kaynak METNİNİ arıyordu, çalışıp
//     çalışmadığını değil) hem YANLIŞ POZİTİF verdi (zararsız bir değişken yeniden adlandırması
//     davranışı DEĞİŞTİRMEDEN kırmızı oldu).
// Bu yüzden kod-şekli çiti KALDIRILDI, yerine GERÇEK `resolveAllowedTranscriptPath` çağrılarıyla
// davranış çitleri kondu — `write-gate-manifest.test.ts` emsali burada GEÇERLİ DEĞİL (orada
// denetlenen derleme/paket çıktısı davranışla erişilemeyen bir yüzey; burada davranış yolu açık).
// -------------------------------------------------------------------------------------------
describe('resolveAllowedTranscriptPath — davranış çitleri (M10/M11 regresyonu, QA S1/S3)', () => {
  it('S1 hedefi (M10 regresyonu) — kök DIŞINDA + VAR OLMAYAN aday: reason KESİNLİKLE "outside-root" (not-found DEĞİL)', () => {
    const claudeRoot = mkTempRoot('mc-qa-s1-root-')
    const allowedProjectPath = 'C:\\dev\\apps\\izlenen-proje-s1'
    // M10 (realpath-öncesi lexical kapsama kontrolü, relFromRootRaw) kaldırılırsa akış ata-symlink
    // döngüsüne düşer ve segment'ler '..' ile başladığı için var-olmayan bir ataya çarpıp
    // 'not-found' döner (QA'nın ölçtüğü fark) — temiz kodda bu kontrol daha erken, 'outside-root'
    // ile biter.
    const outsideNonExistent = path.join(
      os.tmpdir(),
      `mc-qa-s1-outside-${Date.now()}`,
      'ghost.jsonl'
    )
    try {
      const result = resolveAllowedTranscriptPath(
        claudeRoot,
        [allowedProjectPath],
        outsideNonExistent
      )
      expect(result).toEqual({ ok: false, reason: 'outside-root' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('S3 hedefi (M11 regresyonu) — kökün KENDİSİ junction üzerinden verilir: reason KESİNLİKLE "outside-root" (ok:true DEĞİL)', () => {
    const realRoot = mkTempRoot('mc-qa-s3-realroot-')
    const allowedProjectPath = 'C:\\dev\\apps\\izlenen-proje-s3'
    const encodedDir = path.join(realRoot, encodeProjectDirName(allowedProjectPath))
    fs.mkdirSync(encodedDir, { recursive: true })
    const file = path.join(encodedDir, 'session.jsonl')
    fs.writeFileSync(file, '{"type":"user"}\n')

    const junctionRoot = path.join(os.tmpdir(), `mc-qa-s3-junction-${Date.now()}`)
    try {
      fs.symlinkSync(realRoot, junctionRoot, 'junction')
      // Aday, junction KÖKÜNÜN içinde (lexical olarak) ama gerçek hedefi (realpath sonrası)
      // junction kökünün TAMAMEN DIŞINDA (gerçek kök farklı bir mutlak yol). M11 (realpath-sonrası
      // kapsama `resolved` yerine `candidatePath` ile yapılırsa) bu farkı kaçırır ve `ok:true`
      // döner (QA'nın ölçtüğü fark) — temiz kod `resolved` üzerinden kontrol ettiği için
      // 'outside-root' ile reddeder.
      const candidateViaJunction = path.join(
        junctionRoot,
        encodeProjectDirName(allowedProjectPath),
        'session.jsonl'
      )
      const result = resolveAllowedTranscriptPath(
        junctionRoot,
        [allowedProjectPath],
        candidateViaJunction
      )
      expect(result).toEqual({ ok: false, reason: 'outside-root' })
    } finally {
      fs.rmSync(junctionRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(realRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})

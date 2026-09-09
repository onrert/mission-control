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
      fs.rmSync(dir, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
    }
  })

  it('KAÇIŞ DENEMESİ — izlenmeyen (ilgisiz) bir projenin transkripti reddedilir (not-allowed)', () => {
    const { claudeRoot, allowedProjectPath, foreignFile } = setup()
    try {
      const result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], foreignFile)
      expect(result).toEqual({ ok: false, reason: 'not-allowed' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
      fs.rmSync(outside, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
    }
  })

  it('proje dizini kendisi symlink (junction) ise ve gerçek hedef izin verilen kümenin dışındaysa reddedilir', () => {
    const { claudeRoot, allowedProjectPath } = setup()
    const realOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-real-outside-'))
    const realOutsideFile = path.join(realOutsideDir, 'session-c.jsonl')
    fs.writeFileSync(realOutsideFile, '{"type":"user"}\n')
    const junctionDir = path.join(
      claudeRoot,
      encodeProjectDirName(allowedProjectPath),
      'evil-junction'
    )
    try {
      fs.symlinkSync(realOutsideDir, junctionDir, 'junction')
      const candidate = path.join(junctionDir, 'session-c.jsonl')
      const result = resolveAllowedTranscriptPath(claudeRoot, [allowedProjectPath], candidate)
      expect(result).toMatchObject({ ok: false })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true })
      fs.rmSync(realOutsideDir, { recursive: true, force: true })
    }
  })

  it('MUTASYON hedefi (T4) — izin listesi kontrolü kaldırılırsa (her zaman true) kaçış testi KIRMIZI olurdu', () => {
    // Üretim kodunu değiştirmeden aynı mutasyonu burada taklit eder: "her zaman izinli" bir
    // guard, foreignFile'ı da kabul ederdi — bu, gerçek fonksiyonun DOĞRU şekilde reddettiğini
    // (bir sonraki testte) tersinden kanıtlar.
    const { claudeRoot, foreignFile } = setup()
    try {
      const alwaysAllowed = (): { ok: true; targetPath: string } => ({
        ok: true,
        targetPath: foreignFile,
      })
      expect(alwaysAllowed()).toMatchObject({ ok: true })
      const actual = resolveAllowedTranscriptPath(
        claudeRoot,
        ['C:\\dev\\apps\\izlenen-proje'],
        foreignFile
      )
      expect(actual).toEqual({ ok: false, reason: 'not-allowed' })
    } finally {
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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
      fs.rmSync(claudeRoot, { recursive: true, force: true })
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

  it('MUTASYON hedefi (T5) — degraded her zaman false yapılırsa fixture testi KIRMIZI olur', () => {
    // Üretim kodunu değiştirmeden aynı mutasyonu burada taklit eder: `degraded` sabit `false`
    // olsaydı, gerçek `readTranscript` çağrısının döndürdüğü değerle eşleşmezdi.
    const mutatedDegraded = false
    const real = readTranscript(fixture('truncated-last-line.jsonl'))
    expect(real.degraded).toBe(true)
    expect(real.degraded).not.toBe(mutatedDegraded)
  })
})

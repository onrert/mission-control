import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * F-009 T1 (CEO kararı, bağlayıcı) — "elle dikkat ettim" yetmez: `tests/fixtures/transcripts/**`
 * altına eklenen HER dosya bu çitten geçmek zorunda. `readdirSync` ile numaralandırılır (sabit
 * dosya listesi DEĞİL — `CLAUDE.md`'nin Tailwind `@source`/e2e-config-guard dersiyle aynı desen:
 * yapısal çit, dosya adı listesine değil dizin taramasına dayanmalı).
 */

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'transcripts')

// Bu makinede gözlemlenen, izlenmesi Mission Control'e ait OLMAYAN gerçek proje adları
// (`C:\Users\pc\.claude\projects\`). Bir fixture içinde geçmesi, gerçek bir başka projenin
// transkript içeriğinin yanlışlıkla kopyalandığının işaretidir.
const UNRELATED_PROJECT_NAMES = [
  'hayat-mentoru',
  'video-factory',
  'growth-factory',
  'app-factory',
  'trendpulseai',
  'video-vault',
]

// Windows mutlak kullanıcı yolu (`C:\Users\<ad>\...`) — JSON içinde `\\` olarak escape edilmiş
// hâliyle de, ham dizge hâliyle de yakalanır (ham dosya metni üzerinde çalışır).
const WINDOWS_USER_PATH_PATTERN = /[A-Za-z]:\\+Users\\+/i

// Bilinen API anahtarı/token önekleri — gerçek Claude tool-use kimlikleri (`toolu_…`) veya
// oturum UUID'leri BİLEREK dışarıda bırakıldı (bunlar secret değil, sıradan tanımlayıcı).
const SECRET_PREFIX_PATTERN =
  /\b(sk-|ghp_|gho_|github_pat_|AKIA|xox[baprs]-|AIza|eyJ[A-Za-z0-9_-]{10,}\.)[A-Za-z0-9_\-.]{10,}/

// Boşluksuz, 80+ karakterlik opak blok (base64/hex benzeri) — gerçek "thinking" imzaları veya
// sızmış ikili veri şüphesi.
const LONG_OPAQUE_BLOB_PATTERN = /[A-Za-z0-9+/_=]{80,}/

const MAX_FREE_TEXT_CHARS = 200

function collectStringLeaves(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStringLeaves(v, out)
  }
}

function listFixtureFiles(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return []
  return fs
    .readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => path.join(FIXTURES_DIR, entry.name))
}

export function scanFixtureForPrivacyViolations(filePath: string): string[] {
  const violations: string[] = []
  const raw = fs.readFileSync(filePath, 'utf8')
  const lowerRaw = raw.toLowerCase()

  for (const needle of UNRELATED_PROJECT_NAMES) {
    if (lowerRaw.includes(needle)) {
      violations.push(`ilgisiz proje adı bulundu: "${needle}"`)
    }
  }
  if (WINDOWS_USER_PATH_PATTERN.test(raw)) {
    violations.push('mutlak kullanıcı yolu deseni bulundu (C:\\Users\\...)')
  }

  for (const rawLine of raw.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (trimmed === '') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      // Format sağlamlığı `transcript-reader.test.ts`'in konusu; bu çit yalnızca gizliliği ölçer.
      continue
    }
    const strings: string[] = []
    collectStringLeaves(parsed, strings)
    for (const value of strings) {
      if (SECRET_PREFIX_PATTERN.test(value)) {
        violations.push(`secret-biçimli dizge bulundu: "${value.slice(0, 12)}…"`)
      }
      if (LONG_OPAQUE_BLOB_PATTERN.test(value)) {
        violations.push(`uzun opak blok bulundu (${value.length} karakter)`)
      }
      if (value.length > MAX_FREE_TEXT_CHARS) {
        violations.push(
          `${MAX_FREE_TEXT_CHARS} karakterden uzun serbest metin bulundu (${value.length} karakter) — gerçek prompt kopyası şüphesi`
        )
      }
    }
  }
  return violations
}

describe('tests/fixtures/transcripts gizlilik çiti (T1)', () => {
  const files = listFixtureFiles()

  it('taranacak en az 5 fixture bulundu (guard kör değil)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
  })

  it.each(files.map((file) => ({ file, name: path.basename(file) })))(
    '$name hiçbir gizlilik ihlali içermiyor',
    ({ file }) => {
      expect(scanFixtureForPrivacyViolations(file)).toEqual([])
    }
  )

  it('MUTASYON hedefi (T1a) — mutlak kullanıcı yolu içeren bir satır çiti KIRMIZI yapar', () => {
    const probe = path.join(FIXTURES_DIR, '__privacy_probe_userpath__.jsonl')
    fs.writeFileSync(probe, '{"type":"user","cwd":"C:\\\\Users\\\\pc\\\\gizli-not"}\n', 'utf8')
    try {
      expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(probe, { force: true })
    }
  })

  it('MUTASYON hedefi (T1b) — ilgisiz proje adı içeren bir satır çiti KIRMIZI yapar', () => {
    const probe = path.join(FIXTURES_DIR, '__privacy_probe_project__.jsonl')
    fs.writeFileSync(
      probe,
      '{"type":"user","message":{"content":"proje: hayat-mentoru"}}\n',
      'utf8'
    )
    try {
      expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(probe, { force: true })
    }
  })

  it('MUTASYON hedefi (T1c) — 200+ karakterlik serbest metin çiti KIRMIZI yapar', () => {
    const probe = path.join(FIXTURES_DIR, '__privacy_probe_freetext__.jsonl')
    const longText = 'x'.repeat(250)
    fs.writeFileSync(
      probe,
      JSON.stringify({ type: 'user', message: { content: longText } }) + '\n',
      'utf8'
    )
    try {
      expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(probe, { force: true })
    }
  })

  it('MUTASYON hedefi (T1d) — çit kaldırılırsa (boş desen listesiyle taklit) gerçek ihlal kaçırılır', () => {
    // Üretim taramasını değil, "çitsiz" bir taklidini kurar: aynı ihlalli metni yalnızca
    // BOŞ bir desen listesiyle tarar (mutasyonun etkisini simüle eder) ve hiçbir şey
    // yakalamadığını, ardından GERÇEK fonksiyonun aynı metni yakaladığını kanıtlar.
    const violatingText = 'C:\\Users\\pc\\gizli-dosya.txt'
    const noPatterns: RegExp[] = []
    const naiveHits = noPatterns.some((p) => p.test(violatingText))
    expect(naiveHits).toBe(false)

    const probe = path.join(FIXTURES_DIR, '__privacy_probe_fence__.jsonl')
    fs.writeFileSync(probe, JSON.stringify({ type: 'system', note: violatingText }) + '\n', 'utf8')
    try {
      expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(probe, { force: true })
    }
  })
})

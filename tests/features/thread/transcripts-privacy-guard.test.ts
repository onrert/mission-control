import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * F-009 T1 (CEO kararı, bağlayıcı) — "elle dikkat ettim" yetmez: `tests/fixtures/transcripts/**`
 * altına eklenen HER dosya bu çitten geçmek zorunda.
 *
 * QA düzeltme turu (U1, BLOKLAYICI) — round-1 çit 12/12 sızdıran sondada yenildi. Kök nedenler ve
 * bu turdaki düzeltme:
 * 1. `listFixtureFiles` yalnızca üst seviye + `.jsonl` tarıyordu → ÖZYİNELEMELİ + UZANTISIZ.
 * 2. `JSON.parse` başarısız olan satırlar atlanıyordu (serbest kanal) → artık HAM METİN, JSON
 *    ayrıştırmasına bakılmaksızın, çift-tırnak arası ("naif split") dizgelere bölünüp taranıyor.
 *    Bu, kesik/bozuk bir satırda bile (P7) gömülü uzun metni yakalar.
 * 3. Yol deseni yalnızca ters-bölülü Windows biçimini görüyordu → POSIX (`/c/Users/…`), ileri
 *    bölü (`C:/Users/…`), ortam değişkeni (`%USERPROFILE%`) ve UNC (`\\SUNUCU\pay`) eklendi.
 * 4. İlgisiz proje listesi elle yazılmış sabit bir listeydi → `~/.claude/projects` dizin adları
 *    taranarak türetiliyor (CLAUDE.md: "çiti feature'a değil yapıya koy"); sabit taban liste de
 *    korunuyor (bu makinede o dizin yoksa/farklıysa çit kör kalmasın diye).
 * 5. Yalnızca DEĞERLER taranıyordu, anahtarlar değil (P8) → naif split anahtar/değer ayrımı
 *    yapmadan çift-tırnak arası HER dizgeyi tarar.
 * 6. 200 karakter eşiği yalnızca TEK bir dizge için kontrol ediliyordu, bir SATIRDAKİ tüm
 *    dizgelerin TOPLAMI için değil → uzun bir metnin küçük parçalara bölünmesiyle (P9) aşılabiliyordu.
 *    Artık hem tekil hem toplam eşik var.
 * 7. Kısa ama tamamen kişisel serbest metin (P1, TC kimlik türü sayı içeren) hiçbir desene
 *    takılmıyordu → 11 haneli TC-kimlik-biçimli sayı deseni + onaylı sözcük dağarcığı (beyaz liste)
 *    eklendi: birden fazla kelimeli HERHANGİ bir serbest metin, sabit bir onaylı sentetik sözcük
 *    kümesinin DIŞINDA bir kelime içeriyorsa çiti tetikler.
 * 8. 80 karakter altı opak blok (P6, base64 sızıntı) kaçıyordu → eşik 40'a düşürüldü (mevcut 5
 *    fixture'daki en uzun tekil dizge 36 karakter — güvenli marj ölçüldü, bkz. altındaki yorum).
 */

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'transcripts')

// --- 1) Sabit taban liste (makine bağımsız asgari koruma) ------------------------------------
const BASELINE_UNRELATED_PROJECT_NEEDLES = [
  'hayat-mentoru',
  'video-factory',
  'growth-factory',
  'app-factory',
  'trendpulseai',
  'video-vault',
]

// --- 2) `~/.claude/projects` dizin adlarından türetilen dinamik liste -------------------------
// Yapısal gürültü (sürücü harfi, `Users`, `AppData` gibi dosya sistemi iskeleti) sözcükleri
// filtrelenir; geri kalan HER token (>=3 karakter, salt sayısal değil) bir "ilgisiz proje"
// ihtimali olarak eklenir — bu, QA'nın P10 sondasındaki `sandbox`/`workdir`/`sdk` gibi gerçek
// makinede gözlenen ama hiçbir sabit listede olmayan adları da otomatik yakalar.
const STRUCTURAL_PATH_STOPWORDS = new Set([
  'c',
  'd',
  'e',
  'users',
  'pc',
  'desktop',
  'appdata',
  'local',
  'temp',
  'claude',
  'dev',
  'apps',
  'app',
  'multica',
  'workspaces',
  'mission',
  'control',
  'resources',
  'release',
  'win',
  'win32',
  'x64',
  'program',
  'files',
  'onedrive',
  'documents',
  'node',
  'modules',
])

function deriveUnrelatedProjectNeedlesFromDisk(): string[] {
  const projectsRoot = path.join(os.homedir(), '.claude', 'projects')
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(projectsRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const needles = new Set<string>()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const tokens = entry.name.toLowerCase().match(/[a-z0-9]+/g) ?? []
    for (const token of tokens) {
      if (token.length < 3) continue
      if (/^[0-9]+$/.test(token)) continue
      if (STRUCTURAL_PATH_STOPWORDS.has(token)) continue
      needles.add(token)
    }
  }
  return [...needles]
}

const UNRELATED_PROJECT_NEEDLES = [
  ...new Set([...BASELINE_UNRELATED_PROJECT_NEEDLES, ...deriveUnrelatedProjectNeedlesFromDisk()]),
]

// --- 3) Mutlak kullanıcı yolu — biçimden bağımsız (ham dosya baytları üzerinde çalışır; JSON
// içindeki `\` kaçışı `\\` olarak yazılır, bu yüzden `\\+` kullanılır). -------------------------
const WINDOWS_USER_PATH_BACKSLASH = /[A-Za-z]:\\+Users\\+/i
const WINDOWS_USER_PATH_FORWARDSLASH = /[A-Za-z]:\/+Users\/+/i
const POSIX_USER_PATH = /\/[A-Za-z]\/Users\//i
const ENV_VAR_USER_PATH = /%(?:USERPROFILE|APPDATA|LOCALAPPDATA|HOMEPATH|HOMEDRIVE)%/i
// UNC (`\\SUNUCU\pay`): sürücü harfi + iki nokta ÖNCESİNDE gelmiyorsa (o zaten normal bir
// Windows yoludur, UNC değil) — negatif lookbehind bunu ayırt eder.
const UNC_PATH = /(?<![A-Za-z]:)\\{2,}[A-Za-z0-9_.$-]{1,64}\\{1,}/

const PATH_LEAK_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'mutlak kullanıcı yolu (C:\\Users\\...)', pattern: WINDOWS_USER_PATH_BACKSLASH },
  {
    label: 'mutlak kullanıcı yolu (C:/Users/...) — ileri bölü',
    pattern: WINDOWS_USER_PATH_FORWARDSLASH,
  },
  { label: 'mutlak kullanıcı yolu (/c/Users/...) — POSIX/Git Bash', pattern: POSIX_USER_PATH },
  { label: 'ortam değişkenli kullanıcı yolu (%USERPROFILE% vb.)', pattern: ENV_VAR_USER_PATH },
  { label: 'UNC ağ yolu (\\\\SUNUCU\\pay)', pattern: UNC_PATH },
]

// TC kimlik no biçimi: 11 haneli, 0 ile başlamayan sayı (basit ama gerçek bir PII işareti).
const TC_KIMLIK_PATTERN = /(?<![0-9])[1-9][0-9]{10}(?![0-9])/

// Bilinen API anahtarı/token önekleri.
const SECRET_PREFIX_PATTERN =
  /\b(sk-|ghp_|gho_|github_pat_|AKIA|xox[baprs]-|AIza|eyJ[A-Za-z0-9_-]{10,}\.)[A-Za-z0-9_\-.]{10,}/

// Boşluksuz opak blok (base64/hex benzeri). Eşik 40 (eskiden 80 — QA P6: 52 karakterlik base64
// sızıntı 80 eşiğinin altında kalıp kaçıyordu). Ölçülen güvenlik marjı: mevcut 5 fixture'daki EN
// UZUN tekil dizge 36 karakter (bkz. geliştirici notu) — 40 eşiği hiçbir mevcut fixture'ı
// yanlışlıkla tetiklemez, 52 karakterlik sondayı yakalar.
const LONG_OPAQUE_BLOB_PATTERN = /[A-Za-z0-9+/_=]{40,}/

// Tekil dizge uzunluk eşiği (P7 — kesik satırda gömülü tek bir uzun metin).
const MAX_FREE_TEXT_CHARS = 200
// SATIR BAŞINA toplam "dizge-benzeri" içerik eşiği (P9 — 20 parçaya bölünmüş uzun prompt, her
// parça < 200 ama toplamı çok daha büyük). Ölçülen güvenlik marjı: mevcut 5 fixture'daki EN
// YÜKSEK satır-başı toplam 413 karakter (naif-split, anahtarlar dahil) — 500 eşiği bunu
// tetiklemez, P9'un onlarca-parçalı sondasını (toplam binlerce karakter) yakalar.
const MAX_TOTAL_FREE_TEXT_CHARS_PER_LINE = 500

// Serbest metin (BOŞLUK İÇEREN dizge — tekil kimlik/enum token'ları değil) beyaz listesi.
// Mevcut 5 fixture'ın ürettiği TÜM çok-kelimeli anonim yer tutucu metinler burada. Yeni bir
// fixture yeni bir çok-kelimeli serbest metin eklerse, kelimeleri BURAYA bilinçli olarak
// eklenmelidir — bu sürtünme kasıtlı (P1: kısa ama tamamen kişisel metin, hiçbir yapısal desene
// takılmadığı için başka türlü yakalanamaz).
const APPROVED_FREE_TEXT_WORDS = new Set([
  'ornek',
  'istek',
  'istem',
  'istemi',
  'metni',
  'metin',
  'kisaltildi',
  'anonim',
  'kullanici',
  'yanit',
  'bom',
  'crlf',
])

function hasOnlyApprovedWords(value: string): boolean {
  const words = value.toLowerCase().match(/[a-zçğıöşü]+/gi)
  if (!words) return true
  return words.every((w) => APPROVED_FREE_TEXT_WORDS.has(w))
}

/** Dizin ağacını özyinelemeli, UZANTIDAN BAĞIMSIZ numaralandırır (sabit dosya adı listesi YOK). */
function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

function listFixtureFiles(): string[] {
  return walk(FIXTURES_DIR)
}

/**
 * Bir satırı çift-tırnak sınırlarına göre "naif" böler: tek sayılı (1., 3., 5., …) parçalar
 * JSON'da bir anahtar YA DA değerin İÇİNDE kabul edilir. Bu, gerçek bir JSON ayrıştırıcısından
 * FARKLI olarak satır BOZUK/KESİK olsa bile (kapanmayan son tırnak) çalışır — son parça yine de
 * "içeride" sayılır (P7'nin tam olarak sızdığı kanal budur). Kaçışlı tırnak (`\"`) içeren
 * fixture'larda hizalama kayabilir — bu turda fixture'ların hiçbirinde kaçışlı tırnak yok.
 */
function naiveQuotedSegments(rawLine: string): string[] {
  const segments = rawLine.split('"')
  const out: string[] = []
  for (let i = 1; i < segments.length; i += 2) {
    const seg = segments[i]
    if (seg !== undefined) out.push(seg)
  }
  return out
}

export function scanFixtureForPrivacyViolations(filePath: string): string[] {
  const violations: string[] = []
  const raw = fs.readFileSync(filePath, 'utf8')
  const lowerRaw = raw.toLowerCase()

  for (const needle of UNRELATED_PROJECT_NEEDLES) {
    if (lowerRaw.includes(needle)) {
      violations.push(`ilgisiz proje adı/sözcüğü bulundu: "${needle}"`)
    }
  }
  for (const { label, pattern } of PATH_LEAK_PATTERNS) {
    if (pattern.test(raw)) {
      violations.push(`yol sızıntısı deseni bulundu: ${label}`)
    }
  }
  if (TC_KIMLIK_PATTERN.test(raw)) {
    violations.push('TC kimlik no biçiminde 11 haneli sayı bulundu')
  }

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.startsWith('\uFEFF') ? rawLine.slice(1) : rawLine
    if (line.trim() === '') continue

    const segments = naiveQuotedSegments(line)
    const totalLen = segments.reduce((sum, s) => sum + s.length, 0)
    if (totalLen > MAX_TOTAL_FREE_TEXT_CHARS_PER_LINE) {
      violations.push(
        `satır başına toplam ${MAX_TOTAL_FREE_TEXT_CHARS_PER_LINE} karakterden uzun dizge içeriği (${totalLen} karakter) — parçalanmış prompt şüphesi`
      )
    }

    for (const value of segments) {
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
      if (value.includes(' ') && !hasOnlyApprovedWords(value)) {
        violations.push(
          `onaylı sözcük dağarcığı dışında serbest metin bulundu: "${value.slice(0, 40)}…"`
        )
      }
    }
  }
  return violations
}

function writeProbe(relPath: string, content: string): string {
  const full = path.join(FIXTURES_DIR, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  return full
}

function removeProbe(full: string): void {
  fs.rmSync(full, { force: true })
  const parent = path.dirname(full)
  if (parent !== FIXTURES_DIR && fs.existsSync(parent)) {
    const remaining = fs.readdirSync(parent)
    if (remaining.length === 0) fs.rmdirSync(parent)
  }
}

describe('tests/fixtures/transcripts gizlilik çiti (T1)', () => {
  const files = listFixtureFiles()

  it('taranacak en az 5 fixture bulundu (guard kör değil)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
  })

  it.each(files.map((file) => ({ file, name: path.relative(FIXTURES_DIR, file) })))(
    '$name hiçbir gizlilik ihlali içermiyor',
    ({ file }) => {
      expect(scanFixtureForPrivacyViolations(file)).toEqual([])
    }
  )

  it('MUTASYON hedefi (T1a) — mutlak kullanıcı yolu içeren bir satır çiti KIRMIZI yapar', () => {
    const probe = writeProbe(
      '__privacy_probe_userpath__.jsonl',
      '{"type":"user","cwd":"C:\\\\Users\\\\pc\\\\gizli-not"}\n'
    )
    try {
      expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
    } finally {
      removeProbe(probe)
    }
  })

  it('MUTASYON hedefi (T1b) — ilgisiz proje adı içeren bir satır çiti KIRMIZI yapar', () => {
    const probe = writeProbe(
      '__privacy_probe_project__.jsonl',
      '{"type":"user","message":{"content":"proje: hayat-mentoru"}}\n'
    )
    try {
      expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
    } finally {
      removeProbe(probe)
    }
  })

  it('MUTASYON hedefi (T1c) — 200+ karakterlik serbest metin çiti KIRMIZI yapar (opak-blok maskelemez, U2)', () => {
    // QA B3: eski sonda `'x'.repeat(250)` idi — bu, eşikten BAĞIMSIZ olarak opak-blok desenine
    // takılıyordu, MAX_FREE_TEXT_CHARS mutasyonunu (200→100000) maskeliyordu. Bu sonda yalnızca
    // ONAYLI sözcüklerden (boşluklu, "doğal" görünümlü) oluşur — ne opak blok deseni (boşluk var),
    // ne beyaz liste ihlali (yalnızca onaylı kelimeler) tetiklenir; SADECE uzunluk eşiği tetiklenir.
    const longApprovedText = 'ornek istem metni anonim kullanici yanit '.repeat(6).trim()
    expect(longApprovedText.length).toBeGreaterThan(MAX_FREE_TEXT_CHARS)
    expect(hasOnlyApprovedWords(longApprovedText)).toBe(true)
    expect(LONG_OPAQUE_BLOB_PATTERN.test(longApprovedText)).toBe(false)

    const probe = writeProbe(
      '__privacy_probe_freetext__.jsonl',
      JSON.stringify({ type: 'user', message: { content: longApprovedText } }) + '\n'
    )
    try {
      const violations = scanFixtureForPrivacyViolations(probe)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('serbest metin bulundu'))).toBe(true)
    } finally {
      removeProbe(probe)
    }
  })

  it('MUTASYON hedefi (T1d) — onaylı sözcük dağarcığı mekanizması gerçekten ayırt ediyor', () => {
    // U7 — eskiden bu test boş bir `RegExp[]`'in hiçbir şey eşleşmediğini doğruluyordu (kendi
    // kendine referans, hiçbir gerçek kod yolunu ölçmüyordu). Şimdi GERÇEK `hasOnlyApprovedWords`
    // fonksiyonunu hem onaylı hem onaysız girdiyle çağırıp ayrımı doğruca kanıtlıyor.
    expect(hasOnlyApprovedWords('ornek istem metni anonim')).toBe(true)
    expect(hasOnlyApprovedWords('gercek kullanici adi soyadi burada')).toBe(false)
  })

  // ------------------------------------------------------------------------------------------
  // QA'nın P1-P12 sondaları — kalıcı regresyon testleri (CEO kararı U1). Fixture'lar SENTETİK,
  // depoda BIRAKILMAZ (yazılır, test biter bitmez silinir — mevcut T1a/T1b deseni).
  // ------------------------------------------------------------------------------------------
  describe('QA round-1 sondaları — 12/12 artık KIRMIZI (kalıcı regresyon)', () => {
    it('P1 — kısa (< 200 karakter) ama tamamen kişisel metin, TC-kimlik-biçimli sayı içerir', () => {
      const content =
        'gercek ad soyad tc kimlik numaram 12345678901 maas bilgim ve bosanma surecim hakkinda'
      expect(content.length).toBeLessThan(200)
      const probe = writeProbe(
        '__qa_p1_shortpersonal.jsonl',
        JSON.stringify({ type: 'user', message: { content } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P2 — Git Bash/POSIX biçimli mutlak kullanıcı yolu (/c/Users/...)', () => {
      const probe = writeProbe(
        '__qa_p2_bashpath.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: '/c/Users/pc/Documents/vergi-beyani-2025.pdf' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P3 — ortam değişkenli yol (%USERPROFILE%\\...)', () => {
      const probe = writeProbe(
        '__qa_p3_envvar.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: '%USERPROFILE%\\Desktop\\ozel-notlar\\banka.txt' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P4 — UNC ağ yolu (\\\\SUNUCU\\pay\\...)', () => {
      const probe = writeProbe(
        '__qa_p4_unc.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: '\\\\FILESRV01\\pc-yedek\\saglik-raporu.docx' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P5 — ileri bölülü Windows yolu (C:/Users/...)', () => {
      const probe = writeProbe(
        '__qa_p5_fwdslash.jsonl',
        JSON.stringify({ type: 'user', message: { content: 'C:/Users/pc/Desktop/gizli' } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P6 — 80 eşiğinin altında (40-79 karakter) base64 benzeri opak blok', () => {
      const secretish = Buffer.from('sentetik-parola-ve-IBAN-ornek-degeri-987654321').toString(
        'base64'
      )
      expect(secretish.length).toBeGreaterThanOrEqual(40)
      expect(secretish.length).toBeLessThan(80)
      const probe = writeProbe(
        '__qa_p6_base64.jsonl',
        JSON.stringify({ type: 'user', message: { content: secretish } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P7 — ayrıştırılamayan (kesik) satırda gömülü 3000+ karakterlik gerçek-görünümlü metin', () => {
      const longText = 'gercek konusma kopyasi metni '.repeat(120) // > 3000 karakter, onaysız kelimeler
      expect(longText.length).toBeGreaterThan(3000)
      // Bilerek kapanmayan tırnak/parantez — JSON.parse BAŞARISIZ olur.
      const brokenLine = `{"type":"user","message":{"content":"${longText}`
      expect(() => JSON.parse(brokenLine)).toThrow()
      const probe = writeProbe('__qa_p7_badline.jsonl', brokenLine + '\n')
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P8 — uzun metin JSON ANAHTARI olarak (değer değil)', () => {
      const longKey = 'x'.repeat(210)
      const probe = writeProbe(
        '__qa_p8_key.jsonl',
        JSON.stringify({ type: 'user', message: { [longKey]: 'kisa' } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P9 — uzun prompt 20 parçaya bölünmüş, her parça < 200 karakter (toplam eşiği yakalar)', () => {
      const parts = Array.from({ length: 20 }, (_, i) =>
        `gercek prompt parcasi numara ${i} `.repeat(4)
      )
      expect(parts.every((p) => p.length < 200)).toBe(true)
      const totalLen = parts.reduce((a, p) => a + p.length, 0)
      expect(totalLen).toBeGreaterThan(MAX_TOTAL_FREE_TEXT_CHARS_PER_LINE)
      const probe = writeProbe(
        '__qa_p9_split.jsonl',
        JSON.stringify({ type: 'user', message: { content: parts } }) + '\n'
      )
      try {
        const violations = scanFixtureForPrivacyViolations(probe)
        expect(violations.length).toBeGreaterThan(0)
        expect(violations.some((v) => v.includes('toplam'))).toBe(true)
      } finally {
        removeProbe(probe)
      }
    })

    it('P10 — listede olmayan gerçek proje adı/sözcüğü (disk taramasından türetilir)', () => {
      // Bu makinede `~/.claude/projects` yoksa (ör. temiz bir CI klonu) dinamik türetme boş
      // döner ve bu test anlamsız hâle gelir — o durumda atlanır (baseline liste zaten P10'un
      // KENDİ makinesindeki gerçek örneklerini bilemez, bu doğası gereği makineye bağlı bir çit).
      const dynamic = deriveUnrelatedProjectNeedlesFromDisk()
      if (dynamic.length === 0) return
      const needle = dynamic[0] as string
      const probe = writeProbe(
        '__qa_p10_unlistedproject.jsonl',
        JSON.stringify({ type: 'user', message: { content: `proje hakkında not: ${needle}` } }) +
          '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P11 — `.json` uzantılı dosya artık taranıyor (uzantı süzgeci kalktı)', () => {
      const probe = writeProbe(
        '__qa_p11_leak.json',
        JSON.stringify({ type: 'user', message: { content: 'C:\\Users\\pc\\gizli' } }) + '\n'
      )
      try {
        const files = listFixtureFiles()
        expect(files).toContain(probe)
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P12 — alt dizindeki dosya artık taranıyor (özyinelemeli tarama)', () => {
      const probe = writeProbe(
        path.join('__qa_sub', 'leak.jsonl'),
        JSON.stringify({ type: 'user', message: { content: 'C:\\Users\\pc\\gizli-alt-dizin' } }) +
          '\n'
      )
      try {
        const files = listFixtureFiles()
        expect(files).toContain(probe)
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })
  })
})

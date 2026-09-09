import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * F-009 T1 (CEO kararı, bağlayıcı) — "elle dikkat ettim" yetmez: `tests/fixtures/transcripts/**`
 * altına eklenen HER dosya bu çitten geçmek zorunda.
 *
 * QA round 2 (KALDI, Y1/Y2 bloklayıcı) — round-1 çit 12/12, round-2 çit 11/12 yeni vektörde
 * yenildi (denylist tasarımı iki turda iki kez yenildi). CEO kararı (round 3): tasarımı
 * DENYLIST'ten ALLOWLIST'e çevir — `docs/decisions/ADR-013-*.md` Ek'teki emsal ("allowlist
 * zorunludur, denylist değil"), `CLAUDE.md`: "aynı hata sınıfı dördüncü kez tekrarlıyorsa yamayı
 * bırak, yapısal çit koy". Tam gerekçe: `docs/qa/F-009-contract.md` §7.
 *
 * TASARIM (denylist YOK, tek mekanizma):
 * 1. Her satır, `JSON.parse` denemeden, ham metin olarak `TOKEN_RE` ile token'lara bölünür. JSON
 *    yapısal karakterleri (`{`,`}`,`"`,`,`,`\`,boşluk,`%`,`@`,`/`) her zaman AYIRICI kabul edilir.
 *    Bu, satırın ayrıştırılabilir olup olmamasından (bozuk satır, tırnaksız dosya, kaçışlı tırnak
 *    hizalama kayması) TAMAMEN bağımsız TEK bir kod yoludur — anahtar/değer ayrımı da yoktur.
 * 2. Her token `isApprovedToken` ile kontrol edilir: ya `ALLOWED_TOKENS` (mevcut 5 dondurulmuş
 *    fixture'ın gerçekte ürettiği, elle enumere edilmiş kapalı kelime kümesi) içinde, ya da 7 dar
 *    YAPISAL desenden (sentetik UUID, ISO zaman damgası, semver, sürücü harfi, `:`+kısa
 *    sayı/bool/null, `msg_example‹N›`, 1-3 haneli çıplak sayı) birine uyar.
 * 3. **Listede/desende olmayan HER token reddedilir** — sızıntı olup olmadığına bakılmaksızın.
 *    Yeni bir fixture yeni bir kelime eklerse bu listeye BİLİNÇLİ olarak eklenmesi gerekir
 *    (sürtünme kasıtlı — eski tasarımın "onaylı sözcük dağarcığı" fikrinin devamı, ama artık
 *    TEK ve YEGANE mekanizma, kısmi/koşullu değil).
 *
 * Neden bu tasarım QA'nın 24 vektörünün hiçbirini geçirmiyor: denylist'in yenilgisi hep aynı
 * şekildeydi — saldırgan bilinen bir desenden FARKLI bir biçim buluyordu (URL-encode, ROT13,
 * e-posta, alt çizgi, tırnaksız dosya, kaçışlı tırnak). Beyaz listede bu fark ETMEZ: hangi
 * biçimde gelirse gelsin, tokenizer'dan çıkan parça listede/desende değilse reddedilir. 1-3 hane
 * sayı üst sınırı kasıtlı (mevcut fixture'lardaki en yüksek `usage` değeri 800, 3 hane) — 4+
 * haneli her sayı (telefon, TC kimlik, kredi kartı grupları, IBAN) otomatik reddedilir.
 */

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'transcripts')

// Fixture dizinindeki tek git kontrol dosyası — fixture İÇERİĞİ değil, taramadan dosya ADIYLA
// (uzantıyla değil) hariç tutulur. Tek istisna, gerekçeli: `.gitattributes` içeriği bu dosyanın
// KENDİSİNİ (bayt-bire-bir koruma niyetini) açıklayan Türkçe düzyazı, sentetik transkript verisi
// değil — beyaz listeye tabi tutulması yalnızca yorum metnini beyaz listeye eklemeyi gerektirirdi,
// hiçbir gerçek koruma sağlamaz. `.__qa_..._hidden` gibi başka gizli dosyalar bu istisnaya
// GİRMEZ (yalnızca tam ad eşleşmesi) — QA'nın N12 sondası hâlâ taranır.
const NON_FIXTURE_FILENAMES = new Set(['.gitattributes'])

// --- Kapalı kelime kümesi: mevcut 5 dondurulmuş fixture'ın (+ kasıtlı bozuk/bilinmeyen şema
// fixture'ının) GERÇEKTEN ürettiği her token, elle enumere edilmiş (script ile türetilip elle
// gözden geçirilmiş — bkz. `docs/qa/F-009-contract.md` §7.1). Yeni bir fixture yeni bir kelime
// eklerse BURAYA bilinçli olarak eklenmelidir.
const ALLOWED_TOKENS = new Set([
  'agent-setting',
  'agentSetting',
  'anonim',
  'assistant',
  'bar', // unknown-schema.jsonl — kasıtlı bilinmeyen şema sondası
  'bom',
  'cache_creation_input_tokens',
  'cache_read_input_tokens',
  'ceo',
  'claude-example',
  'conte', // truncated-last-line.jsonl — kasıtlı kesik son satırın gövdesi ("content" kesilmiş)
  'content',
  'crlf',
  'cwd',
  'developer',
  'enqueue',
  'foo', // unknown-schema.jsonl
  'future-thing', // unknown-schema.jsonl — kasıtlı bilinmeyen `type` sondası
  'hookCount',
  'id',
  'input_tokens',
  'isSidechain',
  'istek',
  'istem',
  'istemi',
  'kisaltildi',
  'kullanici',
  'last-prompt',
  'lastPrompt',
  'leafUuid',
  'message',
  'metin',
  'metni',
  'mode',
  'model',
  'msg_dup_1', // duplicate-usage.jsonl — F-011 QA düzeltme turu (Z1), sentetik tekrarlı mesaj kimliği
  'msg_dup_2', // duplicate-usage.jsonl — sentetik farklı mesaj kimliği
  'normal',
  'not-a-number', // unknown-schema.jsonl — kasıtlı yanlış-tip (`input_tokens` string) sondası
  'operation',
  'ornek',
  'ornek-proje', // sentetik `cwd` bileşeni
  'output_tokens',
  'parentUuid',
  'payload', // unknown-schema.jsonl
  'queue-operation',
  'req_dup_1', // duplicate-usage.jsonl — sentetik tekrarlı requestId
  'req_dup_2', // duplicate-usage.jsonl — sentetik farklı requestId
  'requestId', // duplicate-usage.jsonl — F-011 QA düzeltme turu (Z1), gerçek üst-seviye alan adı
  'role',
  'sessionId',
  'stop_hook_summary',
  'subtype',
  'system',
  'text',
  'timestamp',
  'type',
  'usage',
  'user',
  'uuid',
  'version',
  'workspace', // sentetik `cwd` bileşeni
  'yanit',
])

// --- 7 dar YAPISAL desen. Hepsi kasıtlı dar: sentetik/üretilebilir biçimleri tanır, gerçek
// kullanıcı verisiyle örtüşme riski en aza indirilmiş.
/** `00000000-0000-4000-8000-00000000000N` — mevcut fixture'ların tek UUID kalıbı. Rastgele hex
 * içeren GERÇEK bir UUID bu deseni KARŞILAMAZ (yalnızca son hane değişebilir). */
const SYNTHETIC_UUID = /^00000000-0000-4000-8000-0{11}[0-9a-fA-F]$/
const ISO_TIMESTAMP = /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SEMVER = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const DRIVE_LETTER = /^[A-Za-z]:$/
const COLON_LITERAL = /^:(?:[0-9]{1,3}|true|false|null)?$/
const MSG_ID = /^msg_example\d{1,4}$/
/** 1-3 haneli çıplak sayı. Üst sınır KASITLI: mevcut fixture'lardaki en yüksek `usage` değeri
 * 800 (3 hane). 4+ haneli her sayı (telefon, TC kimlik, kredi kartı grubu, IBAN parçası)
 * otomatik reddedilir — yeni bir fixture'ın gerçekten 4+ haneli bir sayıya ihtiyacı olursa bu
 * sınır bilinçli olarak genişletilmelidir (sürtünme kasıtlı). */
const BARE_NUMBER = /^[0-9]{1,3}$/

const APPROVED_PATTERNS: readonly RegExp[] = [
  SYNTHETIC_UUID,
  ISO_TIMESTAMP,
  SEMVER,
  DRIVE_LETTER,
  COLON_LITERAL,
  MSG_ID,
  BARE_NUMBER,
]

/** JSON yapısal karakterleri (`{}[]":,\`, boşluk, `%`, `@`, `/`) her zaman AYIRICI. */
const TOKEN_RE = /[A-Za-z0-9çÇğĞıİöÖşŞüÜ:._-]+/g

export function tokenize(rawLine: string): string[] {
  return rawLine.match(TOKEN_RE) ?? []
}

export function isApprovedToken(token: string): boolean {
  if (ALLOWED_TOKENS.has(token)) return true
  return APPROVED_PATTERNS.some((pattern) => pattern.test(token))
}

/** Dizin ağacını özyinelemeli, UZANTIDAN BAĞIMSIZ numaralandırır — `.gitattributes` hariç. */
function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.isFile() && !NON_FIXTURE_FILENAMES.has(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function listFixtureFiles(): string[] {
  return walk(FIXTURES_DIR)
}

export function scanFixtureForPrivacyViolations(filePath: string): string[] {
  const violations: string[] = []
  const raw = fs.readFileSync(filePath, 'utf8')
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') continue
    for (const token of tokenize(rawLine)) {
      if (!isApprovedToken(token)) {
        violations.push(`onaylı beyaz liste dışında içerik bulundu: "${token.slice(0, 60)}"`)
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

describe('tests/fixtures/transcripts gizlilik çiti (T1) — beyaz liste tasarımı', () => {
  const files = listFixtureFiles()

  it('taranacak en az 5 fixture bulundu (guard kör değil)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
  })

  it('.gitattributes tarama listesine dahil DEĞİL (isimle hariç tutuldu)', () => {
    expect(files.some((f) => path.basename(f) === '.gitattributes')).toBe(false)
    expect(fs.existsSync(path.join(FIXTURES_DIR, '.gitattributes'))).toBe(true)
  })

  it.each(files.map((file) => ({ file, name: path.relative(FIXTURES_DIR, file) })))(
    '$name hiçbir gizlilik ihlali içermiyor',
    ({ file }) => {
      expect(scanFixtureForPrivacyViolations(file)).toEqual([])
    }
  )

  // ----------------------------------------------------------------------------------------
  // isApprovedToken doğrudan birim testleri — her onaylı kategori + temsili reddedilen biçimler.
  // ----------------------------------------------------------------------------------------
  describe('isApprovedToken — kategori bazlı doğrudan doğrulama', () => {
    it.each([
      ['00000000-0000-4000-8000-000000000001', true, 'sentetik UUID'],
      ['00000000-0000-4000-8000-00000000000a', true, 'sentetik UUID (hex son hane)'],
      ['2026-01-01T00:00:00.000Z', true, 'ISO zaman damgası'],
      ['2.1.261', true, 'semver'],
      ['C:', true, 'sürücü harfi'],
      [':0', true, 'colon+sayı'],
      [':false', true, 'colon+bool'],
      [':null', true, 'colon+null'],
      ['msg_example001', true, 'sentetik mesaj kimliği'],
      ['800', true, '3 haneli sayı (mevcut fixture üst sınırı)'],
      ['type', true, 'onaylı JSON anahtarı'],
      ['ornek', true, 'onaylı serbest metin sözcüğü'],
      ['4242', false, '4 haneli sayı (kredi kartı grubu boyutu) — REDDEDİLMELİ'],
      ['12345678901', false, '11 haneli sayı (TC kimlik boyutu) — REDDEDİLMELİ'],
      ['veron.seldon', false, 'e-posta kullanıcı adı parçası — REDDEDİLMELİ'],
      ['gmail.com', false, 'e-posta alan adı parçası — REDDEDİLMELİ'],
      ['Users', false, 'gerçek Windows kullanıcı yolu bileşeni — REDDEDİLMELİ'],
      [
        'trepx-xhyynavpv-nqv-fblnqv-ir-onaxn-fvsrfv',
        false,
        'ROT13/boşluksuz şifreleme — REDDEDİLMELİ',
      ],
      ['gercek', false, 'onaysız Türkçe sözcük — REDDEDİLMELİ'],
      [
        '00000001-0000-4000-8000-000000000001',
        false,
        'sahte-sentetik UUID (ilk grup sıfır değil) — REDDEDİLMELİ',
      ],
    ])('%s → onaylı=%s (%s)', (token, expected) => {
      expect(isApprovedToken(token)).toBe(expected)
    })
  })

  // ----------------------------------------------------------------------------------------
  // MUTASYON hedefi (bağlantı çiti, QA Y2) — TEK mekanizma, yedek yok. Eski tasarımda beyaz
  // liste yalnızca `value.includes(' ')` koşulunda devreye giriyordu ve TC-kimlik regex'i gibi
  // ÖRTÜŞEN bir başka denylist parçası aynı sondayı maskeliyordu; devre dışı bırakılınca
  // 1124/1124 test YEŞİL kalmıştı (bağlantı hiç kanıtlanmamıştı). Yeni tasarımda `isApprovedToken`
  // TEK karar noktası — ne TC-kimlik regex'i, ne secret-prefix, ne opak-blok, ne yol deseni, ne
  // ilgisiz-proje listesi gibi ÖRTÜŞEN bir yedek MEVCUT DEĞİL. `isApprovedToken` her zaman `true`
  // dönecek şekilde bozulursa BU describe bloğundaki ve aşağıdaki "QA sondaları" bloğundaki
  // testlerin NEREDEYSE TAMAMI (tek bir izole test değil) aynı anda kırmızı olur — bu turda bizzat
  // uygulanıp ölçüldü (bkz. `docs/qa/F-009-contract.md` §7.3 ve QA raporu).
  // ----------------------------------------------------------------------------------------
  it('MUTASYON hedefi (bağlantı) — scanFixtureForPrivacyViolations GERÇEK isApprovedToken üzerinden karar verir', () => {
    // Gerçek fonksiyonu gerçek bilinen-kötü ve gerçek bilinen-iyi girdilerle sınar; ikisi de
    // AYNI `isApprovedToken`'ı kullanıyor (kod içinde başka hiçbir dal/örtüşen kontrol yok).
    const probe = writeProbe(
      '__connection_probe__.jsonl',
      JSON.stringify({ type: 'user', message: { content: 'veron.seldon@gmail.com' } }) + '\n'
    )
    try {
      const violations = scanFixtureForPrivacyViolations(probe)
      expect(violations.length).toBeGreaterThan(0)
      expect(isApprovedToken('veron.seldon')).toBe(false)
      expect(isApprovedToken('type')).toBe(true)
    } finally {
      removeProbe(probe)
    }
  })

  // ------------------------------------------------------------------------------------------
  // QA'nın P1-P12 (round 1) + N1-N14 (round 2) sondaları — kalıcı regresyon testleri. Fixture'lar
  // SENTETİK, depoda BIRAKILMAZ (yazılır, test biter bitmez silinir).
  // ------------------------------------------------------------------------------------------
  describe('QA round-1 sondaları (P1-P12) — kalıcı regresyon', () => {
    it('P1 — kısa (< 200 karakter) ama tamamen kişisel metin, TC-kimlik-biçimli sayı içerir', () => {
      const content =
        'gercek ad soyad tc kimlik numaram 12345678901 maas bilgim ve bosanma surecim hakkinda'
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
      const longText = 'gercek konusma kopyasi metni '.repeat(120)
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

    it('P9 — uzun prompt 20 parçaya bölünmüş, her parça < 200 karakter', () => {
      const parts = Array.from({ length: 20 }, (_, i) =>
        `gercek prompt parcasi numara ${i} `.repeat(4)
      )
      const probe = writeProbe(
        '__qa_p9_split.jsonl',
        JSON.stringify({ type: 'user', message: { content: parts } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P10 — listede olmayan gerçek proje adı/sözcüğü (whitelist tasarımında disk taraması GEREKMEZ)', () => {
      // Eski tasarım ~/.claude/projects'ten dinamik türetme yapıyordu (makineye bağlı); yeni
      // tasarımda GEREKSİZ — kapalı kelime kümesinde OLMAYAN her sözcük zaten reddedilir.
      const probe = writeProbe(
        '__qa_p10_unlistedproject.jsonl',
        JSON.stringify({ type: 'user', message: { content: 'proje hakkında not: sandbox' } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('P11 — `.json` uzantılı dosya taranıyor (uzantı süzgeci yok)', () => {
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

    it('P12 — alt dizindeki dosya taranıyor (özyinelemeli tarama)', () => {
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

  describe("QA round-2 sondaları (N1-N14) — çiti round-2'de yenen 11 vektör, kalıcı regresyon", () => {
    it('N1 — URL-kodlanmış Windows yolu', () => {
      const probe = writeProbe(
        '__qa_n1_urlenc.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: 'C%3A%5CUsers%5Cpc%5Cgizli%5Cbanka-sifreleri.txt' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N2 — uzun-yol öneki, `Users` içermeyen mutlak yol', () => {
      const probe = writeProbe(
        '__qa_n2_longpath.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: '//?/D:/ozel/veron/saglik/rapor.pdf' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N3 — e-posta adresi', () => {
      const probe = writeProbe(
        '__qa_n3_email.jsonl',
        JSON.stringify({ type: 'user', message: { content: 'veron.seldon@gmail.com' } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N3b — telefon numarası', () => {
      const probe = writeProbe(
        '__qa_n3b_phone.jsonl',
        JSON.stringify({ type: 'user', message: { content: '+90-532-111-22-33' } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N4b — yalnızca onaylı sözcükler + gömülü telefon/kart rakam grupları', () => {
      const content = 'ornek istem 05321112233 anonim kullanici 4242 4242 4242 4242 yanit metni'
      const probe = writeProbe(
        '__qa_n4b_digitsonly.jsonl',
        JSON.stringify({ type: 'user', message: { content } }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N5 — satır sonu kaçışlarıyla (\\n) ayrılmış gerçek metin', () => {
      const probe = writeProbe(
        '__qa_n5_splitbyescape.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: 'gercek\nkullanici\nadi\nsoyadi\nev\nadresi\nkadikoy' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N6 — ROT13/boşluksuz şifrelenmiş metin', () => {
      const probe = writeProbe(
        '__qa_n6_rot13.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: 'trepx-xhyynavpv-nqv-fblnqv-ir-onaxn-fvsrfv' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N7 — tırnaksız düz metin dosyası (`.md`), kişisel veri', () => {
      const probe = writeProbe(
        '__qa_n7_plaintext.md',
        'gercek kullanici bilgisi satir1\nsatir2 telefon adres bilgisi\nsatir3 tamamlandi\n'
      )
      try {
        const files = listFixtureFiles()
        expect(files).toContain(probe)
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N8 — tek kaçışlı tırnak → eski naif-split hizalama kaymasının hedefi', () => {
      const probe = writeProbe(
        '__qa_n8_escapedquote.jsonl',
        '{"a":"\\"","leak":"gercek kullanici adi soyadi telefonu ve ev adresi burada"}\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N9 — Türkçe karakterli, alt çizgili, boşluksuz kimlik', () => {
      const probe = writeProbe(
        '__qa_n9_turkishunderscored.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: 'Şükrü_Yılmaz_Kadıköy_İstanbul_doğum_1987' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N11 — şema dışı alana (`_note`) gömülü metin', () => {
      const probe = writeProbe(
        '__qa_n11_unschemedkey.jsonl',
        JSON.stringify({
          type: 'user',
          _note: 'gizli-musteri-listesi-ve-fiyatlandirma-2026',
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N12 — gizli dosya (nokta ile başlayan), tırnaksız', () => {
      const probe = writeProbe(
        '__qa_n12_hidden',
        'gercek kullanici kisisel bilgisi gizli dosyada\n'
      )
      try {
        const files = listFixtureFiles()
        expect(files).toContain(probe)
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N13 — gerçek satır şekli, çift kaçışlı tırnak (kontrol)', () => {
      const probe = writeProbe(
        '__qa_n13_doubleescaped.jsonl',
        '{"type":"user","message":{"content":"gercek kullanici adi \\\\"soyadi\\\\" burada"}}\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })

    it('N14 — gerçek satır şekli, kaçışsız (kontrol)', () => {
      const probe = writeProbe(
        '__qa_n14_plain.jsonl',
        JSON.stringify({
          type: 'user',
          message: { content: 'gercek kullanici adi soyadi burada' },
        }) + '\n'
      )
      try {
        expect(scanFixtureForPrivacyViolations(probe).length).toBeGreaterThan(0)
      } finally {
        removeProbe(probe)
      }
    })
  })
})

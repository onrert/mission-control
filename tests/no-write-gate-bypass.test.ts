import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.join(__dirname, '..')

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, extensions, out)
    } else if (extensions.includes(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

// F-006 sözleşmesi §6 — genel yazma kapısı statik taraması. Yasak desenler ÇAĞRI BİÇİMİNDE
// (R4 düzeltmesi): çıplak `truncate` gibi alt dizgeler proje içi meşru isimlerle (ör.
// `truncateSummary`, `Math.trunc`, Tailwind `truncate` sınıfı) çakışıp yanlış pozitif üretiyordu.
// Her desen bir çağrının AÇILIŞ PARANTEZİYLE biter — `findCalls` bunu balanced-paren okuyarak
// tam çağrı metnine (nesne öneki dahil, ör. `fs.writeFileSync(...)`) genişletir.
//
// QA KALDI turu (D35/B1): önceki tek-liste tasarımı iki sınıf ismi karıştırıyordu.
// - "Bare" isimler (`writeFileSync`, `mkdirSync`, ... — çoğu `Sync` sonekli veya kendine özgü)
//   kısa/çakışan başka bir API ile karışmaz, dizge-içerme taramasıyla güvenle yakalanır.
// - "Ambiguous" isimler (`write`, `open`, `rm`, `rmdir`, `symlink`, `link`, `writev` — kısa,
//   `res.write(`/`window.open(`/`confirm(` gibi fs-dışı API'lerle çakışabilir) yalnızca bir
//   fs-modülü ALICISINA (`fs`, `fs.promises`, `fsp`, destructure edilmiş `promises`) bağlı
//   olarak taranır — nesne ÖNEKİNDEN bağımsız (eskiden yalnızca `'fs.rm('` taranıyordu,
//   `fsp.rm(`/`promises.rm(`/`fs.promises.rm(` kaçıyordu, QA'nın 9 kaçak denemesinin kökü).
const DENIED_BARE = [
  'writeFileSync(',
  'writeFile(',
  'appendFileSync(',
  'appendFile(',
  'renameSync(',
  'rename(',
  'mkdirSync(',
  'mkdir(',
  'unlinkSync(',
  'unlink(',
  'rmSync(',
  'rmdirSync(',
  'copyFile(',
  'copyFileSync(',
  'cp(',
  'cpSync(',
  'createWriteStream(',
  'truncate(',
  'truncateSync(',
  'ftruncate(',
  'ftruncateSync(',
  'openSync(',
  'writeSync(',
  'writevSync(',
  'symlinkSync(',
  'linkSync(',
]

// `fs`/`fs.promises`/`fsp`/destructure edilmiş `promises` — hepsi node:fs'in kendisi, hangi
// biçimde erişildiğinden bağımsız. `\b` her alternatifin bir TOKEN sınırında başlamasını
// zorunlu kılar (`xfs.rm(` gibi bir değişken adının sonu yanlışlıkla eşleşmez).
const FS_RECEIVER = String.raw`(?:fs\.promises|fs|fsp|promises)`
const AMBIGUOUS_NAMES = ['write', 'writev', 'open', 'rm', 'rmdir', 'symlink', 'link']
const DENIED_SCOPED = AMBIGUOUS_NAMES.map(
  (name) => new RegExp(String.raw`\b${FS_RECEIVER}\.${name}\(`, 'g')
)

// D35 — nesne öneki (hatta alıcı) tarafından SAKLANAMAYAN ikinci bir kaçış: yasak fs adını
// yeniden adlandırılmış bir import'la (`import { writeFile as wf }`) veya destructure'la
// (`const { rm } = fs`) edinip sonra çıplak çağırmak. Çağrı-biçimli tarama bunu göremez (çağrı
// alanında artık "fs"/"rm" birlikte görünmez). Çözüm: KULLANIMI değil EDİNİMİ (import/destructure
// satırının kendisini) yakala — kapasiteyi kazanmanın kendisi bu mimaride ihlaldir, kullanılıp
// kullanılmaması önemli değil.
const DANGEROUS_NAMES = new Set([
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'rename',
  'renameSync',
  'mkdir',
  'mkdirSync',
  'unlink',
  'unlinkSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'createWriteStream',
  'truncate',
  'truncateSync',
  'ftruncate',
  'ftruncateSync',
  'open',
  'openSync',
  'write',
  'writeSync',
  'writev',
  'writevSync',
  'symlink',
  'symlinkSync',
  'link',
  'linkSync',
])

const IMPORT_ALIAS_PATTERNS = [
  // import { writeFile, rm as remove } from 'node:fs' | 'node:fs/promises' | 'fs' | 'fs/promises'
  /import\s*\{([^}]+)\}\s*from\s*['"](?:node:)?fs(?:\/promises)?['"]/g,
  // const { rm } = require('node:fs' | 'fs' | 'fs/promises')
  /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/g,
  // const { rm } = fs | fs.promises | fsp | promises — modül referansından destructure
  /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:fs\.promises|fs|fsp|promises)\b/g,
]

const WRITE_GATE_FILE = path.join(ROOT, 'src', 'server', 'write-gate.ts')

// `0.0.0.0`/`MC_HOST` literal taraması burada TEKRAR EDİLMİYOR — zaten
// `tests/no-external-host.test.ts`'te kapsanıyor (Karpathy §2, gereksiz tekrar yok).

const allSourceFiles = walk(path.join(ROOT, 'src'), ['.ts', '.tsx'])
const scannedFiles = allSourceFiles

// Dört dosya artık dosya-seviyesinde MUAF DEĞİL — ÇAĞRI-BİÇİMLİ, DİZGE-SEVİYESİ yaklaşım: her
// dosyanın DENIED ile eşleşen her çağrısı aşağıdaki izinli tam-çağrı kümesiyle karşılaştırılır.
// Bu bir naif `content.includes(...)` DEĞİLDİR (bir yorum satırındaki düz metni yanlış pozitif
// saymaz) — yalnızca gerçek çağrı biçiminde eşleşen metinler karşılaştırılır.
// `write-gate.ts` (D34/B2, QA KALDI turu): tek yazma yetkilisi olduğu için geniş bir yüzeyi
// (openSync/writeSync/mkdirSync/renameSync/unlinkSync(tmp)) meşru şekilde kullanır, ama AC3'ün
// "silme yok" iddiasının gerçekten çitli olması için bu meşru çağrıların TAM METNİ (argümanlar
// dahil) listelenir — yeni bir `unlinkSync(resolved.targetPath)` gibi bir silme yolu eklenirse
// bu tam metin listede olmadığından tarama KIRMIZI verir.
const STORE_FILES: Record<string, string[]> = {
  [WRITE_GATE_FILE]: [
    'fs.mkdirSync(dir, { recursive: true })',
    "fs.openSync(tmp, 'wx')",
    'fs.writeSync(fd, data)',
    'fs.renameSync(tmp, targetPath)',
    'fs.unlinkSync(tmp)',
    'fs.mkdirSync(path.dirname(archiveResolved.targetPath), { recursive: true })',
    'fs.renameSync(sourceResolved.targetPath, archiveResolved.targetPath)',
  ],
  [path.join(ROOT, 'src', 'server', 'store', 'jsonl-store.ts')]: [
    'fs.writeFileSync(seqFile, String(value))',
    'fs.mkdirSync(eventsDir, { recursive: true })',
    'fs.promises.appendFile(file, line)',
  ],
  [path.join(ROOT, 'src', 'server', 'store', 'projects-registry.ts')]: [
    'fs.mkdirSync(dataDir, { recursive: true })',
    'fs.writeFileSync(tmpPath, JSON.stringify(body, null, 2))',
    'fs.renameSync(tmpPath, filePath)',
    'fs.unlinkSync(tmpPath)',
  ],
  [path.join(ROOT, 'src', 'server', 'store', 'retention.ts')]: ['fs.unlinkSync(target)'],
  // F-012 (D8/B5, §2.1) — `jsonl-store.ts`'in zaten yaptığı şeyin birebir aynısı: sunucunun
  // kendi görüntüleme kaydını append-only bir dosyaya yazması. Yeni bir kategori/mekanizma
  // İCAT EDİLMEDİ, var olan desen tekrarlanıyor.
  [path.join(ROOT, 'src', 'features', 'chat', 'server', 'history-log.ts')]: [
    'fs.mkdirSync(chatDir, { recursive: true })',
    'fs.promises.appendFile(historyFile, line)',
  ],
  [path.join(ROOT, 'src', 'features', 'chat', 'server', 'session-store.ts')]: [
    'fs.mkdirSync(chatDir, { recursive: true })',
    'fs.writeFileSync(sessionIdFile, sessionId)',
  ],
}

const WORD_OR_DOT = /[\w.]/

/** `patternIndex` bir DENIED deseninin başladığı indekstir, `pattern` `(` ile biter.
 * Geriye doğru nesne önekini (`fs.`, `fs.promises.` …), ileriye doğru dengeli parantezle
 * tam çağrı metnine genişletir. */
function extractCall(content: string, patternIndex: number, pattern: string): string {
  let start = patternIndex
  while (start > 0 && WORD_OR_DOT.test(content[start - 1] ?? '')) start--
  const openParenIndex = patternIndex + pattern.length - 1
  let depth = 0
  let end = openParenIndex
  for (let i = openParenIndex; i < content.length; i++) {
    if (content[i] === '(') depth++
    else if (content[i] === ')') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  return content.slice(start, end + 1)
}

function findCalls(content: string): string[] {
  const calls: string[] = []
  for (const pattern of DENIED_BARE) {
    let index = content.indexOf(pattern)
    while (index !== -1) {
      calls.push(extractCall(content, index, pattern))
      index = content.indexOf(pattern, index + pattern.length)
    }
  }
  for (const re of DENIED_SCOPED) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(content))) {
      calls.push(extractCall(content, match.index, match[0]))
    }
  }
  return calls
}

function specifierOriginalName(spec: string): string {
  // "writeFile as wf" (ESM yeniden adlandırma) veya "writeFile: wf" (destructure yeniden adlandırma)
  return (spec.split(/\s+as\s+|:/)[0] ?? '').trim()
}

function findDangerousImportAliases(content: string): string[] {
  const violations: string[] = []
  for (const re of IMPORT_ALIAS_PATTERNS) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(content))) {
      const specifiers = (match[1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const spec of specifiers) {
        if (DANGEROUS_NAMES.has(specifierOriginalName(spec))) {
          violations.push(match[0].trim())
        }
      }
    }
  }
  return violations
}

describe('no-write-gate-bypass — genel yazma kapısı statik taraması (F-006 sözleşmesi §6)', () => {
  it("taranan dosya sayısı > 0 (körlük assert'i)", () => {
    expect(scannedFiles.length).toBeGreaterThan(0)
  })

  it('kalıcı negatif-kontrol: tarama, yapay bir dosya sistemi çağrısını gerçekten yakalar', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-guard-negcontrol-'))
    const fixtureFile = path.join(fixtureDir, 'fake.ts')
    fs.writeFileSync(fixtureFile, "fs.mkdirSync('/tmp/whatever')\n")
    try {
      const content = fs.readFileSync(fixtureFile, 'utf8')
      expect(findCalls(content)).toEqual(["fs.mkdirSync('/tmp/whatever')"])
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  // D32/mutasyon 14 — QA Bulgu 5'in genişlettiği desenlerin HER BİRİ ayrı ayrı yakalanır
  // (yalnızca ilk emsal olan mkdirSync değil) — bir desen yanlışlıkla listeden çıkarsa/yazım
  // hatası içerirse bu test o deseni tek başına kırar.
  it.each([
    ['fs.copyFileSync(a, b)', 'copyFileSync('],
    ['fs.cpSync(a, b)', 'cpSync('],
    ['fs.createWriteStream(a)', 'createWriteStream('],
    ['fs.truncateSync(a, 0)', 'truncateSync('],
    ["fs.openSync(a, 'w')", 'openSync('],
    ['fs.writeSync(fd, data)', 'writeSync('],
    ['fs.writevSync(fd, buffers)', 'writevSync('],
    ['fs.symlinkSync(a, b)', 'symlinkSync('],
    ['fs.linkSync(a, b)', 'linkSync('],
  ] as const)('kalıcı negatif-kontrol: %s deseni (%s) yakalanır', (...[snippet]) => {
    expect(findCalls(snippet).length).toBeGreaterThan(0)
  })

  // D35 (QA KALDI turu, B1) — QA'nın ölçtüğü 9 kaçak denemesinin HER BİRİ, tek tek: nesne
  // önekinden (`fs.`/`fsp.`/`promises.`/`fs.promises.`) bağımsız olarak yakalanır.
  it.each([
    ["fs.open(p, 'w', cb)", 'fs.open('],
    ['fs.write(fd, data)', 'fs.write('],
    ['fs.writev(fd, buffers, cb)', 'fs.writev('],
    ['fs.rmdir(p, cb)', 'fs.rmdir('],
    ['fs.promises.rmdir(p)', 'fs.promises.rmdir('],
    ['fs.promises.rm(p)', 'fs.promises.rm('],
    ['fsp.rm(p)', 'fsp.rm('],
    ['promises.rm(p)', 'promises.rm('],
    ['fs.symlink(a, b, cb)', 'fs.symlink('],
    ['fs.link(a, b, cb)', 'fs.link('],
  ] as const)(
    'kalıcı negatif-kontrol: nesne-öneki bağımsız %s deseni yakalanır',
    (...[snippet]) => {
      expect(findCalls(snippet).length).toBeGreaterThan(0)
    }
  )

  // D35 — yeniden adlandırılmış import / destructure ile EDİNİLEN yasak fs kapasitesi; çağrı
  // biçimli tarama bunu göremez (çağrı alanında "fs"/"rm" birlikte görünmez), bu yüzden AYRI bir
  // kontrol EDİNİM satırının kendisini yakalar.
  it.each([
    ["import { writeFile as wf } from 'node:fs'", 'import { writeFile as wf }'],
    ["import { rm } from 'node:fs/promises'", 'import { rm }'],
    ['const { rm } = fs', 'const { rm } = fs'],
    ['const { unlink: del } = fs.promises', 'const { unlink: del } = fs.promises'],
    ["const { rm } = require('node:fs')", "const { rm } = require('node:fs')"],
  ] as const)(
    'kalıcı negatif-kontrol: yasak fs adının yeniden adlandırılmış/destructure edilmiş edinimi (%s) yakalanır',
    (...[snippet]) => {
      expect(findDangerousImportAliases(snippet).length).toBeGreaterThan(0)
    }
  )

  it.each(scannedFiles.filter((f) => !(f in STORE_FILES)))(
    '%s bilinen fs yazma/silme çağrı biçimlerinden hiçbirini içermiyor',
    (file) => {
      const content = fs.readFileSync(file, 'utf8')
      expect(findCalls(content)).toEqual([])
      expect(findDangerousImportAliases(content)).toEqual([])
    }
  )

  it.each(Object.entries(STORE_FILES))(
    '%s: DENIED ile eşleşen her çağrı izinli kümedeki tam dizgelerden biriyle eşleşir, yeniden adlandırma/destructure yok',
    (file, allowed) => {
      const content = fs.readFileSync(file, 'utf8')
      const found = findCalls(content)
      expect(found.length).toBeGreaterThan(0)
      for (const call of found) {
        expect(allowed).toContain(call)
      }
      expect(findDangerousImportAliases(content)).toEqual([])
    }
  )
})

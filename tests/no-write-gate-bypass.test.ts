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
const DENIED = [
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
  'fs.rm(',
  'copyFile(',
  'cp(',
  'cpSync(',
  'createWriteStream(',
  'truncate(',
  'truncateSync(',
  'ftruncate(',
  'ftruncateSync(',
  'openSync(',
  'writeSync(',
  'promises.open(',
]

const WRITE_GATE_FILE = path.join(ROOT, 'src', 'server', 'write-gate.ts')

// `0.0.0.0`/`MC_HOST` literal taraması burada TEKRAR EDİLMİYOR — zaten
// `tests/no-external-host.test.ts`'te kapsanıyor (Karpathy §2, gereksiz tekrar yok).

const allSourceFiles = walk(path.join(ROOT, 'src'), ['.ts', '.tsx'])
// TEK dosya-seviyesi istisna — write-gate.ts kendisi tek yazma yetkilisi, geniş yüzeyi
// (openSync/writeSync/mkdirSync/renameSync/unlinkSync(tmp)) burada meşru.
const scannedFiles = allSourceFiles.filter((f) => f !== WRITE_GATE_FILE)

// Üç store dosyası artık dosya-seviyesinde MUAF DEĞİL — no-delete-guard.test.ts'in
// unlinkSync(tmpPath) emsaliyle aynı, ÇAĞRI-BİÇİMLİ, DİZGE-SEVİYESİ yaklaşım: her dosyanın
// DENIED ile eşleşen her çağrısı aşağıdaki izinli tam-çağrı kümesiyle karşılaştırılır. Bu bir
// naif `content.includes(...)` DEĞİLDİR (bir yorum satırındaki düz metni yanlış pozitif
// saymaz) — yalnızca gerçek çağrı biçiminde eşleşen metinler karşılaştırılır.
const STORE_FILES: Record<string, string[]> = {
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
}

const WORD_OR_DOT = /[\w.]/

/** `patternIndex` bir DENIED deseninin başladığı indekstir, `pattern` `(` ile biter.
 * Geriye doğru nesne önekini (`fs.`, `fs.promises.` …), ileriye doğru dengeli parantezle
 * tam çağrı metnini genişletir. */
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
  for (const pattern of DENIED) {
    let index = content.indexOf(pattern)
    while (index !== -1) {
      calls.push(extractCall(content, index, pattern))
      index = content.indexOf(pattern, index + pattern.length)
    }
  }
  return calls
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
  ] as const)('kalıcı negatif-kontrol: %s deseni (%s) yakalanır', (snippet) => {
    expect(findCalls(snippet).length).toBeGreaterThan(0)
  })

  it.each(scannedFiles.filter((f) => !(f in STORE_FILES)))(
    '%s yasak dosya sistemi çağrısı içermiyor',
    (file) => {
      const content = fs.readFileSync(file, 'utf8')
      expect(findCalls(content)).toEqual([])
    }
  )

  it.each(Object.entries(STORE_FILES))(
    '%s: DENIED ile eşleşen her çağrı izinli kümedeki tam dizgelerden biriyle eşleşir',
    (file, allowed) => {
      const content = fs.readFileSync(file, 'utf8')
      const found = findCalls(content)
      expect(found.length).toBeGreaterThan(0)
      for (const call of found) {
        expect(allowed).toContain(call)
      }
    }
  )
})

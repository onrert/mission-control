import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * F-011 QA düzeltme turu (Z2) — QA'nın çalışma-zamanı casus tabanlı ağ çiti
 * (`usage-aggregator.test.ts`'teki Y3 sondası, yalnızca `fetch`/`http.request`/`https.request`i
 * gözlüyordu) 8 sondadan 6'sıyla yenildi: `http.get`, `net.connect`, `dns.lookup`,
 * `execFileSync('curl')`, dinamik `import('node:https')`, modül yüklenirken yakalanmış bir
 * referans (`const r = http.request; r(...)`). 1. turun düzeltmesi bunu bir KARA LİSTE
 * (`FORBIDDEN_MODULES`) ile kapattı — QA düzeltme turu 2'de bu KARA LİSTE de yenildi: N1
 * (`createRequire(import.meta.url)('node:http').get(…)`) `node:module`'ü hiç yasaklı listede
 * olmadığı için geçti ve GERÇEKTEN bir yerel dinleyiciye istek attı (318/318 test yeşilken); N2
 * (`process.binding('tcp_wrap')`) hiç import bile İÇERMEDİĞİ için import-taramasına hiç görünmedi.
 *
 * **AA1 kararı (F-011 QA düzeltme turu 2, BLOKLAYICI) — BEYAZ LİSTEYE geçiş.**
 * `ADR-013`'ün emsali ("allowlist zorunludur, denylist değil") burada da geçerli: kara liste her
 * zaman "henüz düşünülmemiş bir kaçış yolu" bırakır. Bu dosya artık `src/features/usage/server/**`
 * modül grafiğinin **yalnızca onaylı bir kümeden** (`ALLOWED_MODULE_SPECIFIERS`) içe aktarım
 * yapabileceğini kanıtlar — onaylı listede olmayan HER içe aktarım, "yasaklı" olarak
 * işaretlenmiş olsun ya da olmasın, REDDEDİLİR. İki katman:
 *
 * 1. **Statik (bu dosya):** modül grafiği taranır — yalnızca `ALLOWED_MODULE_SPECIFIERS`'teki
 *    bare specifier'lara VE yerel (`./`, `../`) importlara izin verilir. Ayrıca DOLAYLI modül
 *    edinme yolları (`createRequire(`, `require(`, `process.binding(`, `eval(`, `Function(`,
 *    dinamik `import()`) hiçbir import ifadesi kurmasalar bile METİNSEL olarak yakalanır (N1/N2
 *    tam olarak buradan kaçmıştı).
 * 2. **Çalışma zamanı (`usage-aggregator.test.ts`'teki gerçek-dinleyici testi):** ürün kodu GERÇEK
 *    bir yerel TCP dinleyicisi çalışırken çalıştırılır — istek gelirse test KIRMIZI verir. Statik
 *    katmanda bir boşluk kalsa bile bu ikinci katman canlı bir sızıntıyı yakalar.
 *
 * Kapsam BİLİNÇLİ OLARAK sunucu tarafıyla (`usage/server/**`) sınırlı: istemci
 * `useUsageReport.ts`'in KENDİ `/api/usage` backend'ine (aynı origin) `fetch` atması AC4/Y3'ün
 * kastettiği "harici ağ isteği" DEĞİLDİR — CEO kararı Z2, `docs/qa/F-011-contract.md` §5'te
 * belgelenmiştir. "Toplayıcı saf olsun: veriyi dışarıdan alsın, kendi I/O yapmasın" ifadesi
 * `computeUsageReport`'un kendisini hedef alıyordu, istemcinin kendi ekranını verisini çekme
 * mekanizmasını değil.
 */

const ROOT = path.join(__dirname, '..', '..', '..', '..')
const USAGE_SERVER_DIR = path.join(ROOT, 'src', 'features', 'usage', 'server')

/**
 * AA1 — BEYAZ LİSTE. Bugünkü ürün kodu (`usage-aggregator.ts`, `handlers.ts`, transitif olarak
 * thread'in `transcript-reader.ts`'i) yalnızca bu ikisini import eder (dosya başlarındaki kendi
 * yorumları da bunu iddia eder — bu test o iddiayı kanıtlar). Bare (`fs`) VE `node:` önekli
 * (`node:fs`) biçimlerin ikisi de kabul edilir, hangisinin kullanıldığı önemsiz.
 */
const ALLOWED_BARE_MODULES = new Set(['fs', 'path'])

/**
 * AA1 — dolaylı modül/yetenek edinme yolları: N1 (`createRequire`) ve N2 (`process.binding`) HİÇ
 * bir `import` ifadesi kurmadan (veya yasaklı olmayan bir modül üzerinden) ağ/süreç yeteneği
 * kazanıyordu. Bunlar import grafiğinden BAĞIMSIZ, ham metin üzerinde aranır — bir dosyanın hiç
 * import'u olmasa bile yakalanır (N2'nin tam olarak kaçtığı boşluk).
 */
const FORBIDDEN_CALL_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bcreateRequire\s*\(/, label: 'createRequire( — dolaylı modül edinme (N1)' },
  { re: /\brequire\s*\(/, label: 'require( — dolaylı modül edinme' },
  { re: /process\s*\.\s*binding\s*\(/, label: 'process.binding( — dolaylı yetenek edinme (N2)' },
  { re: /\beval\s*\(/, label: 'eval( — dinamik kod çalıştırma' },
  { re: /\bFunction\s*\(/, label: 'Function( — dinamik kod çalıştırma' },
]

function normalizeModuleSpecifier(spec: string): string {
  return spec.startsWith('node:') ? spec.slice('node:'.length) : spec
}

// `import (type )?<binding> from '<spec>'` — lazy `[\s\S]*?` çok satırlı import'ları (ör.
// `import {\n  a,\n} from 'x'`) da kapsar. `type\s+` grubu `import type X from '...'` VE
// `import type { X } from '...'`'yi (TAM tip-only import) yakalar — bu, ÇALIŞMA ZAMANINDA
// erimiş sayılır, kapasiteye SAYILMAZ (`handlers.ts`'in `ProjectsService`/`ApiResponse` tip
// importları bu yüzden muaf).
const STATIC_IMPORT_RE = /import\s+(type\s+)?[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g
// Yan-etkili çıplak import: `import '<spec>'` (`from` yan tümcesi YOK — ör. bir modülü yalnızca
// çalıştırmak için import etmek). `STATIC_IMPORT_RE`'nin dışında ayrı bir desen gerekir.
const BARE_SIDE_EFFECT_IMPORT_RE = /^\s*import\s*['"]([^'"]+)['"]/gm
const DYNAMIC_IMPORT_RE = /\bimport\s*\(/
const FETCH_CALL_RE = /\bfetch\s*\(/

function resolveRelativeImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

interface ScanResult {
  filesScanned: string[]
  violations: string[]
}

/** AA1 — bir bare specifier'ın BEYAZ LİSTEDE olup olmadığını kontrol eder (kara liste DEĞİL):
 *  onaylı kümede olmayan HER şey reddedilir, "bilinen tehlikeli" olup olmadığına bakılmaz. */
function isAllowedBareModule(spec: string): boolean {
  return ALLOWED_BARE_MODULES.has(normalizeModuleSpecifier(spec))
}

/** Verilen giriş dosyalarından başlayıp YEREL import zincirini (derinlik sınırsız) izleyerek tam
 *  modül grafiğini tarar. Harici (node_modules/node: dışı-relative-olmayan) modüllere GİRİLMEZ —
 *  yalnızca bu deponun kendi kaynak dosyaları (relative import) takip edilir. AA1 — modül
 *  grafiğindeki HER bare import BEYAZ LİSTEYE karşı kontrol edilir (varsayılan RET); ayrıca ham
 *  dosya metni dolaylı modül/yetenek edinme kalıplarına (`createRequire`, `require(`,
 *  `process.binding(`, `eval(`, `Function(`) karşı taranır — bunlar hiçbir `import` ifadesi
 *  kurmasa bile (N2) yakalanır. */
function scanModuleGraph(entryFiles: readonly string[]): ScanResult {
  const visited = new Set<string>()
  const violations: string[] = []
  const stack = [...entryFiles]

  while (stack.length > 0) {
    const file = stack.pop()!
    if (visited.has(file)) continue
    visited.add(file)

    const content = fs.readFileSync(file, 'utf8')

    if (DYNAMIC_IMPORT_RE.test(content)) {
      violations.push(`${file}: dinamik import() kullanımı yasak (Z2)`)
    }
    if (FETCH_CALL_RE.test(content)) {
      violations.push(`${file}: fetch() çağrısı yasak (Z2, yalnızca sunucu tarafı toplayıcı)`)
    }
    for (const { re, label } of FORBIDDEN_CALL_PATTERNS) {
      if (re.test(content)) {
        violations.push(`${file}: ${label}`)
      }
    }

    STATIC_IMPORT_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = STATIC_IMPORT_RE.exec(content))) {
      const isTypeOnly = Boolean(match[1])
      const spec = match[2]!
      if (isTypeOnly) continue // erimiş — çalışma zamanı kapasitesi yok
      if (spec.startsWith('.')) {
        const resolved = resolveRelativeImport(file, spec)
        if (resolved) stack.push(resolved)
        continue
      }
      if (!isAllowedBareModule(spec)) {
        violations.push(`${file}: beyaz listede olmayan modül import ediliyor (${spec})`)
      }
    }

    BARE_SIDE_EFFECT_IMPORT_RE.lastIndex = 0
    let bareMatch: RegExpExecArray | null
    while ((bareMatch = BARE_SIDE_EFFECT_IMPORT_RE.exec(content))) {
      const spec = bareMatch[1]!
      if (spec.startsWith('.')) {
        const resolved = resolveRelativeImport(file, spec)
        if (resolved) stack.push(resolved)
        continue
      }
      if (!isAllowedBareModule(spec)) {
        violations.push(`${file}: beyaz listede olmayan modül import ediliyor (${spec})`)
      }
    }
  }

  return { filesScanned: Array.from(visited), violations }
}

const usageServerEntries = fs
  .readdirSync(USAGE_SERVER_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => path.join(USAGE_SERVER_DIR, f))

function withTempFixture(content: string, run: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-'))
  try {
    const file = path.join(dir, 'fake.ts')
    fs.writeFileSync(file, content)
    run(file)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('usage/server ağ/süreç yeteneği yapısal çiti (Z2, F-011 QA düzeltme turu)', () => {
  it('taranacak en az bir giriş dosyası bulundu (körlük assert’i)', () => {
    expect(usageServerEntries.length).toBeGreaterThan(0)
  })

  it('gerçek modül grafiği (handlers.ts + usage-aggregator.ts + transitif importlar) HİÇBİR ağ/süreç yeteneği içermiyor', () => {
    const { filesScanned, violations } = scanModuleGraph(usageServerEntries)
    // en az: handlers.ts, usage-aggregator.ts, thread'in transcript-reader.ts'i — grafik körlüğü
    // önlenir (yalnızca giriş dosyalarını "tarayıp" transitif izlemiyor olma riski).
    expect(filesScanned.length).toBeGreaterThan(1)
    expect(violations).toEqual([])
  })

  // ------------------------------------------------------------------------------------------
  // Kalıcı negatif-kontrol — QA'nın 8 sondasının hepsi burada import-seviyesinde temsil edilir.
  // ------------------------------------------------------------------------------------------
  it.each([
    ["import http from 'node:http'\nhttp.get('http://x', () => {})\n", 'http.get (sonda #3)'],
    ["import * as net from 'node:net'\nnet.connect({ port: 1 })\n", 'net.connect (sonda #4)'],
    ["import dns from 'node:dns'\ndns.lookup('x', () => {})\n", 'dns.lookup (sonda #5)'],
    [
      "import { execFileSync } from 'node:child_process'\nexecFileSync('curl', ['x'])\n",
      'execFileSync (sonda #6)',
    ],
    [
      "import http from 'node:http'\nconst r = http.request\nr('http://x')\n",
      'yakalanmış referans (sonda #8)',
    ],
  ] as const)('%s içeren dosya yakalanır (%s)', (...[content]) => {
    withTempFixture(content, (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  it('dinamik import() ile ağ modülü çağrısı yakalanır (sonda #7)', () => {
    withTempFixture("import('node:https').then((m) => m.request('http://x'))\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  it('bare fetch() çağrısı yakalanır (sonda #1)', () => {
    withTempFixture("fetch('http://example.com')\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  it('globalThis.fetch() çağrısı yakalanır (sonda #2)', () => {
    withTempFixture("globalThis.fetch('http://example.com')\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  it('`import type` ile yasak modül importu MUAF (çalışma zamanı kapasitesi yok, yanlış pozitif değil)', () => {
    withTempFixture(
      "import type http from 'node:http'\nexport type X = http.ServerResponse\n",
      (file) => {
        const { violations } = scanModuleGraph([file])
        expect(violations).toEqual([])
      }
    )
  })

  it('transitif olarak import edilen bir dosyadaki yasak modül de yakalanır (grafik derinliği > 1)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-transitive-'))
    try {
      const helper = path.join(dir, 'helper.ts')
      const entry = path.join(dir, 'entry.ts')
      fs.writeFileSync(helper, "import http from 'node:http'\nhttp.get('http://x', () => {})\n")
      fs.writeFileSync(entry, "import './helper'\n")
      const { violations } = scanModuleGraph([entry])
      expect(violations.length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // ------------------------------------------------------------------------------------------
  // AA1 (F-011 QA düzeltme turu 2) — QA'nın N1/N2 sondaları: 1. turun KARA LİSTESİNİ (hangi
  // modülün "yasaklı" sayıldığını arayan bir tarama) yenen iki gerçek vektör, kalıcı negatif
  // kontrol olarak buraya girer. BEYAZ LİSTE modelinde ikisi de İKİ AYRI yoldan yakalanır: (a)
  // `node:module`/`createRequire` beyaz listede OLMADIĞI için import'un KENDİSİ reddedilir, (b)
  // metinsel `createRequire(`/`process.binding(` deseni import'tan BAĞIMSIZ yakalanır.
  // ------------------------------------------------------------------------------------------
  it("N1 — createRequire(import.meta.url)('node:http').get(…) yakalanır (QA'nın gerçekten canlı istek attığı vektör)", () => {
    withTempFixture(
      "import { createRequire } from 'node:module'\n" +
        'const req = createRequire(import.meta.url)\n' +
        "req('node:http').get('http://x')\n",
      (file) => {
        const { violations } = scanModuleGraph([file])
        expect(violations.length).toBeGreaterThan(0)
        // İKİ bağımsız katman da yakalamalı — biri düşerse diğeri hâlâ korur.
        expect(violations.some((v) => v.includes('node:module'))).toBe(true)
        expect(violations.some((v) => v.includes('createRequire('))).toBe(true)
      }
    )
  })

  it("N2 — process.binding('tcp_wrap') (HİÇ import YOK) yakalanır (1. turun kara listesinin tam olarak kaçırdığı vektör)", () => {
    withTempFixture("process.binding('tcp_wrap')\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('process.binding('))).toBe(true)
    })
  })

  it('AA1 — beyaz listede olmayan HERHANGİ bir modül (yasaklı diye işaretlenmemiş olsa BİLE) reddedilir', () => {
    // `node:module` `FORBIDDEN_MODULES` kara listesinde HİÇ yoktu (QA'nın B3 bulgusu) — beyaz
    // liste modelinde bu artık önemsiz, çünkü onaylı iki modül (`fs`/`path`) DIŞINDAKİ her şey
    // varsayılan olarak reddedilir.
    withTempFixture("import { createRequire } from 'node:module'\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  it('AA1 — beyaz listedeki modüller (fs/path, node: önekli ve öneksiz) YANLIŞ POZİTİF üretmez', () => {
    withTempFixture(
      "import fs from 'node:fs'\nimport path from 'path'\nfs.readFileSync(path.join('a', 'b'))\n",
      (file) => {
        const { violations } = scanModuleGraph([file])
        expect(violations).toEqual([])
      }
    )
  })

  it('AA1 — eval(...) ve Function(...) ile dinamik kod çalıştırma yakalanır', () => {
    withTempFixture('eval(\'fetch("http://x")\')\n', (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
    withTempFixture('Function(\'return fetch("http://x")\')()\n', (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })
})

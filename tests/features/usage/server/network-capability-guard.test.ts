import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'

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
 *
 * **AA1 kararı (F-011 QA düzeltme turu 3, BLOKLAYICI B1) — METİN TARAMASINDAN GERÇEK AST
 * AYRIŞTIRMASINA geçiş.** Turun 2'de kurulan beyaz liste, hangi import/export'un modül
 * grafiğine/beyaz listeye tabi olduğunu `STATIC_IMPORT_RE`/`BARE_SIDE_EFFECT_IMPORT_RE` regex'iyle
 * (yalnızca `import … from '<spec>'` ve `import '<spec>'` biçimleri) belirliyordu — bu, kılık
 * değiştirmiş bir kara liste (bu kez "hangi SÖZDİZİMİ biçimi kapsanıyor" listesi) bırakıyordu.
 * QA'nın X1 sondası (`export { get } from 'node:http'`, gizlenmemiş, sıradan bir barrel yazımı)
 * tam bu boşluktan geçti ve ürün kodunun gerçek `computeUsageReport`'undan CANLI bir HTTP isteği
 * çıkardı — tüm test paketi yeşilken. Artık modül grafiği/beyaz liste kontrolü TypeScript'in kendi
 * derleyici API'siyle (`ts.createSourceFile` + `ts.forEachChild`) kurulan gerçek AST üzerinden
 * yapılıyor: `ImportDeclaration` VE `ExportDeclaration` (dahil `export * from`, `export * as ns
 * from`) düğümlerinin `moduleSpecifier`'ı aynı beyaz listeye tabi. Tip-only olan (`import type
 * …`/`export type … from`) düğümler AYNEN muaf (çalışma zamanı kapasitesi yok). Yorum içindeki
 * sahte `import`/`export` metni AST'de hiç düğüm üretmediği için doğası gereği yanlış pozitif
 * vermiyor — bu, regex'in veremediği bir garanti. `createRequire(`/`require(`/`process.binding(`/
 * `eval(`/`Function(` metinsel taraması (aşağıdaki `FORBIDDEN_CALL_PATTERNS`) ile `import()`/
 * `fetch()` blanket yasağı (hedef modülden bağımsız) DEĞİŞMEDİ — QA bu ikinci katmanı hiç
 * yenemedi, kara-liste kalıntısı olduğu bilinçli olarak kabul ediliyor (kapsamı: yalnızca "bu
 * çağrı hiç yapılmasın" — belirli bir modül hedefi aramıyor).
 *
 * **AA1 kararı (F-011 QA düzeltme turu 4, BLOKLAYICI B1) — ÇÖZÜLEMEYEN YEREL IMPORT ARTIK
 * İHLAL SAYILIYOR (fail-closed) + bu katman artık İKİNCİL, birincil koruma değil.** Tur 3'ün
 * AST'ye geçişi doğruydu ama `resolveRelativeImport` yalnızca dört aday deniyordu
 * (`<spec>.ts/.tsx`, `index.ts/.tsx`) ve çözemediğinde beyaz listenin "varsayılan RET"
 * felsefesiyle ÇELİŞEREK dosyayı sessizce ATLIYORDU (fail-open) — X1'in kök nedeninin
 * (tarayıcının tanımadığı bir şekil sessizce geçer) aynısı, başka bir kapıdan. QA'nın V5/V6/V7
 * sondaları bunu gizlenmemiş, sıradan bir NodeNext/ESM alışkanlığıyla (`./x.js`/`./x.mjs`/
 * `./x.cjs`) kanıtladı — hatta MEVCUT bir import'a yalnızca `.js` uzantısı eklemek bile yeterliydi
 * (§"mevcut import'a .js ekle" testi). Artık: (a) `resolveRelativeImport` `.js→.ts`, `.mjs→.mts`,
 * `.cjs→.cts` eşlemesini de dener, (b) hiçbir aday bulunamazsa dosya **İHLAL** sayılır (aşağıya
 * bkz.), (c) giriş numaralandırması `.mts`/`.cts`'i de kapsar ve alt dizinleri özyinelemeli
 * tarar, (d) "körlük assert'i" dosya SAYISI yerine BEKLENEN KÜMEYE bağlı.
 *
 * Bu turda ayrıca ÜST bir davranış katmanı eklendi (`usage-aggregator.test.ts` —
 * `installNetworkCapabilitySentinel`): gerçek `computeUsageReport` çalışırken `net`/`tls`/`http`/
 * `https`/`dgram`/`dns`/`fetch`'in KENDİSİ global olarak kuşatılıyor. O katman BİRİNCİL korumadır
 * — sözdiziminden tamamen bağımsızdır, bu dosyadaki AST taraması ise İKİNCİL/erken-uyarı
 * katmanıdır (statik analiz sayesinde bir sorunu kod yazılırken/CI'da yakalar, davranış
 * katmanından önce).
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

const DYNAMIC_IMPORT_RE = /\bimport\s*\(/
const FETCH_CALL_RE = /\bfetch\s*\(/

interface ModuleSpecifierRef {
  spec: string
  isTypeOnly: boolean
}

/**
 * AA1 (tur 3) — gerçek TypeScript AST'i gezerek dosyanın kurduğu TÜM statik modül bağlarını
 * çıkarır: `import … from '<spec>'`, `import '<spec>'` (yan-etkili, `importClause` yok),
 * `export { x } from '<spec>'`, `export * from '<spec>'`, `export * as ns from '<spec>'`. Bunların
 * hepsi TEK bir `forEachChild` gezintisiyle yakalanır — regex'in ayrı ayrı desen yazması gereken
 * biçimler burada aynı AST düğüm ailesine (`ImportDeclaration`/`ExportDeclaration`) düşüyor. Tip-only
 * olan düğümler (`isTypeOnly`) işaretlenir ama listeden ÇIKARILMAZ; çağıran taraf (`scanModuleGraph`)
 * bunları filtreler — mevcut "tip-only muaf" davranışıyla birebir.
 */
function extractModuleSpecifierRefs(content: string, fileName: string): ModuleSpecifierRef[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  )
  const refs: ModuleSpecifierRef[] = []

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier
      if (spec && ts.isStringLiteralLike(spec)) {
        refs.push({ spec: spec.text, isTypeOnly: Boolean(node.importClause?.isTypeOnly) })
      }
    } else if (ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier
      if (spec && ts.isStringLiteralLike(spec)) {
        refs.push({ spec: spec.text, isTypeOnly: node.isTypeOnly })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return refs
}

/**
 * AA1 (F-011 QA düzeltme turu 4, BLOKLAYICI B1) — bir JS-tarzı uzantı içeren relative specifier'ın
 * hangi TS kaynak dosyasına karşılık geldiğini eşler (`moduleResolution: "Bundler"`'ın kabul
 * ettiği, NodeNext/ESM alışkanlığı olan yazım: `./x.js` → `x.ts`). QA'nın V5/V6/V7 sondaları tam
 * bunun EKSİK olmasından geçti.
 */
const JS_STYLE_TO_TS_EXTENSION: Readonly<Record<string, string>> = {
  '.js': '.ts',
  '.mjs': '.mts',
  '.cjs': '.cts',
}

function resolveRelativeImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec)
  const specExt = path.extname(spec)
  const candidates: string[] = []

  const tsExt = JS_STYLE_TO_TS_EXTENSION[specExt]
  if (tsExt) {
    // `./x.js` → `x.ts`, `./x.mjs` → `x.mts`, `./x.cjs` → `x.cts` (AA1 tur 4, V5/V6/V7).
    candidates.push(base.slice(0, base.length - specExt.length) + tsExt)
  } else if (specExt) {
    // Zaten bir TS-tarzı uzantı (veya bilinmeyen bir uzantı) taşıyor — olduğu gibi dene.
    candidates.push(base)
  } else {
    candidates.push(
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mts`,
      `${base}.cts`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx')
    )
  }

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

    // AA1 (tur 3) — `import … from`, `import '<spec>'`, `export … from`, `export * from`,
    // `export * as ns from` HEPSİ tek bir AST gezintisiyle çıkarılır (bkz. `extractModuleSpecifierRefs`
    // üstündeki yorum). Regex tabanlı iki ayrı desen (`STATIC_IMPORT_RE`/`BARE_SIDE_EFFECT_IMPORT_RE`)
    // buradan kaldırıldı çünkü `export … from` biçimi ikisinde de yoktu (X1'in kaçtığı boşluk).
    for (const { spec, isTypeOnly } of extractModuleSpecifierRefs(content, file)) {
      if (isTypeOnly) continue // erimiş — çalışma zamanı kapasitesi yok
      if (spec.startsWith('.')) {
        const resolved = resolveRelativeImport(file, spec)
        if (resolved) {
          stack.push(resolved)
        } else {
          // AA1 (F-011 QA düzeltme turu 4, BLOKLAYICI B1) — QA'nın B1 bulgusu: çözülemeyen bir
          // yerel import eskiden burada sessizce ATLANIYORDU (fail-open), beyaz listenin
          // "varsayılan RET" felsefesiyle çelişen tek nokta. Artık çözülemeyen HER yerel import
          // İHLAL sayılır (fail-closed) — dosyanın içeriği görülemiyorsa güvenli varsayım onun
          // yasak bir yetenek taşıdığıdır, taşımadığı değil.
          violations.push(
            `${file}: yerel import çözülemedi, güvenlik gereği İHLAL sayılıyor (${spec})`
          )
        }
        continue
      }
      if (!isAllowedBareModule(spec)) {
        violations.push(`${file}: beyaz listede olmayan modül import ediliyor (${spec})`)
      }
    }
  }

  return { filesScanned: Array.from(visited), violations }
}

const SOURCE_ENTRY_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

/**
 * AA1 (F-011 QA düzeltme turu 4) — QA §2.3'ün gereği: giriş numaralandırması yalnızca `.ts`
 * bakıyordu (`.mts`/`.cts` giriş olarak hiç sayılmıyordu) VE alt dizinleri özyinelemeli
 * TARAMIYORDU (bugün `usage/server` düz bir dizin olsa da yarın bir alt dizine dosya eklenirse
 * sessizce görünmez olurdu). Bu fonksiyon dosya sistemini özyinelemeli gezer.
 */
function listSourceEntriesRecursively(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listSourceEntriesRecursively(full))
    } else if (SOURCE_ENTRY_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

const usageServerEntries = listSourceEntriesRecursively(USAGE_SERVER_DIR)

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
    // AA1 (F-011 QA düzeltme turu 4) — QA §2.4'ün "körlük assert'i" bulgusu: `filesScanned.length
    // > 1` iki yerel giriş dosyasıyla (handlers.ts, usage-aggregator.ts) geçişli takip TAMAMEN
    // kırılsa bile daima ≥ 2 olduğu için asla tetiklenemiyordu. Artık SAYIYA değil, BEKLENEN
    // KÜMEYE bakılıyor: `transcript-reader.ts` `usage/server` dizini DIŞINDA (thread/server) ama
    // `usage-aggregator.ts` tarafından transitif import ediliyor — bu dosyanın taranan kümede
    // olması, geçişli takibin gerçekten çalıştığının doğrudan kanıtıdır.
    const scannedBaseNames = filesScanned.map((f) => path.basename(f))
    expect(scannedBaseNames).toEqual(
      expect.arrayContaining(['handlers.ts', 'usage-aggregator.ts', 'transcript-reader.ts'])
    )
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

  // F-011 QA tur 5 (BLOKLAYICI B2) — QA canlı kanıtladı: yukarıdaki N2'nin literal biçimi
  // (`process.binding(`) bu depoda `Process` tipinde `binding` alanı olmadığı için ASLA
  // DERLENMEZ (`TS2339`); gerçekte YAZILABİLİR/derlenen tek yol bir `unknown` cast'i ara
  // değişkene atamaktır — ve bu biçim metinsel regex'in aradığı ardışık "process" + ".binding("
  // dizisini kırdığı için tarayıcı tarafından YAKALANMAZ. Bu kalıcı negatif kontrol o sınırı
  // ÖRTBAS ETMEDEN belgeler: bu vektördeki asıl savunma artık `usage-aggregator.test.ts`teki
  // sentinel'in `process.binding`'i doğrudan kuşatmasıdır (çalışma zamanı katmanı), bu dosyanın
  // statik taraması DEĞİL.
  it("N2b — process.binding('tcp_wrap') GERÇEKTEN DERLENEN cast biçiminde (process as unknown as {…}) statik tarayıcı tarafından YAKALANMAZ (bilinen, kabul edilmiş sınır — asıl savunma sentinel'in runtime kuşatması)", () => {
    withTempFixture(
      'const qaProc = process as unknown as { binding: (name: string) => unknown }\n' +
        "qaProc.binding('tcp_wrap')\n",
      (file) => {
        const { violations } = scanModuleGraph([file])
        expect(violations.length).toBe(0)
      }
    )
  })

  // ------------------------------------------------------------------------------------------
  // AA1 (F-011 QA düzeltme turu 3, BLOKLAYICI B1) — X1: QA'nın gizlenmemiş, sıradan bir
  // TypeScript deseniyle (barrel yeniden dışa aktarımı) çiti yendiği ve ürün kodunun gerçek
  // `computeUsageReport`'undan CANLI bir HTTP isteği çıkardığı vektör. Artık AST tabanlı tarama
  // sayesinde kalıcı negatif kontrol.
  // ------------------------------------------------------------------------------------------
  it("X1 — export { get } from 'node:http' (+ yerel import) yakalanır (QA'nın canlı sızıntı kanıtladığı vektör, gizleme YOK)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-x1-'))
    try {
      const reexport = path.join(dir, 'reexport.ts')
      const entry = path.join(dir, 'entry.ts')
      // Bu dosyada `import` kelimesi HİÇ geçmiyor — tam QA'nın repro'sundaki gibi.
      fs.writeFileSync(reexport, "export { get as qaGet } from 'node:http'\n")
      fs.writeFileSync(entry, "import { qaGet } from './reexport'\nqaGet\n")
      const { violations } = scanModuleGraph([entry])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("X2 — export * from 'node:http' (tüm modülü yeniden dışa aktarma) yakalanır", () => {
    withTempFixture("export * from 'node:http'\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    })
  })

  it("X2b — export * as ns from 'node:http' yakalanır", () => {
    withTempFixture("export * as ns from 'node:http'\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    })
  })

  it("X3 — export type { X } from 'node:http' MUAF (tip-only, çalışma zamanı kapasitesi yok, yanlış pozitif değil)", () => {
    withTempFixture("export type { IncomingMessage as X } from 'node:http'\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations).toEqual([])
    })
  })

  it('X4 — yorum içindeki sahte export/import metni YAKALANMAZ (AST düğüm üretmez, yanlış pozitif yok)', () => {
    withTempFixture(
      "// export { get } from 'node:http'\n" +
        "/* import http from 'node:http' */\n" +
        "import fs from 'node:fs'\nfs.readFileSync\n",
      (file) => {
        const { violations } = scanModuleGraph([file])
        expect(violations).toEqual([])
      }
    )
  })

  it('X5 — çok satırlı export { … } from biçimi de yakalanır', () => {
    withTempFixture("export {\n  get,\n  request,\n} from 'node:http'\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  // ------------------------------------------------------------------------------------------
  // AA1 (F-011 QA düzeltme turu 4, BLOKLAYICI B1) — çözülemeyen yerel import artık fail-closed;
  // V5/V6/V7 kalıcı negatif kontrol olarak buraya girer.
  // ------------------------------------------------------------------------------------------
  it('çözülemeyen yerel import artık İHLAL sayılır (fail-closed, sessizce atlanmaz)', () => {
    withTempFixture("import './does-not-exist-anywhere'\n", (file) => {
      const { violations } = scanModuleGraph([file])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('çözülemedi'))).toBe(true)
    })
  })

  it("V5 — alt dizindeki .ts dosyasına '.js' uzantılı relative import ile referans verilmesi hâlâ taranır", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-v5-'))
    try {
      const subdir = path.join(dir, 'qasub')
      fs.mkdirSync(subdir)
      fs.writeFileSync(
        path.join(subdir, 'leak.ts'),
        "import http from 'node:http'\nhttp.get('http://x', () => {})\n"
      )
      const entry = path.join(dir, 'entry.ts')
      fs.writeFileSync(entry, "import './qasub/leak.js'\n")
      const { violations } = scanModuleGraph([entry])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("V6 — kardeş .mts dosyaya '.mjs' uzantılı import hâlâ taranır", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-v6-'))
    try {
      fs.writeFileSync(
        path.join(dir, 'qa-leak.mts'),
        "import http from 'node:http'\nhttp.get('http://x', () => {})\n"
      )
      const entry = path.join(dir, 'entry.ts')
      fs.writeFileSync(entry, "import './qa-leak.mjs'\n")
      const { violations } = scanModuleGraph([entry])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("V7 — kardeş .cts dosyaya '.cjs' uzantılı import hâlâ taranır", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-v7-'))
    try {
      fs.writeFileSync(
        path.join(dir, 'qa-leak2.cts'),
        "import http from 'node:http'\nhttp.get('http://x', () => {})\n"
      )
      const entry = path.join(dir, 'entry.ts')
      fs.writeFileSync(entry, "import './qa-leak2.cjs'\n")
      const { violations } = scanModuleGraph([entry])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("patlama yarıçapı regresyonu — MEVCUT bir import'a yalnızca '.js' uzantısı eklenmesi taramayı düşürmez (QA tur4 §2.3)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-usage-netguard-blast-'))
    try {
      const helper = path.join(dir, 'helper.ts')
      const entry = path.join(dir, 'entry.ts')
      fs.writeFileSync(helper, "import http from 'node:http'\nhttp.get('http://x', () => {})\n")
      // Kozmetik, hiçbir aracın uyarmadığı düzenleme: uzantısız importa yalnızca `.js` eklendi.
      fs.writeFileSync(entry, "import './helper.js'\n")
      const { violations } = scanModuleGraph([entry])
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.includes('node:http'))).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
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

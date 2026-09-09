import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * F-011 QA düzeltme turu (Z2) — QA'nın çalışma-zamanı casus tabanlı ağ çiti
 * (`usage-aggregator.test.ts`'teki Y3 sondası, yalnızca `fetch`/`http.request`/`https.request`i
 * gözlüyordu) 8 sondadan 6'sıyla yenildi: `http.get`, `net.connect`, `dns.lookup`,
 * `execFileSync('curl')`, dinamik `import('node:https')`, modül yüklenirken yakalanmış bir
 * referans (`const r = http.request; r(...)`). Ürün kodu bugün TEMİZ (`usage-aggregator.ts`
 * yalnızca `node:fs`/`node:path` import ediyor) — sorun çitin kendisiydi.
 *
 * Bu dosya YAPISAL bir çit kurar: `src/features/usage/server/**`'in giriş dosyalarından
 * (handlers.ts, usage-aggregator.ts) başlayıp YEREL (`./`, `../`) import zincirini takip ederek
 * TAM modül grafiğini kurar (ör. `usage-aggregator.ts` → thread'in `transcript-reader.ts`'i).
 * Grafikteki HİÇBİR dosya çalışma zamanında ağ/süreç yeteneği olan bir modül import edemez
 * (`import type` ERİMİŞ sayılır, muaf — ör. `handlers.ts`'in `import type http from 'node:http'`i),
 * bare/`globalThis.`-önekli `fetch(` çağıramaz, dinamik `import()` kullanamaz. Bu, QA'nın 8
 * sondasının HEPSİNİ import-seviyesinde kapatır: `http`/`net`/`dns`/`child_process` importunun
 * KENDİSİ yasak olduğu için hangi API'siyle çağrıldığı (get/connect/lookup/execFileSync) veya
 * nasıl saklandığı (yakalanmış referans) önemsizleşir.
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

const FORBIDDEN_MODULES = new Set([
  'net',
  'http',
  'https',
  'dns',
  'tls',
  'child_process',
  'dgram',
  'worker_threads',
])

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

/** Verilen giriş dosyalarından başlayıp YEREL import zincirini (derinlik sınırsız) izleyerek tam
 *  modül grafiğini tarar. Harici (node_modules/node: dışı-relative-olmayan) modüllere GİRİLMEZ —
 *  yalnızca bu deponun kendi kaynak dosyaları (relative import) takip edilir. */
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
      if (FORBIDDEN_MODULES.has(normalizeModuleSpecifier(spec))) {
        violations.push(`${file}: yasak modül import ediliyor (${spec})`)
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
      if (FORBIDDEN_MODULES.has(normalizeModuleSpecifier(spec))) {
        violations.push(`${file}: yasak modül import ediliyor (${spec})`)
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
})

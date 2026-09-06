import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// QA düzeltme turu 1, D11/B1 çiti: `vite.config.ts:11` `root: 'src/web'` olduğu için
// Tailwind v4'ün otomatik kaynak taraması yalnızca Vite kökünün İÇİNDEKİ dosyaları görüyordu;
// `src/features/events/web/**` kökün dışında kaldığı için o dizindeki sınıflar üretilen CSS'ten
// tamamen düşüyordu (ekranda `sr-only` görünür metin oluyordu, sütunlar/çipler bitişikti).
// Bu test GERÇEK `vite build`'i çalıştırıp üretilen dist CSS'ini okur — kaynak metni değil,
// üretim çıktısını denetler. Mutasyon: `src/web/index.css`'teki `@source "../features/events/web"`
// satırı silinirse bu test KIRMIZI verir (bkz. docs/qa/F-003-fix1-notes içindeki mutasyon tablosu).
const repoRoot = path.join(__dirname, '..')
const distWebDir = path.join(repoRoot, 'dist', 'web')

function readBuiltCss(): string {
  const assetsDir = path.join(distWebDir, 'assets')
  const cssFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'))
  if (cssFiles.length === 0) {
    throw new Error(`build sonrası hiçbir .css dosyası bulunamadı: ${assetsDir}`)
  }
  return cssFiles.map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n')
}

describe('B1 regresyonu: üretim CSS çıktısı src/features/events/web sınıflarını içerir', () => {
  let css: string

  beforeAll(() => {
    // `npm run build` ile birebir aynı komut (vite.js CLI'ı doğrudan node ile çağırıyoruz,
    // npm shim'inin Windows'ta ekstra süreç/PATH çözümleme maliyetinden kaçınmak için).
    execFileSync(
      process.execPath,
      [path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
      { cwd: repoRoot, stdio: 'pipe' }
    )
    css = readBuiltCss()
  }, 60000)

  // 5 farklı kategori: a11y yardımcısı, aralık (spacing), taşma (overflow), yuvarlaklık
  // (rounding), renk. Her biri YALNIZCA `src/features/events/web/**`'te kullanılıyor —
  // `src/web/App.tsx` bu sınıfların hiçbirini içermiyor (QA raporu §6 B1 ölçüm tablosu).
  const expectedClasses = [
    ['sr-only', 'a11y yardımcısı (TimelineScreen.tsx canlı bölge)'],
    ['gap-3', 'aralık (TimelineScreen.tsx üst araç çubuğu)'],
    ['overflow-y-auto', 'taşma (TimelineScreen.tsx kaydırma kabı)'],
    ['rounded-full', 'yuvarlaklık (FilterChips.tsx çipleri)'],
    ['text-amber-300', 'renk (ConnectionBadge.tsx / FilterChips.tsx)'],
  ] as const

  it.each(expectedClasses)('sınıf "%s" (%s) üretilen CSS çıktısında var', (cls) => {
    expect(css).toContain(cls)
  })

  afterAll(() => {
    // Test sonrası dist temiz kalsın diye silinmiyor — `npm run verify` zaten `build` adımını
    // ayrıca çalıştırır ve `emptyOutDir: true` bir sonraki build'de üzerine yazar. Silmek
    // paralel çalışan başka bir test/komutla yarış durumuna girebilir.
  })
})

describe('F-005: üretim CSS çıktısı src/features/projects/web sınıflarını içerir (@source çiti)', () => {
  let css: string

  const otherRoots = [
    path.join(repoRoot, 'src', 'web'),
    path.join(repoRoot, 'src', 'features', 'events', 'web'),
  ]

  function readSourceFiles(root: string): string {
    let combined = ''
    for (const entry of fs.readdirSync(root, { withFileTypes: true, recursive: true } as never)) {
      const e = entry as unknown as { name: string; parentPath?: string; path?: string }
      const dir = e.parentPath ?? e.path ?? root
      if (!e.name.endsWith('.ts') && !e.name.endsWith('.tsx')) continue
      combined += fs.readFileSync(path.join(dir, e.name), 'utf8')
    }
    return combined
  }

  beforeAll(() => {
    execFileSync(
      process.execPath,
      [path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
      { cwd: repoRoot, stdio: 'pipe' }
    )
    css = readBuiltCss()
  }, 60000)

  // Yalnızca `src/features/projects/web/**`'te kullanılan 3 sınıf (QA Bulgu 11 düzeltmesi —
  // F-003'te `bg-zinc-950`'nin başka yerde de geçtiği için tesadüfen yeşil kaldığı hatanın
  // tekrarını önlemek için, aşağıdaki "ön koşul" testi bu sınıfların DİĞER köklerde HİÇ
  // geçmediğini programatik olarak (fs.readFileSync + includes) doğruluyor).
  const projectsOnlyClasses = ['min-w-0', 'disabled:opacity-50', 'mt-auto'] as const

  it.each(projectsOnlyClasses)(
    'ön koşul: sınıf "%s" src/web/** veya src/features/events/web/**\'te HİÇ geçmiyor',
    (cls) => {
      for (const root of otherRoots) {
        const content = readSourceFiles(root)
        expect(content.includes(cls)).toBe(false)
      }
    }
  )

  it.each(projectsOnlyClasses)(
    'sınıf "%s" (yalnızca projects/web) üretilen CSS çıktısında var',
    (cls) => {
      // Tailwind, seçici içindeki `:` karakterini CSS'te `\:` olarak kaçırır (ör.
      // `.disabled\:opacity-50:disabled`); ham sınıf adı yerine kaçırılmış selector aranır.
      const selectorForm = cls.replace(/:/g, '\\:')
      expect(css).toContain(selectorForm)
    }
  )
})

describe('F-007: üretim CSS çıktısı src/features/kanban/web sınıflarını içerir (@source çiti)', () => {
  let css: string

  // QA tur 1 NOT-b (F-007 sözleşmesi §2.1): "birebir aynı desen" kopyalanırsa iki kök yeter
  // sanılıp `src/features/projects/web` atlanabilir — bu turda kasıtlı olarak ÜÇ kök taranıyor.
  const otherRoots = [
    path.join(repoRoot, 'src', 'web'),
    path.join(repoRoot, 'src', 'features', 'events', 'web'),
    path.join(repoRoot, 'src', 'features', 'projects', 'web'),
  ]

  function readSourceFiles(root: string): string {
    let combined = ''
    for (const entry of fs.readdirSync(root, { withFileTypes: true, recursive: true } as never)) {
      const e = entry as unknown as { name: string; parentPath?: string; path?: string }
      const dir = e.parentPath ?? e.path ?? root
      if (!e.name.endsWith('.ts') && !e.name.endsWith('.tsx')) continue
      combined += fs.readFileSync(path.join(dir, e.name), 'utf8')
    }
    return combined
  }

  beforeAll(() => {
    execFileSync(
      process.execPath,
      [path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
      { cwd: repoRoot, stdio: 'pipe' }
    )
    css = readBuiltCss()
  }, 60000)

  // Yalnızca `src/features/kanban/web/**`'te kullanılan 3 sınıf (aynı ön-koşul deseni — bu
  // sınıfların DİĞER üç kökte HİÇ geçmediği programatik olarak doğrulanır).
  const kanbanOnlyClasses = [
    ['min-w-[220px]', 'min-w-\\[220px\\]'],
    ['bg-fuchsia-950/10', 'bg-fuchsia-950\\/10'],
    ['text-[10px]', 'text-\\[10px\\]'],
  ] as const

  it.each(kanbanOnlyClasses)('ön koşul: sınıf "%s" diğer üç kökte HİÇ geçmiyor', (cls) => {
    for (const root of otherRoots) {
      const content = readSourceFiles(root)
      expect(content.includes(cls)).toBe(false)
    }
  })

  it.each(kanbanOnlyClasses)(
    'sınıf "%s" (yalnızca kanban/web) üretilen CSS çıktısında var',
    (_cls, selectorForm) => {
      expect(css).toContain(selectorForm)
    }
  )
})

describe('F-012 QA E2 — yapısal çit: src/features/*/web dizinlerinin TÜMÜ index.css @source listesinde', () => {
  // QA F-012 KALDI B1/E2: bu, aynı hata sınıfının (yeni bir `src/features/<x>/web` dizini
  // `@source` listesine eklenmeyi unutur) DÖRDÜNCÜ tekrarıydı (F-003/B1, F-005, F-007, F-012).
  // Önceki üç düzeltmenin hepsi feature-bazlı (yalnızca o feature'ın kendi sınıflarını arayan)
  // bir `it.each` bloğuydu — bir SONRAKİ feature yine unutabilirdi. Bu test FEATURE-BAZLI DEĞİL:
  // `src/features/*/web` dizinlerini gerçek dosya sisteminden numaralandırıp her birinin
  // `index.css`'in `@source` listesinde bir satırı olduğunu doğrular. Yeni bir feature `@source`
  // eklemeyi unutursa bu test (vite build'e gerek kalmadan, saniyeler içinde) KIRMIZI verir.
  const featuresDir = path.join(repoRoot, 'src', 'features')
  const cssPath = path.join(repoRoot, 'src', 'web', 'index.css')

  function listFeatureWebDirs(root: string): string[] {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => fs.existsSync(path.join(root, name, 'web')))
      .sort()
  }

  function readSourcedDirNames(cssContent: string): Set<string> {
    const sourced = new Set<string>()
    const regex = /@source\s+"\.\.\/features\/([^/"]+)\/web"/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(cssContent)) !== null) {
      sourced.add(match[1]!)
    }
    return sourced
  }

  it('her src/features/<x>/web dizini için index.css içinde bir @source satırı var', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf8')
    const sourcedDirs = readSourcedDirNames(cssContent)
    const actualDirs = listFeatureWebDirs(featuresDir)
    const missing = actualDirs.filter((d) => !sourcedDirs.has(d))
    expect(missing).toEqual([])
  })

  // Çitin kendisini mutasyonla doğrula: gerçekte var olan ama @source'da OLMAYAN sahte bir
  // dizin eklenince test KIRMIZI vermeli — böylece "regex her zaman boş döner de yeşil kalır"
  // gibi sessiz bir totoloji olasılığı da elenmiş olur.
  it('mutasyon kanıtı: @source listesinde olmayan yeni bir src/features/<x>/web dizini KIRMIZI verir', () => {
    const probeName = '__mutation_probe_e2__'
    const probeWebDir = path.join(featuresDir, probeName, 'web')
    fs.mkdirSync(probeWebDir, { recursive: true })
    try {
      const cssContent = fs.readFileSync(cssPath, 'utf8')
      const sourcedDirs = readSourcedDirNames(cssContent)
      const actualDirs = listFeatureWebDirs(featuresDir)
      const missing = actualDirs.filter((d) => !sourcedDirs.has(d))
      expect(missing).toEqual([probeName])
    } finally {
      fs.rmSync(path.join(featuresDir, probeName), { recursive: true, force: true })
    }
  })
})

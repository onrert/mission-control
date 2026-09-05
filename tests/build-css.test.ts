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

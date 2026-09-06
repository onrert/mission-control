import { defineConfig } from '@playwright/test'

/**
 * F-014 — Electron masaüstü kabuğu duman testi. Diğer `playwright*.config.ts` dosyalarından
 * FARKLI: `webServer`/`baseURL`/`projects` YOK — sunucuyu Playwright değil, testin kendisinin
 * başlattığı gerçek `electron.exe` (main.cjs üzerinden, §1) başlatır. `_electron.launch()`
 * kendi Chromium bağlamını taşır, ayrı bir tarayıcı projesine ihtiyaç duymaz.
 *
 * `npm run e2e` (ana koşu) bunu ÇALIŞTIRMAZ — ayrı `npm run e2e:electron` komutu gerekir
 * (Karpathy §3 — cerrahi değişiklik, mevcut E2E paketine dokunulmuyor).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['electron-smoke.spec.ts', 'electron-autostart-smoke.spec.ts'],
  // Her dosya kendi worker'ında (bkz. `electron-autostart-smoke.spec.ts` başlık notu — aynı
  // worker'da art arda üçüncü gerçek `electron.exe` başlatması ölçülebilir şekilde kararsızdı).
  // Bir dosya içindeki testler yine SERİ çalışır (Playwright varsayılanı); yalnızca iki dosya
  // paralel worker'lara dağılır.
  workers: 2,
  timeout: 60_000,
  // `retries` KASITLI OLARAK yok — diğer `playwright*.config.ts` dosyalarıyla aynı (varsayılan
  // 0). CLAUDE.md'nin "retry kararsızlığı gizler" dersi: bir test retry olmadan kararsızsa bu
  // BULGUDUR, config'te saklanmaz. Önceki `retries: 2` denemesi kaldırıldı (CEO kararı,
  // 2026-09-06) — kök neden düzeltilmeden retry eklemek testi yeşil GÖSTERİR ama hiçbir şey
  // ÖLÇMEZ.
})

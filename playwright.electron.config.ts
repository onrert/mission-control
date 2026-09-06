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
  testMatch: ['electron-smoke.spec.ts'],
  workers: 1,
  timeout: 60_000,
})

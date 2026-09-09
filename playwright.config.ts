import { defineConfig, devices } from '@playwright/test'
import { createTempDataDir, removeTempDataDir } from './tests/helpers/temp-data-dir'

// F-003 YENİ-3 düzeltmesi: paylaşılan webServer'a (shell.spec.ts + timeline.spec.ts'in AC5
// dışı kısmı) izole bir MC_DATA_DIR verilir — aksi hâlde sunucu gerçek `./data`'yı okur ve
// F-004'ün kurulu hook'u testler koşarken canlı olay POST etmeye devam ettiği için E2E
// zamana/makineye bağımlı hâle gelirdi. AC5'in kendi test.describe bloğu ayrı bir MC_DATA_DIR
// kullanmaya devam eder (sözleşme §5 madde 1, burada değişmedi).
const e2eDataDir = createTempDataDir()
process.on('exit', () => removeTempDataDir(e2eDataDir))

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: [
    'shell.spec.ts',
    'timeline.spec.ts',
    'settings.spec.ts',
    'kanban.spec.ts',
    'gates.spec.ts',
    'thread.spec.ts',
  ],
  // Tüm spec dosyaları TEK paylaşılan `webServer`/`MC_DATA_DIR`/proje kaydını kullanıyor
  // (yukarıdaki yorum). `kanban.spec.ts` gerçek `POST/DELETE /api/projects` çağrıları yapan
  // testler eklediğinden (F-007), varsayılan çoklu-worker paralelliği farklı spec
  // dosyalarının aynı anda proje eklemesine/silmesine yol açıyor — `settings.spec.ts`'in
  // "tam olarak N proje" sayımlarını ve `kanban.spec.ts`'in echo/render-sayacı ölçümünü
  // (paylaşılan `projects`/`features` SSE yayını başka bir test tetiklediğinde) kirletiyor.
  // Tek worker (dosyalar arası tam sıralı çalıştırma) bu paylaşılan-durum yarışını kökten
  // ortadan kaldırır; testler içi davranış/assert'ler değişmedi.
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:7333',
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:7333/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    // F-012 — chat kapalı: bu webServer'ın gerçek `@anthropic-ai/claude-agent-sdk` `query()`'si
    // enjekte etmesi mümkün değil (Playwright ayrı bir süreç başlatıyor), varsayılan açık kalırsa
    // her `npm run e2e` gerçek, ÜCRETLİ bir Claude oturumu açardı. QA tur 2 Y2 düzeltmesi —
    // bu artık YALNIZCA `npm start`'ın (SUNUCU süreci) `MC_CHAT_ENABLED`'ı; `npm run build`
    // (istemci paketi) bu değişkeni HİÇ okumuyor (vite.config.ts'in `define`'ı kaldırıldı) —
    // yani bu ortam değişkeni `dist/`'i kalıcı olarak "sohbetsiz" bırakmıyor, yalnızca BU e2e
    // koşusundaki sunucu sürecinin gerçek SDK oturumu açmasını engelliyor.
    env: { MC_DATA_DIR: e2eDataDir, MC_CHAT_ENABLED: '0' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

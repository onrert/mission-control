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
  testMatch: ['shell.spec.ts', 'timeline.spec.ts', 'settings.spec.ts', 'kanban.spec.ts'],
  use: {
    baseURL: 'http://127.0.0.1:7333',
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:7333/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MC_DATA_DIR: e2eDataDir },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

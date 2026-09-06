import { defineConfig, devices } from '@playwright/test'
import { createTempDataDir, removeTempDataDir } from './tests/helpers/temp-data-dir'

/**
 * F-012 F6 — sohbet ekranı için tarayıcı seviyesinde E2E. `playwright.config.ts`'ten AYRI bir
 * dosya (Karpathy §3 — cerrahi değişiklik): diğer feature'ların paylaşılan `webServer`/E2E
 * koşusuna dokunmadan, yalnızca bu senaryoya özel bir sunucu başlatıcı (`chat-fake-server.ts`)
 * kullanır. `npm run e2e` (ana koşu) bunu çalıştırmaz — ayrı `npm run e2e:chat` komutu gerekir.
 *
 * `chat-fake-server.ts` gerçek üretim `createServer()`'ı, sahte (enjekte edilmiş) bir `query()`
 * ile başlatır — QA'nın `docs/qa/F-012-2026-09-06-tur2.md` §3'te gösterdiği gibi bu, **sıfır
 * kota** ile gerçek tarayıcıda gerçek HTTP/SSE akışını ölçmeyi sağlar (hiçbir gerçek, ücretli
 * SDK oturumu açılmaz).
 */
const chatDataDir = createTempDataDir()
process.on('exit', () => removeTempDataDir(chatDataDir))

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['chat.spec.ts'],
  use: {
    baseURL: 'http://127.0.0.1:7435',
  },
  webServer: {
    command: 'npm run build && npm run e2e:chat:server',
    env: { PORT: '7435', MC_DATA_DIR: chatDataDir },
    url: 'http://127.0.0.1:7435/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

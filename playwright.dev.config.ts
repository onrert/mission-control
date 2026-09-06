import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'dev-shell.spec.ts',
  use: {
    baseURL: 'http://127.0.0.1:7434',
  },
  webServer: {
    command: 'npm run dev',
    // F-012 — chat kapalı: gerçek `@anthropic-ai/claude-agent-sdk` `query()` enjekte edilemiyor
    // (ayrı süreç), varsayılan açık kalırsa her `npm run e2e:dev` gerçek, ÜCRETLİ bir Claude
    // oturumu açardı.
    env: { MC_PORT: '7433', MC_WEB_PORT: '7434', MC_CHAT_ENABLED: '0' },
    url: 'http://127.0.0.1:7434',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

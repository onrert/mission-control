import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'shell.spec.ts',
  use: {
    baseURL: 'http://127.0.0.1:7333',
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:7333/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

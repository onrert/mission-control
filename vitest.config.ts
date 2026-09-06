import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts?(x)'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: ['./tests/setup/chat-disabled-by-default.ts'],
  },
})

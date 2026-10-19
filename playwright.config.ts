import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE_URL = `http://localhost:${PORT}`
const desktopChrome = devices['Desktop Chrome']

export default defineConfig({
  testDir: './tests/e2e',
  // offline.spec butuh service worker → hanya hidup di build produksi
  // (playwright.preview.config.ts). Di server dev ia pasti gagal.
  testIgnore: /offline\.spec\.ts/,
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: desktopChrome ? [{ name: 'chromium', use: desktopChrome }] : [],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

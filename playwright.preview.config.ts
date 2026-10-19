import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4199)
const BASE_URL = `http://localhost:${PORT}`
const desktopChrome = devices['Desktop Chrome']

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /offline\.spec\.ts/,
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: desktopChrome ? [{ name: 'chromium', use: desktopChrome }] : [],
  webServer: {
    command: `pnpm vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

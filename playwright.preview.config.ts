import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4199)
const BASE_URL = `http://localhost:${PORT}`
const desktopChrome = devices['Desktop Chrome']
const pixel7 = devices['Pixel 7']

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
  // Alur offline penuh dibuktikan di desktop DAN satu viewport ponsel nyata
  // (P2 palingkritis untuk pengguna Android — `plan.md` §audiens).
  projects: [
    ...(desktopChrome ? [{ name: 'chromium', use: desktopChrome }] : []),
    ...(pixel7 ? [{ name: 'mobile-chrome', use: pixel7 }] : []),
  ],
  webServer: {
    command: `pnpm vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

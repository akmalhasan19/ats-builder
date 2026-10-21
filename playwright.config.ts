import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE_URL = `http://localhost:${PORT}`
const desktopChrome = devices['Desktop Chrome']
const pixel7 = devices['Pixel 7']

// T9.2 — matriks browser. `webkit` tidak terpasang di mesin pengembangan
// (butuh `playwright install webkit`), jadi proyeknya didefinisikan di sini
// dan baru aktif saat `E2E_WEBKIT=1` — misalnya di CI Linux.
// C5.1 — spec kanvas kini juga masuk proyek mobile-chrome (§5.3): alur edit
// langsung di kertas wajib usable di Pixel 7, bukan hanya di desktop.
// FASE 14 — `canvas-caret-follow` juga khusus layar sempit (kamera mengikuti
// caret), jadi ikut allowlist mobile.
const mobileSpecs =
  /(?:first-visit|editor-flow|template-switch|download-pdf|ats-check|responsive|canvas-mode|canvas-guides|canvas-edit|canvas-edit-zoom|canvas-caret-follow|canvas-entry|canvas-mobile)\.spec\.ts/

// Spec yang khusus menguji perilaku panel mobile (<1024px).
const mobileOnlySpecs = [
  /canvas-mobile\.spec\.ts/,
  /canvas-edit-zoom\.spec\.ts/,
  /canvas-caret-follow\.spec\.ts/,
]

// C5.1 — `offline.spec` butuh service worker (hanya hidup di build produksi;
// dijalankan lewat `playwright.preview.config.ts`). Penting: `testIgnore` di
// tingkat proyek **menggantikan** `testIgnore` global, jadi pola ini wajib ikut
// di setiap proyek — kalau tidak, spec offline ikut jalan di server dev dan
// timeout menunggu `serviceWorker.ready`.
const devIgnoredSpecs = [/offline\.spec\.ts/]

const projects = [
  ...(!desktopChrome
    ? []
    : [
        {
          name: 'chromium',
          use: { ...desktopChrome },
          testIgnore: [...devIgnoredSpecs, ...mobileOnlySpecs],
        },
      ]),
  ...(pixel7
    ? [
        {
          name: 'mobile-chrome',
          use: { ...pixel7 },
          testMatch: mobileSpecs,
          testIgnore: devIgnoredSpecs,
        },
      ]
    : []),
]

if (process.env.E2E_WEBKIT === '1' && devices['Desktop Safari']) {
  projects.push({
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
    testIgnore: [...devIgnoredSpecs, ...mobileOnlySpecs],
  })
}

export default defineConfig({
  testDir: './tests/e2e',
  // offline.spec butuh service worker → hanya hidup di build produksi
  // (playwright.preview.config.ts). Di server dev ia pasti gagal.
  testIgnore: [/offline\.spec\.ts/],
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
  projects,
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

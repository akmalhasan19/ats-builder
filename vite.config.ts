import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  // `--mode spike` dipakai untuk mengukur pemisahan chunk PDF pada build
  // produksi. Nilai ini literal, sehingga bundler benar-benar membuang rute
  // `/dev/*` dari build biasa (T0.3).
  define: {
    __DEV_PAGES__: JSON.stringify(mode === 'spike'),
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(srcDir, '../vitest.setup.ts')],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // QA Fase 9: default 5000 ms terlalu sempit saat 49 berkas jsdom berjalan
    // paralel di mesin ini — test murni render/store pernah mati karena antrean
    // CPU, bukan karena perilaku. Timeout dinaikkan, assertion tidak diubah.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // T9.1 — cakupan global: seluruh kode yang benar-benar dikirim ke
    // pengguna. Rute dev (`/dev/*`) dan spike hanya hidup di build dev dan
    // sudah ter-DCE dari `dist`, jadi tidak ikut dihitung sebagai produk.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/app/dev/**',
        'src/main.tsx',
        'src/types/**',
        'src/features/pdf/spikePdf.ts',
        'src/features/templates/pdf/SpikePdfLib.ts',
        'src/features/templates/screen/SpikeSheet.tsx',
        'src/features/templates/spikeContent.ts',
        'src/features/templates/spikeSpec.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
}))

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
    // Gate Fase 1: lib/, store/, schema/ ≥ 85%.
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/lib/**', 'src/store/**', 'src/schema/**'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85,
      },
    },
  },
}))

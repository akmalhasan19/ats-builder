module.exports = {
  ci: {
    collect: {
      // `staticDistDir` memakai server statis tanpa SPA fallback sehingga
      // /templates & /privacy 404. `vite preview` melayani fallback index.html
      // seperti hosting produksi.
      startServerCommand: 'pnpm vite preview --port 4173 --strictPort',
      startServerReadyPattern: 'Local:',
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/templates',
        'http://localhost:4173/privacy',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttlingMethod: 'simulate',
        throttling: { rttMs: 150, throughputKbps: 1638.4 },
      },
    },
    assert: {
      assertions: {
        // T9.4 budget. Yang bisa dicapai hari ini = `error` (memblokir CI);
        // Performance & LCP berstatus `warn` karena menembusnya butuh diet
        // bundle lintas modul yang ditunda owner ke task tersendiri
        // (IMPLEMENTATION_PLAN §9, keputusan Fase 9 no. 1). Angka nyatanya
        // dilaporkan `scripts/evidence-fase9.mjs` dan ditulis di Execution Log.
        'categories:performance': ['warn', { minScore: 0.9 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}

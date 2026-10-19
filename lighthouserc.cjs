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
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}

import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// QA Fase 9 — rute produksi di-`lazy()`, jadi `findBy*` menunggu chunk resolve.
// Default 1000 ms Testing Library pernah kelewatan saat 49 berkas jsdom berjalan
// paralel (flake, bukan bug perilaku). Timeout dinaikkan; assertion tetap.
configure({ asyncUtilTimeout: 10_000 })

// Radix ScrollArea mengamati ukuran viewport dengan ResizeObserver; jsdom tidak
// menyediakannya, jadi komponen yang memakainya gagal dirender di unit test.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// PreviewWell melacak halaman yang sedang terlihat dengan IntersectionObserver;
// jsdom tidak menyediakannya sama sekali.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver
}

afterEach(() => {
  cleanup()
})

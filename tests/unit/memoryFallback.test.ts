import { describe, expect, it, vi } from 'vitest'
import { flushPendingWrite, startAutosave } from '@/features/persistence/autosave'
import { initPersistence } from '@/features/persistence/init'
import { useDocStore } from '@/store/docStore'
import { useSyncStore } from '@/store/syncStore'

vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.reject(new Error('IndexedDB ditolak'))),
  set: vi.fn(() => Promise.reject(new Error('IndexedDB ditolak'))),
  keys: vi.fn(() => Promise.resolve([])),
}))

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

describe('fallback saat IndexedDB ditolak (private mode)', () => {
  it('tetap boot, lalu menyimpan ke memori dengan status error & banner jujur', async () => {
    await initPersistence()

    expect(useSyncStore.getState().storageMode).toBe('memory')
    expect(useDocStore.getState().doc.schemaVersion).toBe(1)

    startAutosave()
    useDocStore.getState().setTitle('Tanpa IndexedDB')
    flushPendingWrite()

    const deadline = Date.now() + 2000
    while (useSyncStore.getState().status !== 'error' && Date.now() < deadline) {
      await sleep(20)
    }

    expect(useSyncStore.getState().status).toBe('error')
    expect(useSyncStore.getState().storageMode).toBe('memory')
    expect(useDocStore.getState().doc.title).toBe('Tanpa IndexedDB')
  })
})

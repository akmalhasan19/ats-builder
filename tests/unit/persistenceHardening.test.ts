/**
 * T9.6 / Fase 9 — penguatan persistensi.
 *
 * Fokus pada jalur yang tidak terlihat saat semuanya baik: kuota IndexedDB
 * habis (nama galat berbeda antar mesin), kembali sehat setelah tulis sukses,
 * mode offline, dan cabang-cabang `initPersistence` (baca gagal, dokumen korup,
 * boot pertama, listener konektivitas). Modul init punya flag `started`, jadi
 * tiap tes boot memakai `vi.resetModules()` + import dinamis.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { id } from '@/dictionaries/id'
import {
  flushPendingWrite,
  isQuotaError,
  saveNow,
  startAutosave,
} from '@/features/persistence/autosave'
import { createSampleDoc } from '@/schema/resume'
import { useDocStore, type DocStore } from '@/store/docStore'
import { useErrorStore } from '@/store/errorStore'
import { useSyncStore, type SyncStore } from '@/store/syncStore'
import { corruptDocShapeFixture, v0DocFixture } from '../fixtures/docs'
import type { UiStore } from '@/store/uiStore'
import type { ResumeDoc } from '@/types/resume'

// Kunci harus ikut di-hoist karena dipakai pabrik mock di bawah.
const shared = vi.hoisted(() => ({
  DOC_KEY: 'ats:doc:v1',
  FIRST_RUN_KEY: 'ats:firstRun',
}))

const DOC_KEY = shared.DOC_KEY
const FIRST_RUN_KEY = shared.FIRST_RUN_KEY

const idb = vi.hoisted(() => ({
  readValue: vi.fn<(key: string) => Promise<unknown>>(),
  writeValue: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  quarantineCorruptDoc: vi.fn<(raw: unknown) => Promise<void>>(),
}))

const toastMock = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast: toastMock }))

// Semua akses penyimpanan lewat stub ini supaya cabang gagal bisa dipaksa.
vi.mock('@/features/persistence/idb', () => ({
  DOC_KEY: shared.DOC_KEY,
  PREFS_KEY: 'ats:prefs:v1',
  FIRST_RUN_KEY: shared.FIRST_RUN_KEY,
  corruptKey: (timestamp: number) => `ats:doc:corrupt:${timestamp}`,
  readValue: idb.readValue,
  writeValue: idb.writeValue,
  quarantineCorruptDoc: idb.quarantineCorruptDoc,
}))

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function until(predicate: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 2000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message)
    await sleep(10)
  }
}

const quotaError = (): unknown => new DOMException('kuota habis', 'QuotaExceededError')

const docWrites = (): [string, unknown][] =>
  idb.writeValue.mock.calls.filter((call) => call[0] === DOC_KEY)

type Boot = {
  initPersistence: () => Promise<void>
  docStore: { getState: () => DocStore }
  syncStore: { getState: () => SyncStore }
  uiStore: { getState: () => UiStore }
}

/** Modul segar per tes — `initPersistence` hanya bekerja sekali per instance. */
async function boot(): Promise<Boot> {
  vi.resetModules()
  const [init, docStore, syncStore, uiStore] = await Promise.all([
    import('@/features/persistence/init'),
    import('@/store/docStore'),
    import('@/store/syncStore'),
    import('@/store/uiStore'),
  ])
  return {
    initPersistence: init.initPersistence,
    docStore: docStore.useDocStore,
    syncStore: syncStore.useSyncStore,
    uiStore: uiStore.useUiStore,
  }
}

const seedStorage = (values: Record<string, unknown>): void => {
  idb.readValue.mockImplementation(async (key: string) => values[key])
}

const profileFullNameOf = (doc: ResumeDoc): string => {
  const profile = doc.sections.find((section) => section.kind === 'profile')
  if (!profile || profile.kind !== 'profile') throw new Error('dokumen tanpa profil')
  return profile.data.fullName
}

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  flushPendingWrite()

  idb.readValue.mockResolvedValue(undefined)
  idb.writeValue.mockResolvedValue(undefined)
  idb.quarantineCorruptDoc.mockResolvedValue(undefined)

  useErrorStore.getState().dismissError()
  useSyncStore.setState({
    status: 'saved-local',
    storageMode: 'idb',
    error: null,
    lastSyncedAt: null,
  })
  useDocStore.getState().loadDoc(createSampleDoc())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/* ------------------------------------------------------------ isQuotaError */

describe('isQuotaError — nama galat lintas mesin', () => {
  it('QuotaExceededError dan UsageError dihitung kuota habis', () => {
    expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true)
    expect(isQuotaError(new DOMException('x', 'UsageError'))).toBe(true)
  })

  it('error biasa, non-objek, dan objek tanpa name bukan kuota', () => {
    expect(isQuotaError(new Error('x'))).toBe(false)
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError('QuotaExceededError')).toBe(false)
    expect(isQuotaError({})).toBe(false)
    expect(isQuotaError({ name: 'NotFoundError' })).toBe(false)
  })
})

/* ------------------------------------------------------------------ autosave */

describe('autosave saat kuota penyimpanan habis', () => {
  it('tulis gagal karena kuota: mode memory, status error, banner quota', async () => {
    idb.writeValue.mockRejectedValue(quotaError())

    saveNow()
    expect(useSyncStore.getState().status).toBe('saving')

    await until(() => useSyncStore.getState().status === 'error', 'status tidak jadi error')

    expect(useSyncStore.getState().storageMode).toBe('memory')
    expect(useErrorStore.getState().banner).toBe('quota')
    expect(idb.writeValue).toHaveBeenCalledWith(DOC_KEY, useDocStore.getState().doc)
  })

  it('UsageError (Safari) juga memunculkan banner quota', async () => {
    idb.writeValue.mockRejectedValue(new DOMException('pemakaian', 'UsageError'))
    saveNow()

    await until(() => useErrorStore.getState().banner === 'quota', 'banner quota tidak muncul')
    expect(useSyncStore.getState().storageMode).toBe('memory')
  })

  it('tulis gagal non-kuota: tetap memory + error, tanpa banner quota', async () => {
    idb.writeValue.mockRejectedValue(new Error('IndexedDB ditolak'))
    saveNow()

    await until(() => useSyncStore.getState().status === 'error', 'status tidak jadi error')
    expect(useSyncStore.getState().storageMode).toBe('memory')
    expect(useErrorStore.getState().banner).toBeNull()
  })

  it('jalur debounce (ubah dokumen setelah startAutosave) memakai aturan yang sama', async () => {
    idb.writeValue.mockRejectedValue(quotaError())
    const stop = startAutosave()
    try {
      vi.useFakeTimers()
      useDocStore.getState().setTitle('Sebelum kuota habis')
      expect(useSyncStore.getState().status).toBe('saving')
      expect(idb.writeValue).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(399)
      expect(idb.writeValue).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(idb.writeValue).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
      await until(() => useSyncStore.getState().status === 'error', 'debounce tidak sampai tulis')
      expect(useErrorStore.getState().banner).toBe('quota')
    } finally {
      stop()
    }
  })

  it('tulis sukses berikutnya membersihkan banner dan mengembalikan saved-local', async () => {
    idb.writeValue.mockRejectedValue(quotaError())
    saveNow()
    await until(() => useErrorStore.getState().banner === 'quota', 'banner quota tidak muncul')
    expect(useSyncStore.getState().status).toBe('error')

    idb.writeValue.mockResolvedValue(undefined)
    saveNow()
    await until(
      () => useSyncStore.getState().status === 'saved-local',
      'status tidak kembali saved-local',
    )

    expect(useErrorStore.getState().banner).toBeNull()
    expect(useSyncStore.getState().storageMode).toBe('idb')
    expect(docWrites()).toHaveLength(2)
  })

  it('banner non-quota tidak ikut dibersihkan oleh tulis sukses', async () => {
    useErrorStore.getState().showError('runtime')
    saveNow()
    await until(() => useSyncStore.getState().status === 'saved-local', 'tulis tidak selesai')
    expect(useErrorStore.getState().banner).toBe('runtime')
  })

  it('tulis sukses saat offline menghasilkan status offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    saveNow()

    await until(() => useSyncStore.getState().status === 'offline', 'status tidak offline')
    expect(useSyncStore.getState().storageMode).toBe('idb')
    expect(idb.writeValue).toHaveBeenCalledTimes(1)
    expect(useErrorStore.getState().banner).toBeNull()
  })

  it('flushPendingWrite memaksa tulis sekarang dan tidak menulis dua kali', async () => {
    const stop = startAutosave()
    try {
      useDocStore.getState().setTitle('Dipaksa sekarang')
      expect(useSyncStore.getState().status).toBe('saving')

      flushPendingWrite()
      await until(() => useSyncStore.getState().status === 'saved-local', 'flush tidak menulis')
      expect(idb.writeValue).toHaveBeenCalledTimes(1)

      // Tidak ada tugas tertunda lagi: flush berikutnya diam.
      flushPendingWrite()
      await sleep(30)
      expect(idb.writeValue).toHaveBeenCalledTimes(1)
    } finally {
      stop()
    }
  })

  it('tab disembunyikan (visibilitychange) memaksa tulis sebelum debounce habis', async () => {
    const stop = startAutosave()
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    try {
      useDocStore.getState().setTitle('Tab ditutup paksa')
      expect(idb.writeValue).not.toHaveBeenCalled()

      document.dispatchEvent(new Event('visibilitychange'))
      expect(idb.writeValue).toHaveBeenCalledTimes(1)
      await until(() => useSyncStore.getState().status === 'saved-local', 'flush tidak selesai')
      expect(idb.writeValue).toHaveBeenCalledWith(DOC_KEY, useDocStore.getState().doc)
    } finally {
      if (visibility) Object.defineProperty(document, 'visibilityState', visibility)
      else delete (document as unknown as { visibilityState?: unknown }).visibilityState
      stop()
    }
  })

  it('pagehide memaksa tulis yang masih tertunda', async () => {
    const stop = startAutosave()
    try {
      useDocStore.getState().setTitle('Pagehide paksa')
      expect(idb.writeValue).not.toHaveBeenCalled()

      window.dispatchEvent(new Event('pagehide'))
      await until(() => idb.writeValue.mock.calls.length > 0, 'pagehide tidak menulis')
      expect(docWrites()).toHaveLength(1)
    } finally {
      stop()
    }
  })
})

/* --------------------------------------------------------------- init boot */

describe('initPersistence — cabang boot', () => {
  it('baca gagal → mode memory, aplikasi tetap jalan dengan dokumen awal', async () => {
    const ctx = await boot()
    idb.readValue.mockRejectedValue(new Error('IndexedDB ditolak'))

    await ctx.initPersistence()

    expect(ctx.syncStore.getState().storageMode).toBe('memory')
    expect(ctx.docStore.getState().doc.schemaVersion).toBe(1)
    expect(docWrites()).toHaveLength(0)
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('boot pertama menulis dokumen yang sedang aktif', async () => {
    const ctx = await boot()
    seedStorage({ [DOC_KEY]: undefined, [FIRST_RUN_KEY]: undefined })

    await ctx.initPersistence()

    const current = ctx.docStore.getState().doc
    const writes = docWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0]![1]).toBe(current)
    expect(ctx.syncStore.getState().storageMode).toBe('idb')
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('boot pertama tapi tulis ditolak → mode memory, tetap jalan', async () => {
    const ctx = await boot()
    idb.writeValue.mockRejectedValue(new Error('IDB menolak tulis pertama'))

    await ctx.initPersistence()

    expect(ctx.syncStore.getState().storageMode).toBe('memory')
    expect(ctx.docStore.getState().doc.schemaVersion).toBe(1)
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('boot pertama sambil offline → status offline', async () => {
    const ctx = await boot()
    vi.stubGlobal('navigator', { onLine: false })

    await ctx.initPersistence()

    expect(ctx.syncStore.getState().status).toBe('offline')
    expect(ctx.syncStore.getState().storageMode).toBe('idb')
  })

  it('listener offline/online menaikkan lalu menurunkan status', async () => {
    const ctx = await boot()
    await ctx.initPersistence()

    window.dispatchEvent(new Event('offline'))
    expect(ctx.syncStore.getState().status).toBe('offline')

    window.dispatchEvent(new Event('online'))
    expect(ctx.syncStore.getState().status).toBe('saved-local')

    // 'online' saat status bukan offline tidak boleh menimpa status lain.
    ctx.syncStore.getState().setStatus('error')
    window.dispatchEvent(new Event('online'))
    expect(ctx.syncStore.getState().status).toBe('error')
  })

  it('dokumen korup: karantina, dokumen contoh, toast, dan kunci ditimpa', async () => {
    const ctx = await boot()
    seedStorage({ [DOC_KEY]: 'isi-berkas-rusak-total' })

    await ctx.initPersistence()

    expect(profileFullNameOf(ctx.docStore.getState().doc)).toBe('Alex Morgan')
    expect(idb.quarantineCorruptDoc).toHaveBeenCalledWith('isi-berkas-rusak-total')
    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith(id['persist.corrupt.restored'])

    const writes = docWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0]![1]).toBe(ctx.docStore.getState().doc)
    expect(ctx.syncStore.getState().storageMode).toBe('idb')
  })

  it('karantina dan tulis sama-sama menolak: tetap pulih dengan dokumen contoh', async () => {
    const ctx = await boot()
    seedStorage({ [DOC_KEY]: corruptDocShapeFixture })
    idb.quarantineCorruptDoc.mockRejectedValue(new Error('IDB mati'))
    idb.writeValue.mockRejectedValue(new Error('IDB mati'))

    await ctx.initPersistence()

    expect(idb.quarantineCorruptDoc).toHaveBeenCalledWith(corruptDocShapeFixture)
    expect(profileFullNameOf(ctx.docStore.getState().doc)).toBe('Alex Morgan')
    expect(toastMock).toHaveBeenCalledWith(id['persist.corrupt.restored'])
    expect(ctx.syncStore.getState().storageMode).toBe('memory')
  })

  it('dokumen versi lama dimigrasikan lalu dimuat tanpa karantina', async () => {
    const ctx = await boot()
    seedStorage({ [DOC_KEY]: structuredClone(v0DocFixture) })

    await ctx.initPersistence()

    const doc = ctx.docStore.getState().doc
    expect(doc.title).toBe('CV Versi Nol')
    expect(doc.schemaVersion).toBe(1)
    expect(doc.settings.page.marginMm).toBe(18)
    expect(idb.quarantineCorruptDoc).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('firstRun tersimpan menandai kartu pertama sudah pernah tampil', async () => {
    const ctx = await boot()
    seedStorage({ [FIRST_RUN_KEY]: true })

    await ctx.initPersistence()

    expect(ctx.uiStore.getState().firstRunSeen).toBe(true)
  })

  it('firstRun terbaca gagal: kartu tetap boleh tampil', async () => {
    const ctx = await boot()
    idb.readValue.mockImplementation(async (key: string) => {
      if (key === FIRST_RUN_KEY) throw new Error('IDB ditolak')
      return undefined
    })

    await ctx.initPersistence()

    expect(ctx.uiStore.getState().firstRunSeen).toBe(false)
    expect(ctx.docStore.getState().doc.schemaVersion).toBe(1)
    expect(ctx.syncStore.getState().storageMode).toBe('idb')
  })

  it('dipanggil dua kali hanya sekali bekerja (flag started)', async () => {
    const ctx = await boot()

    await ctx.initPersistence()
    await ctx.initPersistence()

    expect(docWrites()).toHaveLength(1)
    expect(idb.readValue).toHaveBeenCalledTimes(2)
  })

  it('autosave aktif setelah boot sehingga perubahan berikutnya tertulis', async () => {
    const ctx = await boot()
    await ctx.initPersistence()
    idb.writeValue.mockClear()

    vi.useFakeTimers()
    try {
      ctx.docStore.getState().setTitle('Judul baru setelah boot')
      await vi.advanceTimersByTimeAsync(400)
    } finally {
      vi.useRealTimers()
    }
    await until(() => docWrites().length > 0, 'autosave tidak menulis')

    const writes = docWrites()
    expect(writes).toHaveLength(1)
    expect((writes[0]![1] as ResumeDoc).title).toBe('Judul baru setelah boot')
  })
})

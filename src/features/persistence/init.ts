import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { createSampleDoc, migrate } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { useSyncStore } from '@/store/syncStore'
import { DOC_KEY, quarantineCorruptDoc, readValue, writeValue } from './idb'
import { startAutosave } from './autosave'

let started = false

function registerConnectivityListeners(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('offline', () => {
    useSyncStore.getState().setStatus('offline')
  })
  window.addEventListener('online', () => {
    const sync = useSyncStore.getState()
    if (sync.status === 'offline') sync.setStatus('saved-local')
  })
}

export async function initPersistence(): Promise<void> {
  if (started) return
  started = true

  registerConnectivityListeners()

  let raw: unknown
  let readOk = true
  try {
    raw = await readValue(DOC_KEY)
  } catch {
    readOk = false
    raw = undefined
    useSyncStore.getState().setStorageMode('memory')
  }

  if (readOk && raw !== undefined && raw !== null) {
    try {
      useDocStore.getState().loadDoc(migrate(raw))
    } catch {
      try {
        await quarantineCorruptDoc(raw)
      } catch {
        // IndexedDB sedang menolak; karantina bersifat terbaik-saja — yang
        // penting aplikasi tetap jalan dengan dokumen contoh.
      }
      const sample = createSampleDoc()
      useDocStore.getState().loadDoc(sample)
      try {
        // Timpa kunci dokumen supaya reload berikutnya tidak mengkarantina
        // berkas yang sama berulang kali.
        await writeValue(DOC_KEY, sample)
        useSyncStore.getState().setStorageMode('idb')
      } catch {
        useSyncStore.getState().setStorageMode('memory')
      }
      toast(t('persist.corrupt.restored'))
    }
  } else if (readOk) {
    // Boot pertama: dokumen contoh dipersistensikan segera supaya isi form
    // dan isi IndexedDB selaras sejak awal.
    try {
      await writeValue(DOC_KEY, useDocStore.getState().doc)
      useSyncStore.getState().setStorageMode('idb')
    } catch {
      useSyncStore.getState().setStorageMode('memory')
    }
  }

  startAutosave()

  if (navigator.onLine === false) useSyncStore.getState().setStatus('offline')
}

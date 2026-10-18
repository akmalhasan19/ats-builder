import type { ResumeDoc } from '@/types/resume'
import { useDocStore } from '@/store/docStore'
import { useSyncStore } from '@/store/syncStore'
import { DOC_KEY, writeValue } from './idb'

const AUTOSAVE_DEBOUNCE_MS = 400

let timer: ReturnType<typeof setTimeout> | null = null
let pendingDoc: ResumeDoc | null = null
let unsubscribe: (() => void) | null = null
let flushHandlersInstalled = false

async function persistNow(doc: ResumeDoc): Promise<void> {
  const sync = useSyncStore.getState()
  try {
    await writeValue(DOC_KEY, doc)
    sync.setStorageMode('idb')
    sync.setStatus(navigator.onLine === false ? 'offline' : 'saved-local')
  } catch {
    sync.setStorageMode('memory')
    sync.setStatus('error')
  }
}

function scheduleWrite(doc: ResumeDoc): void {
  useSyncStore.getState().setStatus('saving')
  if (timer !== null) clearTimeout(timer)
  pendingDoc = doc
  timer = setTimeout(() => {
    timer = null
    const docToWrite = pendingDoc
    pendingDoc = null
    if (docToWrite !== null) void persistNow(docToWrite)
  }, AUTOSAVE_DEBOUNCE_MS)
}

// visibilitychange/pagehide tidak menunggu promise, jadi tulis sekarang juga
// tanpa menunda — itulah titik terakhir sebelum tab atau proses ditutup.
export function flushPendingWrite(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  const docToWrite = pendingDoc
  pendingDoc = null
  if (docToWrite !== null) void persistNow(docToWrite)
}

// Dipakai tombol retry di SaveStatusPill saat status 'error' (T2.3): tulis
// dokumen yang sedang aktif sekarang juga, tanpa menunggu perubahan berikutnya.
export function saveNow(): void {
  useSyncStore.getState().setStatus('saving')
  void persistNow(useDocStore.getState().doc)
}

export function startAutosave(): () => void {
  if (unsubscribe === null) {
    unsubscribe = useDocStore.subscribe((state, previous) => {
      if (state.doc !== previous.doc) scheduleWrite(state.doc)
    })
  }

  if (!flushHandlersInstalled && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingWrite()
    })
    window.addEventListener('pagehide', flushPendingWrite)
    flushHandlersInstalled = true
  }

  return () => {
    if (unsubscribe !== null) {
      unsubscribe()
      unsubscribe = null
    }
  }
}

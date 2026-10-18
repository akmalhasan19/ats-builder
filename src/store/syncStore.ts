import { create } from 'zustand'

// Label tiap status ada di dictionaries/id.ts ('status.*') sesuai P7.
export type SaveStatus = 'saved-local' | 'saving' | 'saved-cloud' | 'offline' | 'error'

export type SyncStore = {
  status: SaveStatus
  lastSyncedAt: number | null
  error: string | null
  // 'memory' = IndexedDB ditolak (mis. private mode): data tetap hidup di RAM
  // tetapi tidak tertulis ke perangkat, jadi banner jujur wajib tampil (T1.3).
  storageMode: 'idb' | 'memory'
  setStatus: (status: SaveStatus) => void
  setLastSyncedAt: (lastSyncedAt: number | null) => void
  setError: (error: string | null) => void
  setStorageMode: (storageMode: 'idb' | 'memory') => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'saved-local',
  lastSyncedAt: null,
  error: null,
  storageMode: 'idb',
  setStatus: (status) => set({ status }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setError: (error) => set({ error }),
  setStorageMode: (storageMode) => set({ storageMode }),
}))

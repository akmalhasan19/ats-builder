import { create } from 'zustand'
import { useSyncExternalStore } from 'react'
import type { HeightMap } from '@/features/preview/pagination'

/**
 * Tinggi blok hasil pengukuran DOM (T4.2). Disimpan di store supaya blok bisa
 * melapor lewat selector, bukan lewat prop — prop baru akan mematahkan memo.
 */
export type PreviewStore = {
  heights: HeightMap
  resetHeights: () => void
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  heights: {},

  resetHeights: () => set({ heights: {} }),
}))

// Satu ketikan bisa mengubah tinggi beberapa blok sekaligus (mis. bullet yang
// pindah baris). ResizeObserver melaporkan tiap elemen sendiri, dan setiap tulis
// langsung ke store berarti satu render tambahan — karena itu laporan ditampung
// dulu dan dikeluarkan sekali per frame.
let buffer = new Map<string, number>()
let frame: number | null = null

const flush = () => {
  frame = null
  const changes = buffer
  buffer = new Map()
  if (changes.size === 0) return
  usePreviewStore.setState((state) => {
    const heights = { ...state.heights }
    let changed = false
    for (const [key, value] of changes) {
      if (value > 0 && heights[key] !== value) {
        heights[key] = value
        changed = true
      }
    }
    return changed ? { heights } : state
  })
}

export function scheduleHeight(key: string, heightPx: number): void {
  buffer.set(key, heightPx)
  if (frame === null) frame = requestAnimationFrame(flush)
}

// T4.5 — teks di preview berubah instan karena tiap blok berlangganan potongannya
// sendiri; yang ditahan 60ms hanya pemecahan ulang halaman. Snapshot `settled`
// dibaca lewat useSyncExternalStore supaya satu ketikan tidak memicu render
// tambahan untuk tinggi yang belum dipakai.
const RELAYOUT_DEBOUNCE_MS = 60

let settled: HeightMap = usePreviewStore.getState().heights
const listeners = new Set<() => void>()
let settleTimer: ReturnType<typeof setTimeout> | null = null

usePreviewStore.subscribe((state) => {
  if (state.heights === settled) return
  if (settleTimer !== null) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settleTimer = null
    settled = state.heights
    for (const listener of listeners) listener()
  }, RELAYOUT_DEBOUNCE_MS)
})

const subscribeSettled = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSettledHeights = (): HeightMap =>
  useSyncExternalStore(
    subscribeSettled,
    () => settled,
    () => settled,
  )

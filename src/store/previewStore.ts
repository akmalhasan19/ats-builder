import { create } from 'zustand'
import { useSyncExternalStore } from 'react'
import type { HeightMap } from '@/features/preview/pagination'
import { useCanvasStore } from '@/store/canvasStore'

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

// Laporan tinggi yang ditahan selama sesi edit kanvas (D6).
let heldHeights = new Map<string, number>()

const releaseHeldHeights = () => {
  if (heldHeights.size === 0) return
  const pending = heldHeights
  heldHeights = new Map()
  for (const [key, value] of pending) buffer.set(key, value)
  if (frame === null) frame = requestAnimationFrame(flush)
}

export function scheduleHeight(key: string, heightPx: number): void {
  // D6 — selama sesi edit kanvas aktif, laporan tinggi ditahan: rencana
  // halaman membeku sehingga blok yang sedang diedit tidak berpindah halaman
  // (dan tidak unmount) saat user mengetik. Laporan yang ditahan dilepas
  // begitu sesi ditutup — pengukuran ulang & repaginasi berjalan normal
  // sesudah commit.
  if (useCanvasStore.getState().session !== null) {
    heldHeights.set(key, heightPx)
    return
  }
  buffer.set(key, heightPx)
  if (frame === null) frame = requestAnimationFrame(flush)
}

useCanvasStore.subscribe((state, prevState) => {
  if (prevState.session !== null && state.session === null) releaseHeldHeights()
})

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

import { useCallback, useEffect } from 'react'
import { docSignature } from './engine'
import { runAtsCheck } from './runCheck'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'

/**
 * T7.6 — pemeriksaan ulang otomatis menyala hanya setelah drawer pernah dibuka:
 * sebelum itu tidak ada yang melihat hasilnya, jadi tidak ada gunanya
 * menghabiskan CPU tiap ketikan.
 */

const RECHECK_DEBOUNCE_MS = 1500

export function useAtsAutoCheck(pageCount: number): void {
  const doc = useDocStore((state) => state.doc)
  const hasOpened = useAtsStore((state) => state.hasOpened)
  // QA Fase 9: `docSignature` adalah JSON.stringify seluruh dokumen. Dulu ia
  // dihitung tiap render meski drawer belum pernah dibuka — biaya yang sama
  // merogoh kocek CPU saat mengetik yang justru ingin dihemat.
  const signature = hasOpened ? docSignature(doc) : ''
  useEffect(() => {
    if (!hasOpened) return undefined
    const timer = window.setTimeout(() => void runAtsCheck(pageCount), RECHECK_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [signature, hasOpened, pageCount])
}

/** Buka drawer dan tandai bahwa hasil checker sudah pernah dilihat. */
export function useOpenAtsDrawer(): () => void {
  const setAtsDrawerOpen = useUiStore((state) => state.setAtsDrawerOpen)
  const setHasOpened = useAtsStore((state) => state.setHasOpened)
  return useCallback(() => {
    setHasOpened(true)
    setAtsDrawerOpen(true)
  }, [setAtsDrawerOpen, setHasOpened])
}

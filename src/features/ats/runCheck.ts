import { buildReport } from './engine'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'

/**
 * T7.6 — satu pintu eksekusi pemeriksaan. Dibaca langsung dari store supaya
 * tombol di drawer dan pemicu ulang otomatis memakai jalur yang sama.
 */

/** §5.5 — sapuan garis scan pada lembar A4. Status "memeriksa" ditahan selama ini
 *  supaya animasinya benar-benar terlihat, bukan sekadar satu frame. */
const SCAN_MS = 700

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export async function runAtsCheck(pageCount: number): Promise<void> {
  const ats = useAtsStore.getState()
  if (ats.isChecking) return
  ats.setChecking(true)
  const startedAt = Date.now()
  try {
    // Satu tick ke UI supaya status "sedang memeriksa" benar-benar terlihat
    // pada dokumen besar. Hasilnya tetap deterministik: hanya `checkedAt`
    // yang bergantung waktu.
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    const now = Date.now()
    const report = buildReport(useDocStore.getState().doc, pageCount, now)
    const store = useAtsStore.getState()
    store.setReport(report)
    store.setKeywords(report.keywords?.matched ?? [])
    store.setLastCheckedAt(now)
    useDocStore.getState().setLastCheckedAt(now)

    if (!prefersReducedMotion()) {
      const remaining = SCAN_MS - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
    }
  } finally {
    useAtsStore.getState().setChecking(false)
  }
}

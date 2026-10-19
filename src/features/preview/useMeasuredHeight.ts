import { useEffect, useRef } from 'react'
import { scheduleHeight } from '@/store/previewStore'

/**
 * Mengukur tinggi alami satu blok pada lebar konten (T4.2). `borderBoxSize`
 * dipakai karena ia melaporkan kotak layout sebelum `transform: scale()` zoom,
 * jadi hasil pengukuran tidak berubah saat pengguna mengganti zoom.
 *
 * Laporan pertama sengaja ditunda sampai setelah paint (dua frame): pembacaan
 * `offsetHeight` memaksa layout penuh dokumen; kalau ia jalan di efek mount,
 * paint pertama (FCP/LCP lembar A4) ikut tertunda. Rencana halaman pertama
 * memakai perkiraan `estimatePx`, lalu dikoreksi oleh ResizeObserver.
 */
export function useMeasuredHeight<T extends HTMLElement>(key: string) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const report = (heightPx: number) => scheduleHeight(key, heightPx)

    let frame2 = 0
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => report(element.offsetHeight))
    })
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const borderBox = entry.borderBoxSize?.[0]
      report(borderBox ? borderBox.blockSize : element.offsetHeight)
    })
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      observer.disconnect()
    }
  }, [key])

  return ref
}

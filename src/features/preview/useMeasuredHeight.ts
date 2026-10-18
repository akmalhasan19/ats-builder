import { useEffect, useRef } from 'react'
import { scheduleHeight } from '@/store/previewStore'

/**
 * Mengukur tinggi alami satu blok pada lebar konten (T4.2). `borderBoxSize`
 * dipakai karena ia melaporkan kotak layout sebelum `transform: scale()` zoom,
 * jadi hasil pengukuran tidak berubah saat pengguna mengganti zoom.
 */
export function useMeasuredHeight<T extends HTMLElement>(key: string) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const report = (heightPx: number) => scheduleHeight(key, heightPx)
    report(element.offsetHeight)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const borderBox = entry.borderBoxSize?.[0]
      report(borderBox ? borderBox.blockSize : element.offsetHeight)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [key])

  return ref
}

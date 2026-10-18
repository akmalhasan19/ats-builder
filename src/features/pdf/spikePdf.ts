import { buildSpikePdf } from '@/features/templates/pdf/SpikePdfLib'
import type { SpikeContent, SpikeRenderOptions } from '@/features/templates/spikeContent'

export type SpikePdfBlobResult = {
  blob: Blob
  bytes: number
  durationMs: number
  pageCount: number
}

/**
 * Modul ini sengaja hanya boleh dicapai lewat dynamic import, supaya pdf-lib,
 * fontkit, dan font TTF tidak pernah masuk bundle awal (§3 keputusan #4).
 */
export async function renderSpikePdfToBlob(
  content: SpikeContent,
  options: SpikeRenderOptions,
): Promise<SpikePdfBlobResult> {
  const startedAt = performance.now()

  const { bytes, pageCount } = await buildSpikePdf(content, options, async (file) => {
    const response = await fetch(`/fonts/${file}`)
    if (!response.ok) throw new Error(`font TTF gagal dimuat: ${file}`)
    return new Uint8Array(await response.arrayBuffer())
  })

  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  return {
    blob,
    bytes: blob.size,
    durationMs: Math.round(performance.now() - startedAt),
    pageCount,
  }
}

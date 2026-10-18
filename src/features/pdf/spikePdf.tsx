import { pdf } from '@react-pdf/renderer'
import { registerPdfFonts } from '@/features/pdf/fonts'
import { SpikeDocument } from '@/features/templates/pdf/SpikeDocument'
import type { SpikeContent, SpikeRenderOptions } from '@/features/templates/spikeContent'

registerPdfFonts((file) => `/fonts/${file}`)

export type SpikePdfResult = {
  blob: Blob
  bytes: number
  durationMs: number
}

/**
 * Modul ini sengaja hanya boleh dicapai lewat dynamic import, supaya
 * @react-pdf/renderer + font TTF tidak pernah masuk bundle awal (§3 keputusan #4).
 */
export async function renderSpikePdfToBlob(
  content: SpikeContent,
  options: SpikeRenderOptions,
): Promise<SpikePdfResult> {
  const startedAt = performance.now()
  const blob = await pdf(<SpikeDocument content={content} options={options} />).toBlob()
  return {
    blob,
    bytes: blob.size,
    durationMs: Math.round(performance.now() - startedAt),
  }
}

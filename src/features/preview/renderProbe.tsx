import type { ReactNode } from 'react'
import { Profiler } from 'react'

type RenderSink = { id: string; phase: string; duration: number }

/**
 * Pembuktian gate Fase 4 ("hanya blok itu yang re-render") memakai API React
 * Profiler sungguhan per blok. `onRender` hanya terpanggil untuk blok yang
 * ikut dirender, jadi daftar id yang muncul setelah satu keystroke adalah
 * bukti re-render, bukan perkiraan. Hanya aktif di dev (di build produksi
 * cabang ini di-DCE).
 */
const sink = (): RenderSink[] => {
  const host = window as unknown as { __atsPreviewRenders?: RenderSink[] }
  if (!host.__atsPreviewRenders) host.__atsPreviewRenders = []
  return host.__atsPreviewRenders
}

export const resetRenderProbe = (): void => {
  sink().length = 0
}

const recordRender = (
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
): void => {
  sink().push({ id, phase, duration: Math.round(actualDuration * 100) / 100 })
}

export function withRenderProbe(node: ReactNode, id: string): ReactNode {
  if (!import.meta.env.DEV) return node
  return (
    <Profiler id={id} onRender={recordRender}>
      {node}
    </Profiler>
  )
}

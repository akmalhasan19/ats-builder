import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { FIT_PAD_PX_CANVAS, MAX_ZOOM, MAX_ZOOM_CANVAS } from '@/features/preview/previewZoom'
import { A4_PX } from '@/lib/units'
import { paginationDoc } from '../fixtures/docs'

/**
 * FASE 13 — T2.1/T2.2/T2.3/T2.5 — perilaku zoom di mode kanvas layar penuh.
 *
 * Uji ini memakai komponen sungguhan (bukan fungsi murni) karena plafon
 * zoom, padding well, dan penghitungan ulang skala terjadi di dalam
 * `PreviewWell`.
 */

const renderWell = () =>
  render(
    <TooltipProvider>
      <PreviewWell />
    </TooltipProvider>,
  )

const probe = (name: string) => document.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const zoomValue = () => probe('zoom-value')?.textContent

/** Skala yang benar-benar dipakai pohon pratinjau. */
const scaleOf = () => {
  const style = probe('preview-content')?.getAttribute('style') ?? ''
  const match = /scale\(([\d.]+)\)/.exec(style)
  return match ? Number(match[1]) : null
}

const zoomIn = () => screen.getByRole('button', { name: 'Perbesar' })
const zoomOut = () => screen.getByRole('button', { name: 'Perkecil' })

/** Lebar well tiruan — jsdom tidak punya layout. */
const stubWellWidth = (width: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
}

const restoreWellWidth = () => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
}

beforeEach(() => {
  act(() => {
    usePreviewStore.getState().resetHeights()
    useDocStore.getState().loadDoc(paginationDoc('pendek'))
    useUiStore.setState({ editMode: 'form', fitMode: false, zoom: 1 })
  })
})

describe('T2.1 — plafon zoom mengikuti mode', () => {
  it('mode form: tombol perbesar mati di 150% (regresi nol)', () => {
    act(() => useUiStore.getState().setZoom(MAX_ZOOM))
    renderWell()
    expect(zoomIn()).toBeDisabled()
  })

  it('mode kanvas layar penuh: tombol perbesar masih hidup di 150%', () => {
    act(() => {
      useUiStore.getState().setEditMode('canvas')
      useUiStore.getState().setZoom(MAX_ZOOM)
    })
    renderWell()
    expect(zoomIn()).not.toBeDisabled()
  })

  it('mode kanvas layar penuh: tombol perbesar mati tepat di 200%', () => {
    act(() => {
      useUiStore.getState().setEditMode('canvas')
      useUiStore.getState().setZoom(MAX_ZOOM_CANVAS)
    })
    renderWell()
    expect(zoomIn()).toBeDisabled()
    expect(zoomOut()).not.toBeDisabled()
  })

  it('perbesar di mode kanvas bisa melewati 150% menuju plafon 200%', async () => {
    const user = userEvent.setup()
    act(() => {
      useUiStore.getState().setEditMode('canvas')
      useUiStore.getState().setZoom(1.5)
    })
    renderWell()

    await user.click(zoomIn())
    expect(useUiStore.getState().zoom).toBeCloseTo(1.6, 5)
    expect(zoomValue()).toBe('160%')
  })

  it('mode kanvas: zoom 190% tidak dipotong plafon 150%', () => {
    act(() => {
      useUiStore.getState().setEditMode('canvas')
      useUiStore.getState().setZoom(1.9)
    })
    renderWell()
    expect(zoomValue()).toBe('190%')
  })
})

describe('T2.2 — skala fit memakai plafon mode yang aktif', () => {
  it('mode form mentok di 150%, mode kanvas lanjut sampai 200%', () => {
    stubWellWidth(2000)
    try {
      act(() => useUiStore.getState().setFitMode(true))
      const { unmount } = renderWell()
      expect(scaleOf()).toBeCloseTo(MAX_ZOOM, 4)
      unmount()

      act(() => useUiStore.getState().setEditMode('canvas'))
      renderWell()
      expect(scaleOf()).toBeCloseTo(MAX_ZOOM_CANVAS, 4)
    } finally {
      restoreWellWidth()
    }
  })

  it('berganti ke mode kanvas menghitung ulang skala, bukan memakai angka lama', () => {
    stubWellWidth(2000)
    try {
      act(() => useUiStore.getState().setFitMode(true))
      renderWell()
      expect(scaleOf()).toBeCloseTo(MAX_ZOOM, 4)

      act(() => useUiStore.getState().setEditMode('canvas'))
      expect(scaleOf()).toBeCloseTo(MAX_ZOOM_CANVAS, 4)
    } finally {
      restoreWellWidth()
    }
  })

  it('skala fit mengikuti padding well yang sebenarnya (bukan angka hardcode)', () => {
    stubWellWidth(1440)
    try {
      act(() => {
        useUiStore.getState().setFitMode(true)
        useUiStore.getState().setEditMode('canvas')
      })
      const { container } = renderWell()
      const well = container.querySelector<HTMLElement>('#pane-preview')!
      // Well mode kanvas memakai `lg:p-10` → 40px kiri + 40px kanan.
      well.style.paddingLeft = '40px'
      well.style.paddingRight = '40px'

      act(() => useUiStore.getState().setFitMode(false))
      act(() => useUiStore.getState().setFitMode(true))

      expect(scaleOf()).toBeCloseTo((1440 - FIT_PAD_PX_CANVAS) / A4_PX.w, 4)
    } finally {
      restoreWellWidth()
    }
  })
})

describe('T2.3 — ruang di sekitar kertas', () => {
  it('mode kanvas memakai padding lega `lg:p-10`; mode form tetap `p-6`', () => {
    const { container, unmount } = renderWell()
    const well = container.querySelector<HTMLElement>('#pane-preview')!
    expect(well.className).toContain('p-6')
    expect(well.className).not.toContain('lg:p-10')
    unmount()

    act(() => useUiStore.getState().setEditMode('canvas'))
    const { container: canvasContainer } = renderWell()
    const canvasWell = canvasContainer.querySelector<HTMLElement>('#pane-preview')!
    expect(canvasWell.className).toContain('p-6')
    expect(canvasWell.className).toContain('lg:p-10')
  })
})

describe('T2.5 — preset zoom di popover nilai zoom', () => {
  const openZoomPopover = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(probe('zoom-value')!)
    const content = document.querySelector<HTMLElement>('[data-slot="popover-content"]')
    expect(content).not.toBeNull()
    return content as HTMLElement
  }

  it('mode kanvas menampilkan preset 125% dan 150%', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    const content = await openZoomPopover(user)
    expect(within(content).getByRole('button', { name: '125%' })).toBeInTheDocument()
    expect(within(content).getByRole('button', { name: '150%' })).toBeInTheDocument()
  })

  it('mode form tetap tiga preset (tanpa 125% & 150%)', async () => {
    const user = userEvent.setup()
    renderWell()

    const content = await openZoomPopover(user)
    expect(within(content).getByRole('button', { name: '50%' })).toBeInTheDocument()
    expect(within(content).queryByRole('button', { name: '125%' })).toBeNull()
    expect(within(content).queryByRole('button', { name: '150%' })).toBeNull()
  })
})

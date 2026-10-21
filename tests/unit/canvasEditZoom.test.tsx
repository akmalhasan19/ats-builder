import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import {
  EDIT_ZOOM,
  applyEditZoom,
  capturePreviewZoom,
  centerFocusPoint,
  isNarrowLayout,
  measureFocusPoint,
  restorePreviewZoom,
  startCanvasEdit,
} from '@/features/canvas/canvasEditZoom'
import { useCanvasEditFocus } from '@/features/canvas/useCanvasEditFocus'
import { useCanvasStore } from '@/store/canvasStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'

/**
 * Addendum FASE 13 — zoom edit di layar sempit.
 *
 * Yang diuji:
 *  1. titik fokus diukur dalam **koordinat kertas** (tidak ikut berubah saat
 *     zoom), dengan sumbu horizontal = tengah teks & sumbu vertikal = tepi atas;
 *  2. di layar sempit skala naik ke 75% dan zoom ringkasan disimpan;
 *  3. sesi ditutup → zoom kembali ke nilai ringkasan (kecuali user mengubah
 *     zoom sendiri selama sesi);
 *  4. pemusatan horizontal: field yang diedit berakhir di tengah well.
 */

vi.mock('sonner', () => ({ toast: vi.fn() }))

/** Pohon pratinjau tiruan: well → lapisan gulir → konten → segmen. */
const buildTree = (scale: number) => {
  const well = document.createElement('section')
  well.id = 'pane-preview'
  const scroller = document.createElement('div')
  scroller.setAttribute('data-probe', 'preview-scroll')
  const content = document.createElement('div')
  content.setAttribute('data-probe', 'preview-content')
  const field = document.createElement('button')
  field.setAttribute('data-field', 'profile.fullName')
  content.append(field)
  scroller.append(content)
  well.append(scroller)
  document.body.append(well)

  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  })

  // Skala 0,5: konten 397px (794 × 0,5) mulai di x=24; segmen mulai di
  // x=58 (= 24 + 68 × 0,5) dan lebar 50 (= 100 × 0,5).
  content.getBoundingClientRect = () => rect(24, 100, 794 * scale, 500)
  field.getBoundingClientRect = () => rect(24 + 68 * scale, 120, 100 * scale, 10)
  well.getBoundingClientRect = () => rect(0, 0, 412, 800)

  return { well, scroller, content, field }
}

/** Skala efektif pohon pratinjau (matriks transform). */
const stubScale = (scale: number) => {
  const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    transform: `matrix(${scale}, 0, 0, ${scale}, 0, 0)`,
    borderLeftWidth: '0px',
    borderTopWidth: '0px',
  } as CSSStyleDeclaration)
  return () => spy.mockRestore()
}

/** `scrollLeft` di jsdom tidak menggulir apa pun — rekam nilainya. */
const stubScrollLeft = (element: HTMLElement) => {
  const written: number[] = []
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => written[written.length - 1] ?? 0,
    set: (value: number) => {
      written.push(value)
    },
  })
  return written
}

/** Harness minimal untuk hook lifecycle sesi. */
function Harness() {
  useCanvasEditFocus()
  return null
}

beforeEach(() => {
  act(() => {
    useUiStore.setState({ panelMode: 'tabs', zoom: 0.3, fitMode: false })
    useCanvasStore.setState({
      session: null,
      modeHintSeen: false,
      zoomRaised: false,
      focusPoint: null,
      preEditZoom: null,
    })
  })
  vi.mocked(toast).mockReset()
  document.body.innerHTML = ''
})

describe('layar sempit sebagai penentu perilaku', () => {
  it('panel mode tabs (<1024px) = sempit; 3col/icon-rail = lebar', () => {
    act(() => useUiStore.setState({ panelMode: 'tabs' }))
    expect(isNarrowLayout()).toBe(true)
    act(() => useUiStore.setState({ panelMode: 'icon-rail' }))
    expect(isNarrowLayout()).toBe(false)
    act(() => useUiStore.setState({ panelMode: '3col' }))
    expect(isNarrowLayout()).toBe(false)
  })
})

describe('titik fokus di koordinat kertas', () => {
  it('sumbu horizontal = tengah segmen, sumbu vertikal = tepi atas', () => {
    const restore = stubScale(0.5)
    const { field } = buildTree(0.5)

    const point = measureFocusPoint(field)

    // x: tengah segmen (58 + 25 = 83) diukur dari tepi konten (24) → 59 / 0,5 = 118.
    expect(point?.x).toBeCloseTo(118, 5)
    // y: tepi atas segmen (120) dari tepi konten (100) → 20 / 0,5 = 40.
    expect(point?.y).toBeCloseTo(40, 5)
    restore()
  })

  it('elemen di luar kertas (tanpa isi) tidak punya titik fokus', () => {
    const restore = stubScale(0.5)
    const orphan = document.createElement('button')
    expect(measureFocusPoint(orphan)).toBeNull()
    expect(measureFocusPoint(null)).toBeNull()
    restore()
  })
})

describe('zoom edit di layar sempit', () => {
  it('skala di bawah 75% naik ke 75% dan zoom ringkasan disimpan', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })

    expect(useUiStore.getState().zoom).toBe(EDIT_ZOOM)
    expect(useUiStore.getState().fitMode).toBe(false)
    expect(useCanvasStore.getState().preEditZoom?.before).toEqual({ zoom: 0.3, fitMode: false })
    // Tanpa toast di layar sempit: toast mobile duduk tepat di atas field
    // yang sedang diedit (lihat `canvasEditZoom.ts`).
    expect(toast).not.toHaveBeenCalled()
    restore()
  })

  it('skala yang sudah lebih besar tidak dikecilkan', () => {
    const restore = stubScale(0.9)
    const { field } = buildTree(0.9)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })

    expect(useUiStore.getState().zoom).toBe(0.3)
    expect(toast).not.toHaveBeenCalled()
    restore()
  })

  it('desktop memakai guard lama (D7), bukan zoom edit', () => {
    const restore = stubScale(0.5)
    act(() => useUiStore.setState({ panelMode: '3col' }))
    const { field } = buildTree(0.5)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })

    // D7: naik ke 75% sekali saja per sesi aplikasi, dan tidak dikembalikan.
    expect(useUiStore.getState().zoom).toBe(0.75)
    expect(useCanvasStore.getState().preEditZoom).toBeNull()
    expect(toast).toHaveBeenCalledWith(t('canvas.zoomRaised'))
    restore()
  })

  it('toast zoom edit tidak pernah muncul di layar sempit', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
      applyEditZoom(field)
    })

    expect(toast).not.toHaveBeenCalled()
    restore()
  })
})

describe('kembali ke zoom ringkasan', () => {
  it('sesi ditutup → zoom kembali ke nilai sebelum edit', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })
    expect(useUiStore.getState().zoom).toBe(EDIT_ZOOM)

    act(() => restorePreviewZoom())

    expect(useUiStore.getState().zoom).toBe(0.3)
    expect(useCanvasStore.getState().preEditZoom).toBeNull()
    restore()
  })

  it('mode Fit juga dikembalikan', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)
    act(() => useUiStore.setState({ zoom: 1, fitMode: true }))

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })
    act(() => restorePreviewZoom())

    expect(useUiStore.getState().fitMode).toBe(true)
    expect(useUiStore.getState().zoom).toBe(1)
    restore()
  })

  it('zoom yang diubah user sendiri during sesi tidak ditimpa', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })
    // User menekan tombol +/− saat sesi masih terbuka.
    act(() => useUiStore.getState().setZoom(1))

    act(() => restorePreviewZoom())

    expect(useUiStore.getState().zoom).toBe(1)
    restore()
  })

  it('desktop tidak pernah memulihkan zoom', () => {
    const restore = stubScale(0.5)
    act(() => useUiStore.setState({ panelMode: '3col' }))
    const { field } = buildTree(0.5)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
    })
    act(() => restorePreviewZoom())

    expect(useUiStore.getState().zoom).toBe(0.75)
    restore()
  })
})

describe('hook lifecycle sesi (useCanvasEditFocus)', () => {
  it('sesi ditutup → zoom kembali ke ringkasan', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)
    render(<Harness />)

    act(() => {
      capturePreviewZoom()
      applyEditZoom(field)
      useCanvasStore.getState().openSession({
        blockKey: 'profile:fullName',
        sectionId: 'profile',
        fieldPath: 'profile.fullName',
        kind: 'input',
      })
    })
    expect(useUiStore.getState().zoom).toBe(EDIT_ZOOM)

    act(() => useCanvasStore.getState().closeSession())

    expect(useUiStore.getState().zoom).toBe(0.3)
    restore()
  })
})

describe('satu pintu masuk sesi edit', () => {
  it('startCanvasEdit: ukur titik fokus, naikkan zoom, lalu buka sesi', () => {
    const restore = stubScale(0.3)
    const { field } = buildTree(0.3)

    act(() => {
      startCanvasEdit(field, {
        blockKey: 'profile:fullName',
        sectionId: 'profile',
        fieldPath: 'profile.fullName',
        kind: 'input',
      })
    })

    expect(useCanvasStore.getState().session?.fieldPath).toBe('profile.fullName')
    expect(useCanvasStore.getState().focusPoint?.x).toBeCloseTo(118, 5)
    expect(useUiStore.getState().zoom).toBe(EDIT_ZOOM)
    restore()
  })
})

describe('pemusatan horizontal', () => {
  it('segmen digeser ke tengah well', () => {
    const restore = stubScale(0.5)
    const { well, scroller, field } = buildTree(0.5)
    const written = stubScrollLeft(scroller)
    Object.defineProperty(well, 'clientWidth', { configurable: true, value: 412 })
    Object.defineProperty(well, 'clientHeight', { configurable: true, value: 800 })

    const point = measureFocusPoint(field)
    act(() => centerFocusPoint(point))

    // Titik fokus: x=118 (kartu) → 59 px pada skala 0,5 → layar 24+59 = 83.
    // Tengah well = 412 / 2 = 206 → konten harus bergeser 123 px ke kanan,
    // artinya `scrollLeft` berkurang 123 (gulir ke kiri).
    expect(written[written.length - 1]).toBeCloseTo(-123, 5)
    restore()
  })

  it('tanpa titik fokus tidak ada yang digeser', () => {
    const restore = stubScale(0.5)
    const { scroller } = buildTree(0.5)
    const written = stubScrollLeft(scroller)

    act(() => centerFocusPoint(null))

    expect(written).toHaveLength(0)
    restore()
  })
})

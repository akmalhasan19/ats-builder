import { act, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { ScanSweep } from '@/features/preview/ScanSweep'
import { resetRenderProbe, withRenderProbe } from '@/features/preview/renderProbe'
import { useMeasuredHeight } from '@/features/preview/useMeasuredHeight'
import { usePreviewPrefs } from '@/features/preview/usePreviewPrefs'
import { blockFootprintPx, type DocBlock } from '@/features/preview/pagination'
import { PREFS_KEY, readValue, writeValue } from '@/features/persistence/idb'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { paginationDoc } from '../fixtures/docs'
import { sampleResume } from '../fixtures/sampleResume'

type IdbModule = {
  DOC_KEY: string
  PREFS_KEY: string
  readValue: <T>(key: string) => Promise<T | undefined>
  writeValue: (key: string, value: unknown) => Promise<void>
}

vi.mock('@/features/persistence/idb', async (importOriginal) => {
  const actual = await importOriginal<IdbModule>()
  return {
    ...actual,
    readValue: vi.fn(async () => undefined),
    writeValue: vi.fn(async () => undefined),
  }
})

/**
 * T9.x — cabang preview yang belum tertutup `tests/unit/preview.test.tsx`:
 * pengukuran tinggi blok (ResizeObserver pendaftaran/pelepasan + fallback
 * `estimatePx`), preferensi preview ke IndexedDB, sapuan garis scan, dan
 * cabang `import.meta.env.DEV` pada render probe.
 */

type Frame = { id: number; cb: FrameRequestCallback }

function stubFrames(): { pump: (times?: number) => void; pending: () => number } {
  const queue: Frame[] = []
  let nextId = 1
  const cancel = vi.fn((id: number) => {
    const index = queue.findIndex((frame) => frame.id === id)
    if (index >= 0) queue.splice(index, 1)
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++
    queue.push({ id, cb })
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', cancel)
  return {
    pending: () => queue.length,
    pump: (times = 1) => {
      for (let frame = 0; frame < times; frame += 1) {
        const batch = queue.splice(0, queue.length)
        if (batch.length === 0) return
        for (const item of batch) item.cb(item.id)
      }
    },
  }
}

type ObserverSpy = {
  observe: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  emit: (entries: Partial<ResizeObserverEntry>[]) => void
}

function stubResizeObserver(): { built: () => ObserverSpy[] } {
  const created: ObserverSpy[] = []
  const callbackOf = new WeakMap<object, ResizeObserverCallback>()
  class ResizeObserverSpy {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()

    constructor(callback: ResizeObserverCallback) {
      callbackOf.set(this, callback)
      created.push({
        observe: this.observe,
        unobserve: this.unobserve,
        disconnect: this.disconnect,
        emit: (entries) => callback(entries as ResizeObserverEntry[], this),
      })
    }
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverSpy)
  return { built: () => created }
}

const measuredBlock = (key: string, estimatePx: number): DocBlock => ({
  key,
  kind: 'entry-line',
  sectionKind: 'experience',
  sectionId: 's1',
  padAfterMm: 0,
  estimatePx,
  minWithNext: 0,
})

function Measured({ blockKey }: { blockKey: string }) {
  const ref = useMeasuredHeight<HTMLDivElement>(blockKey)
  return (
    <div ref={ref} data-probe="measured">
      isi blok
    </div>
  )
}

function Unattached() {
  const ref = useMeasuredHeight<HTMLDivElement>('kunci-tanpa-elemen')
  void ref
  return <div data-probe="tanpa-ref" />
}

beforeEach(() => {
  useDocStore.getState().loadDoc(sampleResume())
  usePreviewStore.getState().resetHeights()
  useAtsStore.setState({
    report: null,
    isChecking: false,
    hasOpened: true,
    lastCheckedAt: null,
    keywords: [],
  })
  useUiStore.setState({
    zoom: 1,
    fitMode: true,
    showMarginGuides: true,
    showKeywordMarks: true,
    editMode: 'form',
    panelMode: '3col',
    activeTab: 'preview',
    atsDrawerOpen: false,
    atsTab: 'issues',
  })
  vi.mocked(readValue).mockReset()
  vi.mocked(readValue).mockResolvedValue(undefined)
  vi.mocked(writeValue).mockReset()
  vi.mocked(writeValue).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('useMeasuredHeight — ResizeObserver & fallback estimatePx', () => {
  it('mendaftarkan observer, menunda laporan ke frame ke-2, lalu melepasnya saat unmount', () => {
    const frames = stubFrames()
    const observers = stubResizeObserver()
    const { unmount } = render(<Measured blockKey="blok-a" />)
    const element = document.querySelector<HTMLElement>('[data-probe="measured"]')
    if (!element) throw new Error('elemen terukur tidak dirender')
    Object.defineProperty(element, 'offsetHeight', { value: 137, configurable: true })

    const first = observers.built()[0]
    if (!first) throw new Error('ResizeObserver tidak dibuat')
    expect(first.observe).toHaveBeenCalledWith(element)
    expect(first.disconnect).not.toHaveBeenCalled()
    // Laporan pertama sengaja ditunda: paint pertama tidak menunggu layout.
    expect(usePreviewStore.getState().heights['blok-a']).toBeUndefined()

    frames.pump(1)
    expect(usePreviewStore.getState().heights['blok-a']).toBeUndefined()
    frames.pump(1)
    frames.pump(1)
    expect(usePreviewStore.getState().heights['blok-a']).toBe(137)
    expect(measuredBlock('blok-a', 24).estimatePx).toBe(24)

    unmount()
    expect(first.disconnect).toHaveBeenCalledTimes(1)
  })

  it('borderBoxSize dipakai saat tersedia; entries kosong diabaikan; tanpa borderBox → offsetHeight', () => {
    const frames = stubFrames()
    const observers = stubResizeObserver()
    render(<Measured blockKey="blok-b" />)
    const element = document.querySelector<HTMLElement>('[data-probe="measured"]')
    if (!element) throw new Error('elemen terukur tidak dirender')
    Object.defineProperty(element, 'offsetHeight', { value: 200, configurable: true })
    frames.pump(3)
    expect(usePreviewStore.getState().heights['blok-b']).toBe(200)

    const spy = observers.built()[0]
    if (!spy) throw new Error('observer hilang')
    spy.emit([{ borderBoxSize: [{ blockSize: 312, inlineSize: 794 }] }])
    frames.pump(2)
    expect(usePreviewStore.getState().heights['blok-b']).toBe(312)

    // Tidak ada entry sama sekali → tidak ada laporan, tinggi lama bertahan.
    spy.emit([])
    frames.pump(2)
    expect(usePreviewStore.getState().heights['blok-b']).toBe(312)

    // Entry tanpa `borderBoxSize` → fallback `offsetHeight` elemen.
    Object.defineProperty(element, 'offsetHeight', { value: 96, configurable: true })
    spy.emit([{}])
    frames.pump(2)
    expect(usePreviewStore.getState().heights['blok-b']).toBe(96)
  })

  it('kunci baru → observer lama dilepas & cancelAnimationFrame dipanggil', () => {
    const frames = stubFrames()
    const observers = stubResizeObserver()
    const { rerender } = render(<Measured blockKey="blok-c" />)
    const oldSpy = observers.built()[0]
    if (!oldSpy) throw new Error('observer lama hilang')

    rerender(<Measured blockKey="blok-d" />)
    expect(oldSpy.disconnect).toHaveBeenCalledTimes(1)
    expect(observers.built()).toHaveLength(2)
    expect(frames.pending()).toBeGreaterThan(0)

    const element = document.querySelector<HTMLElement>('[data-probe="measured"]')
    if (!element) throw new Error('elemen terukur tidak dirender')
    Object.defineProperty(element, 'offsetHeight', { value: 145, configurable: true })
    frames.pump(3)
    expect(usePreviewStore.getState().heights['blok-d']).toBe(145)
    expect(frames.pending()).toBe(0)
  })

  it('ref tidak terpasang → tidak ada observer sama sekali (tanpa melempar)', () => {
    const frames = stubFrames()
    const observers = stubResizeObserver()
    const { container } = render(<Unattached />)
    expect(observers.built()).toHaveLength(0)
    expect(frames.pending()).toBe(0)
    expect(container.querySelector('[data-probe="tanpa-ref"]')).not.toBeNull()
    expect(usePreviewStore.getState().heights['kunci-tanpa-elemen']).toBeUndefined()
  })

  it('tinggi terukur menggantikan perkiraan dalam rencana halaman', () => {
    const frames = stubFrames()
    stubResizeObserver()
    render(<Measured blockKey="header" />)
    const element = document.querySelector<HTMLElement>('[data-probe="measured"]')
    if (!element) throw new Error('elemen terukur tidak dirender')
    Object.defineProperty(element, 'offsetHeight', { value: 480, configurable: true })

    const block = measuredBlock('header', 120)
    expect(blockFootprintPx(block, {})).toBe(120)
    expect(blockFootprintPx(block, usePreviewStore.getState().heights)).toBe(120)

    frames.pump(3)
    const heights = usePreviewStore.getState().heights
    expect(heights['header']).toBe(480)
    expect(blockFootprintPx(block, heights)).toBe(480)
  })
})

describe('usePreviewPrefs — simpan/pulihkan preferensi (ats:prefs:v1)', () => {
  it('memuat kelima preferensi dari IndexedDB saat mount', async () => {
    vi.mocked(readValue).mockResolvedValue({
      zoom: 1.5,
      fitMode: false,
      showMarginGuides: false,
      showKeywordMarks: false,
      editMode: 'canvas',
    })
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => {
      const state = useUiStore.getState()
      expect(state.zoom).toBe(1.5)
      expect(state.fitMode).toBe(false)
      expect(state.showMarginGuides).toBe(false)
      expect(state.showKeywordMarks).toBe(false)
      expect(state.editMode).toBe('canvas')
    })
    expect(readValue).toHaveBeenCalledWith(PREFS_KEY)
    unmount()
  })

  it('nilai cacat diabaikan (tipe berbeda) → default sesi tetap dipakai', async () => {
    vi.mocked(readValue).mockResolvedValue({
      zoom: '1.5',
      fitMode: 'ya',
      showMarginGuides: false,
      editMode: 'kanvas',
      // showKeywordMarks hilang sama sekali
    })
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(useUiStore.getState().showMarginGuides).toBe(false))
    expect(useUiStore.getState().zoom).toBe(1)
    expect(useUiStore.getState().fitMode).toBe(true)
    expect(useUiStore.getState().showKeywordMarks).toBe(true)
    expect(useUiStore.getState().editMode).toBe('form')
    unmount()
  })

  it('belum ada preferensi tersimpan → tidak mengubah apa pun & tidak menulis', async () => {
    vi.mocked(readValue).mockResolvedValue(undefined)
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(readValue).toHaveBeenCalledTimes(1))
    expect(useUiStore.getState().zoom).toBe(1)
    expect(writeValue).not.toHaveBeenCalled()
    unmount()
  })

  it('IndexedDB menolak → diam saja, sesi berlanjut dan still menulis setelahnya', async () => {
    vi.mocked(readValue).mockRejectedValue(new Error('IndexedDB rusak'))
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(readValue).toHaveBeenCalledTimes(1))
    expect(useUiStore.getState().zoom).toBe(1)
    await act(async () => {
      useUiStore.getState().setZoom(0.75)
    })
    await waitFor(() => expect(writeValue).toHaveBeenCalled())
    expect(vi.mocked(writeValue).mock.calls.at(-1)?.[0]).toBe(PREFS_KEY)
    expect(vi.mocked(writeValue).mock.calls.at(-1)?.[1]).toEqual({
      zoom: 0.75,
      fitMode: true,
      showMarginGuides: true,
      showKeywordMarks: true,
      editMode: 'form',
    })
    unmount()
  })

  it('menyimpan setiap perubahan zoom/fit/margin/highlighter', async () => {
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(readValue).toHaveBeenCalledTimes(1))

    await act(async () => {
      useUiStore.getState().setFitMode(false)
    })
    await act(async () => {
      useUiStore.getState().setShowMarginGuides(false)
    })
    await act(async () => {
      useUiStore.getState().setShowKeywordMarks(false)
    })
    await act(async () => {
      useUiStore.getState().setZoom(2)
    })

    const saved = vi.mocked(writeValue).mock.calls.map((call) => call[1])
    expect(saved.at(-1)).toEqual({
      zoom: 2,
      fitMode: false,
      showMarginGuides: false,
      showKeywordMarks: false,
      editMode: 'form',
    })
    expect(writeValue).toHaveBeenCalledWith(PREFS_KEY, saved.at(-1))
    unmount()
  })

  it('tulis gagal (kuota penuh) tidak melempar ke UI', async () => {
    vi.mocked(writeValue).mockRejectedValue(new Error('QuotaExceededError'))
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(readValue).toHaveBeenCalledTimes(1))
    await expect(
      act(async () => {
        useUiStore.getState().setZoom(1.25)
      }),
    ).resolves.toBeUndefined()
    expect(writeValue).toHaveBeenCalled()
    expect(useUiStore.getState().zoom).toBe(1.25)
    unmount()
  })

  it('unmount sebelum muatan selesai → hasil dibuang (tidak menimpa sesi)', async () => {
    let release: (value: unknown) => void = () => undefined
    vi.mocked(readValue).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const { unmount } = renderHook(() => usePreviewPrefs())
    unmount()
    await act(async () => {
      release({ zoom: 3, fitMode: false })
      await Promise.resolve()
    })
    expect(useUiStore.getState().zoom).toBe(1)
    expect(useUiStore.getState().fitMode).toBe(true)
  })
})

describe('ScanSweep §5.5', () => {
  it('satu sapuan: aria-hidden, pointer-events mati, dua garis di dalam lembar', () => {
    const { container } = render(<ScanSweep />)
    const sweep = container.querySelector<HTMLElement>('[data-probe="scan-sweep"]')
    if (!sweep) throw new Error('scan sweep tidak dirender')
    expect(sweep.getAttribute('aria-hidden')).toBe('true')
    expect(sweep.className).toContain('pointer-events-none')
    expect(sweep.className).toContain('ats-scan-sweep')
    expect(sweep.children).toHaveLength(2)
    expect(sweep.children[0]?.className).toContain('bg-gradient-to-b')
    expect(sweep.children[1]?.className).toContain('bg-accent')
  })

  it('hanya muncul saat pemeriksaan berjalan, di dalam pembungkus lembar', async () => {
    act(() => {
      usePreviewStore.getState().resetHeights()
      useDocStore.getState().loadDoc(paginationDoc('pendek'))
    })
    const idle = render(
      <TooltipProvider>
        <PreviewWell />
      </TooltipProvider>,
    )
    expect(idle.container.querySelector('[data-probe="scan-sweep"]')).toBeNull()

    useAtsStore.setState({ isChecking: true })
    await waitFor(() => {
      const sweep = document.querySelector('[data-probe="scan-sweep"]')
      expect(sweep).not.toBeNull()
      expect(sweep?.parentElement?.querySelector('[data-probe="preview-content"]')).not.toBeNull()
    })

    useAtsStore.setState({ isChecking: false })
    await waitFor(() => {
      expect(document.querySelector('[data-probe="scan-sweep"]')).toBeNull()
    })
    idle.unmount()
  })
})

describe('renderProbe — hanya aktif di dev', () => {
  type Sink = { id: string; phase: string; duration: number }
  const reads = (): Sink[] =>
    (window as unknown as { __atsPreviewRenders?: Sink[] }).__atsPreviewRenders ?? []

  it('DEV benar → dibungkus Profiler dan render tercatat', async () => {
    vi.stubEnv('DEV', true)
    resetRenderProbe()
    const { container } = render(
      <div>{withRenderProbe(<span data-probe="probed">isi</span>, 'blok-probe')}</div>,
    )
    expect(container.querySelector('[data-probe="probed"]')?.textContent).toBe('isi')
    await waitFor(() => {
      expect(reads().some((entry) => entry.id === 'blok-probe' && entry.phase === 'mount')).toBe(
        true,
      )
    })
    const record = reads().find((entry) => entry.id === 'blok-probe')
    expect(record?.duration).toBeTypeOf('number')

    resetRenderProbe()
    expect(reads()).toHaveLength(0)
  })

  it('DEV salah (build produksi) → node dikembalikan apa adanya, tanpa Profiler', async () => {
    vi.stubEnv('DEV', false)
    resetRenderProbe()
    const { container } = render(
      <div>
        {withRenderProbe(<span data-probe="probed">isi produksi</span>, 'blok-probe-prod')}
      </div>,
    )
    expect(container.querySelector('[data-probe="probed"]')?.textContent).toBe('isi produksi')
    await waitFor(() => {
      expect(reads().filter((entry) => entry.id === 'blok-probe-prod')).toHaveLength(0)
    })
  })
})

describe('toolbar preview memakai preferensi yang dipulihkan', () => {
  it('zoom 150% tersimpan → lembar dirender dengan skala yang sama', async () => {
    vi.mocked(readValue).mockResolvedValue({ zoom: 1.5, fitMode: false })
    act(() => {
      usePreviewStore.getState().resetHeights()
      useDocStore.getState().loadDoc(paginationDoc('pendek'))
    })
    const { container } = render(
      <TooltipProvider>
        <PreviewWell />
      </TooltipProvider>,
    )
    await waitFor(() => expect(useUiStore.getState().zoom).toBe(1.5))
    expect(useUiStore.getState().fitMode).toBe(false)
    const style = container.querySelector('[data-probe="preview-content"]')?.getAttribute('style')
    expect(style).toContain('scale(1.5)')
    expect(container.querySelector('[data-probe="zoom-value"]')?.textContent).toBe('150%')
    expect(writeValue).toHaveBeenCalledWith(
      PREFS_KEY,
      expect.objectContaining({ zoom: 1.5, fitMode: false }),
    )
  })
})

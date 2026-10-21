import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CanvasExitButton } from '@/app/shell/CanvasExitButton'
import { CanvasSectionMenu } from '@/app/shell/CanvasSectionMenu'
import { StickyActionBar } from '@/app/shell/StickyActionBar'
import { TampilanMenu } from '@/app/shell/TampilanMenu'
import { useCanvasFull, useCanvasFullscreen } from '@/app/useCanvasFull'
import { AtsDockSlot, AtsOverlay } from '@/features/ats/components/AtsDrawer'
import { ATS_DOCK_MIN, atsDockedFor } from '@/features/ats/useAtsDock'
import { PREFS_KEY, readValue, writeValue } from '@/features/persistence/idb'
import { usePreviewPrefs } from '@/features/preview/usePreviewPrefs'
import { sectionRegistry } from '@/features/sections/registry'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { sampleResume } from '../fixtures/sampleResume'

/**
 * FASE 13 — Fase 3 — jalan keluar & kontrol yang hilang bersama rail:
 * preferensi `canvasFullscreen` (T3.1), toggle di menu Tampilan (T3.2),
 * tombol keluar (T3.3), menu "Bagian" pengganti rail (T3.4, D12), dan
 * drawer ATS yang menjadi lapisan di mode kanvas (T3.5, D9).
 *
 * Selektor memakai `data-probe` / role / teks kamus (konvensi repo).
 */

type IdbModule = {
  DOC_KEY: string
  PREFS_KEY: string
  FIRST_RUN_KEY: string
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

const DOCK_QUERY = `(min-width: ${ATS_DOCK_MIN}px)`

/** Stub `matchMedia` sederhana: satu nilai awal untuk query dock ATS. */
function stubDockMedia(matches: boolean) {
  const impl = (query: string) => ({
    media: query,
    matches: query === DOCK_QUERY ? matches : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  })
  vi.stubGlobal('matchMedia', impl)
}

const probe = (name: string, root: ParentNode = document): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const popover = (): HTMLElement => {
  const content = document.querySelector<HTMLElement>('[data-slot="popover-content"]')
  expect(content, 'popover tidak terbuka').not.toBeNull()
  return content as HTMLElement
}

/** Label bagian urutan ke-`i` di dokumen, sama seperti yang dibaca menu. */
const sectionLabel = (index: number): string => {
  const section = useDocStore.getState().doc.sections[index]!
  return t(sectionRegistry[section.kind].labelId)
}

const kindOf = (index: number) => useDocStore.getState().doc.sections[index]!.kind

beforeEach(() => {
  useDocStore.getState().loadDoc(sampleResume())
  useUiStore.setState({
    editMode: 'form',
    canvasFullscreen: true,
    panelMode: '3col',
    activeTab: 'form',
    sectionCatalogOpen: false,
    atsDrawerOpen: true,
    showMarginGuides: true,
    showKeywordMarks: false,
    includeMarksInPdf: false,
    zoom: 1,
    fitMode: true,
  })
  useAtsStore.setState({ report: null, isChecking: false, hasOpened: true, keywords: [] })
  vi.mocked(readValue).mockReset()
  vi.mocked(readValue).mockResolvedValue(undefined)
  vi.mocked(writeValue).mockReset()
  vi.mocked(writeValue).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('T3.1 (D2) — preferensi canvasFullscreen di uiStore', () => {
  it('default store adalah layar penuh', () => {
    expect(useUiStore.getState().canvasFullscreen).toBe(true)
  })

  it('layar penuh hanya hidup di mode kanvas', () => {
    const view = renderHook(() => ({
      full: useCanvasFull(),
      pref: useCanvasFullscreen(),
    }))
    expect(view.result.current.pref).toBe(true)
    expect(view.result.current.full).toBe(false)

    act(() => useUiStore.getState().setEditMode('canvas'))
    expect(view.result.current.full).toBe(true)

    act(() => useUiStore.getState().setCanvasFullscreen(false))
    expect(view.result.current.full).toBe(false)

    act(() => useUiStore.getState().setCanvasFullscreen(true))
    expect(view.result.current.full).toBe(true)
    view.unmount()
  })

  it('preferensi tersimpan dibaca saat boot lalu ikut ditulis', async () => {
    vi.mocked(readValue).mockResolvedValue({ canvasFullscreen: false })
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(useUiStore.getState().canvasFullscreen).toBe(false))

    act(() => useUiStore.getState().setCanvasFullscreen(true))
    await waitFor(() =>
      expect(writeValue).toHaveBeenCalledWith(
        PREFS_KEY,
        expect.objectContaining({ canvasFullscreen: true }),
      ),
    )
    unmount()
  })

  it('preferensi lama tanpa kunci baru tidak error dan tetap default', async () => {
    // Bentuk `ats:prefs:v1` sebelum FASE 13: tidak punya `canvasFullscreen`.
    vi.mocked(readValue).mockResolvedValue({ zoom: 1.25, fitMode: false, editMode: 'canvas' })
    const { unmount } = renderHook(() => usePreviewPrefs())

    await waitFor(() => expect(useUiStore.getState().zoom).toBe(1.25))
    expect(useUiStore.getState().canvasFullscreen).toBe(true)
    expect(useUiStore.getState().editMode).toBe('canvas')
    unmount()
  })
})

describe('T3.2 — toggle "Kertas layar penuh" di menu Tampilan', () => {
  it('mati (disabled) selama mode form, hidup di mode kanvas', async () => {
    const user = userEvent.setup()
    render(<TampilanMenu />)
    await user.click(screen.getByRole('button', { name: t('tampilan.open') }))

    const toggle = within(popover()).getByRole('switch', { name: t('canvas.fullscreenLabel') })
    expect(toggle).toBeDisabled()

    // Pengguna pindah ke mode kanvas lewat radiogroup yang sama.
    await user.click(within(popover()).getByRole('radio', { name: /Langsung di CV/ }))
    expect(toggle).toBeEnabled()

    await user.click(toggle)
    expect(useUiStore.getState().canvasFullscreen).toBe(false)
    expect(useUiStore.getState().editMode).toBe('canvas')
  })

  it('lebar popover tidak berubah (tetap w-[288px])', async () => {
    const user = userEvent.setup()
    render(<TampilanMenu />)
    await user.click(screen.getByRole('button', { name: t('tampilan.open') }))
    expect(popover().className).toContain('w-[288px]')
  })
})

describe('T3.3 — tombol keluar layar penuh', () => {
  it('tidak dirender di mode form', () => {
    render(
      <TooltipProvider>
        <CanvasExitButton />
      </TooltipProvider>,
    )
    expect(probe('canvas-exit')).toBeNull()
  })

  it('keluar layar penuh tanpa mengganti mode pengerjaan', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(
      <TooltipProvider>
        <CanvasExitButton />
      </TooltipProvider>,
    )

    const exit = probe('canvas-exit')
    expect(exit).not.toBeNull()
    expect(exit).toHaveAccessibleName(t('canvas.fullscreenExit'))

    await user.click(exit as HTMLElement)
    expect(useUiStore.getState().canvasFullscreen).toBe(false)
    // Jalan keluar ini TIDAK mengubah `editMode`: pengguna tetap di kertas.
    expect(useUiStore.getState().editMode).toBe('canvas')
  })

  /**
   * FASE 13 (T5.2/T5.3) — di bawah 640px tombol ini hanya ikon, jadi
   * `canvas.fullscreenExitHint` jadi tooltip-nya.
   */
  it('memakai kamus untuk tooltip keterangan tombol keluar', () => {
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(
      <TooltipProvider>
        <CanvasExitButton />
      </TooltipProvider>,
    )
    const exit = probe('canvas-exit')
    expect(exit).toHaveAttribute('aria-label', t('canvas.fullscreenExit'))
    // Isi tooltip diambil dari kamus, bukan string yang ditulis di komponen.
    expect(t('canvas.fullscreenExitHint')).not.toBe('')
    expect(t('canvas.fullscreenExitHint')).toContain('berpanel')
  })
})

describe('T3.4 (D12) — menu "Bagian" pengganti rail', () => {
  it('tidak dirender di mode form (rail masih ada)', () => {
    render(<CanvasSectionMenu />)
    expect(probe('canvas-sections-menu')).toBeNull()
  })

  it('popover desktop memuat daftar bagian beserta kontrol struktural', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(<CanvasSectionMenu />)

    await user.click(probe('canvas-sections-menu') as HTMLElement)
    const content = popover()
    const total = useDocStore.getState().doc.sections.length
    expect(within(content).getAllByRole('checkbox')).toHaveLength(total)
    expect(within(content).getAllByRole('button', { name: /^Pindahkan ke atas/ })).toHaveLength(
      total,
    )
    expect(within(content).getAllByRole('button', { name: /^Hapus bagian/ })).toHaveLength(total)
    expect(within(content).getByRole('button', { name: t('rail.addSection') })).toBeInTheDocument()
  })

  it('sembunyikan bagian & ubah urutan bekerja lewat menu kanvas', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(<CanvasSectionMenu />)
    await user.click(probe('canvas-sections-menu') as HTMLElement)

    const content = popover()
    await user.click(within(content).getAllByRole('checkbox')[1] as HTMLElement)
    expect(useDocStore.getState().doc.sections[1]!.visible).toBe(false)

    const before = kindOf(0)
    await user.click(
      within(content).getByRole('button', { name: `${t('rail.moveDown')}: ${sectionLabel(0)}` }),
    )
    expect(kindOf(1)).toBe(before)
  })

  it('bagian terisi minta konfirmasi dulu, bagian kosong langsung terhapus', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(<CanvasSectionMenu />)
    await user.click(probe('canvas-sections-menu') as HTMLElement)

    const total = useDocStore.getState().doc.sections.length
    await user.click(
      within(popover()).getByRole('button', { name: `${t('rail.delete')}: ${sectionLabel(0)}` }),
    )
    // `sampleResume()` mengisi setiap bagian → dialog konfirmasi, bukan hapus diam-diam.
    const dialog = await screen.findByRole('dialog', {
      name: t('rail.deleteConfirmTitle', { name: sectionLabel(0) }),
    })
    await user.click(within(dialog).getByRole('button', { name: t('rail.deleteConfirmAction') }))
    expect(useDocStore.getState().doc.sections).toHaveLength(total - 1)
  })

  it('"+ Tambah bagian" membuka dialog katalog yang sudah ada (C4.4)', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(<CanvasSectionMenu />)
    await user.click(probe('canvas-sections-menu') as HTMLElement)

    await user.click(within(popover()).getByRole('button', { name: t('rail.addSection') }))
    expect(useUiStore.getState().sectionCatalogOpen).toBe(true)
    // Popover penutup diri agar dialog katalog tidak tertimpa.
    expect(probe('canvas-sections-menu')).toHaveAttribute('aria-expanded', 'false')
  })

  it('di <1024px menu membuka sheet bawah, bukan popover', async () => {
    const user = userEvent.setup()
    act(() => {
      useUiStore.getState().setEditMode('canvas')
      useUiStore.setState({ panelMode: 'tabs' })
    })
    render(<CanvasSectionMenu />)

    const trigger = probe('canvas-sections-menu')
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveAccessibleName(t('canvas.sectionsMenu'))

    await user.click(trigger as HTMLElement)
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getAllByRole('checkbox').length).toBeGreaterThan(0)
    expect(within(sheet).getByRole('button', { name: t('rail.addSection') })).toBeInTheDocument()
  })

  it('bar bawah mobile memakai daftar yang sama dan tidak mengubah perilakunya', async () => {
    const user = userEvent.setup()
    render(<StickyActionBar />)
    await user.click(screen.getByRole('button', { name: t('mobile.sections') }))

    const sheet = await screen.findByRole('dialog')
    // Mode form: `allowDelete` mati — sheet bar bawah tidak pernah punya hapus.
    expect(within(sheet).queryAllByRole('button', { name: /^Hapus bagian/ })).toHaveLength(0)

    await user.click(within(sheet).getByRole('button', { name: sectionLabel(2) }))
    // Perilaku lama dipertahankan: pilihan bagian membuka tab formulir.
    expect(useUiStore.getState().activeTab).toBe('form')
    expect(useDocStore.getState().activeSectionId).toBe(useDocStore.getState().doc.sections[2]!.id)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('di layar penuh memilih bagian tidak memindahkan tab ke formulir yang tersembunyi', async () => {
    const user = userEvent.setup()
    act(() => {
      useUiStore.getState().setEditMode('canvas')
      useUiStore.setState({ panelMode: 'tabs', activeTab: 'preview' })
    })
    render(<StickyActionBar />)
    await user.click(screen.getByRole('button', { name: t('mobile.sections') }))

    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: sectionLabel(2) }))
    expect(useUiStore.getState().activeTab).toBe('preview')
  })
})

describe('T3.5 (D9) — drawer ATS jadi lapisan di mode kanvas', () => {
  const truthTable = [
    { editMode: 'form', canvasFullscreen: true, docked: true, expected: true },
    { editMode: 'form', canvasFullscreen: false, docked: true, expected: true },
    { editMode: 'canvas', canvasFullscreen: false, docked: true, expected: true },
    { editMode: 'canvas', canvasFullscreen: true, docked: true, expected: false },
    { editMode: 'canvas', canvasFullscreen: true, docked: false, expected: false },
  ] as const

  it.each(truthTable)(
    'editMode=${editMode} fullscreen=${canvasFullscreen} lebarDock=${docked} → dock=${expected}',
    ({ editMode, canvasFullscreen, docked, expected }) => {
      expect(atsDockedFor(editMode, canvasFullscreen, docked)).toBe(expected)
    },
  )

  it('≥1600px di mode kanvas layar penuh: bukan kolom, tapi lapisan', () => {
    stubDockMedia(true)
    act(() => useUiStore.getState().setEditMode('canvas'))

    const { unmount } = render(<AtsDockSlot />)
    expect(probe('ats-drawer')).toBeNull()
    unmount()

    render(<AtsOverlay />)
    expect(probe('ats-drawer')).not.toBeNull()
  })

  it('≥1600px di mode form tetap menjadi kolom ke-4 (regresi nol)', () => {
    stubDockMedia(true)
    const { container } = render(<AtsDockSlot />)
    const drawer = probe('ats-drawer', container)
    expect(drawer).not.toBeNull()
    expect(drawer?.tagName).toBe('ASIDE')
  })

  it('keluar layar penuh saat ATS terbuka mengembalikannya menjadi kolom', () => {
    stubDockMedia(true)
    act(() => useUiStore.getState().setEditMode('canvas'))
    const { rerender } = render(<AtsDockSlot />)
    expect(probe('ats-drawer')).toBeNull()

    act(() => useUiStore.getState().setCanvasFullscreen(false))
    rerender(<AtsDockSlot />)
    expect(probe('ats-drawer')?.tagName).toBe('ASIDE')
  })
})

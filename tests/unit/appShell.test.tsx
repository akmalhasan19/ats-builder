import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/app/AppShell'
import { BrandMark } from '@/app/BrandMark'
import { SkipToContent } from '@/app/SkipToContent'
import { ICON_RAIL_MIN, THREE_COL_MIN, panelModeFor, usePanelMode } from '@/app/usePanelMode'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { StickyActionBar } from '@/app/shell/StickyActionBar'
import { TemplateSelect } from '@/app/shell/TemplateSelect'
import { TopBar } from '@/app/shell/TopBar'
import { TEMPLATE_IDS, applyTemplate, templateLabelKey } from '@/app/shell/templateList'
import { buildReport } from '@/features/ats/engine'
import { createEmptyDoc } from '@/schema/resume'
import { A4_PX } from '@/lib/units'
import { t } from '@/lib/i18n'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { useErrorStore } from '@/store/errorStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { useSyncStore } from '@/store/syncStore'
import { useUiStore } from '@/store/uiStore'
import { sampleResume } from '../fixtures/sampleResume'
import { paginationDoc } from '../fixtures/docs'
import type { ResumeDoc, TemplateId } from '@/types/resume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const { idb } = vi.hoisted(() => ({
  idb: {
    readValue: vi.fn(async () => undefined),
    writeValue: vi.fn(async () => undefined),
    quarantineCorruptDoc: vi.fn(async () => undefined),
  },
}))
// Preferensi preview ditulis lewat modul ini; di-stub supaya jsdom tidak perlu
// IndexedDB dan tes bisa memeriksa isi prefs.
vi.mock('@/features/persistence/idb', () => ({
  DOC_KEY: 'ats:doc:v1',
  PREFS_KEY: 'ats:prefs:v1',
  FIRST_RUN_KEY: 'ats:firstRun',
  corruptKey: (timestamp: number) => `ats:doc:corrupt:${timestamp}`,
  ...idb,
}))

const { pdf } = vi.hoisted(() => ({
  pdf: {
    exportPdf: vi.fn(async () => ({
      blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      filename: 'cv-alex-morgan-classic-ats.pdf',
      bytes: 8,
      durationMs: 1,
      pageCount: 1,
    })),
    queueExport: vi.fn((task: () => Promise<unknown>) => task()),
    downloadPdfBlob: vi.fn(),
    openPdfBlob: vi.fn(),
    pdfErrorKey: vi.fn(() => 'pdf.error.failed' as const),
    pdfFilename: vi.fn(() => 'cv.pdf'),
  },
}))
// Ekspor PDF nyata menarik pdf-lib + font; cukup dibuktikan sampai pemanggilan.
vi.mock('@/features/pdf/exportPdf', () => pdf)

/**
 * Fase 9 — kerangka aplikasi: TopBar, TemplateSelect, toolbar PreviewWell,
 * StickyActionBar, AppShell, usePanelMode, templateList, BrandMark,
 * SkipToContent. Selektor memakai `data-probe` / role / teks kamus.
 */

const store = () => useDocStore.getState()

/**
 * `sampleResume()` menyimpan `meta.createdAt/updatedAt = 0` supaya id-nya
 * deterministik; `resumeDocSchema` menuntut nilai > 0, jadi tes yang menyentuh
 * gerbang validasi ekspor memakai salinan dengan stempel waktu nyata.
 */
const validSample = (): ResumeDoc => ({
  ...sampleResume(),
  meta: { createdAt: 1, updatedAt: 1, lastCheckedAt: null },
})

const probe = (name: string, root: ParentNode = document): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const withProfile = (patch: Record<string, unknown>): ResumeDoc =>
  ({
    ...sampleResume(),
    sections: sampleResume().sections.map((section) =>
      section.kind === 'profile'
        ? ({ ...section, data: { ...section.data, ...patch } } as typeof section)
        : section,
    ),
  }) as ResumeDoc

const profileData = (doc: ResumeDoc): Record<string, unknown> => {
  const profile = doc.sections.find((section) => section.kind === 'profile')
  return profile ? { ...(profile.data as Record<string, unknown>) } : {}
}

/** Stub matchMedia + innerWidth → MediaQueryList tiruan yang bisa di-fire. */
function stubViewport(width: number) {
  const handlers: Array<() => void> = []
  const removed: Array<() => void> = []
  const mql = {
    get matches() {
      return window.innerWidth >= THREE_COL_MIN
    },
    media: '',
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => handlers.push(cb),
    removeEventListener: (_type: string, cb: () => void) => removed.push(cb),
    dispatchEvent: () => true,
  }
  setInnerWidth(width)
  vi.stubGlobal('matchMedia', () => mql)
  return { handlers, removed, fire: () => handlers.forEach((handler) => handler()) }
}

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

function PanelProbe() {
  usePanelMode()
  const mode = useUiStore((state) => state.panelMode)
  return <span data-probe="panel-mode">{mode}</span>
}

beforeEach(() => {
  store().loadDoc(sampleResume())
  useUiStore.setState({
    panelMode: '3col',
    activeTab: 'form',
    fitMode: false,
    zoom: 1,
    showMarginGuides: true,
    showKeywordMarks: true,
    atsDrawerOpen: false,
    firstRunSeen: true,
  })
  useErrorStore.setState({ banner: null })
  useSyncStore.setState({ status: 'saved-local', storageMode: 'idb' })
  usePdfExportStore.setState({ isGenerating: false })
  useAtsStore.setState({
    report: null,
    isChecking: false,
    hasOpened: false,
    lastCheckedAt: null,
    keywords: [],
  })
  // `restoreMocks: true` melepas implementasi bawaan vi.fn, jadi implementasi
  // stub dipasang ulang setiap tes agar pemeriksaan pemanggilan tetap berarti.
  idb.readValue.mockImplementation(async () => undefined)
  idb.writeValue.mockImplementation(async () => undefined)
  idb.quarantineCorruptDoc.mockImplementation(async () => undefined)
  pdf.exportPdf.mockImplementation(async () => ({
    blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    filename: 'cv-alex-morgan-classic-ats.pdf',
    bytes: 8,
    durationMs: 1,
    pageCount: 1,
  }))
  pdf.queueExport.mockImplementation((task: () => Promise<unknown>) => task())
  pdf.downloadPdfBlob.mockImplementation(() => undefined)
  pdf.openPdfBlob.mockImplementation(() => undefined)
  pdf.pdfErrorKey.mockImplementation(() => 'pdf.error.failed' as const)
  pdf.pdfFilename.mockImplementation(() => 'cv.pdf')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('templateList.ts — satu pintu ganti template (T6.4)', () => {
  it('mendaftarkan lima template dengan label hasil t()', () => {
    expect(TEMPLATE_IDS).toEqual<TemplateId[]>([
      'classic-ats',
      'ledger',
      'executive',
      'minimal',
      'technician',
    ])

    const labels = TEMPLATE_IDS.map((id) => {
      expect(templateLabelKey(id)).toBe(`template.${id}`)
      return t(templateLabelKey(id))
    })
    for (const label of labels) {
      expect(label).not.toMatch(/^template\./)
      expect(label.trim().length).toBeGreaterThan(0)
    }
    expect(new Set(labels).size).toBe(5)
  })

  it('applyTemplate hanya mengganti templateId lalu memunculkan toast konfirmasi', () => {
    const before = store().doc
    applyTemplate('technician')
    const after = store().doc

    expect(after.templateId).toBe('technician')
    expect(after.sections).toEqual(before.sections)
    expect(after.settings).toEqual(before.settings)
    expect(after.theme).toEqual(before.theme)
    expect(toast).toHaveBeenCalledWith(t('template.appliedToast', { name: 'Technician' }))
  })
})

describe('BrandMark & SkipToContent', () => {
  it('BrandMark menyembunyikan ornamennya dari papan baca dan menghormati size', () => {
    const { container, rerender } = render(<BrandMark />)
    const mark = container.firstElementChild as HTMLElement

    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(mark).toHaveStyle({ width: '22px', height: '22px' })
    expect(container.querySelectorAll('svg rect')).toHaveLength(5)

    rerender(<BrandMark size={20} className="hidden" />)
    expect(container.firstElementChild).toHaveStyle({ width: '20px' })
    expect(container.firstElementChild?.className).toContain('hidden')
  })

  it('SkipToContent menunjuk anchor default dan yang dikustomisasi', () => {
    const { rerender } = render(<SkipToContent />)
    expect(screen.getByRole('link', { name: t('dev.skipToContent') })).toHaveAttribute(
      'href',
      '#workspace-main',
    )

    rerender(<SkipToContent targetId="pane-form" />)
    expect(screen.getByRole('link', { name: t('dev.skipToContent') })).toHaveAttribute(
      'href',
      '#pane-form',
    )
  })
})

describe('usePanelMode — tiga cabang breakpoint', () => {
  it('memetakan 3col / icon-rail / tabs dari lebar viewport', () => {
    stubViewport(1440)
    const first = render(<PanelProbe />)
    expect(screen.getByText('3col')).toBeInTheDocument()
    expect(useUiStore.getState().panelMode).toBe(panelModeFor(1440))
    first.unmount()

    stubViewport(ICON_RAIL_MIN + 1)
    const second = render(<PanelProbe />)
    expect(screen.getByText('icon-rail')).toBeInTheDocument()
    expect(useUiStore.getState().panelMode).toBe('icon-rail')
    second.unmount()

    stubViewport(800)
    render(<PanelProbe />)
    expect(screen.getByText('tabs')).toBeInTheDocument()
    expect(useUiStore.getState().panelMode).toBe('tabs')
  })

  it('berlangganan perubahan media query dan berhenti saat unmount', () => {
    const viewport = stubViewport(1440)
    const { unmount } = render(<PanelProbe />)

    expect(viewport.handlers).toHaveLength(2)
    setInnerWidth(900)
    act(() => viewport.fire())
    expect(useUiStore.getState().panelMode).toBe('tabs')

    unmount()
    expect(viewport.removed).toHaveLength(2)
  })

  it('lingkungan tanpa matchMedia tidak mengubah mode panel', () => {
    setInnerWidth(800)
    vi.stubGlobal('matchMedia', undefined)
    render(<PanelProbe />)
    expect(useUiStore.getState().panelMode).toBe('3col')
  })
})

describe('TemplateSelect — popover galeri mini', () => {
  it('memilih template dari popover memanggil setTemplate dan memunculkan toast', async () => {
    const user = userEvent.setup()
    render(<TemplateSelect />)

    // aria-label trigger menyebut template aktif: "Pilih template: Classic ATS"
    await user.click(screen.getByRole('button', { name: new RegExp(t('topbar.templateTitle')) }))
    const content = document.querySelector('[data-slot="popover-content"]')
    expect(content).not.toBeNull()
    expect(within(content as HTMLElement).getAllByRole('button', { pressed: true })).toHaveLength(1)
    for (const id of TEMPLATE_IDS) {
      expect(within(content as HTMLElement).getByText(t(`template.desc.${id}`))).toBeInTheDocument()
    }

    await user.click(within(content as HTMLElement).getByRole('button', { name: /Ledger/i }))

    expect(store().doc.templateId).toBe('ledger')
    expect(toast).toHaveBeenCalledWith(t('template.appliedToast', { name: 'Ledger' }))
    await waitFor(() => expect(document.querySelector('[data-slot="popover-content"]')).toBeNull())
    expect(probe('template-trigger')?.textContent).toContain('Ledger')
  })

  it('trigger mati saat ekspor PDF sedang berjalan', () => {
    usePdfExportStore.setState({ isGenerating: true })
    render(<TemplateSelect />)
    expect(
      screen.getByRole('button', { name: new RegExp(t('topbar.templateTitle')) }),
    ).toBeDisabled()
  })
})

describe('TopBar', () => {
  it('menyediakan merek, pemilih template, Periksa ATS, dan Download PDF', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    const brand = screen.getByRole('link', { name: t('topbar.brandHome') })
    expect(brand).toHaveAttribute('href', '/')
    // `header` juga dipakai blok template, jadi landmark diperiksa lewat leluhurnya.
    expect(brand.closest('header')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: new RegExp(t('topbar.templateTitle')) }),
    ).toBeInTheDocument()
    expect(probe('check-ats')).not.toBeNull()
    expect(probe('download-pdf')).not.toBeNull()
    expect(screen.getByRole('button', { name: t('topbar.download') })).toBeInTheDocument()
  })

  it('Check ATS membuka drawer ATS dan menandai pernah dibuka', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: t('topbar.checkAts') }))

    expect(useUiStore.getState().atsDrawerOpen).toBe(true)
    expect(useAtsStore.getState().hasOpened).toBe(true)
  })

  it('badge titik merah hanya muncul bila laporan punya isu `bad`', () => {
    useAtsStore.setState({ report: buildReport(sampleResume(), 2, 0) })
    const clean = render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )
    expect(probe('check-ats-badge')).toBeNull()
    clean.unmount()

    useAtsStore.setState({
      report: buildReport(withProfile({ email: '', phone: '12' }), 2, 0),
    })
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )
    const badge = probe('check-ats-badge')
    expect(badge).not.toBeNull()
    expect(badge).toHaveAttribute('aria-hidden', 'true')
    expect(badge?.className).toContain('bg-signal-bad')
  })

  it('Dokumen tidak sah memblokir ekspor dan menunjuk kolom bermasalah', async () => {
    const user = userEvent.setup()
    // Fixture memakai meta 0 → ditolak resumeDocSchema (timestamp harus > 0).
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: t('topbar.download') }))

    expect(pdf.exportPdf).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(t('pdf.error.invalid'))
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
  })

  it('Download PDF memakai jalur ekspor lalu melapor hasil unduhan', async () => {
    const user = userEvent.setup()
    store().loadDoc(validSample())
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: t('topbar.download') }))

    await waitFor(() => expect(pdf.exportPdf).toHaveBeenCalled())
    expect(pdf.downloadPdfBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'cv-alex-morgan-classic-ats.pdf',
    )
    await waitFor(() => expect(usePdfExportStore.getState().isGenerating).toBe(false))
    expect(
      vi.mocked(toast).mock.calls.some((call) => call[0] === t('pdf.success.downloaded')),
    ).toBe(true)
  })

  it('menu mobile memuat template, Periksa ATS, dan reset dokumen', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: t('topbar.menu') }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText(t('topbar.menuTitle'))).toBeInTheDocument()
    expect(within(sheet).getAllByRole('button', { pressed: false })).toHaveLength(
      TEMPLATE_IDS.length - 1,
    )

    await user.click(within(sheet).getByRole('button', { name: /Executive/i }))
    expect(store().doc.templateId).toBe('executive')
    expect(toast).toHaveBeenCalledWith(t('template.appliedToast', { name: 'Executive' }))

    await user.click(within(sheet).getByRole('button', { name: t('topbar.checkAts') }))
    expect(useUiStore.getState().atsDrawerOpen).toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await user.click(screen.getByRole('button', { name: t('topbar.menu') }))
    const sheet2 = await screen.findByRole('dialog')
    await user.click(within(sheet2).getByRole('button', { name: t('menu.resetDoc') }))

    const confirm = (
      await screen.findByRole('heading', {
        name: t('menu.resetDocTitle'),
      })
    ).closest('[role="dialog"]') as HTMLElement
    await user.click(within(confirm).getByRole('button', { name: t('menu.resetToEmpty') }))

    expect(store().doc.title).toBe(createEmptyDoc().title)
    expect(profileData(store().doc).fullName).toBe('')
    expect(toast).toHaveBeenCalledWith(t('firstRun.emptyToast'))
  })

  it('menu mobile juga bisa memuat ulang dokumen contoh', async () => {
    const user = userEvent.setup()
    store().setTitle('CV Milikku')
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: t('topbar.menu') }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: t('menu.resetDoc') }))
    const confirm = (
      await screen.findByRole('heading', {
        name: t('menu.resetDocTitle'),
      })
    ).closest('[role="dialog"]') as HTMLElement
    await user.click(within(confirm).getByRole('button', { name: t('menu.resetToSample') }))

    expect(store().doc.sections).toHaveLength(10)
    expect(store().doc.title).toContain('Alex Morgan')
    expect(toast).toHaveBeenCalledWith(t('firstRun.sampleToast'))
  })
})

describe('PreviewWell — toolbar', () => {
  const renderWell = () =>
    render(
      <TooltipProvider>
        <PreviewWell />
      </TooltipProvider>,
    )

  const popover = () => {
    const node = document.querySelector('[data-slot="popover-content"]')
    expect(node).not.toBeNull()
    return node as HTMLElement
  }

  it('zoom minus/plus menulis preferensi zoom dan keluar dari mode Fit', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ fitMode: false, zoom: 1 })
    renderWell()

    await user.click(screen.getByRole('button', { name: t('preview.zoomOut') }))
    expect(useUiStore.getState().zoom).toBeCloseTo(0.9, 5)
    expect(probe('zoom-value')?.textContent).toBe('90%')

    await user.click(screen.getByRole('button', { name: t('preview.zoomIn') }))
    await user.click(screen.getByRole('button', { name: t('preview.zoomIn') }))
    expect(useUiStore.getState().zoom).toBeCloseTo(1.1, 5)

    await waitFor(() => expect(idb.writeValue).toHaveBeenCalled())
    expect(idb.writeValue).toHaveBeenCalledWith(
      'ats:prefs:v1',
      expect.objectContaining({ fitMode: false, zoom: expect.any(Number) }),
    )
  })

  it('menekan tombol zoom pada mode Fit mengirim pengguna ke zoom manual', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ fitMode: true })
    // Mode Fit menghitung skala dari lebar well; jsdom tidak punya layout, jadi
    // clientWidth diberi nilai 643px agar fitScale = 1.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 643,
    })

    try {
      renderWell()
      expect(probe('zoom-value')?.textContent).toBe(t('preview.zoom.fit'))
      const zoomOut = screen.getByRole('button', { name: t('preview.zoomOut') })
      expect(zoomOut).not.toBeDisabled()

      await user.click(zoomOut)

      const fitScale = (643 - 48) / A4_PX.w
      expect(useUiStore.getState().fitMode).toBe(false)
      expect(useUiStore.getState().zoom).toBeCloseTo(fitScale - 0.1, 5)
    } finally {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
    }
  })

  it('tombol zoom mati di batas 30% dan 150%', () => {
    useUiStore.setState({ fitMode: false, zoom: 1.5 })
    renderWell()
    expect(screen.getByRole('button', { name: t('preview.zoomIn') })).toBeDisabled()

    act(() => useUiStore.getState().setZoom(0.3))
    expect(screen.getByRole('button', { name: t('preview.zoomOut') })).toBeDisabled()
  })

  it('preset 50/75/100% dan Fit diatur lewat popover nilai zoom', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ fitMode: false, zoom: 1 })
    renderWell()
    expect(probe('zoom-value')?.textContent).toBe('100%')

    await user.click(probe('zoom-value')!)
    await user.click(within(popover()).getByRole('button', { name: '75%' }))
    expect(useUiStore.getState().zoom).toBe(0.75)
    expect(probe('zoom-value')?.textContent).toBe('75%')

    await user.click(probe('zoom-value')!)
    await user.click(within(popover()).getByRole('button', { name: t('preview.zoom.fit') }))
    expect(useUiStore.getState().fitMode).toBe(true)
    expect(probe('zoom-value')?.textContent).toBe(t('preview.zoom.fit'))
  })

  it('toggle penggaris margin memakai aria-pressed dan ikut tersimpan di prefs', async () => {
    const user = userEvent.setup()
    renderWell()
    const ruler = screen.getByRole('button', { name: t('preview.ruler') })
    expect(ruler).toHaveAttribute('aria-pressed', 'true')

    await user.click(ruler)
    expect(useUiStore.getState().showMarginGuides).toBe(false)

    await user.click(ruler)
    expect(useUiStore.getState().showMarginGuides).toBe(true)
    await waitFor(() =>
      expect(idb.writeValue).toHaveBeenCalledWith(
        'ats:prefs:v1',
        expect.objectContaining({ showMarginGuides: true }),
      ),
    )
  })

  it('highlighter mati sebelum ada kata kunci, dengan tooltip alasannya', async () => {
    const user = userEvent.setup()
    renderWell()
    const button = probe('preview-highlighter')!

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.hover(button.parentElement as HTMLElement)
    expect(await screen.findByText(t('preview.highlighterPending'))).toBeInTheDocument()
  })

  it('setelah kata kunci ATS ada, highlighter bisa dimatikan', async () => {
    const user = userEvent.setup()
    useAtsStore.setState({ keywords: ['TypeScript', 'React'] })
    renderWell()
    const button = probe('preview-highlighter')!

    expect(button).not.toBeDisabled()
    await user.click(button)
    expect(useUiStore.getState().showKeywordMarks).toBe(false)

    await user.click(button)
    expect(useUiStore.getState().showKeywordMarks).toBe(true)
  })

  it('melabeli halaman berjalan terhadap total lembar hasil pagination', () => {
    store().loadDoc(paginationDoc('panjang'))
    renderWell()

    const total = document.querySelectorAll('[data-probe="page-sheet"]').length
    expect(total).toBeGreaterThan(1)
    const counter = probe('page-counter')?.textContent
    expect(counter).toBe(t('preview.pageCounter', { page: 1, total }))
    expect(counter).toMatch(/^HAL 1 \/ \d+$/)
    if (total > 2) {
      expect(probe('page-chip')?.textContent).toBe(t('preview.pageChip', { count: total }))
    } else {
      expect(probe('page-chip')).toBeNull()
    }
  })
})

describe('StickyActionBar — bar bawah mobile (§5.7)', () => {
  it('menampilkan tombol bagian dan Download PDF', () => {
    render(<StickyActionBar />)
    expect(screen.getByRole('button', { name: t('mobile.sections') })).toBeInTheDocument()
    expect(probe('download-pdf')).not.toBeNull()
    expect(screen.getByRole('button', { name: t('topbar.download') })).toBeInTheDocument()
  })

  it('sheet Bagian mengatur visibilitas, urutan, dan pilihan bagian', async () => {
    const user = userEvent.setup()
    render(<StickyActionBar />)

    await user.click(screen.getByRole('button', { name: t('mobile.sections') }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText(t('mobile.sectionsTitle'))).toBeInTheDocument()

    await user.click(
      within(sheet).getByRole('checkbox', {
        name: `${t('rail.toggleVisibility')}: ${t('section.summary')}`,
      }),
    )
    expect(store().doc.sections.find((s) => s.kind === 'summary')?.visible).toBe(false)

    await user.click(
      within(sheet).getByRole('button', {
        name: `${t('rail.moveDown')}: ${t('section.summary')}`,
      }),
    )
    expect(store().doc.sections[1]?.kind).toBe('experience')

    await user.click(within(sheet).getByRole('button', { name: t('section.projects') }))
    expect(store().activeSectionId).toBe(
      store().doc.sections.find((s) => s.kind === 'projects')?.id,
    )
    expect(useUiStore.getState().activeTab).toBe('form')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('katalog bagian menambah section baru lalu menutup sheet', async () => {
    const user = userEvent.setup()
    const doc = sampleResume()
    store().loadDoc({ ...doc, sections: doc.sections.filter((s) => s.kind !== 'awards') })
    render(<StickyActionBar />)

    await user.click(screen.getByRole('button', { name: t('mobile.sections') }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: t('rail.addSection') }))

    const catalog = (
      await screen.findByRole('heading', {
        name: t('rail.catalogTitle'),
      })
    ).closest('[role="dialog"]') as HTMLElement
    await user.click(within(catalog).getByRole('button', { name: t('rail.add') }))

    expect(store().doc.sections.some((s) => s.kind === 'awards')).toBe(true)
    expect(store().doc.sections).toHaveLength(10)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('tombol bar mati dan berubah label saat PDF sedang dibuat', () => {
    usePdfExportStore.setState({ isGenerating: true })
    render(<StickyActionBar />)

    expect(screen.getByRole('button', { name: t('mobile.sections') })).toBeDisabled()
    const download = probe('download-pdf')
    expect(download).toBeDisabled()
    expect(download?.textContent).toContain(t('pdf.state.generating'))
  })
})

describe('AppShell — grid satu halaman (§2.4)', () => {
  it('merender rail, form, preview, dan anchor beranda sesuai mode panel', async () => {
    stubViewport(1920)
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )

    expect(document.querySelector('[data-panel-mode="3col"]')).not.toBeNull()
    expect(screen.getByRole('main', { name: t('workspace.heading') })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: t('topbar.brandHome') }).closest('header'),
    ).not.toBeNull()
    expect(screen.getByRole('complementary', { name: t('rail.heading') })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: t('workspace.previewTitle') })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t('dev.skipToContent') })).toHaveAttribute(
      'href',
      '#workspace-main',
    )

    const anchor = probe('home-anchor')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute('href', '#home-templates')
    await waitFor(() =>
      expect(document.getElementById('home-templates')?.children.length).toBeGreaterThan(0),
    )
    expect(document.getElementById('home-faq')?.children.length).toBeGreaterThan(0)
  })

  it('drawer ATS menjadi aside kolom ke-4 hanya saat lebar ≥1600px', async () => {
    stubViewport(1680)
    useUiStore.setState({ atsDrawerOpen: true })
    const { unmount } = render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(document.querySelector('aside[data-probe="ats-drawer"]')).not.toBeNull(),
    )
    unmount()

    stubViewport(1200)
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )
    await waitFor(() => expect(probe('ats-drawer')).not.toBeNull())
    expect(document.querySelector('aside[data-probe="ats-drawer"]')).toBeNull()
  })
})

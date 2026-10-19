/**
 * T9.6 / Fase 9 — antrian ekspor PDF, tombol unduh, dan renderer PDF jalur nyata.
 *
 * Antrian (`queueExport`) diuji dengan jam palsu karena ia mengukur jeda lewat
 * `Date.now()`. Tombol diuji dengan mock modul ekspor supaya store & DOM tetap
 * nyata; renderer diuji dengan panggilan sungguhan (font dibaca dari
 * `public/fonts` lewat `fetch` yang di-stub, sama seperti `pdfExport.test.ts`
 * yang membacanya lewat `readFileSync`).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { id } from '@/dictionaries/id'
import { renderResumePdfToBlob } from '@/features/pdf/renderResumePdf'
import { PdfDownloadButton } from '@/features/pdf/PdfDownloadButton'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { resolveSpec } from '@/features/templates/specs'
import { PdfExportError } from '@/features/templates/pdf/ResumePdfLib'
import { createSampleDoc } from '@/schema/resume'
import { sampleResume } from '../fixtures/sampleResume'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { useUiStore } from '@/store/uiStore'
import type { ExportPdfResult } from '@/features/pdf/exportPdf'
import type { ResumeDoc, SectionInstance, TemplateId } from '@/types/resume'
import type {
  downloadPdfBlob as DownloadPdf,
  openPdfBlob as OpenPdf,
  pdfErrorKey as PdfErrorKey,
  pdfFilename as PdfFilename,
  queueExport as QueueExport,
} from '@/features/pdf/exportPdf'

const mocks = vi.hoisted(() => ({
  exportPdf:
    vi.fn<
      (
        doc: unknown,
        plan: unknown,
        options: { keywords?: readonly string[] },
      ) => Promise<ExportPdfResult>
    >(),
  downloadPdfBlob: vi.fn<(blob: Blob, filename: string) => void>(),
  openPdfBlob: vi.fn<(blob: Blob) => void>(),
  queueExport: vi.fn(<T,>(task: () => Promise<T>) => task()),
  scrollToFirstInvalidField: vi.fn<() => null>(),
  toast: vi.fn(),
}))

// Sebagian diekspor apa adanya (`pdfErrorKey`, `pdfFilename`) supaya pemetaan
// pesan yang diuji tombol adalah kode produksi, bukan salinan tes.
vi.mock('@/features/pdf/exportPdf', async (importOriginal) => {
  const original = await importOriginal<ExportModule>()
  return {
    ...original,
    exportPdf: mocks.exportPdf,
    downloadPdfBlob: mocks.downloadPdfBlob,
    openPdfBlob: mocks.openPdfBlob,
    queueExport: mocks.queueExport,
  }
})

vi.mock('@/features/editor/scrollToFirstInvalidField', () => ({
  scrollToFirstInvalidField: mocks.scrollToFirstInvalidField,
}))

vi.mock('sonner', () => ({ toast: mocks.toast }))

const QUEUE_BASE_MS = 1_000_000_000_000

/** Waktu palsu yang selalu lebih muda dari tugas test sebelumnya. */
let virtualNow = QUEUE_BASE_MS

type RealExport = {
  queueExport: typeof QueueExport
  pdfFilename: typeof PdfFilename
  downloadPdfBlob: typeof DownloadPdf
  openPdfBlob: typeof OpenPdf
  pdfErrorKey: typeof PdfErrorKey
}

type ExportModule = RealExport & {
  exportPdf: (
    doc: ResumeDoc,
    plan: unknown,
    options?: { keywords?: readonly string[] },
  ) => Promise<ExportPdfResult>
}

/** Modul ekspor asli — mock hanya berlaku untuk komponen yang mengimpornya. */
const realExport = (): Promise<RealExport> =>
  vi.importActual<RealExport>('@/features/pdf/exportPdf')

const flush = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

/**
 * Dokumen sah menurut `resumeDocSchema` (fixture `sampleResume()` memakai
 * `meta.createdAt: 0` sehingga sengaja ditolak validator).
 */
const validDoc = (): ResumeDoc => createSampleDoc()

const invalidEmailDoc = (): ResumeDoc => ({
  ...validDoc(),
  sections: validDoc().sections.map((section): SectionInstance =>
    section.kind === 'profile'
      ? { ...section, data: { ...section.data, email: 'bukan-email' } }
      : section,
  ),
})

const exportResult = (overrides: Partial<ExportPdfResult> = {}): ExportPdfResult => ({
  blob: new Blob(['%PDF-1.4 stub'], { type: 'application/pdf' }),
  filename: 'alex-morgan-classic-ats.pdf',
  bytes: 11,
  durationMs: 42,
  pageCount: 1,
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  virtualNow += 1_000_000
  vi.setSystemTime(virtualNow)
  act(() => {
    useDocStore.getState().loadDoc(validDoc())
    usePdfExportStore.getState().setGenerating(false)
    useAtsStore.getState().setKeywords([])
    useUiStore.getState().setIncludeMarksInPdf(false)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})

/* ------------------------------------------------- antrian ekspor (T9.6) */

describe('queueExport — satu ekspor per 500 ms, tanpa membuang tugas', () => {
  it('tugas pertama berjalan langsung', async () => {
    const { queueExport: queue } = await realExport()
    const startedAt: number[] = []
    const first = queue(async () => {
      startedAt.push(Date.now())
      return 'satu'
    })
    await flush()
    await expect(first).resolves.toBe('satu')
    // Tidak ada jeda: tugas pertama tidak menunggu 500 ms.
    expect(Date.now() - startedAt[0]!).toBe(0)
  })

  it('tugas kedua diminta 100 ms kemudian tetap dijalankan setelah total 500 ms', async () => {
    const { queueExport: queue } = await realExport()
    const order: string[] = []
    const first = queue(async () => {
      order.push('satu')
      return 1
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(order).toEqual(['satu'])

    const second = queue(async () => {
      order.push('dua')
      return 2
    })
    // Belum 500 ms sejak tugas pertama mulai → tugas kedua antre, bukan dibuang.
    await vi.advanceTimersByTimeAsync(399)
    expect(order).toEqual(['satu'])
    await vi.advanceTimersByTimeAsync(1)
    expect(order).toEqual(['satu', 'dua'])

    await expect(first).resolves.toBe(1)
    await expect(second).resolves.toBe(2)
  })

  it('tiga tugas beruntun dijalankan berurutan tiap 500 ms', async () => {
    const { queueExport: queue } = await realExport()
    const stamps: number[] = []
    const tagged = (label: string) =>
      queue(async () => {
        stamps.push(Date.now())
        return label
      })

    const tasks = [tagged('a'), tagged('b'), tagged('c')]
    await vi.advanceTimersByTimeAsync(1600)

    await expect(Promise.all(tasks)).resolves.toEqual(['a', 'b', 'c'])
    expect(stamps).toHaveLength(3)
    expect(stamps[1]! - stamps[0]!).toBe(500)
    expect(stamps[2]! - stamps[1]!).toBe(500)
  })

  it('tugas yang menolak tidak merusak antrian berikutnya', async () => {
    const { queueExport: queue } = await realExport()
    const order: string[] = []
    const failing = queue(async () => {
      order.push('gagal')
      throw new PdfExportError('content', 'kelebihan halaman')
    })
    // Rantai internal sudah menyerap penolakan; tugas berikutnya tetap antre.
    const following = queue(async () => {
      order.push('setelah-gagal')
      return 'ok'
    })
    const third = queue(async () => {
      order.push('ketiga')
      return 3
    })

    const firstSettled = failing.then(
      () => 'selesai',
      (error: unknown) => (error as Error).message,
    )

    await vi.advanceTimersByTimeAsync(1600)

    await expect(firstSettled).resolves.toBe('kelebihan halaman')
    await expect(following).resolves.toBe('ok')
    await expect(third).resolves.toBe(3)
    expect(order).toEqual(['gagal', 'setelah-gagal', 'ketiga'])
  })

  it('penolakan tugas pertama tetap meneruskan rantai (cabang onRejected)', async () => {
    const { queueExport: queue } = await realExport()
    const order: string[] = []
    const failing = queue(async () => {
      order.push('satu-gagal')
      throw new Error('sedengaja')
    })
    const next = queue(async () => {
      order.push('dua')
      return 'dua'
    })
    const settled = failing.then(
      () => 'selesai',
      (error: unknown) => (error as Error).message,
    )

    await vi.advanceTimersByTimeAsync(1000)

    await expect(settled).resolves.toBe('sedengaja')
    await expect(next).resolves.toBe('dua')
    expect(order).toEqual(['satu-gagal', 'dua'])
  })
})

/* ------------------------------------------------helpers ekspor langsung */

describe('pdfFilename — cabang judul dokumen', () => {
  it('memakai judul dokumen saat nama lengkap kosong', async () => {
    const { pdfFilename } = await realExport()
    const doc: ResumeDoc = {
      ...sampleResume(),
      title: 'Curriculum Vitae Baru',
      templateId: 'executive',
      sections: sampleResume().sections.map((section): SectionInstance =>
        section.kind === 'profile'
          ? { ...section, data: { ...section.data, fullName: '' } }
          : section,
      ),
    }
    expect(pdfFilename(doc)).toBe('curriculum-vitae-baru-executive.pdf')
  })

  it('judul lebih diutamakan daripada nama lengkap', async () => {
    const { pdfFilename } = await realExport()
    expect(pdfFilename(sampleResume())).toBe('cv-alex-morgan-software-engineer-classic-ats.pdf')
  })
})

describe('downloadPdfBlob / openPdfBlob', () => {
  type UrlStub = {
    createObjectURL: (blob: Blob) => string
    revokeObjectURL: (url: string) => void
  }
  const urlAsStub = (): UrlStub => URL as unknown as UrlStub

  const stubUrl = (createObjectURL: (blob: Blob) => string): void => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn<(blob: Blob) => string>(createObjectURL),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn<(url: string) => void>(),
    })
  }

  const createSpy = (): Mock => urlAsStub().createObjectURL as unknown as Mock
  const revokeSpy = (): Mock => urlAsStub().revokeObjectURL as unknown as Mock

  it('menyiapkan anchor download lalu mencabut URL setelah 1000 ms', async () => {
    const { downloadPdfBlob } = await realExport()
    const blob = new Blob(['%PDF'], { type: 'application/pdf' })
    stubUrl(() => 'blob:tersedia')
    const clicked: { href: string; download: string; hidden: boolean | string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download, hidden: this.hidden })
    })

    downloadPdfBlob(blob, 'alex-morgan-classic-ats.pdf')

    expect(createSpy()).toHaveBeenCalledWith(blob)
    expect(clicked).toHaveLength(1)
    expect(clicked[0]!.download).toBe('alex-morgan-classic-ats.pdf')
    expect(clicked[0]!.hidden).toBe(true)
    expect(document.querySelector('a[download]')).toBeNull()

    expect(revokeSpy()).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(revokeSpy()).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revokeSpy()).toHaveBeenCalledWith('blob:tersedia')
  })

  it('URL.createObjectURL yang melempar jadi error ber-code blob', async () => {
    const { downloadPdfBlob } = await realExport()
    stubUrl(() => {
      throw new Error('tab terlalu banyak blob')
    })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    let caught: unknown
    try {
      downloadPdfBlob(new Blob(['x']), 'gagal.pdf')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as { code?: string }).code).toBe('blob')
    expect((caught as Error).message).toBe('tab terlalu banyak blob')
    expect(clickSpy).not.toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('lemparan non-Error tetap dibungkus dengan pesan string', async () => {
    const { downloadPdfBlob } = await realExport()
    stubUrl(() => {
      throw 'blob ditolak'
    })

    const error = await Promise.resolve()
      .then(() => downloadPdfBlob(new Blob(['x']), 'gagal.pdf'))
      .catch((caught: unknown) => caught as Error)

    expect((error as Error & { code?: string }).code).toBe('blob')
    expect((error as Error).message).toBe('blob ditolak')
  })

  it('openPdfBlob membuka tab baru lalu mencabut URL setelah 1000 ms', async () => {
    const { openPdfBlob } = await realExport()
    const blob = new Blob(['%PDF'], { type: 'application/pdf' })
    stubUrl(() => 'blob:buka')
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    openPdfBlob(blob)

    expect(openSpy).toHaveBeenCalledWith('blob:buka', '_blank', 'noopener,noreferrer')
    vi.advanceTimersByTime(1000)
    expect(revokeSpy()).toHaveBeenCalledWith('blob:buka')
  })
})

describe('pdfErrorKey — cabang kode', () => {
  it('memetakan setiap kode ke kunci kamus', async () => {
    const { pdfErrorKey } = await realExport()
    expect(pdfErrorKey(Object.assign(new Error('x'), { code: 'font' }))).toBe('pdf.error.font')
    expect(pdfErrorKey(new PdfExportError('content', 'x'))).toBe('pdf.error.content')
    expect(pdfErrorKey({ code: 'blob' })).toBe('pdf.error.blob')
  })

  it('objek tanpa code, code tak dikenal, dan nilai non-objek jadi gagal umum', async () => {
    const { pdfErrorKey } = await realExport()
    expect(pdfErrorKey(new Error('x'))).toBe('pdf.error.failed')
    expect(pdfErrorKey({ code: 42 })).toBe('pdf.error.failed')
    expect(pdfErrorKey(null)).toBe('pdf.error.failed')
    expect(pdfErrorKey('bukan error')).toBe('pdf.error.failed')
  })
})

/* ------------------------------------------------------ tombol unduh PDF */

const button = (): HTMLButtonElement =>
  document.querySelector('[data-probe="download-pdf"]') as HTMLButtonElement

describe('PdfDownloadButton', () => {
  it('dokumen tidak valid: gulir ke field salah, toast invalid, tanpa ekspor', async () => {
    act(() => {
      useDocStore.getState().loadDoc(invalidEmailDoc())
    })
    render(<PdfDownloadButton />)

    await act(async () => {
      button().click()
      await flush()
    })

    expect(mocks.scrollToFirstInvalidField).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith(id['pdf.error.invalid'])
    expect(mocks.exportPdf).not.toHaveBeenCalled()
    expect(mocks.downloadPdfBlob).not.toHaveBeenCalled()
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
  })

  it('sukses: mengunduh blob dengan nama berkas lalu toast terunduh', async () => {
    const result = exportResult()
    mocks.exportPdf.mockResolvedValue(result)
    render(<PdfDownloadButton />)

    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mocks.exportPdf).toHaveBeenCalledTimes(1)
    // Ekspor selalu lewat antrian, tidak pernah langsung.
    expect(mocks.queueExport).toHaveBeenCalledTimes(1)
    expect(mocks.downloadPdfBlob).toHaveBeenCalledWith(result.blob, 'alex-morgan-classic-ats.pdf')
    expect(mocks.toast).toHaveBeenCalledWith(
      id['pdf.success.downloaded'],
      expect.objectContaining({
        action: expect.objectContaining({ label: id['pdf.action.open'] }),
      }),
    )
    expect(usePdfExportStore.getState().isGenerating).toBe(false)

    // Aksi "Buka" pada toast menyerahkan blob yang sama ke openPdfBlob.
    expect(mocks.openPdfBlob).not.toHaveBeenCalled()
    const toastOptions = mocks.toast.mock.calls[0]?.[1] as {
      action: { label: string; onClick: () => void }
    }
    act(() => {
      toastOptions.action.onClick()
    })
    expect(mocks.openPdfBlob).toHaveBeenCalledWith(result.blob)
  })

  it('menyerahkan kata kunci ke ekspor hanya saat stabilo PDF dinyalakan', async () => {
    mocks.exportPdf.mockResolvedValue(exportResult())
    act(() => {
      useAtsStore.getState().setKeywords(['TypeScript'])
      useUiStore.getState().setIncludeMarksInPdf(true)
    })
    render(<PdfDownloadButton />)

    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })

    const options = mocks.exportPdf.mock.calls[0]?.[2]
    expect(options?.keywords).toEqual(['TypeScript'])

    act(() => {
      useUiStore.getState().setIncludeMarksInPdf(false)
    })
    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })
    const second = mocks.exportPdf.mock.calls[1]?.[2]
    expect(second?.keywords).toEqual([])
  })

  it('gagal: toast memakai pdfErrorKey untuk kode renderer', async () => {
    mocks.exportPdf
      .mockRejectedValueOnce(new PdfExportError('font', 'font hilang'))
      .mockRejectedValueOnce(new Error('entah apa'))
    render(<PdfDownloadButton />)

    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mocks.toast).toHaveBeenCalledWith(id['pdf.error.font'])

    mocks.toast.mockClear()
    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mocks.toast).toHaveBeenCalledWith(id['pdf.error.failed'])
    expect(mocks.downloadPdfBlob).not.toHaveBeenCalled()
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
  })

  it('isGenerating: tombol disabled dan teks sedang membuat', () => {
    act(() => {
      usePdfExportStore.getState().setGenerating(true)
    })
    render(<PdfDownloadButton />)

    expect(button()).toBeDisabled()
    expect(button().textContent).toContain(id['pdf.state.generating'])
    button().click()
    expect(mocks.exportPdf).not.toHaveBeenCalled()
  })

  it('lewat 1200 ms memunculkan pengumuman role=status, lalu hilang saat selesai', async () => {
    let selesai: (value: ExportPdfResult) => void = () => {}
    mocks.exportPdf.mockImplementation(
      () =>
        new Promise<ExportPdfResult>((resolve) => {
          selesai = resolve
        }),
    )
    render(<PdfDownloadButton />)

    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByRole('status')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toBe(id['pdf.state.slow'])
    expect(button().getAttribute('aria-describedby')).toBe(status.id)

    await act(async () => {
      selesai(exportResult())
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
  })

  it('bisa diklik lagi setelah ekspor selesai', async () => {
    mocks.exportPdf.mockResolvedValue(exportResult())
    render(<PdfDownloadButton />)

    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mocks.exportPdf).toHaveBeenCalledTimes(2)
    expect(mocks.downloadPdfBlob).toHaveBeenCalledTimes(2)
  })

  it('unmount saat ekspor berjalan membersihkan timer tanpa error', async () => {
    let abaikan: (value: ExportPdfResult) => void = () => {}
    mocks.exportPdf.mockImplementation(
      () =>
        new Promise<ExportPdfResult>((resolve) => {
          abaikan = resolve
        }),
    )
    const view = render(<PdfDownloadButton />)
    await act(async () => {
      button().click()
      await vi.advanceTimersByTimeAsync(1300)
    })
    expect(screen.getByRole('status').textContent).toBe(id['pdf.state.slow'])

    act(() => {
      view.unmount()
      abaikan(exportResult())
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // `finally` masih jalan setelah unmount: state store dibersihkan, tidak ada lemparan.
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
    expect(mocks.downloadPdfBlob).toHaveBeenCalledTimes(1)
  })
})

/* ----------------------------------------------------------- render nyata */

describe('renderResumePdfToBlob — panggilan nyata untuk 5 template', () => {
  const TEMPLATE_IDS: TemplateId[] = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']

  /** Font dimuat dari public/fonts, meniru jalur `fetch('/fonts/…')` produksi. */
  const stubFonts = (): Mock => {
    const fetchMock = vi.fn<(input: string) => Promise<Response>>(async (input: string) => {
      const file = input.replace('/fonts/', '')
      return new Response(new Uint8Array(readFileSync(path.resolve('public/fonts', file))))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it.each(TEMPLATE_IDS)(
    'template %s menghasilkan blob application/pdf dengan halaman nyata',
    async (templateId) => {
      const fetchMock = stubFonts()
      const doc: ResumeDoc = { ...sampleResume(), templateId }
      const plan = createPagePlan(doc, resolveSpec(templateId, doc.theme, doc.settings.page))

      const result = await renderResumePdfToBlob(doc, plan)

      expect(result.blob.type).toBe('application/pdf')
      expect(result.blob.size).toBeGreaterThan(1000)
      expect(result.bytes).toBe(result.blob.size)
      expect(result.pageCount).toBe(plan.pageCount)
      expect(result.pageCount).toBeGreaterThanOrEqual(1)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      const isi = new TextDecoder('utf-8').decode(await result.blob.arrayBuffer())
      expect(isi.startsWith('%PDF-1.')).toBe(true)
      expect(isi.trimEnd().endsWith('%%EOF')).toBe(true)
      expect(fetchMock).toHaveBeenCalled()
    },
    40000,
  )

  it('kata kunci ikut dirender saat diminta', async () => {
    stubFonts()
    const doc = sampleResume()
    const plan = createPagePlan(doc, resolveSpec(doc.templateId, doc.theme, doc.settings.page))
    const plain = await renderResumePdfToBlob(doc, plan, { keywords: [] })
    const marked = await renderResumePdfToBlob(doc, plan, { keywords: ['PostgreSQL'] })
    expect(marked.bytes).toBeGreaterThan(plain.bytes)
    expect(marked.pageCount).toBe(plain.pageCount)
  })

  it('exportPdf menambahkan nama berkas hasil pdfFilename di atas hasil renderer', async () => {
    stubFonts()
    const { exportPdf } = await vi.importActual<ExportModule>('@/features/pdf/exportPdf')
    const doc = sampleResume()
    const plan = createPagePlan(doc, resolveSpec(doc.templateId, doc.theme, doc.settings.page))

    const result = await exportPdf(doc, plan)

    expect(result.filename).toBe('cv-alex-morgan-software-engineer-classic-ats.pdf')
    expect(result.blob.type).toBe('application/pdf')
    expect(result.pageCount).toBe(plan.pageCount)
    expect(result.bytes).toBe(result.blob.size)
  })

  it('font yang gagal di jaringan jadi PdfExportError code font', async () => {
    const { pdfErrorKey } = await realExport()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const doc = sampleResume()
    const plan = createPagePlan(doc, resolveSpec(doc.templateId, doc.theme, doc.settings.page))

    const error = await renderResumePdfToBlob(doc, plan).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfExportError)
    expect((error as PdfExportError).code).toBe('font')
    expect(pdfErrorKey(error)).toBe('pdf.error.font')
  })

  it('font yang dibalas 404 jadi PdfExportError code font', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('tidak ada', { status: 404 }))),
    )
    const doc = sampleResume()
    const plan = createPagePlan(doc, resolveSpec(doc.templateId, doc.theme, doc.settings.page))

    const error = await renderResumePdfToBlob(doc, plan).catch((e: unknown) => e)
    expect((error as PdfExportError).code).toBe('font')
    expect((error as PdfExportError).message).toMatch(/Font PDF gagal dimuat/u)
  })

  it('lemparan non-Error dari fetch tetap dibungkus jadi error font', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject('jaringan mati')),
    )
    const doc = sampleResume()
    const plan = createPagePlan(doc, resolveSpec(doc.templateId, doc.theme, doc.settings.page))

    const error = await renderResumePdfToBlob(doc, plan).catch((e: unknown) => e)
    expect((error as PdfExportError).message).toBe('jaringan mati')
    expect((error as PdfExportError).code).toBe('font')
  })
})

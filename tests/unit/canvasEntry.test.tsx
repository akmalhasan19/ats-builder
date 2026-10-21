import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { buildBlocks } from '@/features/preview/blocks'
import { validateCanvasDates } from '@/features/canvas/canvasCommit'
import { resolveSpec } from '@/features/templates/specs'
import { useCanvasStore } from '@/store/canvasStore'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { createSampleDoc, DOC_LIMITS } from '@/schema/resume'
import type { CanvasFieldTarget } from '@/features/canvas/canvasFields'
import type { ResumeDoc, SectionInstance } from '@/types/resume'

/**
 * C4 — entri di atas kertas: kepala entri (role/company/dst), bullet, popover
 * tanggal, dan ghost row struktural (D10).
 */

vi.mock('sonner', () => ({ toast: vi.fn() }))

const load = (doc: ResumeDoc) => {
  act(() => {
    usePreviewStore.getState().resetHeights()
    useDocStore.getState().loadDoc(doc)
    useCanvasStore.setState({ session: null, modeHintSeen: false, zoomRaised: false })
  })
}

const renderWell = () =>
  render(
    <TooltipProvider>
      <PreviewWell />
    </TooltipProvider>,
  )

const toCanvas = () => act(() => useUiStore.getState().setEditMode('canvas'))

const fieldButton = (path: string) =>
  document.querySelector<HTMLButtonElement>(`[data-field="${path}"]`)

const editor = () =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.canvas-editor')

const ghost = (kind: 'entry' | 'bullet' | 'section') =>
  document.querySelector<HTMLButtonElement>(`[data-canvas-ghost="${kind}"]`)

const sectionOf = (kind: SectionInstance['kind']) =>
  useDocStore.getState().doc.sections.find((section) => section.kind === kind)

const entriesOf = (kind: SectionInstance['kind']) =>
  (sectionOf(kind)?.data as { entries?: Record<string, unknown>[] } | undefined)?.entries ?? []

const firstEntryId = (kind: SectionInstance['kind']) => String(entriesOf(kind)[0]?.id)

/** Isi satu field lewat editor kanvas (klik → ketik → commit). */
const fillCanvas = async (user: UserEvent, path: string, value: string) => {
  const button = fieldButton(path)
  expect(button, `segmen ${path} harus ada`).not.toBeNull()
  await user.click(button!)
  const control = editor()
  expect(control, `editor untuk ${path} harus terbuka`).not.toBeNull()
  await user.clear(control!)
  await user.type(control!, value)
  // Bullet = satu baris: Enter commit (OQ6). Ringkasan masih Ctrl+Enter (D3).
  const textarea = control!.tagName === 'TEXTAREA'
  const bullet = path.includes('bullets[') || path.includes('notes[')
  if (textarea && !bullet) await user.keyboard('{Control>}{Enter}{/Control}')
  else await user.keyboard('{Enter}')
  await waitFor(() => expect(editor()).toBeNull())
}

const withoutMeta = (doc: ResumeDoc) => ({ ...doc, meta: undefined })

const openCanvas = async (doc: ResumeDoc = createSampleDoc()) => {
  load(doc)
  toCanvas()
  renderWell()
  return doc
}

beforeEach(() => {
  act(() => {
    useUiStore.setState({
      editMode: 'form',
      panelMode: '3col',
      fitMode: false,
      zoom: 1,
      sectionCatalogOpen: false,
    })
    useCanvasStore.setState({ session: null, modeHintSeen: false, zoomRaised: false })
    vi.mocked(toast).mockReset()
  })
})

describe('kepala entri editable di kertas (C4.1)', () => {
  it('klik segmen role → editor → Enter: nilai masuk ke entri lewat updateEntry', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('experience')

    await fillCanvas(user, `entries.experience.${entryId}.role`, 'Staff Engineer')

    const entry = entriesOf('experience')[0] as Record<string, unknown>
    expect(entry.role).toBe('Staff Engineer')
    expect(entry.company).toBe('Tech Nusantara Corp')
    expect(fieldButton(`entries.experience.${entryId}.role`)?.textContent).toBe('Staff Engineer')
    // Baris komposit tetap "role — company" (D4): segmen berubah, teks utuh tidak.
    expect(
      document.querySelector(`[data-block-key="${sectionOf('experience')?.id}:${entryId}:head"]`),
    ).not.toBeNull()
  })

  it('mengisi kepala entri dari kertas == dari form (dokumen identik)', async () => {
    const user = userEvent.setup()
    const doc = await openCanvas()
    const entryId = firstEntryId('experience')

    await fillCanvas(user, `entries.experience.${entryId}.role`, 'Backend Engineer')
    await fillCanvas(user, `entries.experience.${entryId}.company`, 'Kirana Digital')
    await fillCanvas(user, `entries.experience.${entryId}.location`, 'Yogyakarta')

    const viaCanvas = useDocStore.getState().doc

    load(doc)
    const formDoc = useDocStore.getState()
    formDoc.updateEntry(
      doc.sections.find((s) => s.kind === 'experience')!.id,
      entryId,
      (entry) =>
        ({
          ...(entry as Record<string, unknown>),
          role: 'Backend Engineer',
          company: 'Kirana Digital',
          location: 'Yogyakarta',
        }) as never,
    )
    const viaForm = useDocStore.getState().doc

    expect(withoutMeta(viaCanvas)).toEqual(withoutMeta(viaForm))
  })

  it('field wajib entri dikosongkan: nilai kosong ditulis, guide tampil lagi', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('experience')

    await user.click(fieldButton(`entries.experience.${entryId}.role`)!)
    await user.clear(editor()!)
    await user.keyboard('{Enter}')

    expect((entriesOf('experience')[0] as Record<string, unknown>).role).toBe('')
    expect(useCanvasStore.getState().session).toBeNull()
    const slot = fieldButton(`entries.experience.${entryId}.role`)
    expect(slot).toHaveAttribute('data-canvas-guide', 'true')
    expect(slot?.textContent).toBe(t('canvas.guide.role'))
  })

  it('judul pendidikan memakai separator ", " dan tiap field punya target sendiri', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('education')

    await fillCanvas(user, `entries.education.${entryId}.degree`, 'S.T.')
    await fillCanvas(user, `entries.education.${entryId}.field`, 'Teknik Informatika')
    await fillCanvas(user, `entries.education.${entryId}.institution`, 'ITB')

    const entry = entriesOf('education')[0] as Record<string, unknown>
    expect([entry.degree, entry.field, entry.institution]).toEqual([
      'S.T.',
      'Teknik Informatika',
      'ITB',
    ])
    expect(fieldButton(`entries.education.${entryId}.degree`)?.parentElement?.textContent).toBe(
      'S.T., Teknik Informatika',
    )
  })

  it('undo membatalkan satu commit kepala entri', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('experience')

    await fillCanvas(user, `entries.experience.${entryId}.company`, 'Kirana Digital')
    act(() => useDocStore.getState().undo())

    expect((entriesOf('experience')[0] as Record<string, unknown>).company).toBe(
      'Tech Nusantara Corp',
    )
  })
})

describe('editor tanggal on-canvas (C4.2)', () => {
  const datesPath = (kind: string, entryId: string) => `entries.${kind}.${entryId}.dates`

  it('klik segmen tanggal → popover dengan MonthPicker & sakelar "masih di sini"', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('experience')

    await user.click(fieldButton(datesPath('experience', entryId))!)

    const popover = document.querySelector('[data-probe="canvas-dates"]')
    expect(popover).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-probe="canvas-dates"] input[type="month"]'),
    ).toHaveLength(2)
  })

  // §5.3 — C5.1: di panel mode `tabs` (<1024px) editor tanggal dibuka sebagai
  // Sheet bawah; probe isi & tombol sama persis dengan popover desktop.
  it('panel mode tabs: editor tanggal sebagai Sheet bawah, Simpan tetap commit', async () => {
    const user = userEvent.setup()
    act(() => useUiStore.setState({ panelMode: 'tabs' }))
    await openCanvas()
    const entryId = firstEntryId('experience')

    await user.click(fieldButton(datesPath('experience', entryId))!)

    const panel = document.querySelector('[data-probe="canvas-dates"]')
    expect(panel).not.toBeNull()
    // Varian Sheet (bukan popover): konten di-render lewat DialogPrimitive dengan
    // `data-side` dari SheetContent.
    expect(panel!.closest('[data-side="bottom"]')).not.toBeNull()
    expect(
      document.querySelectorAll('[data-probe="canvas-dates"] input[type="month"]'),
    ).toHaveLength(2)

    const [start] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-probe="canvas-dates"] input[type="month"]',
      ),
    )
    await user.clear(start!)
    await user.type(start!, '2020-05')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => {
      const entry = entriesOf('experience')[0] as Record<string, unknown>
      expect(entry.startDate).toBe('2020-05')
    })
    expect(useCanvasStore.getState().session).toBeNull()
  })

  it('Simpan menulis startDate/endDate; Escape membatalkan draft', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const sectionId = sectionOf('experience')!.id
    const entryId = firstEntryId('experience')

    await user.click(fieldButton(datesPath('experience', entryId))!)
    const [start] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-probe="canvas-dates"] input[type="month"]',
      ),
    )
    await user.clear(start!)
    await user.type(start!, '2020-01')

    // Escape = batal: draft dibuang, dokumen tidak tersentuh.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('[data-probe="canvas-dates"]')).toBeNull())
    expect((entriesOf('experience')[0] as Record<string, unknown>).startDate).toBe('2022-04')

    await user.click(fieldButton(datesPath('experience', entryId))!)
    const [again] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-probe="canvas-dates"] input[type="month"]',
      ),
    )
    await user.clear(again!)
    await user.type(again!, '2020-01')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() =>
      expect((entriesOf('experience')[0] as Record<string, unknown>).startDate).toBe('2020-01'),
    )
    expect(useDocStore.getState().doc.sections.find((s) => s.id === sectionId)).toBeDefined()
    expect(useCanvasStore.getState().session).toBeNull()
  })

  it('sakelar "masih di sini" menghapus endDate dan menampilkannya sebagai SEKARANG', async () => {
    const user = userEvent.setup()
    const doc = createSampleDoc()
    const experience = doc.sections.find((section) => section.kind === 'experience')!
    // Entri kedua sudah selesai; jadikan target uji sakelar.
    const entries = (experience.data as { entries: Record<string, unknown>[] }).entries
    entries[0] = { ...entries[0]!, current: false, endDate: '2024-06' }
    await openCanvas(doc)
    const entryId = String(entries[0]!.id)

    await user.click(fieldButton(datesPath('experience', entryId))!)
    await user.click(screen.getByRole('switch', { name: 'Saya masih bekerja di sini' }))
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => {
      const entry = entriesOf('experience')[0] as Record<string, unknown>
      expect(entry.current).toBe(true)
      expect(entry.endDate).toBe('')
    })
    expect(fieldButton(datesPath('experience', entryId))?.textContent).toContain('SEKARANG')
  })

  it('format tanggal salah ditolak dengan pesan zod yang sama seperti form', () => {
    load(createSampleDoc())
    toCanvas()
    const sectionId = sectionOf('experience')!.id
    const target: CanvasFieldTarget = {
      kind: 'entry-dates',
      sectionId,
      entryKind: 'experience',
      entryId: firstEntryId('experience'),
    }

    expect(
      validateCanvasDates(target, { startDate: '2024-13', endDate: '', current: false }),
    ).toContain('Tanggal harus format YYYY-MM')
    expect(
      validateCanvasDates(target, { startDate: '2024-03', endDate: '2025-01', current: false }),
    ).toBeNull()
  })

  it('proyek: range tanpa sakelar; sertifikasi: satu tanggal (issuedAt)', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const projectId = firstEntryId('projects')

    await user.click(fieldButton(datesPath('projects', projectId))!)
    expect(
      document.querySelectorAll('[data-probe="canvas-dates"] input[type="month"]'),
    ).toHaveLength(2)
    expect(document.querySelectorAll('[data-probe="canvas-dates"] [role="switch"]')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Batal' }))

    const certificateId = firstEntryId('certifications')
    await user.click(fieldButton(datesPath('certifications', certificateId))!)
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '[data-probe="canvas-dates"] input[type="month"]',
    )
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!.value).toBe('2023-11')

    await user.clear(inputs[0]!)
    await user.type(inputs[0]!, '2024-02')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() =>
      expect((entriesOf('certifications')[0] as Record<string, unknown>).issuedAt).toBe('2024-02'),
    )
  })

  it('pendidikan tidak punya segmen tanggal — dokumen tidak menampilkannya', () => {
    const entryId = firstEntryId('education')
    expect(fieldButton(datesPath('education', entryId))).toBeNull()
  })
})

describe('bullet editable di kertas (C4.3)', () => {
  it('Enter commit untuk bullet (OQ6): satu baris teks masuk ke array bullets', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('experience')

    await fillCanvas(user, `entries.experience.${entryId}.bullets[0]`, 'Memangkas latensi 40%.')

    const entry = entriesOf('experience')[0] as { bullets: string[] }
    expect(entry.bullets[0]).toBe('Memangkas latensi 40%.')
    expect(entry.bullets).toHaveLength(3)
  })

  it('bullet dikosongkan: keluar dari model (barisnya memang tidak digambar)', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('experience')

    await user.click(fieldButton(`entries.experience.${entryId}.bullets[1]`)!)
    await user.clear(editor()!)
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect((entriesOf('experience')[0] as { bullets: string[] }).bullets).toHaveLength(2),
    )
  })

  it('bullet entri pendidikan menulis array notes', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const entryId = firstEntryId('education')

    await fillCanvas(user, `entries.education.${entryId}.notes[0]`, 'Skripsi tentang rekomendasi.')

    expect((entriesOf('education')[0] as { notes: string[] }).notes[0]).toBe(
      'Skripsi tentang rekomendasi.',
    )
  })

  it('stack & baris bebas bukan field editable (tetap teks biasa)', async () => {
    await openCanvas()

    const stackBlock = document.querySelector(
      '[data-block-kind="entry-line"][data-block-key$=":l3"]',
    )
    expect(stackBlock, 'baris stack tetap blok tersendiri').not.toBeNull()
    expect(stackBlock!.querySelector('[data-field]'), 'stack bukan field kanvas').toBeNull()
    expect(stackBlock!.textContent).toContain('TypeScript')
  })
})

describe('ghost row struktural (C4.4)', () => {
  it('mode kanvas: ghost tambah entri per bagian, tambah bullet per entri, tambah bagian di akhir', () => {
    load(createSampleDoc())
    toCanvas()
    renderWell()

    // experience, education, projects, certifications, languages = 5 bagian ber-entri
    expect(document.querySelectorAll('[data-canvas-ghost="entry"]')).toHaveLength(5)
    // entri yang punya array bullet: 2 pengalaman + 1 pendidikan + 2 proyek
    expect(document.querySelectorAll('[data-canvas-ghost="bullet"]')).toHaveLength(5)
    expect(document.querySelectorAll('[data-canvas-ghost="section"]')).toHaveLength(1)
  })

  it('mode form & thumbnail: nol ghost row', () => {
    load(createSampleDoc())
    renderWell()
    expect(document.querySelector('[data-canvas-ghost]')).toBeNull()
  })

  it('"+ Tambahkan entri" membuat entri baru dan membuka sesi field pertamanya', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const before = entriesOf('experience').length

    await user.click(ghost('entry')!)
    await waitFor(() => expect(entriesOf('experience')).toHaveLength(before + 1))

    const newId = String(entriesOf('experience').at(-1)!.id)
    expect(editor()).not.toBeNull()
    expect(useCanvasStore.getState().session?.fieldPath).toBe(`entries.experience.${newId}.role`)

    await user.type(editor()!, 'Pengembang Web')
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect((entriesOf('experience').at(-1) as Record<string, unknown>).role).toBe(
        'Pengembang Web',
      ),
    )
  })

  it('"+ Tambahkan bullet" mendorong slot kosong lalu membukanya untuk diketik', async () => {
    const user = userEvent.setup()
    await openCanvas()
    const before = (entriesOf('experience')[0] as { bullets: string[] }).bullets.length

    await user.click(ghost('bullet')!)
    await waitFor(() =>
      expect((entriesOf('experience')[0] as { bullets: string[] }).bullets).toHaveLength(
        before + 1,
      ),
    )
    expect((entriesOf('experience')[0] as { bullets: string[] }).bullets[before]).toBe('')

    const control = editor()
    expect(control, 'editor bullet baru harus langsung terbuka').not.toBeNull()
    await user.type(control!, 'Baru: menaikkan konversi 12%.')
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect((entriesOf('experience')[0] as { bullets: string[] }).bullets[before]).toBe(
        'Baru: menaikkan konversi 12%.',
      ),
    )
    // Slot kosong tidak meninggalkan baris hantu di dokumen.
    expect((entriesOf('experience')[0] as { bullets: string[] }).bullets).toHaveLength(before + 1)
  })

  it('membatalkan bullet baru tidak meninggalkan string kosong di model', async () => {
    const user = userEvent.setup()
    await openCanvas()

    await user.click(ghost('bullet')!)
    await waitFor(() =>
      expect((entriesOf('experience')[0] as { bullets: string[] }).bullets).toHaveLength(4),
    )
    await user.keyboard('{Enter}') // commit kosong → slot dibuang

    await waitFor(() =>
      expect((entriesOf('experience')[0] as { bullets: string[] }).bullets).toHaveLength(3),
    )
  })

  it('"+ Tambahkan bagian" membuka dialog katalog yang sama dengan rail (D10)', async () => {
    const user = userEvent.setup()
    await openCanvas()

    await user.click(ghost('section')!)
    expect(useUiStore.getState().sectionCatalogOpen).toBe(true)
  })

  it('entri buatan ghost yang diisi di kanvas == entri buatan form dengan isi yang sama', async () => {
    const user = userEvent.setup()
    const doc = await openCanvas()
    const sectionId = sectionOf('experience')!.id

    await user.click(ghost('entry')!)
    await waitFor(() => expect(entriesOf('experience')).toHaveLength(3))
    const newId = String(entriesOf('experience').at(-1)!.id)

    // Ghost sudah membuka sesi field pertama (D10) → role tinggal diketik.
    expect(useCanvasStore.getState().session?.fieldPath).toBe(`entries.experience.${newId}.role`)
    await user.clear(editor()!)
    await user.type(editor()!, 'Data Analyst')
    await user.keyboard('{Enter}')

    await fillCanvas(user, `entries.experience.${newId}.company`, 'Nimbus Works')
    await user.click(fieldButton(`entries.experience.${newId}.dates`)!)
    const months = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-probe="canvas-dates"] input[type="month"]',
      ),
    )
    await user.clear(months[0]!)
    await user.type(months[0]!, '2019-04')
    await user.clear(months[1]!)
    await user.type(months[1]!, '2021-08')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    const lineBlock = document.querySelector(`[data-block-key="${sectionId}:${newId}:l0"]`)
    const bulletGhost = lineBlock?.nextElementSibling?.querySelector<HTMLButtonElement>(
      '[data-canvas-ghost="bullet"]',
    )
    expect(bulletGhost, 'ghost bullet entri baru harus ada').not.toBeNull()
    await user.click(bulletGhost!)
    expect(useCanvasStore.getState().session?.fieldPath).toBe(
      `entries.experience.${newId}.bullets[0]`,
    )
    await user.clear(editor()!)
    await user.type(editor()!, 'Merapikan pipeline metrik.')
    await user.keyboard('{Enter}')

    const viaCanvas = entriesOf('experience').at(-1)!
    const docViaCanvas = useDocStore.getState().doc

    // Jalur form: addEntry + updateEntry, skrip isi yang sama persis.
    load(doc)
    const store = useDocStore.getState()
    store.addEntry(sectionId)
    const formId = String(entriesOf('experience').at(-1)!.id)
    store.updateEntry(
      sectionId,
      formId,
      (entry) =>
        ({
          ...(entry as Record<string, unknown>),
          role: 'Data Analyst',
          company: 'Nimbus Works',
          startDate: '2019-04',
          endDate: '2021-08',
        }) as never,
    )
    store.updateEntry(
      sectionId,
      formId,
      (entry) =>
        ({
          ...(entry as Record<string, unknown>),
          bullets: ['Merapikan pipeline metrik.'],
        }) as never,
    )
    const viaForm = entriesOf('experience').at(-1)!

    const withoutId = (entry: Record<string, unknown>) => {
      const rest = { ...entry }
      delete rest.id
      return rest
    }
    expect(withoutId(viaCanvas)).toEqual(withoutId(viaForm))
    // Bagian lain dokumen tidak tersentuh jalur kanvas.
    expect(docViaCanvas.sections.filter((section) => section.id !== sectionId)).toEqual(
      useDocStore.getState().doc.sections.filter((section) => section.id !== sectionId),
    )
  })

  it('DOC_LIMITS mematikan ghost row dengan alasan di tooltip', async () => {
    const user = userEvent.setup()
    const doc = createSampleDoc()
    const experience = doc.sections.find((section) => section.kind === 'experience')!
    const data = experience.data as { entries: Record<string, unknown>[] }
    data.entries = Array.from({ length: DOC_LIMITS.entriesPerSection }, (_, index) => ({
      id: `entry-${index}`,
      role: `Peran ${index}`,
      company: 'Perusahaan',
      location: '',
      startDate: '2020-01',
      endDate: '2021-01',
      current: false,
      bullets: ['Satu bullet.'],
      stack: [],
    }))
    await openCanvas(doc)

    const entryGhost = ghost('entry')
    expect(entryGhost).not.toBeNull()
    expect(entryGhost).toBeDisabled()

    await user.hover(entryGhost!.parentElement!)
    expect(await screen.findByText(/Batas 40 entri per bagian tercapai/)).toBeInTheDocument()
  })

  it('ghost bullet mati saat 60 bullet tercapai', async () => {
    const doc = createSampleDoc()
    const experience = doc.sections.find((section) => section.kind === 'experience')!
    const data = experience.data as { entries: Record<string, unknown>[] }
    data.entries = [
      {
        ...data.entries[0]!,
        bullets: Array.from({ length: DOC_LIMITS.bulletsPerEntry }, (_, index) => `B${index}`),
      },
    ]
    await openCanvas(doc)

    const bulletGhost = document.querySelector<HTMLButtonElement>('[data-canvas-ghost="bullet"]')
    expect(bulletGhost).not.toBeNull()
    expect(bulletGhost).toBeDisabled()
  })
})

describe('paritas layar ↔ PDF (Gate C4)', () => {
  it('bullet kosong hanya punya blok di rencana kanvas; kunci blok tetap unik', () => {
    const doc = createSampleDoc()
    const experience = doc.sections.find((section) => section.kind === 'experience')!
    const data = experience.data as { entries: Record<string, unknown>[] }
    const entryId = String(data.entries[0]!.id)
    const original = (data.entries[0] as { bullets: string[] }).bullets
    data.entries[0] = { ...data.entries[0]!, bullets: [...original, ''] }

    const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const content = buildBlocks(doc, spec)
    const canvas = buildBlocks(doc, spec, { guides: true })

    const lineCount = (blocks: typeof content) =>
      blocks.filter((block) => block.itemId === entryId && block.kind === 'entry-line').length
    // 3 bullet + 1 baris stack; bullet kosong tidak digambar di rencana isi.
    expect(lineCount(content)).toBe(4)
    expect(lineCount(canvas)).toBe(5)

    const keys = canvas.map((block) => block.key)
    expect(new Set(keys).size, 'kunci blok tidak boleh kembar').toBe(keys.length)
    // Ghost row bukan bagian dari rencana blok sama sekali.
    expect(keys.some((key) => key.includes('ghost'))).toBe(false)
  })
})

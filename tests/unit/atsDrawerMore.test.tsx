import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { buildReport } from '@/features/ats/engine'
import { simulateParseOrder } from '@/features/ats/parseTape'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { getSpec, resolveSpec } from '@/features/templates/specs'
import { AtsDockSlot, AtsOverlay } from '@/features/ats/components/AtsDrawer'
import { AtsPanel } from '@/features/ats/components/AtsPanel'
import { DOC_LIMITS } from '@/schema/resume'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import { JOB_DESCRIPTION } from '../fixtures/jobDescription'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { useErrorStore } from '@/store/errorStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import type { AtsReport, AtsSeverity } from '@/features/ats/types'
import type { ResumeDoc, SectionInstance } from '@/types/resume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

/**
 * T9.x — cabang `AtsDrawer.tsx` & isi panel yang belum tertutup
 * `tests/unit/atsDrawer.test.tsx`: bentuk overlay vs dock, Esc, tab beserta
 * jummlah isu, `UNCLAIMED` + statistik tape, chip kata kunci yang memfokuskan
 * field keahlian, pemotongan batas karakter deskripsi lowongan, dan keempat
 * state kosong dengan disclaimer permanen (P5).
 */

const DOCK_QUERY = '(min-width: 1600px)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const stubMedia = (map: Record<string, boolean>): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: map[query] === true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    onchange: null,
  }))
}

const probe = (root: ParentNode, name: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const textareaOf = (root: ParentNode): HTMLTextAreaElement => {
  const node = root.querySelector<HTMLTextAreaElement>('[data-probe="ats-jd-input"]')
  if (!node) throw new Error('textarea lowongan tidak dirender')
  return node
}

const all = (root: ParentNode, name: string): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(`[data-probe="${name}"]`),
]

const docWith = (patch: Partial<ResumeDoc>): ResumeDoc => ({ ...sampleResume(), ...patch })

const withProfile = (patch: Record<string, unknown>): ResumeDoc =>
  ({
    ...sampleResume(),
    sections: sampleResume().sections.map((section): SectionInstance =>
      section.kind === 'profile'
        ? ({ ...section, data: { ...section.data, ...patch } } as typeof section)
        : section,
    ),
  }) as ResumeDoc

const withBullet = (text: string): ResumeDoc =>
  ({
    ...sampleResume(),
    sections: sampleResume().sections.map((section): SectionInstance => {
      if (section.kind !== 'experience' || section.id !== SAMPLE_IDS.experience) return section
      const [first, ...rest] = section.data.entries
      if (!first || !('bullets' in first)) return section
      return {
        ...section,
        data: { entries: [{ ...first, bullets: [text, ...first.bullets] }, ...rest] },
      } as SectionInstance
    }),
  }) as ResumeDoc

/** Laporan tanpa satu pun isu yang bisa diperbaiki (semua `ok`). */
const cleanReport = (): AtsReport => {
  const base = buildReport(sampleResume(), 1, 0)
  const issues = base.issues.filter((issue) => issue.severity === 'ok')
  return { ...base, issues, score: 100 }
}

const actionableOf = (report: AtsReport): number =>
  report.issues.filter((issue: { severity: AtsSeverity }) => issue.severity !== 'ok').length

const noop = () => undefined

let scroll = vi.fn()
let writeText = vi.fn()

beforeEach(() => {
  stubMedia({ [DOCK_QUERY]: false, [REDUCED_MOTION]: true })
  scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: scroll,
    configurable: true,
    writable: true,
  })
  writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  vi.mocked(toast).mockClear()

  useDocStore.getState().loadDoc(sampleResume())
  useUiStore.setState({
    atsDrawerOpen: true,
    atsTab: 'issues',
    panelMode: '3col',
    activeTab: 'form',
    showKeywordMarks: true,
    includeMarksInPdf: false,
  })
  useAtsStore.setState({
    report: null,
    isChecking: false,
    hasOpened: true,
    lastCheckedAt: null,
    keywords: [],
  })
  useErrorStore.setState({ banner: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AtsDrawer — overlay vs dock §2.4', () => {
  it('< 1600px mode 3 kolom: drawer adalah sheet non-modal, bukan kolom ke-4', () => {
    const { baseElement } = render(<AtsOverlay />)
    expect(probe(baseElement, 'ats-drawer')?.tagName).toBe('DIV')
    expect(baseElement.querySelector('aside[data-probe="ats-drawer"]')).toBeNull()
    expect(
      baseElement.querySelector('[data-slot="sheet-content"]')?.getAttribute('data-side'),
    ).toBe('right')
    expect(probe(baseElement, 'ats-panel')).not.toBeNull()
    // Non-modal (Gate Fase 7): tidak ada scrim, fokus boleh keluar ke field form.
    expect(baseElement.querySelector('[data-slot="sheet-overlay"]')).toBeNull()
  })

  it('mode tab: sisi drawer pindah ke bawah, scrim tampil, dan dialog modal', () => {
    useUiStore.setState({ panelMode: 'tabs' })
    const { baseElement } = render(<AtsOverlay />)
    expect(
      baseElement.querySelector('[data-slot="sheet-content"]')?.getAttribute('data-side'),
    ).toBe('bottom')
    const scrim = baseElement.querySelector('[data-slot="sheet-overlay"]')
    expect(scrim).not.toBeNull()
    expect(scrim?.getAttribute('class')).toContain('inset-0')
    expect(baseElement.querySelector('[data-probe="ats-drawer"]')?.getAttribute('role')).toBe(
      'dialog',
    )
  })

  it('≥ 1600px: overlay hilang dan drawer menjadi <aside> tanpa scrim', () => {
    stubMedia({ [DOCK_QUERY]: true, [REDUCED_MOTION]: true })
    const overlay = render(<AtsOverlay />)
    expect(overlay.baseElement.querySelector('[data-slot="sheet-content"]')).toBeNull()
    overlay.unmount()

    const { baseElement } = render(<AtsDockSlot />)
    const aside = baseElement.querySelector('aside[data-probe="ats-drawer"]')
    expect(aside).not.toBeNull()
    expect(aside?.getAttribute('aria-labelledby')).toBe('ats-drawer-title')
    expect(baseElement.querySelector('[data-slot="sheet-overlay"]')).toBeNull()
    expect(probe(baseElement, 'ats-panel')).not.toBeNull()
  })

  it('dock tertutup → tidak ada <aside> sama sekali', () => {
    stubMedia({ [DOCK_QUERY]: true, [REDUCED_MOTION]: true })
    useUiStore.setState({ atsDrawerOpen: false })
    const { baseElement } = render(<AtsDockSlot />)
    expect(baseElement.querySelector('aside[data-probe="ats-drawer"]')).toBeNull()
  })

  it('tombol silang di dalam dock menutup lewat uiStore (jalur onClose dock)', async () => {
    stubMedia({ [DOCK_QUERY]: true, [REDUCED_MOTION]: true })
    const user = userEvent.setup()
    const { baseElement } = render(<AtsDockSlot />)
    const aside = baseElement.querySelector('aside[data-probe="ats-drawer"]')
    if (!aside) throw new Error('dock tidak dirender')
    await user.click(
      aside.querySelector<HTMLButtonElement>(`[aria-label="${t('ats.drawer.close')}"]`)!,
    )
    expect(useUiStore.getState().atsDrawerOpen).toBe(false)
  })

  it('klik di luar drawer non-modal tidak menutupnya (fokus boleh keluar ke form)', async () => {
    const user = userEvent.setup()
    const outside = document.createElement('button')
    outside.id = 'di-luar-drawer'
    outside.type = 'button'
    outside.textContent = 'luar'
    document.body.appendChild(outside)

    render(<AtsOverlay />)
    await waitFor(() => {
      expect(document.querySelector('[data-probe="ats-drawer"]')).not.toBeNull()
    })
    await user.click(outside)
    fireEvent.pointerDown(outside, { bubbles: true })
    // Pindahkan fokus sungguhan dari drawer ke elemen di luar → Radix mengirim
    // `focusOutside`; handler drawer memanggil preventDefault supaya drawer
    // tidak tertutup saat fokus berpindah ke field form.
    const content = document.querySelector<HTMLElement>('[data-probe="ats-drawer"]')
    if (!content) throw new Error('drawer tidak dirender')
    content.focus()
    outside.focus()

    expect(useUiStore.getState().atsDrawerOpen).toBe(true)
    expect(document.querySelector('[data-probe="ats-drawer"]')).not.toBeNull()
    outside.remove()
  })

  it('Esc menutup drawer dan menulis status uiStore', async () => {
    useUiStore.setState({ panelMode: 'tabs', atsDrawerOpen: true })
    render(<AtsOverlay />)
    await waitFor(() => {
      expect(document.querySelector('[data-probe="ats-drawer"]')).not.toBeNull()
    })
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(useUiStore.getState().atsDrawerOpen).toBe(false)
      expect(document.querySelector('[data-probe="ats-drawer"]')).toBeNull()
    })
  })

  it('tombol silang (aria-label kamus) menutup drawer', async () => {
    const user = userEvent.setup()
    const { baseElement } = render(<AtsOverlay />)
    await user.click(
      baseElement.querySelector<HTMLButtonElement>(`[aria-label="${t('ats.drawer.close')}"]`)!,
    )
    expect(useUiStore.getState().atsDrawerOpen).toBe(false)
  })

  it('versi dock tidak menampilkan tombol silang (showClose false)', () => {
    const { container } = render(<AtsPanel onClose={noop} showClose={false} />)
    expect(container.querySelector(`[aria-label="${t('ats.drawer.close')}"]`)).toBeNull()
    expect(screen.getByText(t('ats.drawer.title'))).toBeDefined()
  })
})

describe('tab drawer — label & jumlah isu', () => {
  it('label tab memakai kamus dan n = isu non-ok', () => {
    const report = buildReport(withProfile({ email: 'bukan-email' }), 2, 0)
    useAtsStore.setState({ report })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-tab-issues')?.textContent).toBe(
      t('ats.tab.issues', { count: actionableOf(report) }),
    )
    expect(probe(container, 'ats-tab-issues')?.textContent).toContain('Masalah')
    expect(probe(container, 'ats-tab-tape')?.textContent).toBe(t('ats.tab.tape'))
    expect(actionableOf(report)).toBeGreaterThan(0)
  })

  it('pindah ke tab Parse tape mengubah uiStore.atsTab dan tetap bisa kembali', async () => {
    const user = userEvent.setup()
    useAtsStore.setState({ report: cleanReport() })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-tape')).toBeNull()
    await user.click(probe(container, 'ats-tab-tape')!)
    expect(useUiStore.getState().atsTab).toBe('tape')
    expect(probe(container, 'ats-tape')).not.toBeNull()
    await user.click(probe(container, 'ats-tab-issues')!)
    expect(useUiStore.getState().atsTab).toBe('issues')
    expect(probe(container, 'ats-tape')).toBeNull()
  })

  it('state awal tab dari uiStore dipakai apa adanya (tape sudah aktif)', () => {
    useUiStore.setState({ atsTab: 'tape' })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-tape')).not.toBeNull()
    expect(probe(container, 'ats-tab-tape')?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('ParseTapeView — jujuran mesin', () => {
  const openTape = async (container: ParentNode, user: ReturnType<typeof userEvent.setup>) => {
    await user.click(probe(container, 'ats-tab-tape')!)
    return probe(container, 'ats-tape')
  }

  it('baris tak terbaca mesin ditandai UNCLAIMED + warna warn + petunjuk', async () => {
    const user = userEvent.setup()
    useDocStore.getState().loadDoc(withBullet('🚀 Meluncurkan layanan baru dengan 20k pengguna.'))
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const tape = await openTape(container, user)
    expect(tape).not.toBeNull()
    const unclaimed = [...(tape?.querySelectorAll('span') ?? [])].filter(
      (span) => span.textContent === 'UNCLAIMED',
    )
    expect(unclaimed.length).toBeGreaterThan(0)
    expect(unclaimed[0]?.classList.contains('text-signal-warn')).toBe(true)
    expect(tape?.textContent).toContain(t('ats.tape.unclaimedHint'))
    expect(tape?.textContent).toContain('Meluncurkan layanan baru')
  })

  it('tape bersih → tanpa penanda UNCLAIMED dan tanpa petunjuknya', async () => {
    const user = userEvent.setup()
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const tape = await openTape(container, user)
    expect(tape?.textContent).not.toContain('UNCLAIMED')
    expect(tape?.textContent).not.toContain(t('ats.tape.unclaimedHint'))
  })

  it('footer statistik karakter · kata · halaman sesuai isi tape', async () => {
    const user = userEvent.setup()
    const doc = sampleResume()
    const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const plan = createPagePlan(doc, spec)
    const data = simulateParseOrder(doc, spec, plan)
    useAtsStore.setState({ report: buildReport(doc, plan.pageCount, 0) })

    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const tape = await openTape(container, user)
    expect(tape?.textContent).toContain(
      t('ats.tape.footer', {
        chars: data.stats.chars,
        words: data.stats.words,
        pages: data.stats.pages,
      }),
    )
    expect(tape?.textContent).toContain(
      t('ats.tape.header', { template: t(getSpec(doc.templateId).nameId).toUpperCase() }),
    )
    // Satu baris DOM per baris tape, dengan tag di kolom kiri.
    expect(tape?.querySelectorAll('.text-tape > div')).toHaveLength(data.lines.length)
    expect(data.stats.chars).toBeGreaterThan(200)
  })

  it('stabilo kata kunci menandai istilah di tape; mati saat showMarks false', async () => {
    const user = userEvent.setup()
    const doc = docWith({ jobDescription: JOB_DESCRIPTION })
    useDocStore.getState().loadDoc(doc)
    useAtsStore.setState({ report: buildReport(doc, 2, 0) })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const tape = await openTape(container, user)
    const marks = [...(tape?.querySelectorAll('mark') ?? [])]
    expect(marks.length).toBeGreaterThan(0)
    expect(marks[0]?.classList.contains('text-tape-mark')).toBe(true)
    expect(marks.some((mark) => (mark.textContent ?? '').toLowerCase() === 'react')).toBe(true)

    useUiStore.setState({ showKeywordMarks: false })
    const withoutMarks = render(<AtsPanel onClose={noop} showClose />)
    const tape2 = await openTape(withoutMarks.container, user)
    expect(tape2?.querySelectorAll('mark').length).toBe(0)
    withoutMarks.unmount()
  })

  it('Salin teks memakai clipboard.writeText (stub) lalu toast sukses', async () => {
    // Catatan: `userEvent.setup()` menimpa `navigator.clipboard` dengan
    // clipboard internalnya, jadi stub dipasang ulang tepat sebelum diklik.
    const user = userEvent.setup()
    const doc = sampleResume()
    const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const data = simulateParseOrder(doc, spec, createPagePlan(doc, spec))

    const { container } = render(<AtsPanel onClose={noop} showClose />)
    await openTape(container, user)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    await user.click(probe(container, 'ats-tape-copy')!)

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const copied = writeText.mock.calls[0]?.[0]
    expect(typeof copied).toBe('string')
    expect(copied).toBe(data.lines.map((line) => line.text).join('\n'))
    expect(String(copied)).toContain('Alex Morgan')
    expect(String(copied).split('\n').length).toBeGreaterThan(3)
    expect(toast).toHaveBeenCalledWith(t('ats.tape.copied'))
  })

  it('clipboard gagal → toast galat, tanpa melempar', async () => {
    const user = userEvent.setup()
    writeText = vi.fn(async () => {
      throw new Error('NotAllowedError')
    })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    await openTape(container, user)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    await user.click(probe(container, 'ats-tape-copy')!)
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t('ats.tape.copyFailed')))
    expect(toast).not.toHaveBeenCalledWith(t('ats.tape.copied'))
  })
})

describe('KeywordSummary — chip menuju kolom keahlian', () => {
  it('ringkasan `x cocok · y belum ada` sesuai laporan', () => {
    const report = buildReport(docWith({ jobDescription: JOB_DESCRIPTION }), 2, 0)
    useAtsStore.setState({ report })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const summary = probe(container, 'ats-keywords')
    const keywords = report.keywords
    if (!keywords) throw new Error('fixture lowongan hilang dari laporan')
    expect(summary?.textContent).toContain(
      t('ats.keywords.summary', {
        matched: keywords.matched.length,
        missing: keywords.missing.length,
      }),
    )
    expect(all(container, 'ats-keyword-missing').length).toBe(keywords.missing.length)
    expect(summary?.textContent).toContain(keywords.matched.join(' · '))
  })

  it('klik chip yang belum ada → fokus ke field grup keahlian pertama', async () => {
    const report = buildReport(docWith({ jobDescription: JOB_DESCRIPTION }), 2, 0)
    useAtsStore.setState({ report })
    const formPane = document.createElement('div')
    formPane.id = 'pane-form'
    formPane.innerHTML = '<input id="skill-group-skill-1-items" value="TypeScript" />'
    document.body.appendChild(formPane)

    const user = userEvent.setup()
    const { container } = render(<AtsPanel onClose={vi.fn()} showClose />)
    const chip = all(container, 'ats-keyword-missing')[0]
    if (!chip) throw new Error('chip kata kunci belum ada tidak dirender')
    await user.click(chip)

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('skill-group-skill-1-items')
    })
    expect(useDocStore.getState().activeSectionId).toBe(SAMPLE_IDS.skills)
    expect(useUiStore.getState().activeTab).toBe('form')
    formPane.remove()
  })

  it('dokumen tanpa lowongan → pesan kata kunci kosong, tanpa chip', () => {
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-keywords')).toBeNull()
    expect(container.textContent).toContain(t('ats.keywords.empty'))
    expect(all(container, 'ats-keyword-missing').length).toBe(0)
  })

  it('semua istilah cocok → tanpa daftar missing; tanpa kecocokan → tanpa baris cocok', () => {
    const base = buildReport(docWith({ jobDescription: JOB_DESCRIPTION }), 2, 0)
    const paragraphs = (root: HTMLElement): string[] =>
      [...root.querySelectorAll('[data-probe="ats-keywords"] p')].map((p) => p.textContent ?? '')

    const allMatched: AtsReport = {
      ...base,
      keywords: { matched: ['react', 'typescript'], missing: [], density: 1 },
    }
    useAtsStore.setState({ report: allMatched })
    const matched = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(matched.container, 'ats-keywords')?.textContent).toContain(
      t('ats.keywords.summary', { matched: 2, missing: 0 }),
    )
    expect(paragraphs(matched.container)).toContain('react · typescript')
    expect(matched.container.textContent).not.toContain(t('ats.keywords.missingHint'))
    expect(all(matched.container, 'ats-keyword-missing')).toHaveLength(0)
    matched.unmount()

    const noneMatched: AtsReport = {
      ...base,
      keywords: { matched: [], missing: ['graphql'], density: 0 },
    }
    useAtsStore.setState({ report: noneMatched })
    const missing = render(<AtsPanel onClose={noop} showClose />)
    expect(all(missing.container, 'ats-keyword-missing')).toHaveLength(1)
    expect(missing.container.textContent).toContain(t('ats.keywords.missingHint'))
    expect(paragraphs(missing.container)).not.toContain('graphql')
    expect(paragraphs(missing.container)).toHaveLength(2)
    missing.unmount()
  })

  it('dokumen tanpa bagian skills → chip diklik tidak mengubah fokus', async () => {
    const user = userEvent.setup()
    const doc: ResumeDoc = {
      ...docWith({ jobDescription: JOB_DESCRIPTION }),
      sections: sampleResume()
        .sections.filter((section) => section.kind !== 'skills')
        .map((section) => ({ ...section, visible: true })),
    }
    useDocStore.getState().loadDoc(doc)
    useAtsStore.setState({ report: buildReport(doc, 2, 0) })
    const before = useDocStore.getState().activeSectionId
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const chip = all(container, 'ats-keyword-missing')[0]
    if (!chip) throw new Error('chip hilang')
    await user.click(chip)
    expect(useDocStore.getState().activeSectionId).toBe(before)
    expect(document.activeElement?.id ?? '').toBe('')
  })
})

describe('Aksi Perbaiki → dari dalam drawer', () => {
  it('klik Perbaiki → memfokuskan field email dan tetap membuka drawer 3 kolom', async () => {
    const user = userEvent.setup()
    const closeSpy = vi.fn()
    const pane = document.createElement('div')
    pane.id = 'pane-form'
    pane.innerHTML = '<input id="profile-email" value="alex@mail.com" />'
    document.body.appendChild(pane)

    useAtsStore.setState({ report: buildReport(withProfile({ email: 'bukan-email' }), 2, 0) })
    const { container } = render(<AtsPanel onClose={closeSpy} showClose />)
    const fix = all(container, 'ats-fix')[0]
    if (!fix) throw new Error('tombol Perbaiki tidak dirender')
    await user.click(fix)

    await waitFor(() => expect(document.activeElement?.id).toBe('profile-email'))
    expect(useDocStore.getState().activeSectionId).toBe(SAMPLE_IDS.profile)
    expect(useUiStore.getState().activeTab).toBe('form')
    // §5.6 — di ≥1280px drawer tidak menutupi layar, jadi ia tetap terbuka.
    expect(closeSpy).not.toHaveBeenCalled()
    expect(document.activeElement?.classList.contains('ats-field-flash')).toBe(true)
    pane.remove()
  })

  it('mode tab → drawer ditutup lebih dulu sebelum mencari field', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ panelMode: 'icon-rail' })
    const closeSpy = vi.fn()
    const pane = document.createElement('div')
    pane.id = 'pane-form'
    pane.innerHTML = '<input id="profile-phone" value="0812" />'
    document.body.appendChild(pane)

    useAtsStore.setState({ report: buildReport(withProfile({ phone: '12' }), 2, 0) })
    const { container } = render(<AtsPanel onClose={closeSpy} showClose />)
    await user.click(all(container, 'ats-fix')[0]!)
    expect(closeSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.activeElement?.id).toBe('profile-phone'))
    pane.remove()
  })
})

describe('JobDescriptionField — batas karakter T9.6', () => {
  const openField = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<{ container: HTMLElement; unmount: () => void }> => {
    const { container, unmount } = render(<AtsPanel onClose={noop} showClose />)
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-expanded]')
    if (!toggle) throw new Error('toggle deskripsi lowongan tidak dirender')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    return { container, unmount }
  }

  it('mengetik melewati DOC_LIMITS dipotong di store dan mono hint tampil', async () => {
    const user = userEvent.setup()
    const { container, unmount } = await openField(user)
    const textarea = textareaOf(container)
    const oversize = `${'a'.repeat(DOC_LIMITS.jobDescriptionChars)}SISA`
    expect(oversize.length).toBeGreaterThan(DOC_LIMITS.jobDescriptionChars)

    fireEvent.change(textarea, { target: { value: oversize } })

    const stored = useDocStore.getState().doc.jobDescription ?? ''
    expect(stored).toHaveLength(DOC_LIMITS.jobDescriptionChars)
    expect(textarea.value).toHaveLength(DOC_LIMITS.jobDescriptionChars)
    const hint = container.querySelector('p.font-mono')
    expect(hint?.textContent).toBe(t('limits.charsAtMax', { max: DOC_LIMITS.jobDescriptionChars }))
    expect(hint?.className).toContain('font-mono')
    unmount()
  })

  it('di bawah batas → hint tidak muncul; mengetik lagi tetap tersimpan', async () => {
    const user = userEvent.setup()
    const { container, unmount } = await openField(user)
    const textarea = textareaOf(container)
    fireEvent.change(textarea, { target: { value: 'Butuh React dan TypeScript' } })
    expect(container.querySelector('p.font-mono')).toBeNull()
    expect(useDocStore.getState().doc.jobDescription).toBe('Butuh React dan TypeScript')
    unmount()
  })

  it('tombol hapus men-set jobDescription = null dan menyembunyikan hint', async () => {
    const user = userEvent.setup()
    useDocStore.getState().setJobDescription('Sudah terisi sebelumnya')
    const { container, unmount } = await openField(user)
    await user.click(screen.getByRole('button', { name: t('ats.jd.clear') }))
    expect(useDocStore.getState().doc.jobDescription).toBeNull()
    expect(textareaOf(container).value).toBe('')
    expect(container.querySelector('p.font-mono')).toBeNull()
    unmount()
  })

  it('laporan dengan lowongan → checkbox stabilo ke PDF hanya ada saat sudah diperiksa', () => {
    const report = buildReport(docWith({ jobDescription: JOB_DESCRIPTION }), 2, 0)
    const before = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(before.container, 'ats-marks-in-pdf')).toBeNull()
    before.unmount()

    useAtsStore.setState({ report })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const checkbox = probe(container, 'ats-marks-in-pdf')
    expect(checkbox).not.toBeNull()
    expect(checkbox?.hasAttribute('checked')).toBe(false)
    fireEvent.click(checkbox!)
    expect(useUiStore.getState().includeMarksInPdf).toBe(true)
  })
})

describe('state kosong, memeriksa, dan tanpa isu (P5)', () => {
  it('belum diperiksa → ajakan + tombol Periksa sekarang menjalankan pemeriksaan', async () => {
    const user = userEvent.setup()
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const button = probe(container, 'ats-check-now')
    expect(button).not.toBeNull()
    expect(button?.textContent).toBe(t('ats.notChecked.action'))
    expect(container.textContent).toContain(t('ats.notChecked.body'))
    expect(probe(container, 'ats-score')).toBeNull()

    await user.click(button!)
    await waitFor(() => {
      expect(useAtsStore.getState().report).not.toBeNull()
    })
    expect(useAtsStore.getState().isChecking).toBe(false)
    expect(useDocStore.getState().doc.meta.lastCheckedAt).toBeTypeOf('number')
    expect(probe(container, 'ats-score')).not.toBeNull()
  })

  it('sedang memeriksa → tombol disabled dengan label Memeriksa…', () => {
    useAtsStore.setState({ isChecking: true })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const button = probe(container, 'ats-check-now')
    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(button?.textContent).toBe(t('ats.checking'))
  })

  it('tanpa isu → pesan tanpa masalah, tape tetap ditampilkan', async () => {
    const user = userEvent.setup()
    const report = cleanReport()
    useAtsStore.setState({ report })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-tab-issues')?.textContent).toBe(t('ats.tab.issues', { count: 0 }))
    expect(container.textContent).toContain(t('ats.noIssues.title'))
    expect(container.textContent).toContain(t('ats.noIssues.body'))
    expect(all(container, 'ats-issue').length).toBe(0)

    await user.click(probe(container, 'ats-tab-tape')!)
    expect(probe(container, 'ats-tape')).not.toBeNull()
    expect(probe(container, 'ats-tape')?.textContent).toContain('Alex Morgan')
  })

  it('disclaimer tetap ada di SEMUA state (belum diperiksa, tanpa isu, ada isu, tab tape)', async () => {
    const user = userEvent.setup()
    const states: AtsReport[] = [cleanReport(), buildReport(withProfile({ email: '' }), 2, 0)]

    useAtsStore.setState({ report: null })
    const unchecked = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(unchecked.container, 'ats-disclaimer')?.textContent).toBe(t('ats.disclaimer'))
    unchecked.unmount()

    for (const report of states) {
      useUiStore.setState({ atsTab: 'issues' })
      useAtsStore.setState({ report })
      const { container, unmount } = render(<AtsPanel onClose={noop} showClose />)
      expect(probe(container, 'ats-disclaimer')).not.toBeNull()
      await user.click(probe(container, 'ats-tab-tape')!)
      expect(probe(container, 'ats-tape')).not.toBeNull()
      expect(probe(container, 'ats-disclaimer')?.textContent).toContain('tidak ada jaminan')
      unmount()
    }
  })

  it('aria-live mengumumkan skor hanya saat laporan ada', () => {
    useAtsStore.setState({ report: cleanReport() })
    const { container, rerender } = render(<AtsPanel onClose={noop} showClose />)
    const live = container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe(
      t('ats.aria.score', { score: 100, band: t(cleanReport().band.labelId) }),
    )
    useAtsStore.setState({ report: null })
    rerender(<AtsPanel onClose={noop} showClose />)
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('')
  })
})

describe('IssueList — kelompok bisa ditutup & dibuka lagi', () => {
  it('kelompok Sudah baik semula tertutup; klik membukanya lalu menutupnya lagi', async () => {
    const user = userEvent.setup()
    useAtsStore.setState({ report: buildReport(withProfile({ email: '' }), 2, 0) })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const group = probe(container, 'ats-group-ok')
    if (!group) throw new Error('kelompok ok tidak dirender')
    const header = group.querySelector<HTMLButtonElement>('button[aria-expanded]')
    expect(header?.getAttribute('aria-expanded')).toBe('false')
    expect(group.querySelectorAll('[data-probe="ats-issue"]').length).toBe(0)

    await user.click(header!)
    expect(header?.getAttribute('aria-expanded')).toBe('true')
    const openedCount = group.querySelectorAll('[data-probe="ats-issue"]').length
    expect(openedCount).toBeGreaterThan(0)
    expect(group.textContent).toContain(t('ats.group.ok'))

    await user.click(header!)
    expect(header?.getAttribute('aria-expanded')).toBe('false')
    expect(group.querySelectorAll('[data-probe="ats-issue"]').length).toBe(0)

    await user.click(header!)
    expect(group.querySelectorAll('[data-probe="ats-issue"]').length).toBe(openedCount)
  })

  it('isu tanpa target tidak menampilkan tombol Perbaiki →', () => {
    // 4 halaman → `length.tooManyPages` (warn, tanpa target); email salah punya target.
    const report = buildReport(withProfile({ email: 'bukan-email' }), 4, 0)
    useAtsStore.setState({ report })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const issues = all(container, 'ats-issue')
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.some((issue) => issue.textContent?.includes(t('ats.fix')))).toBe(true)
    expect(probe(container, 'ats-issue')?.querySelector('svg')).not.toBeNull()
    const actionable = report.issues.filter((issue) => issue.severity !== 'ok')
    expect(actionable.length).toBe(issues.length)
  })

  it('jumlah tombol Perbaiki → sama dengan jumlah isu yang punya target', () => {
    const report = buildReport(withProfile({ email: 'bukan-email' }), 4, 0)
    const actionable = report.issues.filter((issue) => issue.severity !== 'ok')
    const targeted = actionable.filter((issue) => issue.target)
    expect(actionable.length).toBeGreaterThan(targeted.length)
    expect(actionable.filter((issue) => issue.id === 'length.tooManyPages').length).toBe(1)

    useAtsStore.setState({ report })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(all(container, 'ats-issue')).toHaveLength(actionable.length)
    expect(all(container, 'ats-fix')).toHaveLength(targeted.length)
  })
})

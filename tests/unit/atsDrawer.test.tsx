import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { buildReport } from '@/features/ats/engine'
import { AtsPanel } from '@/features/ats/components/AtsPanel'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import { JOB_DESCRIPTION } from '../fixtures/jobDescription'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import type { ResumeDoc } from '@/types/resume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

/**
 * T7.4/T7.6 — drawer ATS. Fokus tes: disclaimer permanen (P5), pengelompokan
 * isu, mata pencarian deskripsi lowongan, dan aksi `Perbaiki →`.
 * Elemen dicari lewat `data-probe` (konvensi repo), bukan `data-testid`.
 */

const probe = (root: ParentNode, name: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const report = (doc: ResumeDoc = sampleResume(), pages = 2) => buildReport(doc, pages, 0)

const withProfile = (patch: Record<string, unknown>): ResumeDoc =>
  ({
    ...sampleResume(),
    sections: sampleResume().sections.map((section) =>
      section.kind === 'profile'
        ? ({ ...section, data: { ...section.data, ...patch } } as typeof section)
        : section,
    ),
  }) as ResumeDoc

const noop = () => undefined

beforeEach(() => {
  useDocStore.getState().loadDoc(sampleResume())
  useDocStore.getState().setActiveSection(SAMPLE_IDS.experience)
  useUiStore.setState({
    atsDrawerOpen: true,
    atsTab: 'issues',
    includeMarksInPdf: false,
    activeTab: 'form',
    panelMode: '3col',
  })
  useAtsStore.setState({
    report: null,
    isChecking: false,
    hasOpened: true,
    lastCheckedAt: null,
    keywords: [],
  })
})

describe('AtsPanel — state & disclaimer (P5)', () => {
  it('belum ada pemeriksaan → ajakan bertindak, bukan layar kosong', () => {
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(screen.getByText(t('ats.notChecked.title'))).toBeDefined()
    expect(probe(container, 'ats-check-now')).not.toBeNull()
  })

  it('skor & band tampil dengan label INDEKS STRUKTUR, bukan "ATS Score"', () => {
    useAtsStore.setState({ report: report() })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-score-value')?.textContent).toBe('96')
    expect(screen.getByText('INDEKS STRUKTUR')).toBeDefined()
    expect(screen.getByText(t('ats.band.excellent'))).toBeDefined()
    expect(screen.queryByText(/ATS Score/i)).toBeNull()
  })

  it('disclaimer permanen tetap ada saat skor tinggi maupun belum diperiksa', () => {
    useAtsStore.setState({ report: report() })
    const withScore = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(withScore.container, 'ats-disclaimer')?.textContent).toContain('tidak ada jaminan')
    withScore.unmount()

    useAtsStore.setState({ report: null })
    const withoutScore = render(<AtsPanel onClose={noop} showClose />)
    // Tanpa laporan, disclaimer ikut muncul bersama blok penjelasan awal.
    expect(withoutScore.container.textContent).toContain('Setiap ATS punya parser berbeda')
  })

  it('bar tick selalu 20', () => {
    useAtsStore.setState({ report: report() })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-score-ticks')?.children).toHaveLength(20)
  })
})

describe('AtsPanel — daftar isu', () => {
  it('mengelompokkan isu dan hanya menampilkan kelompok yang berisi', () => {
    useAtsStore.setState({ report: report() })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(probe(container, 'ats-group-bad')).toBeNull()
    expect(probe(container, 'ats-group-warn')).not.toBeNull()
    expect(probe(container, 'ats-issue')).not.toBeNull()
  })

  it('kelompok Wajib diperbaiki muncul saat ada isu bad', () => {
    useAtsStore.setState({ report: report(withProfile({ email: '', phone: '12' })) })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const group = probe(container, 'ats-group-bad')
    expect(group).not.toBeNull()
    expect(group?.textContent).toContain(t('ats.group.bad'))
  })

  it('tab Masalah menghitung isu yang bisa diperbaiki (tanpa isu ok)', () => {
    const r = report()
    useAtsStore.setState({ report: r })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const actionable = r.issues.filter((issue) => issue.severity !== 'ok').length
    expect(probe(container, 'ats-tab-issues')?.textContent).toContain(String(actionable))
  })
})

describe('AtsPanel — deskripsi lowongan (T7.5)', () => {
  it('kata kunci cocok/belum ada tampil sebagai chip', () => {
    const doc = { ...sampleResume(), jobDescription: JOB_DESCRIPTION }
    useAtsStore.setState({ report: report(doc) })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const summary = probe(container, 'ats-keywords')
    expect(summary?.textContent).toContain('cocok')
    expect(summary?.textContent).toContain('belum ada')
    expect(container.querySelectorAll('[data-probe="ats-keyword-missing"]').length).toBeGreaterThan(
      0,
    )
  })

  it('tanpa deskripsi lowongan → tidak ada chip & tidak ada highlighter', () => {
    useAtsStore.setState({ report: report(), keywords: [] })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(container.querySelector('[data-probe="ats-keyword-missing"]')).toBeNull()
  })

  it('menyimpan deskripsi lowongan ke dokumen (bukan ke store checker)', async () => {
    const user = userEvent.setup()
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    const toggle = container.querySelector('button[aria-expanded]')
    expect(toggle).not.toBeNull()
    await user.click(toggle!)
    const textarea = screen.getByPlaceholderText(t('ats.jd.placeholder'))
    await user.type(textarea, 'Butuh React dan TypeScript')
    expect(useDocStore.getState().doc.jobDescription).toBe('Butuh React dan TypeScript')
  })
})

describe('AtsPanel — aksi Perbaiki →', () => {
  it('isi isu menunjuk field email sb form, bukan sekadar bagian', () => {
    const r = report(withProfile({ email: 'bukan-email' }))
    const issue = r.issues.find((item) => item.id === 'contact.email.invalid')
    expect(issue?.target?.field).toBe('profile-email')
    useAtsStore.setState({ report: r })
    const { container } = render(<AtsPanel onClose={noop} showClose />)
    expect(container.querySelector('[data-probe="ats-fix"]')).not.toBeNull()
  })

  it('focusTarget memindahkan bagian aktif & tab form sebelum mencari field', async () => {
    const { focusTarget } = await import('@/features/ats/focusTarget')
    useUiStore.setState({ activeTab: 'preview' })
    useDocStore.getState().setActiveSection(SAMPLE_IDS.skills)

    focusTarget(
      { sectionId: SAMPLE_IDS.profile, field: 'profile-email' },
      {
        setActiveSection: (id) => useDocStore.getState().setActiveSection(id),
        setActiveTab: (tab) => useUiStore.getState().setActiveTab(tab),
        closeDrawer: () => useUiStore.getState().setAtsDrawerOpen(false),
        shouldCloseDrawer: true,
      },
    )

    await waitFor(() => {
      expect(useDocStore.getState().activeSectionId).toBe(SAMPLE_IDS.profile)
      expect(useUiStore.getState().activeTab).toBe('form')
    })
  })

  it('tanpa target, focusTarget tidak melakukan apa pun', async () => {
    const { focusTarget } = await import('@/features/ats/focusTarget')
    useDocStore.getState().setActiveSection(SAMPLE_IDS.skills)
    focusTarget(undefined, {
      setActiveSection: (id) => useDocStore.getState().setActiveSection(id),
      setActiveTab: (tab) => useUiStore.getState().setActiveTab(tab),
      closeDrawer: noop,
      shouldCloseDrawer: true,
    })
    expect(useDocStore.getState().activeSectionId).toBe(SAMPLE_IDS.skills)
  })
})

describe('ParseTapeView', () => {
  it('menyalin teks tape ke clipboard dengan toast', async () => {
    const user = userEvent.setup()
    const { simulateParseOrder, tapeText } = await import('@/features/ats/parseTape')
    const { resolveSpec } = await import('@/features/templates/specs')
    const { createPagePlan } = await import('@/features/preview/createPagePlan')
    const { ParseTapeView } = await import('@/features/ats/components/ParseTapeView')

    const doc = sampleResume()
    const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const tape = simulateParseOrder(doc, spec, createPagePlan(doc, spec))
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const { container } = render(
      <ParseTapeView
        lines={tape.lines}
        stats={tape.stats}
        keywords={[]}
        showMarks={false}
        templateLabel="Classic ATS"
      />,
    )

    await user.click(probe(container, 'ats-tape-copy')!)
    expect(writeText).toHaveBeenCalledWith(tapeText(tape.lines))
    expect(toast).toHaveBeenCalledWith(t('ats.tape.copied'))
  })
})

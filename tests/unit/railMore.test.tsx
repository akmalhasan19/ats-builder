import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail } from '@/app/shell/Rail'
import { calculateTotalCompleteness, sectionRegistry } from '@/features/sections/registry'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useSyncStore } from '@/store/syncStore'
import { useUiStore } from '@/store/uiStore'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import type { SectionKind } from '@/schema/resume'
import type { ResumeDoc } from '@/types/resume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

/**
 * Fase 9 — `Rail.tsx` (panel navigasi kiri). Elemen dicari lewat peran
 * (role/aria-label dari kamus) atau `data-probe`, sesuai konvensi repo.
 */

const store = () => useDocStore.getState()

const withoutKinds = (kinds: SectionKind[]): ResumeDoc => {
  const doc = sampleResume()
  return { ...doc, sections: doc.sections.filter((section) => !kinds.includes(section.kind)) }
}

const railLabel = (kind: SectionKind): string => t(sectionRegistry[kind].labelId)

const kinds = (): SectionKind[] => store().doc.sections.map((section) => section.kind)

const probe = (name: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const rowOf = (name: string): HTMLElement => {
  const select = screen.getByRole('button', { name })
  const row = select.closest('div.group')
  expect(row).not.toBeNull()
  return row as HTMLElement
}

const openMoreMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(within(rowOf(name)).getByRole('button', { name: t('rail.moreActions') }))
}

beforeEach(() => {
  store().loadDoc(sampleResume())
  useUiStore.setState({ panelMode: '3col', activeTab: 'form', atsDrawerOpen: false })
  useSyncStore.setState({ status: 'saved-local', storageMode: 'idb' })
})

describe('Rail — daftar bagian', () => {
  it('menampilkan seluruh bagian sesuai urutan doc.sections', () => {
    const { container } = render(<Rail />)

    const toggles = [...container.querySelectorAll('[role="checkbox"]')].map(
      (node) => node.getAttribute('aria-label') ?? '',
    )
    expect(toggles).toEqual(
      store().doc.sections.map(
        (section) => `${t('rail.toggleVisibility')}: ${railLabel(section.kind)}`,
      ),
    )
    expect(toggles).toHaveLength(10)
  })

  it('counter kepala panel = bagian terlihat / total bagian', () => {
    render(<Rail />)
    const sections = store().doc.sections
    const visible = sections.filter((section) => section.visible).length

    expect(screen.getByText(`${visible}/${sections.length}`)).toBeInTheDocument()
    expect(screen.getByText(`${visible}/${sections.length}`).textContent).toBe('8/10')
  })

  it('item tersembunyi diberi tanda redup/warna, bukan coretan', () => {
    render(<Rail />)
    const row = rowOf(railLabel('awards'))
    const hidden = within(row).getByText(railLabel('awards'))

    // P3 — isi yang disembunyikan tidak boleh dicoret; statusnya dibaca dari
    // checkbox dan label yang diturunkan kontrasnya.
    expect(hidden.className).toContain('text-ink-tertiary')
    expect(row.innerHTML).not.toContain('line-through')
    expect(within(row).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(railLabel('experience'))).getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('klik item memindahkan activeSectionId', async () => {
    const user = userEvent.setup()
    render(<Rail />)

    await user.click(screen.getByRole('button', { name: railLabel('projects') }))
    expect(store().activeSectionId).toBe(SAMPLE_IDS.projects)
  })

  it('kotak visibilitas memanggil toggleSectionVisible', async () => {
    const user = userEvent.setup()
    const { container } = render(<Rail />)
    const before = container.querySelectorAll('[role="checkbox"]').length

    await user.click(
      within(rowOf(railLabel('experience'))).getByRole('checkbox', {
        name: `${t('rail.toggleVisibility')}: ${railLabel('experience')}`,
      }),
    )

    expect(store().doc.sections.find((s) => s.id === SAMPLE_IDS.experience)?.visible).toBe(false)
    expect(container.querySelectorAll('[role="checkbox"]')).toHaveLength(before)
  })

  it('panah atas/bawah memindahkan urutan dan memberi pengumuman liris', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    const summaryLabel = railLabel('summary')
    const moveUp = (name: string) =>
      within(rowOf(name)).getByRole('button', { name: t('rail.moveUp') })
    const moveDown = (name: string) =>
      within(rowOf(name)).getByRole('button', { name: t('rail.moveDown') })

    // baris pertama tidak bisa naik lagi
    expect(moveUp(railLabel('profile'))).toBeDisabled()

    await user.click(moveDown(summaryLabel))
    expect(kinds()).toEqual([
      'profile',
      'experience',
      'summary',
      'education',
      'skills',
      'projects',
      'certifications',
      'languages',
      'awards',
      'volunteering',
    ])
    // Region liris dnd-kit juga memakai role="status", jadi isinya yang dicari.
    await waitFor(() =>
      expect(
        screen.getByText(t('rail.reorderAnnounce', { name: summaryLabel, pos: 3, total: 10 })),
      ).toBeInTheDocument(),
    )

    await user.click(moveUp(summaryLabel))
    expect(kinds()).toEqual([
      'profile',
      'summary',
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'languages',
      'awards',
      'volunteering',
    ])
    await waitFor(() =>
      expect(
        screen.getByText(t('rail.reorderAnnounce', { name: summaryLabel, pos: 2, total: 10 })),
      ).toBeInTheDocument(),
    )
    expect(moveDown(railLabel('volunteering'))).toBeDisabled()
  })
})

describe('Rail — aksi per baris', () => {
  it('menu `Duplikat bagian` memanggil duplicateSection dan memilih salinannya', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await openMoreMenu(user, railLabel('projects'))

    await user.click(await screen.findByRole('menuitem', { name: t('rail.duplicate') }))

    const projects = store().doc.sections.filter((s) => s.kind === 'projects')
    expect(projects).toHaveLength(2)
    expect(store().activeSectionId).toBe(projects[1]!.id)
  })

  it('menu `Sembunyikan`/`Tampilkan` memakai aksi visibilitas yang sama', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await openMoreMenu(user, railLabel('skills'))
    await user.click(await screen.findByRole('menuitem', { name: t('rail.hide') }))

    expect(store().doc.sections.find((s) => s.id === SAMPLE_IDS.skills)?.visible).toBe(false)

    await openMoreMenu(user, railLabel('skills'))
    await user.click(await screen.findByRole('menuitem', { name: t('rail.show') }))
    expect(store().doc.sections.find((s) => s.id === SAMPLE_IDS.skills)?.visible).toBe(true)
  })

  it('badge jumlah isu muncul hanya untuk isi yang salah format', () => {
    const doc = sampleResume()
    const profile = doc.sections.find((section) => section.kind === 'profile')!
    store().loadDoc({
      ...doc,
      sections: doc.sections.map((section) =>
        section.id === profile.id
          ? ({ ...section, data: { ...section.data, email: 'bukan-email' } } as typeof section)
          : section,
      ),
    })
    const { container } = render(<Rail />)

    expect(
      within(rowOf(railLabel('profile'))).getByText(t('rail.issuesBadge', { count: 1 })),
    ).toBeInTheDocument()
    expect(within(rowOf(railLabel('projects'))).queryByText(/isu/)).toBeNull()
    expect(container.textContent).toContain(railLabel('profile'))
  })

  it('dialog konfirmasi hapus bisa ditutup dengan Escape', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await openMoreMenu(user, railLabel('experience'))
    await user.click(await screen.findByRole('menuitem', { name: t('rail.delete') }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(store().doc.sections.some((section) => section.id === SAMPLE_IDS.experience)).toBe(true)
  })

  it('bagian kosong terhapus langsung tanpa konfirmasi', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await openMoreMenu(user, railLabel('awards'))
    await user.click(await screen.findByRole('menuitem', { name: t('rail.delete') }))

    expect(store().doc.sections.some((s) => s.kind === 'awards')).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('bagian berisi meminta konfirmasi; `Batal` tidak menghapus, `Hapus` menghapus', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await openMoreMenu(user, railLabel('education'))

    await user.click(await screen.findByRole('menuitem', { name: t('rail.delete') }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', {
        name: t('rail.deleteConfirmTitle', { name: railLabel('education') }),
      }),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: t('common.cancel') }))
    expect(store().doc.sections.some((s) => s.id === SAMPLE_IDS.education)).toBe(true)

    await openMoreMenu(user, railLabel('education'))
    await user.click(await screen.findByRole('menuitem', { name: t('rail.delete') }))
    const dialog2 = await screen.findByRole('dialog')
    await user.click(within(dialog2).getByRole('button', { name: t('rail.deleteConfirmAction') }))

    expect(store().doc.sections.some((s) => s.id === SAMPLE_IDS.education)).toBe(false)
  })

  it('hapus bagian aktif memindahkan fokus ke bagian pertama', async () => {
    const user = userEvent.setup()
    store().setActiveSection(SAMPLE_IDS.awards)
    render(<Rail />)
    await openMoreMenu(user, railLabel('awards'))
    await user.click(await screen.findByRole('menuitem', { name: t('rail.delete') }))

    expect(store().activeSectionId).toBe(SAMPLE_IDS.profile)
  })
})

describe('Rail — tata ulang dengan seret (dnd-kit)', () => {
  it('sensor keyboard memindahkan bagian dan mengumumkan posisi baru', async () => {
    const user = userEvent.setup()
    const { container } = render(<Rail />)
    const rows = [...container.querySelectorAll<HTMLElement>('nav > div.group')]
    expect(rows).toHaveLength(10)

    // jsdom tidak punya layout, jadi kotak tiap baris dibuat sendiri agar
    // tabrakan (closestCenter) punya angka yang bisa dibandingkan.
    const rectOf = (y: number): DOMRect =>
      ({
        x: 0,
        y,
        top: y,
        bottom: y + 40,
        left: 0,
        right: 200,
        width: 200,
        height: 40,
        toJSON: () => ({}),
      }) as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ): DOMRect {
      const index = rows.indexOf(this as HTMLElement)
      return rectOf(index >= 0 ? index * 40 : 0)
    })

    const handle = rows[0]!.querySelector(`[aria-label="${t('rail.dragHandle')}"]`) as HTMLElement
    handle.focus()
    await user.keyboard(' ')

    expect(probe('drag-overlay')).not.toBeNull()

    await user.keyboard('{Arrowdown}')
    await user.keyboard(' ')

    await waitFor(() => expect(kinds()[0]).toBe('summary'))
    expect(kinds()[1]).toBe('profile')
    expect(probe('drag-overlay')).toBeNull()
  })
})

describe('Rail — katalog bagian baru', () => {
  it('`+ Tambah bagian` membuka dialog dan `Tambah` memanggil addSection(kind)', async () => {
    const user = userEvent.setup()
    store().loadDoc(withoutKinds(['languages']))
    render(<Rail />)

    await user.click(screen.getByRole('button', { name: t('rail.addSection') }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: t('rail.catalogTitle') }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(railLabel('languages'))).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: t('rail.add') }))

    const added = store().doc.sections.find((s) => s.kind === 'languages')
    expect(added).toBeDefined()
    expect(added?.visible).toBe(true)
    expect(store().activeSectionId).toBe(added!.id)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('dialog katalog tertutup oleh Escape', async () => {
    const user = userEvent.setup()
    render(<Rail />)

    await user.click(screen.getByRole('button', { name: t('rail.addSection') }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(store().doc.sections).toHaveLength(10)
  })

  it('semua jenis sudah ada → pesan katalog kosong', async () => {
    const user = userEvent.setup()
    render(<Rail />)

    await user.click(screen.getByRole('button', { name: t('rail.addSection') }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('rail.catalogEmpty'))).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: t('rail.add') })).toBeNull()
  })
})

describe('Rail — pengukur kelengkapan', () => {
  it('menampilkan persen kelengkapan dan klik membuka drawer ATS', async () => {
    const user = userEvent.setup()
    const { container } = render(<Rail />)
    const expected = calculateTotalCompleteness(store().doc.sections)
    const meter = screen.getByRole('button', { name: new RegExp(`${expected}%`) })

    expect(container).toHaveTextContent(`${expected}%`)
    expect(meter.querySelector('[style*="width"]')).toHaveStyle({ width: `${expected}%` })
    expect(useUiStore.getState().atsDrawerOpen).toBe(false)

    await user.click(meter)
    expect(useUiStore.getState().atsDrawerOpen).toBe(true)
  })
})

describe('Rail — mode icon-rail', () => {
  it('menyembunyikan label, tombol tambah, dan pengukur kelengkapan', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ panelMode: 'icon-rail' })
    const { container } = render(<Rail />)

    expect(screen.queryByText(railLabel('experience'))).toBeNull()
    expect(screen.queryByRole('button', { name: t('rail.addSection') })).toBeNull()
    expect(screen.queryByText(t('rail.completeness'))).toBeNull()

    const items = [...container.querySelectorAll('nav > button')]
    expect(items).toHaveLength(10)
    // pada rail ikon, baris tersembunyi diredupkan dengan opacity (bukan coretan)
    expect(items[8]!.className).toContain('opacity-55')
    expect(items[2]!.className).not.toContain('opacity-55')
    for (const item of items) expect(item.className).not.toContain('line-through')

    await user.click(items[2]!)
    expect(store().activeSectionId).toBe(SAMPLE_IDS.experience)
  })
})

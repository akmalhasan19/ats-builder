import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MemoryRouter,
  Route,
  Routes,
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router'
import { toast } from 'sonner'
import { LegalPage } from '@/app/pages/LegalPage'
import { NotFoundPage } from '@/app/pages/NotFoundPage'
import { PlaceholderPage } from '@/app/pages/PlaceholderPage'
import { TemplatesPage } from '@/app/pages/TemplatesPage'
import { router } from '@/app/router'
import { TEMPLATE_IDS, templateLabelKey } from '@/app/shell/templateList'
import { ACCENT_HEX } from '@/features/templates/specs'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useErrorStore } from '@/store/errorStore'
import { useSyncStore } from '@/store/syncStore'
import { useUiStore } from '@/store/uiStore'
import { sampleResume } from '../fixtures/sampleResume'
import type { TemplateId } from '@/types/resume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const { idb } = vi.hoisted(() => ({
  idb: {
    readValue: vi.fn(async () => undefined),
    writeValue: vi.fn(async () => undefined),
    quarantineCorruptDoc: vi.fn(async () => undefined),
  },
}))
vi.mock('@/features/persistence/idb', () => ({
  DOC_KEY: 'ats:doc:v1',
  PREFS_KEY: 'ats:prefs:v1',
  FIRST_RUN_KEY: 'ats:firstRun',
  corruptKey: (timestamp: number) => `ats:doc:corrupt:${timestamp}`,
  ...idb,
}))

/**
 * Fase 9 — halaman produk & tabel rute. Halaman dirender lewat `MemoryRouter`
 * di jalur aslinya; rute produksi juga diperiksa dari `router.tsx` langsung.
 */

const store = () => useDocStore.getState()

const probe = (name: string, root: ParentNode = document): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-probe="${name}"]`)

const EDITOR_MARKER = 'EDITOR SEMU'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>{EDITOR_MARKER}</h1>} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/privacy" element={<LegalPage page="privacy" />} />
        <Route path="/terms" element={<LegalPage page="terms" />} />
        <Route path="/dashboard" element={<PlaceholderPage titleKey="route.dashboard" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  store().loadDoc(sampleResume())
  useUiStore.setState({ panelMode: '3col', activeTab: 'form', firstRunSeen: true })
  useErrorStore.setState({ banner: null })
  useSyncStore.setState({ status: 'saved-local', storageMode: 'idb' })
  idb.readValue.mockImplementation(async () => undefined)
  idb.writeValue.mockImplementation(async () => undefined)
})

describe('router.tsx — tabel rute produksi', () => {
  it('mendaftarkan rute produk berurutan dan penangkap rute tak dikenal', () => {
    const paths = router.routes.map((route) => route.path)
    const devPaths = import.meta.env.DEV
      ? [
          '/dev/tokens',
          '/dev/pdf',
          '/dev/preview',
          '/dev/persist',
          '/dev/pagination',
          '/dev/template-compare',
        ]
      : []

    expect(paths).toEqual([
      '/',
      '/r/:resumeId',
      '/templates',
      '/privacy',
      '/terms',
      '/dashboard',
      '/login',
      '/auth/callback',
      '/cover-letter',
      ...devPaths,
      '*',
    ])
    expect(paths[paths.length - 1]).toBe('*')
  })

  it('rute lazy `/privacy` benar-benar memuat LegalPage lewat RouterProvider', async () => {
    const memory = createMemoryRouter(router.routes as RouteObject[], {
      initialEntries: ['/privacy'],
    })
    render(<RouterProvider router={memory} />)

    expect(
      await screen.findByRole('heading', { level: 1, name: t('legal.privacy.title') }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t('legal.backToEditor') })).toHaveAttribute('href', '/')
  })

  it('rute lazy `/templates` dan `/terms` juga terpasang dari tabel rute', async () => {
    const gallery = createMemoryRouter(router.routes as RouteObject[], {
      initialEntries: ['/templates'],
    })
    const { unmount } = render(<RouterProvider router={gallery} />)
    expect(
      await screen.findByRole('heading', { level: 1, name: t('templates.page.title') }),
    ).toBeInTheDocument()
    unmount()

    const terms = createMemoryRouter(router.routes as RouteObject[], {
      initialEntries: ['/terms'],
    })
    render(<RouterProvider router={terms} />)
    expect(
      await screen.findByRole('heading', { level: 1, name: t('legal.terms.title') }),
    ).toBeInTheDocument()
  })

  it('rute tak dikenal memakai NotFoundPage dari tabel rute asli', async () => {
    const memory = createMemoryRouter(router.routes as RouteObject[], {
      initialEntries: ['/tidak-ada'],
    })
    render(<RouterProvider router={memory} />)

    expect(
      await screen.findByRole('heading', { name: t('route.notFoundTitle') }),
    ).toBeInTheDocument()
  })
})

describe('/templates — galeri lima template', () => {
  it('menampilkan lima kartu template nyata dengan label & deskripsi kamus', async () => {
    renderAt('/templates')

    expect(
      screen.getByRole('heading', { level: 1, name: t('templates.page.title') }),
    ).toBeInTheDocument()
    expect(screen.getByText(t('templates.eyebrow'))).toBeInTheDocument()

    for (const id of TEMPLATE_IDS) {
      const card = probe(`template-card-${id}`)
      expect(card, `kartu ${id} hilang`).not.toBeNull()
      expect(within(card as HTMLElement).getByText(t(templateLabelKey(id)))).toBeInTheDocument()
      expect(within(card as HTMLElement).getByText(t(`template.desc.${id}`))).toBeInTheDocument()
    }

    const activeCard = probe('template-card-classic-ats')
    expect(activeCard).toHaveAttribute('aria-pressed', 'true')
    // thumbnail adalah render nyata pada chunk lazy — ia harus benar-benar tiba
    // (satu di kartu, satu lagi di panel detail template terpilih)
    const thumbs = await screen.findAllByRole('img', {
      name: t('templates.thumbLabel', { name: t('template.classic-ats') }),
    })
    expect(thumbs.length).toBeGreaterThanOrEqual(2)
    expect(thumbs.some((thumb) => thumb.closest('button') === activeCard)).toBe(true)
  })

  it('memilih kartu mengganti panel detail beserta tabel speksifikasinya', async () => {
    const user = userEvent.setup()
    renderAt('/templates')

    expect(
      within(probe('template-detail') as HTMLElement).getByRole('heading', {
        level: 2,
        name: 'Classic ATS',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(t('template.technician')) }))

    const detail = probe('template-detail') as HTMLElement
    await waitFor(() =>
      expect(
        within(detail).getByRole('heading', { level: 2, name: 'Technician' }),
      ).toBeInTheDocument(),
    )
    expect(within(detail).getByText(t('templates.spec.margin'))).toBeInTheDocument()
    expect(within(detail).getByText(t('templates.spec.bullet'))).toBeInTheDocument()
    expect(within(detail).getByText(t('templates.spec.fontBody'))).toBeInTheDocument()
    expect(store().doc.templateId).toBe('classic-ats')
  })

  it('`Pakai template` memakai setTemplate lalu tautan kembali menuju editor', async () => {
    const user = userEvent.setup()
    renderAt('/templates')

    await user.click(screen.getByRole('button', { name: new RegExp(t('template.ledger')) }))
    const detail = probe('template-detail') as HTMLElement
    await user.click(probe('use-template', detail) as HTMLElement)

    expect(store().doc.templateId).toBe('ledger')
    expect(toast).toHaveBeenCalledWith(t('template.appliedToast', { name: 'Ledger' }))
    // Setelah dipakai, tombol berubah menjadi penanda aktif + pesan jujur.
    expect(within(detail).getByText(t('templates.useHint'))).toBeInTheDocument()
    expect(probe('use-template', detail)?.textContent).toContain(t('topbar.templateActive'))

    await user.click(screen.getByRole('link', { name: t('templates.backToEditor') }))
    expect(await screen.findByText(EDITOR_MARKER)).toBeInTheDocument()
  })

  it('Ledger menawarkan aksen warna dan menyimpannya ke theme dokumen', async () => {
    const user = userEvent.setup()
    renderAt('/templates')

    await user.click(screen.getByRole('button', { name: new RegExp(t('template.ledger')) }))
    const detail = probe('template-detail') as HTMLElement
    const switchInput = within(detail).getByRole('switch', { name: t('templates.spec.accent') })
    expect(switchInput).toHaveAttribute('aria-checked', 'false')
    expect(probe('accent-warning', detail)).toBeNull()

    await user.click(switchInput)

    expect(store().doc.theme.accentHex).toBe(ACCENT_HEX)
    expect(within(detail).getByText(t('templates.accentWarning'))).toBeInTheDocument()

    await user.click(switchInput)
    expect(store().doc.theme.accentHex).toBeNull()
  })
})

describe('/privacy & /terms — halaman legal', () => {
  it('halaman privasi berisi heading dan daftar data yang disimpan', () => {
    const { container } = renderAt('/privacy')

    expect(
      screen.getByRole('heading', { level: 1, name: t('legal.privacy.title') }),
    ).toBeInTheDocument()
    expect(screen.getByText(t('legal.updated'))).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: t('legal.privacy.storedTitle') }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: t('legal.privacy.notCollectedTitle') }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: t('legal.privacy.contactTitle') }),
    ).toBeInTheDocument()
    const lists = screen.getAllByRole('list')
    expect(lists).toHaveLength(2)
    expect(within(lists[0] as HTMLElement).getAllByRole('listitem')).toHaveLength(3)
    expect(within(lists[1] as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(container.textContent).not.toMatch(/legal\.[a-z]/)
  })

  it('halaman ketentuan memakai isi kamus terms, bukan isi privasi', () => {
    const { container } = renderAt('/terms')

    expect(
      screen.getByRole('heading', { level: 1, name: t('legal.terms.title') }),
    ).toBeInTheDocument()
    expect(screen.getByText(t('legal.terms.intro'))).toBeInTheDocument()
    for (const key of [
      'legal.terms.useTitle',
      'legal.terms.noGuaranteeTitle',
      'legal.terms.liabilityTitle',
    ] as const) {
      expect(screen.getByRole('heading', { name: t(key) })).toBeInTheDocument()
    }
    expect(screen.queryByText(t('legal.privacy.storedTitle'))).toBeNull()
    expect(container.textContent).not.toMatch(/legal\.[a-z]/)
  })

  it('tautan kembali halaman legal mengarah ke editor', async () => {
    const user = userEvent.setup()
    renderAt('/terms')

    await user.click(screen.getByRole('link', { name: t('legal.backToEditor') }))
    expect(await screen.findByText(EDITOR_MARKER)).toBeInTheDocument()
  })
})

describe('rute placeholder & 404', () => {
  it('/dashboard (Fase 10) menyebut fitur belum tersedia', () => {
    renderAt('/dashboard')

    expect(
      screen.getByRole('heading', { level: 1, name: t('route.dashboard') }),
    ).toBeInTheDocument()
    expect(screen.getByText(t('route.pending'))).toBeInTheDocument()
    expect(screen.getByText(t('route.pending'))).toHaveTextContent(/fase berikutnya/i)
    expect(screen.getByRole('link', { name: t('error.backToEditor') })).toHaveAttribute('href', '/')
  })

  it('alamat tak dikenal menampilkan NotFoundPage dengan jalan kembali', async () => {
    const user = userEvent.setup()
    renderAt('/surat-lamaran-baru')

    expect(
      screen.getByRole('heading', { level: 1, name: t('route.notFoundTitle') }),
    ).toBeInTheDocument()
    expect(screen.getByText(t('route.notFoundBody'))).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: t('error.backToEditor') }))
    expect(await screen.findByText(EDITOR_MARKER)).toBeInTheDocument()
  })

  it('PlaceholderPage & NotFoundPage berdiri sendiri tanpa rute cocok', () => {
    render(
      <MemoryRouter>
        <PlaceholderPage titleKey="route.coverLetter" />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: t('route.coverLetter') }),
    ).toBeInTheDocument()
    expect(screen.getByText(t('app.name'))).toBeInTheDocument()
  })
})

describe('TemplatesPage — tipe template yang dipakai', () => {
  it('menandai template aktif dengan centang pada kartu', () => {
    store().loadDoc({ ...sampleResume(), templateId: 'minimal' as TemplateId })
    renderAt('/templates')

    expect(probe('template-card-minimal')).toHaveAttribute('aria-pressed', 'true')
    expect(probe('use-template')?.textContent).toContain(t('topbar.templateActive'))
  })
})

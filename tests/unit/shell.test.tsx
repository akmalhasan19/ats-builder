import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { createSampleDoc } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { useSyncStore, type SaveStatus } from '@/store/syncStore'
import { useUiStore } from '@/store/uiStore'
import { panelModeFor } from '@/app/usePanelMode'
import { DocumentTitle } from '@/app/shell/DocumentTitle'
import { FormPane } from '@/app/shell/FormPane'
import { MobileTabBar } from '@/app/shell/MobileTabBar'
import { Rail } from '@/app/shell/Rail'
import { SaveStatusPill } from '@/app/shell/SaveStatusPill'
import { t } from '@/lib/i18n'

vi.mock('sonner', () => ({ toast: vi.fn() }))

// Penyimpanan lokal di-stub supaya retry bisa diuji tanpa IndexedDB jsdom.
vi.mock('@/features/persistence/idb', () => ({
  DOC_KEY: 'ats:doc:v1',
  PREFS_KEY: 'ats:prefs:v1',
  FIRST_RUN_KEY: 'ats:firstRun',
  corruptKey: (timestamp: number) => `ats:doc:corrupt:${timestamp}`,
  readValue: vi.fn(async () => undefined),
  writeValue: vi.fn(async () => undefined),
  quarantineCorruptDoc: vi.fn(async () => undefined),
}))

const store = () => useDocStore.getState()

beforeEach(() => {
  store().loadDoc(createSampleDoc())
  useSyncStore.setState({ status: 'saved-local' })
  useUiStore.setState({ panelMode: '3col', activeTab: 'form' })
})

describe('panelModeFor', () => {
  it('memetakan lebar viewport ke tiga mode panel §2.4', () => {
    expect(panelModeFor(360)).toBe('tabs')
    expect(panelModeFor(1023)).toBe('tabs')
    expect(panelModeFor(1024)).toBe('icon-rail')
    expect(panelModeFor(1279)).toBe('icon-rail')
    expect(panelModeFor(1280)).toBe('3col')
    expect(panelModeFor(1920)).toBe('3col')
  })
})

describe('SaveStatusPill', () => {
  it('menampilkan teks yang berbeda untuk kelima status', () => {
    const cases: [SaveStatus, string][] = [
      ['saved-local', t('status.savedLocal')],
      ['saving', t('status.saving')],
      ['saved-cloud', t('status.savedCloud')],
      ['offline', t('status.offline')],
      ['error', t('status.error')],
    ]

    for (const [status, label] of cases) {
      useSyncStore.setState({ status })
      const { unmount } = render(<SaveStatusPill />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('status error bisa diklik untuk mencoba menyimpan lagi', async () => {
    useSyncStore.setState({ status: 'error' })
    const user = userEvent.setup()
    render(<SaveStatusPill />)

    await user.click(screen.getByRole('button', { name: t('status.error') }))

    await waitFor(() => expect(useSyncStore.getState().status).toBe('saved-local'))
    expect(screen.getByText(t('status.savedLocal'))).toBeInTheDocument()
  })
})

describe('DocumentTitle', () => {
  it('Enter menyimpan judul baru', async () => {
    const user = userEvent.setup()
    render(<DocumentTitle />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('topbar.titleEdit')) }))
    const input = screen.getByLabelText(t('topbar.titleLabel'))
    await user.clear(input)
    await user.type(input, 'CV Frontend{Enter}')

    expect(store().doc.title).toBe('CV Frontend')
  })

  it('Escape membatalkan perubahan', async () => {
    const user = userEvent.setup()
    store().setTitle('Judul Awal')
    render(<DocumentTitle />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('topbar.titleEdit')) }))
    const input = screen.getByLabelText(t('topbar.titleLabel'))
    await user.clear(input)
    await user.type(input, 'Dibuang{Escape}')

    expect(store().doc.title).toBe('Judul Awal')
  })

  it('judul kosong dikembalikan dan pengguna diberi tahu', async () => {
    const user = userEvent.setup()
    store().setTitle('Judul Awal')
    render(<DocumentTitle />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('topbar.titleEdit')) }))
    const input = screen.getByLabelText(t('topbar.titleLabel'))
    await user.clear(input)
    await user.keyboard('{Enter}')

    expect(store().doc.title).toBe('Judul Awal')
    expect(toast).toHaveBeenCalledWith(t('topbar.titleEmpty'))
  })
})

describe('MobileTabBar', () => {
  it('mengganti tab aktif dan menandainya di aria-selected', async () => {
    const user = userEvent.setup()
    render(<MobileTabBar />)

    const preview = screen.getByRole('tab', { name: t('mobile.tabPreview') })
    await user.click(preview)

    expect(useUiStore.getState().activeTab).toBe('preview')
    await waitFor(() => expect(preview).toHaveAttribute('aria-selected', 'true'))
  })
})

describe('Rail', () => {
  it('memilih bagian mengubah activeSectionId', async () => {
    const user = userEvent.setup()
    render(<Rail />)

    const target = store().doc.sections.find((section) => section.kind === 'education')
    expect(target).toBeDefined()

    await user.click(screen.getByRole('button', { name: new RegExp(t('section.education')) }))
    expect(store().activeSectionId).toBe(target!.id)
  })
})

describe('FormPane', () => {
  it('menampilkan bagian yang sedang aktif beserta posisinya', () => {
    const target = store().doc.sections.find((section) => section.kind === 'experience')
    store().setActiveSection(target!.id)

    render(<FormPane />)

    expect(screen.getByRole('heading', { name: t('section.experience') })).toBeInTheDocument()
    expect(screen.getByText(/BAGIAN 03/)).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBanner } from '@/app/shell/ErrorBanner'
import { registerGlobalErrorHandlers } from '@/app/globalErrors'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useErrorStore } from '@/store/errorStore'
import { useSyncStore } from '@/store/syncStore'
import { sampleResume } from '../fixtures/sampleResume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

// Tombol `Simpan lagi` pada banner kuota memanggil flush autosave. Modulnya
// di-stub supaya tes tidak menyentuh IndexedDB jsdom.
const { saveNowMock } = vi.hoisted(() => ({ saveNowMock: vi.fn() }))
vi.mock('@/features/persistence/autosave', () => ({ saveNow: saveNowMock }))

/**
 * T9.6 — galat tak terduga & penyimpanan penuh harus dilaporkan lewat banner
 * non-blocking, bukan layar putih. Pendengar global dipasang sekali (modul
 * menyimpan flag `installed`), jadi tes pemasangan dijalankan lebih dulu.
 */

beforeEach(() => {
  useDocStore.getState().loadDoc(sampleResume())
  useErrorStore.setState({ banner: null })
  useSyncStore.setState({ status: 'saved-local', storageMode: 'idb' })
  saveNowMock.mockClear()
})

describe('registerGlobalErrorHandlers (T9.6)', () => {
  it('memasang pendengar error & unhandledrejection tepat satu kali', () => {
    const add = vi.spyOn(window, 'addEventListener')
    registerGlobalErrorHandlers()
    registerGlobalErrorHandlers()

    const types = add.mock.calls.map((call) => call[0])
    expect(types.filter((type) => type === 'error')).toHaveLength(1)
    expect(types.filter((type) => type === 'unhandledrejection')).toHaveLength(1)
    add.mockRestore()
  })

  it('galat runtime → banner `runtime` dan pesan masuk konsol', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const boom = new Error('render meledak')

    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: boom }))

    expect(useErrorStore.getState().banner).toBe('runtime')
    expect(errorSpy).toHaveBeenCalledWith('[resume-studio] galat runtime', boom)
  })

  it('promise ditolak tanpa penanganan → banner `runtime` juga', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reason = new Error('idb gagal')
    // `promise` wajib di init jsdom; `.catch` dipakai supaya vitest tidak
    // menganggap penolakan ini benar-benar tak tertangani.
    const rejected = Promise.reject(reason)
    void rejected.catch(() => undefined)
    const event =
      typeof PromiseRejectionEvent === 'function'
        ? new PromiseRejectionEvent('unhandledrejection', { promise: rejected, reason })
        : Object.defineProperty(new Event('unhandledrejection'), 'reason', { value: reason })

    window.dispatchEvent(event)

    expect(useErrorStore.getState().banner).toBe('runtime')
    expect(errorSpy).toHaveBeenCalledWith(
      '[resume-studio] promise ditolak tanpa penanganan',
      reason,
    )
  })

  it('detail teknis tidak bocor ke UI: banner hanya berisi teks kamus', () => {
    // Konsol memang tempat detail teknisnya — di-spy agar output tes bersih.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }))
    render(<ErrorBanner />)

    expect(screen.getByRole('status')).toHaveTextContent(t('error.banner.runtime'))
    expect(screen.queryByText(/boom/i)).toBeNull()
  })
})

describe('ErrorBanner — tiga keadaan (T9.6)', () => {
  it('banner runtime menampilkan teks kamus dan tombol muat ulang', () => {
    useErrorStore.getState().showError('runtime')
    render(<ErrorBanner />)

    expect(screen.getByText(t('error.banner.runtime'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('error.reload') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('topbar.retrySave') })).toBeNull()
  })

  it('banner kuota menawarkan `Simpan lagi` yang memanggil saveNow', async () => {
    const user = userEvent.setup()
    useErrorStore.getState().showError('quota')
    useSyncStore.getState().setStatus('error')
    render(<ErrorBanner />)

    expect(screen.getByText(t('error.banner.quota'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('topbar.retrySave') }))

    expect(saveNowMock).toHaveBeenCalledTimes(1)
  })

  it('storageMode memory tanpa banner → pesan jujur mode memori dan tanpa tombol tutup', () => {
    useSyncStore.setState({ storageMode: 'memory' })
    render(<ErrorBanner />)

    expect(screen.getByText(t('persist.banner.memory'))).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('data-probe', 'error-banner')
    expect(screen.queryByLabelText(t('common.close'))).toBeNull()
    expect(screen.queryByRole('button', { name: t('topbar.retrySave') })).toBeNull()
  })

  it('banner runtime & kuota bisa ditutup dan kembali hilang dari DOM', async () => {
    const user = userEvent.setup()
    useErrorStore.getState().showError('runtime')
    const { unmount } = render(<ErrorBanner />)

    await user.click(screen.getByLabelText(t('common.close')))
    expect(useErrorStore.getState().banner).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    unmount()

    useErrorStore.getState().showError('quota')
    render(<ErrorBanner />)
    await user.click(screen.getByLabelText(t('common.close')))
    expect(useErrorStore.getState().banner).toBeNull()
    expect(screen.queryByText(t('error.banner.quota'))).toBeNull()
  })

  it('storageMode idb tanpa banner → tidak ada apa pun yang dirender', () => {
    const { container } = render(<ErrorBanner />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

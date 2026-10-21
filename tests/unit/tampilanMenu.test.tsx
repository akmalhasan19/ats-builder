import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { TampilanMenu } from '@/app/shell/TampilanMenu'
import { usePreviewPrefs } from '@/features/preview/usePreviewPrefs'
import { PREFS_KEY, readValue, writeValue } from '@/features/persistence/idb'
import { useCanvasStore } from '@/store/canvasStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'

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

vi.mock('sonner', () => ({ toast: vi.fn() }))

beforeEach(() => {
  useUiStore.setState({
    editMode: 'form',
    showMarginGuides: true,
    showKeywordMarks: true,
    includeMarksInPdf: false,
    zoom: 1,
    fitMode: true,
  })
  useCanvasStore.setState({ session: null, modeHintSeen: false })
  vi.mocked(readValue).mockReset()
  vi.mocked(readValue).mockResolvedValue(undefined)
  vi.mocked(writeValue).mockReset()
  vi.mocked(writeValue).mockResolvedValue(undefined)
  vi.mocked(toast).mockReset()
})

describe('TampilanMenu (C1.3)', () => {
  it('popover membuka dengan mode form terpilih sebagai default', async () => {
    const user = userEvent.setup()
    render(<TampilanMenu />)

    await user.click(screen.getByRole('button', { name: t('tampilan.open') }))

    expect(screen.getByRole('radio', { name: /Form terpandu/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: /Langsung di CV/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('memilih mode Langsung di CV mengubah editMode dan toast hint muncul sekali per sesi', async () => {
    const user = userEvent.setup()
    render(<TampilanMenu />)
    await user.click(screen.getByRole('button', { name: t('tampilan.open') }))

    await user.click(screen.getByRole('radio', { name: /Langsung di CV/ }))
    expect(useUiStore.getState().editMode).toBe('canvas')
    expect(toast).toHaveBeenCalledWith(t('canvas.modeHint'))

    await user.click(screen.getByRole('radio', { name: /Form terpandu/ }))
    expect(useUiStore.getState().editMode).toBe('form')

    await user.click(screen.getByRole('radio', { name: /Langsung di CV/ }))
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('toggle pratinjau dan preset zoom menulis uiStore yang sama dengan toolbar', async () => {
    const user = userEvent.setup()
    render(<TampilanMenu />)
    await user.click(screen.getByRole('button', { name: t('tampilan.open') }))

    await user.click(screen.getByRole('switch', { name: t('preview.ruler') }))
    expect(useUiStore.getState().showMarginGuides).toBe(false)

    await user.click(screen.getByRole('radio', { name: '75%' }))
    expect(useUiStore.getState().zoom).toBe(0.75)
    expect(useUiStore.getState().fitMode).toBe(false)

    await user.click(screen.getByRole('radio', { name: t('preview.zoom.fit') }))
    expect(useUiStore.getState().fitMode).toBe(true)
  })

  it('stabilo dinonaktifkan selama belum ada kata kunci', async () => {
    const user = userEvent.setup()
    render(<TampilanMenu />)
    await user.click(screen.getByRole('button', { name: t('tampilan.open') }))

    expect(screen.getByRole('switch', { name: t('preview.highlighter') })).toBeDisabled()
    expect(screen.getByRole('switch', { name: t('ats.marksInPdf') })).toBeDisabled()
  })

  /**
   * FASE 13 Fase 4 (T4.1/T4.2) — toolbar kanvas di bawah 640px tidak muat
   * di kotak konten well, jadi pemicunya jadi ikon saja. Mode form TIDAK
   * memakai perampingan itu — labelnya tetap terlihat sebagai teks.
   */
  it('mode kanvas layar penuh: pemicu jadi ikon saja di bawah 640px', () => {
    const { rerender } = render(<TampilanMenu />)
    const form = screen.getByRole('button', { name: t('tampilan.open') })
    // Mode form: nama aksesibel berasal dari teks yang terlihat.
    expect(form).not.toHaveAttribute('aria-label')
    expect(form.querySelector('span')?.textContent).toBe(t('tampilan.open'))
    expect(form.querySelector('span')?.className).toBe('')

    rerender(<TampilanMenu iconOnlyBelowSm />)
    const compact = screen.getByRole('button', { name: t('tampilan.open') })
    // Ikon saja: nama aksesibel pindah ke aria-label, teks disembunyikan
    // lewat utility responsif (Tailwind tidak dimuat di jsdom, jadi kelasnya
    // yang dikunci di sini).
    expect(compact).toHaveAttribute('aria-label', t('tampilan.open'))
    expect(compact.querySelector('span')?.className).toContain('max-sm:hidden')
  })
})

describe('editMode di preferensi preview (C1.2)', () => {
  it('editMode tersimpan bersama preferensi preview lain', async () => {
    const { unmount } = renderHook(() => usePreviewPrefs())
    await waitFor(() => expect(readValue).toHaveBeenCalledTimes(1))

    await act(async () => {
      useUiStore.getState().setEditMode('canvas')
    })

    await waitFor(() =>
      expect(writeValue).toHaveBeenCalledWith(
        PREFS_KEY,
        expect.objectContaining({ editMode: 'canvas' }),
      ),
    )
    unmount()
  })
})

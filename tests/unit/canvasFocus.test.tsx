import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasFocus } from '@/app/useCanvasFocus'
import { useCanvasFull } from '@/app/useCanvasFull'
import { useUiStore } from '@/store/uiStore'

/**
 * FASE 13 — T5.1 (D13) — fokus tidak boleh tersesat.
 *
 * Rail & panel formulir disembunyikan dengan `display: none` (D3). Kalau
 * elemen yang sedang difokuskan ikut tersembunyi, fokus jatuh ke `<body>`
 * dan pengguna keyboard kehilangan tempat berdiri. Hook `useCanvasFocus()`
 * menjaga tiga hal:
 *
 *  1. masuk mode kanvas → fokus pindah ke `#pane-preview` (kertas);
 *  2. keluar mode kanvas → fokus kembali ke "pemicu";
 *  3. hanya tata letak yang berubah (tombol "Keluar" ter-unmount) → fokus
 *     yang hilang dipulihkan, bukan dibiarkan jatuh ke `<body>`.
 */

/** Meniru kontrak DOM: `#pane-preview` bisa difokuskan (tabIndex -1). */
function Harness() {
  useCanvasFocus()
  const canvasFull = useCanvasFull()
  return (
    <div>
      <button type="button" data-probe="trigger">
        Pemicu
      </button>
      {canvasFull ? (
        <button type="button" data-probe="exit">
          Keluar
        </button>
      ) : null}
      <section id="pane-preview" tabIndex={-1} data-probe="preview" />
    </div>
  )
}

const preview = (): HTMLElement | null => document.getElementById('pane-preview')

beforeEach(() => {
  useUiStore.setState({ editMode: 'form', canvasFullscreen: true })
})

describe('useCanvasFocus (D13, T5.1)', () => {
  it('masuk mode kanvas: fokus pindah dari pemicu ke kertas', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Pemicu' })
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    act(() => useUiStore.getState().setEditMode('canvas'))

    expect(document.activeElement).toBe(preview())
    expect(document.activeElement).not.toBe(document.body)
  })

  it('keluar mode kanvas: fokus kembali ke pemicu yang tadi dipakai', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Pemicu' })
    trigger.focus()

    act(() => useUiStore.getState().setEditMode('canvas'))
    expect(document.activeElement).toBe(preview())

    act(() => useUiStore.getState().setEditMode('form'))

    expect(document.activeElement).toBe(trigger)
  })

  it('keluar dari layar penuh: fokus tidak jatuh ke body saat tombol keluar ter-unmount', () => {
    render(<Harness />)
    act(() => useUiStore.getState().setEditMode('canvas'))

    const exit = screen.getByRole('button', { name: 'Keluar' })
    exit.focus()
    expect(document.activeElement).toBe(exit)

    act(() => useUiStore.getState().setCanvasFullscreen(false))

    // Tombol "Keluar" hilang dari DOM → fokus harus dipulihkan, bukan<body>.
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(preview())
  })

  it('memuat halaman tidak mencuri fokus (run pertama diabaikan)', () => {
    render(<Harness />)
    expect(document.activeElement).toBe(document.body)
  })
})

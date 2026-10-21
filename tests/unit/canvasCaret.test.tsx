import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  caretContentRect,
  caretViewportRect,
  disposeCaretMirror,
  mirrorStylesFor,
  screenXOf,
  screenYOf,
} from '@/features/canvas/canvasCaret'

/**
 * FASE 14A — **pengukuran caret** (teknik mirror).
 *
 * Yang diuji:
 *  1. konversi posisi caret ke layar (K2) — termasuk pengurangan gulir
 *     internal input, jebakan yang bikin kamera "kehati-hati" terlalu cepat;
 *  2. kelengkapan daftar properti K1 yang disalin ke mirror (mirror miring =
 *     kamera bergetar);
 *  3. pembacaan `offsetLeft`/`offsetTop` marker, termasuk penjaga
 *     `selectionStart === null` dan control yang terlepas dari DOM;
 *  4. mirror benar-benar dilepas dari `document.body` saat dibersihkan.
 */

/** Properti K1 yang wajib ikut tersalin ke mirror. */
const K1_KEYS = [
  'font',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontKerning',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'whiteSpace',
  'overflowWrap',
  'wordBreak',
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'textAlign',
  'direction',
  'tabSize',
] as const

/** Gaya computed tiruan — cukup yang dipakai mirror. */
const BASE_STYLE: Record<string, string> = {
  font: '16px/24px "Inter", sans-serif',
  fontFamily: '"Inter", sans-serif',
  fontSize: '16px',
  fontStyle: 'normal',
  fontVariant: 'normal',
  fontWeight: '400',
  fontStretch: '100%',
  fontKerning: 'auto',
  lineHeight: '24px',
  letterSpacing: 'normal',
  textTransform: 'none',
  whiteSpace: 'pre',
  overflowWrap: 'normal',
  wordBreak: 'normal',
  boxSizing: 'border-box',
  paddingTop: '1px',
  paddingRight: '4px',
  paddingBottom: '1px',
  paddingLeft: '4px',
  textAlign: 'left',
  direction: 'ltr',
  tabSize: '8',
  borderLeftWidth: '0px',
  borderTopWidth: '0px',
}

/** Stub `getComputedStyle` (jsdom tidak punya layout, jadi semua dinilai). */
const stubComputedStyle = (overrides: Record<string, string> = {}) => {
  const style = { ...BASE_STYLE, ...overrides }
  const spy = vi
    .spyOn(window, 'getComputedStyle')
    .mockReturnValue(style as unknown as CSSStyleDeclaration)
  return () => spy.mockRestore()
}

/** Kotak tiruan untuk `getBoundingClientRect`. */
const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({}),
})

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  disposeCaretMirror()
})

describe('posisi caret di layar (K2)', () => {
  it('posisi normal: kotak control + offset caret', () => {
    expect(screenXOf(100, 50, 0)).toBe(150)
    expect(screenYOf(200, 30, 0)).toBe(230)
  })

  it('gulir internal input dikurangkan — caret bergeser ke kiri di layar', () => {
    // Browser menggulir isi input supaya caret tetap terlihat; kamera harus
    // tahu itu, kalau tidak ia berhenti mengikuti tepat saat dibutuhkan.
    expect(screenXOf(100, 50, 20)).toBe(130)
  })

  it('gulir internal vertikal textarea dikurangkan', () => {
    expect(screenYOf(200, 30, 12)).toBe(218)
  })
})

describe('gaya mirror (K1)', () => {
  it('menyalin seluruh daftar properti K1', () => {
    const restore = stubComputedStyle({ textTransform: 'uppercase', textAlign: 'center' })
    const control = document.createElement('input')

    const styles = mirrorStylesFor(control)

    for (const key of K1_KEYS) {
      expect(styles[key], `properti ${key}`).toBe(
        key === 'textTransform' ? 'uppercase' : key === 'textAlign' ? 'center' : BASE_STYLE[key],
      )
    }
    restore()
  })

  it('input memakai pre, textarea memakai pre-wrap', () => {
    const restore = stubComputedStyle()

    expect(mirrorStylesFor(document.createElement('input')).whiteSpace).toBe('pre')
    expect(mirrorStylesFor(document.createElement('textarea')).whiteSpace).toBe('pre-wrap')
    restore()
  })

  it('menyalin lebar control supaya titik wrap & perataan identik', () => {
    const restore = stubComputedStyle()
    const textarea = document.createElement('textarea')
    Object.defineProperty(textarea, 'clientWidth', { configurable: true, value: 480 })
    const input = document.createElement('input')
    Object.defineProperty(input, 'clientWidth', { configurable: true, value: 320 })

    expect(mirrorStylesFor(textarea).width).toBe('480px')
    // Input rata tengah (nama Executive) butuh lebar yang sama supaya
    // teksnya tetap rata tengah di mirror.
    expect(mirrorStylesFor(input).width).toBe('320px')
    restore()
  })
})

describe('pengukuran caret lewat mirror', () => {
  it('marker dibaca setelah teks & mirror dilampirkan ke body', () => {
    const restore = stubComputedStyle()
    const control = document.createElement('input')
    control.value = 'Nama Pengguna'
    document.body.append(control)
    control.setSelectionRange(4, 4)

    // Panggilan pertama membuat mirror (jsdom tidak punya layout, jadi offset
    // marker masih 0).
    caretContentRect(control)
    const root = document.querySelector('[data-probe="caret-mirror"]')
    const marker = document.querySelector('[data-probe="caret-mirror"] [data-probe="caret-marker"]')
    expect(root).not.toBeNull()
    expect(document.body.contains(root)).toBe(true)
    expect(marker).not.toBeNull()

    Object.defineProperty(marker!, 'offsetLeft', { configurable: true, get: () => 42 })
    Object.defineProperty(marker!, 'offsetTop', { configurable: true, get: () => 7 })

    const rect = caretContentRect(control)

    expect(rect).toEqual({ x: 42, y: 7, height: 24 })
    // Mirror memuat teks tepat sebelum caret, marker sesudahnya.
    expect(root!.firstChild?.nodeValue).toBe('Nama')
    expect(root!.lastElementChild).toBe(marker)
    restore()
  })

  it('selectionStart null → tidak ada posisi caret', () => {
    const restore = stubComputedStyle()
    const control = document.createElement('input')
    document.body.append(control)
    Object.defineProperty(control, 'selectionStart', { configurable: true, get: () => null })

    expect(caretContentRect(control)).toBeNull()
    restore()
  })

  it('control yang terlepas dari DOM → tidak ada posisi caret', () => {
    const restore = stubComputedStyle()
    const control = document.createElement('input')

    expect(caretContentRect(control)).toBeNull()
    restore()
  })

  it('disposeCaretMirror menghapus mirror dari body', () => {
    const restore = stubComputedStyle()
    const control = document.createElement('input')
    document.body.append(control)
    caretContentRect(control)
    expect(document.querySelector('[data-probe="caret-mirror"]')).not.toBeNull()

    disposeCaretMirror()

    expect(document.querySelector('[data-probe="caret-mirror"]')).toBeNull()
    restore()
  })
})

describe('posisi caret di layar (viewport)', () => {
  it('offset caret dikali skala pohon pratinjau & gulir internal dikurangi', () => {
    // Skala 0,75: isi control berada di dalam `transform: scale()`.
    const restore = stubComputedStyle({ transform: 'matrix(0.75, 0, 0, 0.75, 0, 0)' })
    const content = document.createElement('div')
    content.setAttribute('data-probe', 'preview-content')
    const control = document.createElement('input')
    control.value = 'Nama'
    content.append(control)
    document.body.append(content)
    control.getBoundingClientRect = () => rect(100, 200, 300, 20)
    Object.defineProperty(control, 'scrollLeft', { configurable: true, value: 20 })
    control.setSelectionRange(4, 4)

    caretContentRect(control)
    const marker = document.querySelector('[data-probe="caret-mirror"] [data-probe="caret-marker"]')
    Object.defineProperty(marker!, 'offsetLeft', { configurable: true, get: () => 40 })

    const viewport = caretViewportRect(control)

    // 100 + (40 - 20) × 0,75 = 115.
    expect(viewport?.x).toBeCloseTo(115, 5)
    expect(viewport?.height).toBeCloseTo(18, 5)
    restore()
  })
})

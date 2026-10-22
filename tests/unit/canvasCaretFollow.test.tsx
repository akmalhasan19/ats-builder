import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CARET_BOTTOM_MARGIN_PX,
  CARET_LEFT_MARGIN_PX,
  CARET_RIGHT_RATIO,
  FOLLOW_EASE_MS,
  panDeltaFor,
  startCaretFollow,
  stopCaretFollow,
} from '@/features/canvas/canvasCaretFollow'
import { caretRects } from '@/features/canvas/canvasCaret'
import { EDIT_SIDE_PAD_PX, PAPER_EDGE_MARGIN_PX } from '@/features/canvas/canvasEditZoom'

/**
 * FASE 14C — **kamera mengikuti caret** saat mengetik.
 *
 * Yang diuji:
 *  1. pita gerak: caret di dalam pita → kamera diam; keluar pita → geseran
 *     sebesar kelebihan itu (ke kanan maupun ke kiri);
 *  2. ketikan menggeser `scrollLeft` sebesar kelebihan, dan caret yang
 *     kembali ke kiri (wrap) menarik kamera kembali;
 *  3. clamp di penghujung kertas — kamera mentok, tidak memaksa;
 *  4. gulir manual menghentikan follow; ketikan berikutnya diabaikan, ketikan
 *     kedua diikuti lagi (K6);
 *  5. `prefers-reduced-motion: reduce` menulis target langsung;
 *  6. `stopCaretFollow` membatalkan rAF dan melepas mirror.
 *
 * Pengukuran caret dimock (`caretRects`) supaya jsdom tanpa layout cukup —
 * yang diuji adalah mesin follow-nya, bukan teknik mirror (itu punya tesnya
 * sendiri di `canvasCaret.test.tsx`). Mock caret bergerak bersama scroll,
 * seperti kenyataannya: caret di layar = posisi isi − scroll.
 *
 * Posisi `content` (dalam control) sengaja **tidak** ikut bergeser dengan
 * scroll — itulah yang membuat deteksi wrap jujur: perpindahan baris
 * terdeteksi dari `y`/`x` di dalam control, bukan dari posisi layar yang
 * ikut berubah karena kamera bergerak.
 */

vi.mock('@/features/canvas/canvasCaret', () => ({
  caretRects: vi.fn(() => null),
  disposeCaretMirror: vi.fn(),
}))

const mockedCaret = vi.mocked(caretRects)

/** Bentuk mock: posisi dalam control + posisi di layar. */
const caretAt = (contentX: number, contentY: number, viewportX: number) => ({
  content: { x: contentX, y: contentY, height: 18 },
  viewport: { x: viewportX, y: contentY, height: 18 },
})

/** Pohon pratinjau tiruan: well → lapisan gulir → konten → control. */
const buildTree = () => {
  const well = document.createElement('section')
  well.id = 'pane-preview'
  const scroller = document.createElement('div')
  scroller.setAttribute('data-probe', 'preview-scroll')
  const content = document.createElement('div')
  content.setAttribute('data-probe', 'preview-content')
  const control = document.createElement('input')
  content.append(control)
  scroller.append(content)
  well.append(scroller)
  document.body.append(well)

  well.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 412,
    height: 800,
    right: 412,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  Object.defineProperty(well, 'clientWidth', { configurable: true, value: 412 })
  Object.defineProperty(well, 'clientHeight', { configurable: true, value: 800 })
  // Kertas 595px (794 × 0,75) di area terlihat 364px → batas gulir 231px.
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 364 })
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 595 })

  return { well, scroller, content, control }
}

/** `scrollLeft` di jsdom tidak menggulir apa pun — rekam nilainya. */
const stubScrollLeft = (element: HTMLElement) => {
  const written: number[] = []
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => written[written.length - 1] ?? 0,
    set: (value: number) => {
      written.push(value)
    },
  })
  return written
}

/** `scrollTop` well — sama seperti `scrollLeft`, rekam nilainya. */
const stubScrollTop = (element: HTMLElement) => {
  const written: number[] = []
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => written[written.length - 1] ?? 0,
    set: (value: number) => {
      written.push(value)
    },
  })
  return written
}

/** Antrean frame rAF yang dikendalikan manual. */
const frames: FrameRequestCallback[] = []
let clock = 0

const stubFrames = () => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames.length = 0
  })
}

/** Jalankan satu frame: semua callback yang sudah antre saat frame dimulai. */
const runFrame = () => {
  clock += 16
  const current = frames.splice(0, frames.length)
  for (const callback of current) callback(clock)
}

/**
 * Jalankan beberapa frame sampai kamera diam.
 *
 * Lerp eksponensial mendekati target perlahan (12,5% sisa jarak per frame),
 * jadi butuh banyak frame — bukan satu — sebelum target benar-benar tercapai.
 */
const settle = (count = 120): void => {
  for (let index = 0; index < count; index += 1) runFrame()
}

beforeEach(() => {
  document.body.innerHTML = ''
  frames.length = 0
  clock = 0
  mockedCaret.mockReset()
  mockedCaret.mockReturnValue(caretAt(100, 200, 100))
  stubFrames()
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    borderLeftWidth: '0px',
    borderTopWidth: '0px',
  } as unknown as CSSStyleDeclaration)
})

afterEach(() => {
  stopCaretFollow()
  vi.unstubAllGlobals()
})

describe('pita gerak (K4)', () => {
  it('caret di dalam pita → kamera diam', () => {
    expect(panDeltaFor(200, 0, 412)).toBe(0)
  })

  it('caret melewati ambang kanan → geseran sebesar kelebihan', () => {
    const right = 412 * CARET_RIGHT_RATIO
    expect(panDeltaFor(right + 40, 0, 412)).toBe(40)
  })

  it('caret mundur di bawah margin kiri → geseran negatif', () => {
    expect(panDeltaFor(CARET_LEFT_MARGIN_PX - 30, 0, 412)).toBe(-30)
  })
})

describe('kamera mengikuti ketikan', () => {
  it('caret keluar pita → scrollLeft bertambah sebesar kelebihan', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    // Caret di isi pada posisi 399; di layar = 399 − scrollLeft.
    mockedCaret.mockImplementation(() => caretAt(400, 200, right + 90 - scroller.scrollLeft))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()

    expect(written[written.length - 1]).toBeCloseTo(90, 5)
  })

  it('caret kembali ke kiri (wrap) → scrollLeft turun', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => caretAt(400, 200, right + 90 - scroller.scrollLeft))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()
    const peak = written[written.length - 1] ?? 0
    expect(peak).toBeGreaterThan(0)

    // Caret wrap ke baris berikutnya: kembali ke kiri isi.
    mockedCaret.mockImplementation(() => caretAt(0, 240, 30 - scroller.scrollLeft))
    control.dispatchEvent(new Event('input'))
    settle()

    expect(written[written.length - 1]).toBeLessThan(peak)
  })

  it('padding sisi sesi: wrap mengembalikan kamera ke pendaratan awal sesi', () => {
    const { scroller, control } = buildTree()
    // Padding sisi yang dipasang `PreviewWell` selama sesi edit.
    scroller.style.paddingLeft = `${EDIT_SIDE_PAD_PX}px`
    scroller.style.paddingRight = `${EDIT_SIDE_PAD_PX}px`
    // Padding ikut tergulir: 595 + 2 × 96 = 787.
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 787 })
    const written = stubScrollLeft(scroller)

    // Fase 1 — caret di ujung baris: kamera mengikuti ke kanan sampai caret
    // masuk pita (batas kanan pita = 75% lebar area terlihat).
    mockedCaret.mockImplementation(() => caretAt(400, 200, 400 - scroller.scrollLeft))
    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()
    const peak = written[written.length - 1] ?? 0
    expect(peak).toBeGreaterThan(0)

    // Fase 2 — caret berpindah baris: posisinya di dalam control berubah
    // baris, jadi kamera kembali ke pendaratan awal sesi — tepi kiri kertas
    // tetap punya margin, baris baru mulai di posisi yang familiar. Bukan
    // cram ke tepi kiri layar, dan bukan juga terlempar ke paling jauh kiri.
    mockedCaret.mockImplementation(() => caretAt(0, 240, 138 - scroller.scrollLeft))
    control.dispatchEvent(new Event('input'))
    settle()

    const settled = written[written.length - 1] ?? 0
    expect(settled).toBeCloseTo(EDIT_SIDE_PAD_PX - PAPER_EDGE_MARGIN_PX, 5)
    expect(settled).toBeGreaterThan(0)
  })

  it('kamera mentok di penghujung kertas', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    mockedCaret.mockImplementation(() => caretAt(4000, 200, 4000 - scroller.scrollLeft))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()

    // Batas gulir = scrollWidth - clientWidth = 595 - 364 = 231.
    expect(written[written.length - 1]).toBe(231)
  })

  it('caret melewati tepi bawah → well digulir ke bawah', () => {
    const { well, control } = buildTree()
    const written = stubScrollTop(well)
    mockedCaret.mockImplementation(() => caretAt(100, 900, 100))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()

    // Tepi bawah area terlihat = 800; caret di 900 → digulir 900 − (800 − 32).
    expect(written[written.length - 1]).toBe(900 - (800 - CARET_BOTTOM_MARGIN_PX))
  })
})

describe('gulir manual (K6)', () => {
  it('ketikan pertama setelah gulir manual diabaikan, ketikan kedua diikuti', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => caretAt(400, 200, right + 90 - scroller.scrollLeft))

    startCaretFollow(control)
    // Gulir manual user (tanpa flag programmatic).
    scroller.dispatchEvent(new Event('scroll'))
    const before = written.length

    // Ketikan pertama: follow baru dinyalakan, gerakannya belum ikut.
    control.dispatchEvent(new Event('input'))
    settle()
    expect(written.length).toBe(before)

    // Ketikan kedua: kamera mengikuti lagi.
    control.dispatchEvent(new Event('input'))
    settle()
    expect(written[written.length - 1]).toBeCloseTo(90, 5)
  })

  it('scroll buatan sendiri tidak ikut menghentikan follow', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => caretAt(400, 200, right + 90 - scroller.scrollLeft))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    runFrame()
    const afterFirst = written[written.length - 1] ?? 0

    // Event scroll milik follow sendiri — flag programmatic masih aktif.
    scroller.dispatchEvent(new Event('scroll'))
    runFrame()
    control.dispatchEvent(new Event('input'))
    runFrame()

    expect(written[written.length - 1]).toBeGreaterThan(afterFirst)
  })
})

describe('reduced motion (K7)', () => {
  it('target ditulis langsung, tanpa frame antara', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => caretAt(400, 200, right + 90 - scroller.scrollLeft))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    runFrame()

    expect(written[written.length - 1]).toBe(90)
  })

  it('tanpa reduced motion, gerakan dihaluskan (bertahap)', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => caretAt(400, 200, right + 90 - scroller.scrollLeft))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    runFrame()

    // Satu frame saja → baru sebagian kecil dari 90px.
    const first = written[written.length - 1] ?? 0
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(90)
    expect(FOLLOW_EASE_MS).toBe(120)
  })
})

describe('pembersihan', () => {
  it('beberapa ketikan dalam satu frame → satu pengukuran saja (rAF coalesced)', () => {
    const { control } = buildTree()
    startCaretFollow(control)

    control.dispatchEvent(new Event('input'))
    control.dispatchEvent(new Event('input'))
    control.dispatchEvent(new Event('input'))

    // Satu frame = satu pengukuran: ketikan berikutnya menunggu frame
    // yang sama, bukan menambah pengukuran baru.
    expect(frames).toHaveLength(1)
  })

  it('stopCaretFollow membatalkan rAF & melepas mirror', () => {
    const { control } = buildTree()
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    startCaretFollow(control)

    stopCaretFollow()

    expect(cancel).toHaveBeenCalled()
    expect(frames).toHaveLength(0)
  })

  it('control yang terlepas dari DOM menghentikan follow', () => {
    const { control } = buildTree()
    startCaretFollow(control)
    control.remove()

    runFrame()

    expect(frames).toHaveLength(0)
  })
})

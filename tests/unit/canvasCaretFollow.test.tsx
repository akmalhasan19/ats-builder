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
import { caretViewportRect } from '@/features/canvas/canvasCaret'

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
 * Pengukuran caret dimock (`caretViewportRect`) supaya jsdom tanpa layout
 * cukup — yang diuji adalah mesin follow-nya, bukan teknik mirror (itu punya
 * tesnya sendiri di `canvasCaret.test.tsx`). Mock caret bergerak bersama
 * scroll, seperti kenyataannya: caret di layar = posisi isi − scroll.
 */

vi.mock('@/features/canvas/canvasCaret', () => ({
  caretViewportRect: vi.fn(() => null),
  disposeCaretMirror: vi.fn(),
}))

const mockedCaret = vi.mocked(caretViewportRect)

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
  mockedCaret.mockReturnValue({ x: 100, y: 200, height: 18 })
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

  it('ambang kiri bisa di-override pemanggil (pita adaptif)', () => {
    // Ambang kiri diangkat ke 100: caret 50 di kiri ambang → mundur 50.
    expect(panDeltaFor(50, 0, 412, 100)).toBe(-50)
    // Caret di atas ambang kanan tetap digeser, parameter kiri diabaikan.
    const right = 412 * CARET_RIGHT_RATIO
    expect(panDeltaFor(right + 60, 0, 412, 100)).toBe(60)
  })
})

describe('kamera mengikuti ketikan', () => {
  it('caret keluar pita → scrollLeft bertambah sebesar kelebihan', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    // Caret di isi pada posisi 399; di layar = 399 − scrollLeft.
    mockedCaret.mockImplementation(() => ({
      x: right + 90 - scroller.scrollLeft,
      y: 200,
      height: 18,
    }))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()

    expect(written[written.length - 1]).toBeCloseTo(90, 5)
  })

  it('caret kembali ke kiri (wrap) → scrollLeft turun', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => ({
      x: right + 90 - scroller.scrollLeft,
      y: 200,
      height: 18,
    }))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()
    const peak = written[written.length - 1] ?? 0
    expect(peak).toBeGreaterThan(0)

    // Caret wrap ke baris berikutnya: kembali ke kiri isi.
    mockedCaret.mockImplementation(() => ({
      x: 30 - scroller.scrollLeft,
      y: 240,
      height: 18,
    }))
    control.dispatchEvent(new Event('input'))
    settle()

    expect(written[written.length - 1]).toBeLessThan(peak)
  })

  it('padding sisi sesi: wrap ke kiri menarik kamera sampai margin kertas penuh', () => {
    const { scroller, control } = buildTree()
    // Padding sisi yang dipasang `PreviewWell` selama sesi edit + padding
    // well `p-6` yang dibaca `visibleGeometry`.
    scroller.style.paddingLeft = '96px'
    scroller.style.paddingRight = '96px'
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      borderLeftWidth: '0px',
      borderTopWidth: '0px',
      paddingLeft: '24px',
    } as unknown as CSSStyleDeclaration)
    const written = stubScrollLeft(scroller)

    // Fase 1 — caret jauh di kanan: kamera mentok di penghujung kertas.
    mockedCaret.mockImplementation(() => ({ x: 4000 - scroller.scrollLeft, y: 200, height: 18 }))
    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()
    expect(written[written.length - 1]).toBe(231)

    // Fase 2 — caret wrap ke awal baris (x kertas 24 → 18px pada skala 0,75).
    // Ambang kiri adaptif (tepi kiri kertas + margin kertas) menarik kamera
    // sampai seluruh padding kiri tersimpan: scroll kembali ke 0, tepi kiri
    // kertas di 24 + 96 = 120px dari tepi kiri layar (≈ 1,25 inci ruang).
    mockedCaret.mockImplementation(() => ({
      x: 24 + 96 + 18 - scroller.scrollLeft,
      y: 240,
      height: 18,
    }))
    control.dispatchEvent(new Event('input'))
    settle()

    expect(written[written.length - 1]).toBe(0)
  })

  it('kamera mentok di penghujung kertas', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    mockedCaret.mockImplementation(() => ({ x: 4000 - scroller.scrollLeft, y: 200, height: 18 }))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    settle()

    // Batas gulir = scrollWidth - clientWidth = 595 - 364 = 231.
    expect(written[written.length - 1]).toBe(231)
  })

  it('caret melewati tepi bawah → well digulir ke bawah', () => {
    const { well, control } = buildTree()
    const written = stubScrollTop(well)
    mockedCaret.mockImplementation(() => ({ x: 100, y: 900 - well.scrollTop, height: 18 }))

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
    mockedCaret.mockImplementation(() => ({
      x: right + 90 - scroller.scrollLeft,
      y: 200,
      height: 18,
    }))

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
    mockedCaret.mockImplementation(() => ({
      x: right + 90 - scroller.scrollLeft,
      y: 200,
      height: 18,
    }))

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
    mockedCaret.mockImplementation(() => ({
      x: right + 90 - scroller.scrollLeft,
      y: 200,
      height: 18,
    }))

    startCaretFollow(control)
    control.dispatchEvent(new Event('input'))
    runFrame()

    expect(written[written.length - 1]).toBe(90)
  })

  it('tanpa reduced motion, gerakan dihaluskan (bertahap)', () => {
    const { scroller, control } = buildTree()
    const written = stubScrollLeft(scroller)
    const right = 412 * CARET_RIGHT_RATIO
    mockedCaret.mockImplementation(() => ({
      x: right + 90 - scroller.scrollLeft,
      y: 200,
      height: 18,
    }))

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

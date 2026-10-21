import { effectiveScaleOf } from './canvasZoom'

/**
 * FASE 14A — **pengukuran posisi caret (karet)** pada control kanvas.
 *
 * `<input>` & `<textarea>` tidak punya API posisi caret: `selectionStart`
 * memberi tahu indeks karakter, bukan pikselnya. `getSelection()` pun tidak
 * bisa dipakai — editor kanvas memakai control form asli, bukan
 * `contenteditable`. Satu-satunya cara mengukur posisi caret adalah teknik
 * **mirror**: salin gaya tipografi control ke sebuah div bayangan, taruh teks
 * sampai `selectionStart` + sebuah marker, lalu baca `offsetLeft`/`offsetTop`
 * marker.
 *
 * Modul ini murni **mengukur** — tidak ada yang digulir di sini. Orkestrasinya
 * (pita gerak, rAF, jeda saat gulir manual) ada di `canvasCaretFollow.ts`
 * (FASE 14C).
 *
 * Dua hal yang wajib diingat saat memakai hasilnya:
 *
 *  1. **Gulir internal control.** `.canvas-editor` memakai `overflow: hidden`,
 *     jadi ketika teks melebihi lebar kotaknya browser menggulir *isi* input
 *     (`control.scrollLeft > 0`) supaya caret tetap terlihat. Angka itu wajib
 *     dikurangkan (K2) — kalau tidak, kamera berhenti mengikuti tepat saat
 *     dibutuhkan.
 *  2. **Skala.** Mirror hidup di luar pohon yang diskalakan, jadi
 *     `offsetLeft`/`offsetTop` berada dalam **piksel tata letak**, sedangkan
 *     `getBoundingClientRect()` control berada dalam **piksel layar** (sudah
 *     kena `transform: scale()`). Karena itu konversi ke layar wajib
 *     mengalikan skala pohon pratinjau — tanpa itu posisi caret meleset
 *     sebesar 1/skala (di 75% = 33%).
 */

/** Kotak caret: posisi (x, y) dalam piksel + tinggi caret. */
export type CaretRect = { x: number; y: number; height: number }

/**
 * Properti computed style yang menyalin layout teks ke mirror (K1).
 *
 * Urutannya penting: `font` (shorthand) lebih dulu, lalu longhand-nya —
 * kalau longhand lebih dulu, penulisan `font` akan menimpanya.
 */
const MIRRORED_STYLE_KEYS = [
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

/** Properti yang benar-benar ditulis ke mirror (K1 + lebar konten textarea). */
const APPLIED_STYLE_KEYS = [...MIRRORED_STYLE_KEYS, 'width'] as const

/** Isi mirror: teks sampai caret + marker kosong tepat setelahnya. */
type CaretMirror = {
  root: HTMLDivElement
  text: Text
  marker: HTMLSpanElement
}

/**
 * Mirror bersifat singleton: hanya ada satu sesi edit pada satu waktu, jadi
 * satu elemen bayangan cukup untuk seluruh aplikasi.
 */
let mirror: CaretMirror | null = null

/**
 * Kumpulkan gaya mirror dari computed style control.
 *
 * Satu pembacaan `getComputedStyle` per pemanggilan. Daftar properti K1
 * lengkap (bukan subset) — mirror yang miring membuat kamera bergetar:
 * `text-transform: uppercase` (headline), `text-align: center` (nama
 * Executive), dan `white-space` yang tidak tersalin membuat lebar mirror
 * meleset beberapa piksel → follow "kejar-kejaran".
 */
const collectMirrorStyles = (
  computed: CSSStyleDeclaration,
  control: HTMLInputElement | HTMLTextAreaElement,
): Partial<CSSStyleDeclaration> => {
  const styles: Partial<CSSStyleDeclaration> = {}
  for (const key of MIRRORED_STYLE_KEYS) {
    const value = computed[key]
    if (value) styles[key] = value
  }
  // Input satu baris (`pre`), textarea membungkus (`pre-wrap`).
  styles.whiteSpace = control instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre'
  // Lebar isi control harus sama dengan mirror, supaya dua hal identik:
  // titik wrap textarea, dan **perataan** input (nama Executive rata tengah —
  // kalau mirror lebih sempit, teksnya tidak pernah bisa rata tengah dan
  // posisi caret meleset).
  if (control.clientWidth > 0) {
    styles.width = `${control.clientWidth}px`
  }
  return styles
}

/**
 * Gaya yang harus disalin ke mirror agar posisinya sama persis dengan
 * control aslinya (K1).
 *
 * Dipisah dari DOM supaya bisa diuji di jsdom tanpa layout.
 */
export const mirrorStylesFor = (
  control: HTMLInputElement | HTMLTextAreaElement,
): Partial<CSSStyleDeclaration> => collectMirrorStyles(getComputedStyle(control), control)

/**
 * Posisi horizontal caret di layar (K2).
 *
 * `getBoundingClientRect()` control sudah memperhitungkan skala transform
 * dan posisi scroll saat ini, jadi koordinat kertas tidak perlu dihitung
 * ulang. Gulir internal control dikurangkan — lihat catatan modul.
 */
export const screenXOf = (
  controlRectLeft: number,
  caretContentX: number,
  internalScrollLeft: number,
): number => controlRectLeft + caretContentX - internalScrollLeft

/**
 * Posisi vertikal caret di layar (K2) — sama seperti {@link screenXOf}, dengan
 * gulir internal vertikal control (textarea) dikurangkan.
 */
export const screenYOf = (
  controlRectTop: number,
  caretContentY: number,
  internalScrollTop: number,
): number => controlRectTop + caretContentY - internalScrollTop

/** Buat (atau ambil) mirror singleton dan lampirkan ke `document.body`. */
const ensureCaretMirror = (): CaretMirror => {
  if (mirror && mirror.root.isConnected) return mirror
  const root = document.createElement('div')
  root.setAttribute('data-probe', 'caret-mirror')
  // Mirror tidak boleh terbaca pembaca layar (T2 FASE 14D) dan tidak boleh
  // pernah bisa difokuskan.
  root.setAttribute('aria-hidden', 'true')
  root.style.position = 'absolute'
  root.style.left = '-99999px'
  root.style.top = '0'
  root.style.visibility = 'hidden'
  root.style.pointerEvents = 'none'
  const text = document.createTextNode('')
  const marker = document.createElement('span')
  marker.setAttribute('data-probe', 'caret-marker')
  root.append(text, marker)
  document.body.append(root)
  mirror = { root, text, marker }
  return mirror
}

/** Tulis gaya mirror ke elemen bayangan. */
const applyMirrorStyles = (root: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  const style = root.style as unknown as Record<string, string>
  for (const key of APPLIED_STYLE_KEYS) {
    const value = styles[key]
    if (typeof value === 'string' && value) style[key] = value
  }
}

/** Tinggi caret: tinggi baris teks, dengan cadangan tinggi font. */
const caretHeightOf = (computed: CSSStyleDeclaration): number => {
  const lineHeight = Number.parseFloat(computed.lineHeight)
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight
  const fontSize = Number.parseFloat(computed.fontSize)
  if (Number.isFinite(fontSize) && fontSize > 0) return Math.round(fontSize * 1.2)
  return 16
}

/**
 * Posisi caret **di dalam control** (piksel tata letak, relatif ke tepi kiri
 * kotak border control).
 *
 * Cara kerja: teks control dipecah sampai `selectionStart`, disalin ke
 * mirror bersama marker kosong, lalu `offsetLeft`/`offsetTop` marker dibaca
 * (marker menempel ke mirror sebagai `offsetParent`).
 *
 * `null` bila caret tidak bisa diukur: `selectionStart === null` (control
 * yang tidak mendukung seleksi) atau control sudah terlepas dari DOM.
 */
export const caretContentRect = (
  control: HTMLInputElement | HTMLTextAreaElement,
): CaretRect | null => {
  if (!control.isConnected) return null
  const start = control.selectionStart
  if (start === null) return null

  const computed = getComputedStyle(control)
  const active = ensureCaretMirror()
  applyMirrorStyles(active.root, collectMirrorStyles(computed, control))
  active.text.nodeValue = control.value.slice(0, start)

  // `offsetLeft` marker relatif ke padding box mirror; padding mirror = padding
  // control, jadi selisihnya hanya ketebalan border control.
  const borderLeft = Number.parseFloat(computed.borderLeftWidth) || 0
  const borderTop = Number.parseFloat(computed.borderTopWidth) || 0
  return {
    x: active.marker.offsetLeft + borderLeft,
    y: active.marker.offsetTop + borderTop,
    height: caretHeightOf(computed),
  }
}

/**
 * Posisi caret **di layar** (viewport) — satuan yang dipakai pita gerak
 * (FASE 14C).
 *
 * Menjumlahkan dua sumber: kotak control (sudah dalam piksel layar) dan
 * offset caret di dalam control (piksel tata letak → dikali skala pohon
 * pratinjau), lalu mengurangi gulir internal control.
 */
export const caretViewportRect = (
  control: HTMLInputElement | HTMLTextAreaElement,
): CaretRect | null => {
  const content = caretContentRect(control)
  if (!content) return null
  const rect = control.getBoundingClientRect()
  const scale = effectiveScaleOf(control)
  return {
    x: screenXOf(rect.left, content.x * scale, control.scrollLeft * scale),
    y: screenYOf(rect.top, content.y * scale, control.scrollTop * scale),
    height: content.height * scale,
  }
}

/**
 * Lepas mirror dari DOM — wajib saat sesi edit ditutup, supaya tidak
 * menyisakan node di `document.body`.
 */
export const disposeCaretMirror = (): void => {
  if (!mirror) return
  mirror.root.remove()
  mirror = null
}

import { clamp } from '@/features/preview/previewZoom'
import { caretRects, disposeCaretMirror } from './canvasCaret'
import { PAPER_EDGE_MARGIN_PX, landingScrollFor, sidePadOf } from './canvasEditZoom'

/**
 * FASE 14C — **kamera mengikuti caret** saat mengetik di layar sempit.
 *
 * Di 75% kertas A4 (595px) selalu lebih lebar daripada layar (412px), jadi
 * mengetik panjang berarti teks keluar dari layar. Addendum FASE 13 hanya
 * memusatkan field sekali di awal sesi — kamera lalu diam selamanya, dan
 * browser diam-diam menggulir *isi* input supaya caret tetap terlihat (teks
 * meluncur di dalam kotak yang diam).
 *
 * Modul ini membuat kamera **mengikuti caret**:
 *
 *  1. caret diukur tiap ketikan (lewat `canvasCaret.ts`, teknik mirror);
 *  2. caret dibandingkan dengan **pita** — bagian tengah area terlihat. Kamera
 *     hanya bergerak saat caret keluar pita, dan sebesar kelebihan itu saja
 *     (K4) — jadi gerakannya "sedikit demi sedikit", bukan caret yang dipaku
 *     terus di tengah layar;
 *  3. gerakannya dihaluskan dengan lerp eksponensial, dan langsung saja
 *     kalau `prefers-reduced-motion: reduce` (K7);
 *  4. saat caret melompat ke baris berikutnya (wrap), caret otomatis mundur ke
 *     kiri — pita X dan pita Y yang mengaturnya, tanpa logika khusus
 *     "baris kedua" (K5);
 *  5. saat caret **berpindah baris**, kamera kembali ke pendaratan yang sama
 *     dengan awal masuk mode edit (rumus `landingScrollFor` yang sama) — jadi
 *     baris baru mulai dari posisi yang familiar dan margin kiri kertas tetap
 *     terlihat, bukan caret yang menempel di tepi kiri layar.
 *
 * Gulir manual oleh user (swipe) **menghentikan** follow — keinginan user
 * didahulukan (K6). Follow tidak pernah mengubah zoom: zoom sepenuhnya
 * urusan `applyEditZoom`/`restorePreviewZoom` (K9).
 */

/** Ambang kanan pita: caret boleh keluar setelah 75% dari lebar terlihat. */
export const CARET_RIGHT_RATIO = 0.75

/** Margin kiri pita (px): caret tidak boleh mundur ke bawah nilai ini. */
export const CARET_LEFT_MARGIN_PX = 24

/** Margin bawah pita vertikal (px): caret tidak boleh melewati tepi bawah. */
export const CARET_BOTTOM_MARGIN_PX = 32

/** Konstanta waktu lerp (ms) — gerakan kamera dihaluskan (K7). */
export const FOLLOW_EASE_MS = 120

/**
 * Besaran geseran kamera supaya caret masuk kembali ke pita.
 *
 * Pita = `[visibleLeft + CARET_LEFT_MARGIN_PX, visibleLeft + visibleWidth *
 * CARET_RIGHT_RATIO]`. Selama caret di dalam pita, kamera tidak bergerak
 * sama sekali; begitu keluar, geserannya persis sebesar kelebihan itu.
 * Nilai positif = geser ke kanan, negatif = mundur ke kiri.
 */
export const panDeltaFor = (caretX: number, visibleLeft: number, visibleWidth: number): number => {
  const bandLeft = visibleLeft + CARET_LEFT_MARGIN_PX
  const bandRight = visibleLeft + visibleWidth * CARET_RIGHT_RATIO
  if (caretX > bandRight) return caretX - bandRight
  if (caretX < bandLeft) return caretX - bandLeft
  return 0
}

/**
 * Status follow:
 *
 *  - `following` — kamera bebas mengikuti caret;
 *  - `paused` — user baru saja menggulir sendiri, jadi kamera berhenti
 *    (keinginan user didahulukan, K6);
 *  - `arming` — jeda sudah dilepas oleh gerakan caret berikutnya, tetapi
 *    gerakan itu sendiri belum menggerakkan kamera. Caret berikutnya baru
 *    diikuti — satu sapuan manual user tidak langsung dibatalkan oleh satu
 *    ketikan.
 */
type FollowState = 'following' | 'paused' | 'arming'

/** Kotak area yang terlihat di well pratinjau. */
type VisibleGeometry = {
  /** Tepi kiri area konten well (koordinat layar). */
  left: number
  /** Lebar area yang terlihat (px). */
  width: number
  /** Tepi atas area terlihat — di bawah toolbar lengket. */
  top: number
  /** Tepi bawah area terlihat. */
  bottom: number
}

/** State satu sesi follow. */
type FollowSession = {
  control: HTMLInputElement | HTMLTextAreaElement
  well: HTMLElement
  scroller: HTMLElement
  state: FollowState
  rafId: number | null
  /** true selama scroll yang kita tulis sendiri (jangan dianggap manual). */
  programmatic: boolean
  /** Waktu frame terakhir (ms) — dasar lerp eksponensial. */
  lastFrameAt: number
  /** Posisi caret terakhir yang diproses — menggabungkan `input` +
   *  `selectionchange` milik satu ketikan menjadi satu gerakan. */
  lastCaretStart: number | null
  /** Posisi caret terakhir **di dalam control** — dipakai mendeteksi wrap. */
  lastCaret: { x: number; y: number } | null
  /** Posisi caret terkiri sejauh ini — patokan "awal baris". */
  minCaretX: number | null
  /**
   * Posisi gulir jangkar: kalau ada, kamera sedang kembali ke pendaratan
   * awal sesi (setelah caret berpindah baris) dan pita biasa ditangguhkan.
   */
  anchorScroll: number | null
  motionQuery: MediaQueryList | null
  onMotionChange: () => void
  teardown: () => void
}

/** Sesi follow yang sedang berjalan (hanya ada satu sesi edit). */
let session: FollowSession | null = null

/** Apakah user meminta gerakan kamera yang dihaluskan? */
const reducedMotion = (active: FollowSession): boolean => active.motionQuery?.matches ?? false

/**
 * Lerp eksponensial: makin dekat target, makin pelan geraknya.
 *
 * `FOLLOW_EASE_MS` adalah konstanta waktu — bukan durasi total. Satu frame
 * 16ms dengan konstanta 120ms sudah menjangkau ~13% sisa jarak.
 */
const ease = (current: number, target: number, deltaMs: number): number => {
  const dt = Math.min(64, Math.max(1, deltaMs))
  const factor = 1 - Math.exp(-dt / FOLLOW_EASE_MS)
  return current + (target - current) * factor
}

/**
 * Baca kotak area yang terlihat (well + toolbar lengket).
 *
 * Pita horizontal memakai **tepi kiri konten well** + `CARET_LEFT_MARGIN_PX`
 * (24px = padding well `p-6`) — persis titik tempat penjajaran awal FASE 14B
 * mendaratkan tepi kiri field. Jadi caret di awal sesi sudah berada di tepi
 * pita: follow tidak menggeser apa pun sampai caret benar-benar keluar pita.
 */
const visibleGeometry = (active: FollowSession): VisibleGeometry => {
  const { well } = active
  const rect = well.getBoundingClientRect()
  const style = getComputedStyle(well)
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0
  const originLeft = rect.left + borderLeft
  const originTop = rect.top + borderTop
  const toolbar = well.querySelector<HTMLElement>('[data-probe="preview-toolbar"]')
  const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0
  return {
    left: originLeft,
    width: well.clientWidth,
    top: originTop + toolbarHeight,
    bottom: originTop + well.clientHeight,
  }
}

/**
 * Batas kiri yang boleh dilewati kamera.
 *
 * Selama sesi edit memberi padding sisi ("ruang napas" kertas), kamera tidak
 * pernah turun ke bawah posisi pendaratan awal sesi — di situ tepi kiri
 * kertas masih punya margin terlihat. Tanpa padding (kertas muat) batasnya 0
 * dan perilaku lama utuh.
 */
const anchorFloorFor = (scroller: HTMLElement): number => {
  const sidePad = sidePadOf(scroller)
  return sidePad >= PAPER_EDGE_MARGIN_PX ? sidePad - PAPER_EDGE_MARGIN_PX : 0
}

/**
 * Tulis scroll milik sendiri.
 *
 * Scroll buatan sendiri memicu event `scroll` — tanpa penanda, follow akan
 * menganggap user menggeser dan berhenti pursuing (jebakan §3). Penanda
 * dilepas pada frame berikutnya, karena event `scroll` baru sampai di frame
 * berikutnya juga (urutan "run the scroll steps" sebelum callback rAF).
 */
const writeScroll = (
  active: FollowSession,
  element: HTMLElement,
  key: 'scrollLeft' | 'scrollTop',
  value: number,
): void => {
  active.programmatic = true
  element[key] = value
  requestAnimationFrame(() => {
    active.programmatic = false
  })
}

/** Jadwalkan satu pembacaan caret (coalesce: satu frame, satu pengukuran). */
const schedule = (active: FollowSession): void => {
  if (session !== active) return
  if (active.rafId !== null) return
  active.rafId = requestAnimationFrame((time) => {
    active.rafId = null
    tick(active, time)
  })
}

/**
 * Satu frame follow: baca caret, bandingkan dengan pita, gerakkan kamera.
 *
 * Semua ukuran dibaca **live** per frame — tinggi textarea auto-grow dan
 * posisi scroll ikut berubah, jadi rect antar-frame tidak boleh di-cache
 * (jebakan §3).
 */
const tick = (active: FollowSession, time: number): void => {
  if (session !== active) return
  const control = active.control
  // Sesi ditutup / editor dilepas → berhenti total, jangan sampai rAF bocor
  // dan kamera bergerak sendiri setelah edit selesai.
  if (!control.isConnected) {
    stopCaretFollow()
    return
  }
  const rects = caretRects(control)
  if (!rects) return
  const caret = rects.viewport
  const content = rects.content
  const geometry = visibleGeometry(active)
  const deltaMs = active.lastFrameAt === 0 ? 16 : time - active.lastFrameAt
  active.lastFrameAt = time

  if (active.state !== 'following') return

  const maxScroll = Math.max(0, active.scroller.scrollWidth - active.scroller.clientWidth)

  // **Deteksi perpindahan baris (wrap).**
  //
  // Posisi caret di dalam control (`content`) tidak ikut berubah saat kamera
  // atau well bergulir — jadi ini satu-satunya penanda wrap yang jujur:
  // `y` berpindah baris dan `x` turun ke awal baris baru. Membandingkan
  // posisi *layar* akan salah: gulir kamera sendiri menggeser `x`, dan
  // gulir well menggeser `y`.
  const previous = active.lastCaret
  const minCaretX = active.minCaretX === null ? content.x : Math.min(active.minCaretX, content.x)
  active.minCaretX = minCaretX
  const lineChanged = previous !== null && Math.abs(content.y - previous.y) > 0.5
  const movedLeft = previous !== null && content.x < previous.x - 0.5
  const atLineStart = content.x <= minCaretX + 0.5
  const wrapped = lineChanged && (movedLeft || atLineStart)
  active.lastCaret = { x: content.x, y: content.y }

  // **Kembali seperti awal masuk mode edit.**
  //
  // Saat caret berpindah baris, caret mendarat di awal baris — jauh di
  // sebelah kiri layar. Kalau kamera hanya mengikuti pita, caret itu berhenti
  // menempel di tepi kiri layar dan tepi kiri kertas ikut terpotong. Yang
  // benar: kamera kembali ke **pendaratan yang sama dengan awal sesi** —
  // rumus yang sama (`landingScrollFor`), jadi margin kiri kertas tetap
  // terlihat dan baris baru mulai di tempat yang familiar.
  if (wrapped) {
    active.anchorScroll = landingScrollFor({
      scrollLeft: active.scroller.scrollLeft,
      offsetX: caret.x - geometry.left,
      clientWidth: active.scroller.clientWidth,
      maxScroll,
      sidePad: sidePadOf(active.scroller),
    })
  }

  // Horizontal: caret keluar pita → geser sebesar kelebihan itu. Targetnya
  // adalah posisi scroll tempat caret tepat di ambang kanan pita, jadi
  // setiap frame mengulang perhitungan yang sama sampai caret masuk pita.
  // Selama kamera sedang kembali ke jangkar (wrap), pita ditangguhkan —
  // target dan jangkar tidak boleh saling menarik.
  const delta = panDeltaFor(caret.x, geometry.left, geometry.width)
  let target: number
  if (active.anchorScroll !== null) {
    target = active.anchorScroll
    // Sudah sampai → jangkar selesai, pita biasa mengambil alih lagi.
    if (Math.abs(active.scroller.scrollLeft - target) < 0.5) active.anchorScroll = null
  } else {
    // Batas kiri: kamera tidak pernah turun di bawah pendaratan awal sesi —
    // di situ margin kiri kertas masih terlihat.
    target = clamp(active.scroller.scrollLeft + delta, anchorFloorFor(active.scroller), maxScroll)
  }
  const current = active.scroller.scrollLeft
  const eased = reducedMotion(active) ? target : ease(current, target, deltaMs)
  // Dekat target → tulis target persis, supaya kamera berhenti tepat di
  // ambang pita (bukan menggantung beberapa piksel di thereof).
  const next = Math.abs(target - eased) < 0.5 ? target : eased
  if (Math.abs(next - current) > 0.05) {
    console.log('[follow] write', next.toFixed(1), 'state', active.state)
    writeScroll(active, active.scroller, 'scrollLeft', next)
    // Lanjut ke frame berikutnya selama belum sampai target.
    schedule(active)
  }

  // Vertikal: caret melewati tepi bawah area terlihat → well digulir ke
  // bawah; caret di atas area terlihat → well digulir ke atas (K5).
  const bottomLimit = geometry.bottom - CARET_BOTTOM_MARGIN_PX
  if (caret.y > bottomLimit) {
    writeScroll(active, active.well, 'scrollTop', active.well.scrollTop + (caret.y - bottomLimit))
  } else if (caret.y < geometry.top) {
    writeScroll(active, active.well, 'scrollTop', active.well.scrollTop + (caret.y - geometry.top))
  }
}

/**
 * Nyalakan follow untuk sebuah control (hanya di layar sempit — pemanggil
 * yang memutuskan, `CanvasFieldEditor`).
 *
 * Listener yang dipasang:
 *  - `input` pada control — caret bergerak karena mengetik;
 *  - `selectionchange` pada document — caret bergerak karena tap / tahan lalu
 *    seret / tombol panah. Event ini menyala untuk seluruh form di halaman,
 *    jadi hanya diproses bila `document.activeElement` control yang dilacak;
 *  - `scroll` (capture, passive) pada scroller & well — gulir manual user
 *    menghentikan follow (K6).
 */
export const startCaretFollow = (control: HTMLInputElement | HTMLTextAreaElement): void => {
  stopCaretFollow()
  console.log('[follow] START')
  const well = document.getElementById('pane-preview')
  const scroller = well?.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
  if (!well || !scroller) return

  const active: FollowSession = {
    control,
    well,
    scroller,
    state: 'following',
    rafId: null,
    programmatic: false,
    lastFrameAt: 0,
    lastCaretStart: control.selectionStart,
    lastCaret: null,
    minCaretX: null,
    anchorScroll: null,
    motionQuery: null,
    onMotionChange: () => {},
    teardown: () => {},
  }
  session = active

  const onCaretChange = () => {
    if (session !== active) return
    if (active.state === 'paused') {
      // Jeda dilepas, tapi gerakan ini belum menggerakkan kamera.
      active.state = 'arming'
    } else {
      active.state = 'following'
    }
    schedule(active)
  }

  const handleInput = () => {
    // `input` dan `selectionchange` milik satu ketikan yang sama — kalau
    // keduanya dihitung, satu ketikan terbaca dua gerakan.
    active.lastCaretStart = control.selectionStart
    onCaretChange()
  }

  const handleSelectionChange = () => {
    if (session !== active) return
    if (document.activeElement !== control) return
    // Caret belum bergerak — event ini milik ketikan yang barusan diproses.
    if (control.selectionStart === active.lastCaretStart) return
    active.lastCaretStart = control.selectionStart
    onCaretChange()
  }

  const handleScroll = (event: Event) => {
    if (session !== active) return
    if (active.programmatic) return
    const target = event.target
    // Gulir internal control (browser menjaga caret tetap terlihat) bukan
    // guliran user — jangan ikut menghentikan follow.
    if (target !== active.scroller && target !== active.well) return
    console.log('[follow] manual-scroll → paused')
    active.state = 'paused'
    // Kalau kamera sedang kembali ke jangkar (wrap), guliran manual user
    // membatalkan jangkar itu — keinginan user didahulukan.
    active.anchorScroll = null
  }

  control.addEventListener('input', handleInput)
  document.addEventListener('selectionchange', handleSelectionChange)
  active.scroller.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  active.well.addEventListener('scroll', handleScroll, { capture: true, passive: true })

  const motionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  active.motionQuery = motionQuery
  active.onMotionChange = () => {
    // Nilai `matches` dibaca ulang tiap frame — cukup untuk bereaksi.
  }
  motionQuery?.addEventListener?.('change', active.onMotionChange)

  active.teardown = () => {
    control.removeEventListener('input', handleInput)
    document.removeEventListener('selectionchange', handleSelectionChange)
    active.scroller.removeEventListener('scroll', handleScroll, { capture: true })
    active.well.removeEventListener('scroll', handleScroll, { capture: true })
    motionQuery?.removeEventListener?.('change', active.onMotionChange)
  }

  schedule(active)
}

/**
 * Hentikan follow: batalkan rAF, lepas semua listener, buang mirror.
 *
 * Wajib dipanggil saat editor dilepas — kalau tidak, rAF bocor dan kamera
 * bergerak sendiri setelah sesi edit ditutup.
 */
export const stopCaretFollow = (): void => {
  const active = session
  if (!active) return
  console.log('[follow] STOP')
  session = null
  if (active.rafId !== null) {
    cancelAnimationFrame(active.rafId)
    active.rafId = null
  }
  active.teardown()
  disposeCaretMirror()
}

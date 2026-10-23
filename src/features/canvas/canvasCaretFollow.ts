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
 *     terlihat, bukan caret yang menempel di tepi kiri layar. Jangkar diukur
 *     dari **tepi kiri field**, bukan dari caret: baris pertama selalu mulai
 *     di tepi kiri field, jadi baris berikutnya harus mendarat di titik yang
 *     sama.
 *
 * Gulir manual oleh user (swipe) **menghentikan** follow — keinginan user
 * didahulukan (K6). Tapi tidak semua gulir yang bukan tulisan follow kami
 * adalah gulir user: **browser sendiri** menggulir lapisan kertas untuk
 * menjaga caret tetap terlihat (paling terasa tepat setelah wrap, saat caret
 * melompat jauh ke kiri). Gulir browser itu tidak boleh menjeda follow —
 * kalau dianggap manual, setiap ketikan mem-pause follow dan jangkar wrap
 * dibatalkan, sehingga kamera berhenti mengikuti ketikan di baris
 * selanjutnya. Karena itu gulir yang berdekatan dengan perubahan caret
 * ({@link CARET_SCROLL_GRACE_MS}) dianggap milik browser, sedangkan niat
 * user dideteksi dari gestur gulir itu sendiri (`wheel` / `touchmove`).
 *
 * Follow tidak pernah mengubah zoom: zoom sepenuhnya urusan
 * `applyEditZoom`/`restorePreviewZoom` (K9).
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
 * Jendela waktu (ms) setelah caret bergerak di mana gulir lapisan kertas
 * dianggap **milik browser**, bukan user.
 *
 * Chrome menggulir scrollport terdekat supaya caret tetap terlihat setiap
 * kali caret keluar pandangan — rutin terjadi saat mengetik, dan paling
 * terasa setelah wrap: caret melompat dari ujung kanan ke awal baris baru
 * yang jauh di kiri layar, lalu browser langsung "menyeret" kamera ke sana.
 * Guliran itu bukan keinginan user. Kalau dianggap manual, setiap ketikan
 * setelah wrap mem-pause follow dan membatalkan jangkar — kamera berhenti
 * mengikuti ketikan di baris lanjutan.
 *
 * 250ms cukup lebar untuk menangkap guliran susulan browser (satu-dua frame
 * setelah `input`), tetapi cukup sempit supaya swipe user yang tenang
 * (biasanya jeda > 250ms setelah ketikan terakhir) tetap dihormati.
 */
export const CARET_SCROLL_GRACE_MS = 250

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
  /** Posisi gulir saat jangkar dipasang — penanda "kamera sudah bergerak". */
  anchorFrom: number | null
  /** Posisi gulir frame sebelumnya — mendeteksi kamera yang mentok. */
  lastScroll: number | null
  /** Posisi gulir terakhir yang kita tulis — mendeteksi gulir manual user. */
  lastWritten: number | null
  /** Waktu (ms) caret terakhir bergerak — memisahkan gulir browser dari user. */
  lastCaretAt: number
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
 * Langkah kamera menuju jangkar (posisi awal sesi).
 *
 * Berbeda dari pita gerak — yang hanya bergerak saat caret keluar pita —
 * jangkar adalah perjalanan **balik** ke posisi awal, jadi harus selalu
 * mendarat persis di target. Pena eksponensial tanpa langkah minimum
 * tidak pernah sampai: `scrollLeft` browser dibulatkan, jadi kamera mentok
 * beberapa piksel di atas target dan jangkar tak pernah dilepas — pita
 * gerak tersuspend selamanya dan kamera berhenti mengikuti caret ke kanan.
 * Dengan langkah minimum 1px, jangkar selalu mendarat (maksimal ~40 frame)
 * dan tali pita kembali longgar.
 */
const anchorStep = (current: number, target: number): number => {
  const gap = target - current
  if (Math.abs(gap) <= 1) return target
  return current + Math.sign(gap) * Math.max(1, Math.abs(gap) * 0.125)
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
  //
  // Patokannya **tepi kiri field**, bukan caret. Baris pertama selalu mulai
  // di tepi kiri field; memakai caret (yang di awal baris baru sudah bergeser
  // selebar padding teks) membuat baris lanjutan mendarat beberapa piksel
  // lebih kiri daripada baris pertama. Tepi kiri field juga **tidak berubah**
  // walaupun browser sudah menggulir kamera untuk menjaga caret terlihat:
  // `scrollLeft + (controlLeft − geometry.left)` invarian terhadap guliran
  // itu, jadi jangkar tidak "mengejar" posisi yang sudah digeser browser.
  if (wrapped) {
    const controlLeft = active.control.getBoundingClientRect().left
    active.anchorScroll = landingScrollFor({
      scrollLeft: active.scroller.scrollLeft,
      offsetX: controlLeft - geometry.left,
      clientWidth: active.scroller.clientWidth,
      maxScroll,
      sidePad: sidePadOf(active.scroller),
    })
    active.anchorFrom = active.scroller.scrollLeft
  }

  // Horizontal: caret keluar pita → geser sebesar kelebihan itu. Targetnya
  // adalah posisi scroll tempat caret tepat di ambang kanan pita, jadi
  // setiap frame mengulang perhitungan yang sama sampai caret masuk pita.
  // Selama kamera sedang kembali ke jangkar (wrap), pita ditangguhkan —
  // target dan jangkar tidak boleh saling menarik.
  const delta = panDeltaFor(caret.x, geometry.left, geometry.width)
  const current = active.scroller.scrollLeft

  // **Gulir manual user menang atas animasi kamera.** Kalau posisi gulir
  // berbeda dari yang terakhir kita tulis, ada yang menggeser di luar
  // follow — jeda dulu (K6), jangan ditimpa kamera. Posisi yang berbeda
  // tepat setelah caret bergerak bukan gulir user: itu browser menjaga caret
  // tetap terlihat (lihat `CARET_SCROLL_GRACE_MS`), jadi jangan menjeda.
  if (
    active.lastWritten !== null &&
    Math.abs(current - active.lastWritten) > 1.5 &&
    active.state === 'following' &&
    performance.now() - active.lastCaretAt >= CARET_SCROLL_GRACE_MS
  ) {
    active.state = 'paused'
    active.anchorScroll = null
  }

  let target: number
  if (active.anchorScroll !== null) {
    target = active.anchorScroll
    // **Jangkar selesai** bila kamera sudah sampai persis — snaganya,
    // `scrollLeft` browser dibulatkan, jadi pena eased bisa mentok
    // beberapa piksel di atas target dan tak pernah menyentuhnya.
    const settled = Math.abs(current - target) < 0.5
    // **Jangkar mentok**: kamera sudah bergerak ke arah jangkar tapi tak
    // pernah sampai (target di luar jangkauan gulir) — jangkar tidak boleh
    // menggantung, karena selama menggantung pita gerak tersuspend dan
    // kamera tidak pernah lagi mengikuti caret ke kanan.
    const stuck =
      active.lastScroll !== null &&
      active.anchorFrom !== null &&
      Math.abs(current - active.lastScroll) < 0.5 &&
      Math.abs(current - active.anchorFrom) >= 0.5
    if (settled || stuck) active.anchorScroll = null
  } else {
    // Batas kiri: kamera tidak pernah turun di bawah pendaratan awal sesi —
    // di situ margin kiri kertas masih terlihat.
    const floor = anchorFloorFor(active.scroller)
    const fieldWidth = active.control.clientWidth
    if (fieldWidth > 0 && content.x > fieldWidth) {
      // **Caret sudah melewati tepi kanan field.** Browser mengambil alih
      // (menggulir isi control supaya caret tetap terlihat), jadi posisi caret
      // di *layar* berhenti bergerak — kamera yang ikut berhenti di sana
      // membuat tepi kanan kertas beserta ruang napasnya tak pernah terlihat.
      // Kamera lalu berjalan ke batas gulir.
      target = maxScroll
    } else {
      target = clamp(active.scroller.scrollLeft + delta, floor, maxScroll)
    }
  }
  active.lastScroll = current
  const eased = reducedMotion(active) ? target : ease(current, target, deltaMs)
  // Dekat target → tulis target persis, supaya kamera berhenti tepat di
  // ambang pita (bukan menggantung beberapa piksel di thereof).
  // Jangkar: langkahnya sendiri yang selalu mendarat persis (lihat
  // `anchorStep`) — pena eased akan mentok di atas target.
  const next =
    active.anchorScroll !== null
      ? anchorStep(current, target)
      : Math.abs(target - eased) < 0.5
        ? target
        : eased
  if (Math.abs(next - current) > 0.05) {
    console.log('[follow] write', next.toFixed(1), 'state', active.state)
    writeScroll(active, active.scroller, 'scrollLeft', next)
    active.lastWritten = next
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
 * Hentikan kamera karena user menggulir sendiri (K6).
 *
 * Jangkar wrap ikut dibatalkan: keinginan user yang lebih baru didahulukan,
 * kamera tidak boleh menarik kembali pandangan yang baru saja digeser.
 */
const pauseFollow = (active: FollowSession): void => {
  if (active.state === 'paused') return
  active.state = 'paused'
  active.anchorScroll = null
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
 *    menghentikan follow (K6), kecuali guliran browser yang berdekatan dengan
 *    perubahan caret (lihat `CARET_SCROLL_GRACE_MS`);
 *  - `wheel` / `touchmove` pada scroller & well — gestur gulir user yang
 *    tegas, langsung menghentikan follow tanpa menunggu klasifikasi `scroll`.
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
    anchorFrom: null,
    lastScroll: null,
    lastWritten: null,
    // Belum ada caret yang bergerak — gulir apa pun sebelum ketikan pertama
    // tetap dianggap manual (perilaku K6 yang sudah ada).
    lastCaretAt: Number.NEGATIVE_INFINITY,
    motionQuery: null,
    onMotionChange: () => {},
    teardown: () => {},
  }
  session = active

  const onCaretChange = () => {
    if (session !== active) return
    active.lastCaretAt = performance.now()
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
    // **Gulir browser, bukan gulir user.** Tepat setelah caret bergerak
    // (terutama saat wrap), browser menggulir scrollport supaya caret tetap
    // terlihat. Itu bukan keinginan user — jangan menjeda follow dan jangan
    // membatalkan jangkar. `lastWritten` diselaraskan supaya pemeriksaan di
    // tick tidak membaca guliran ini sebagai gulir manual yang tertinggal.
    if (performance.now() - active.lastCaretAt < CARET_SCROLL_GRACE_MS) {
      active.lastWritten = active.scroller.scrollLeft
      return
    }
    pauseFollow(active)
  }

  // **Niat user** dideteksi dari gestur gulirnya sendiri: roda mouse /
  // trackpad dan seret jari. Ini kebal terhadap guliran browser (yang tidak
  // punya gestur) dan tetap menghormati K6 — user yang menggulir sendiri
  // menghentikan kamera, kapan pun itu terjadi.
  const handleUserScrollIntent = () => {
    if (session !== active) return
    pauseFollow(active)
  }

  control.addEventListener('input', handleInput)
  document.addEventListener('selectionchange', handleSelectionChange)
  active.scroller.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  active.well.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  for (const element of [active.scroller, active.well]) {
    element.addEventListener('wheel', handleUserScrollIntent, { passive: true })
    element.addEventListener('touchmove', handleUserScrollIntent, { passive: true })
  }

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
    for (const element of [active.scroller, active.well]) {
      element.removeEventListener('wheel', handleUserScrollIntent)
      element.removeEventListener('touchmove', handleUserScrollIntent)
    }
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

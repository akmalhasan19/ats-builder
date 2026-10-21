import { useCanvasStore, type CanvasFocusPoint, type CanvasSession } from '@/store/canvasStore'
import { useUiStore } from '@/store/uiStore'
import { effectiveScaleOf, ensureReadableZoom } from './canvasZoom'

/**
 * Addendum FASE 13 — **zoom edit di layar sempit**.
 *
 * Di layar sempit (panel mode `tabs`, <1024px) kertas A4 selalu lebih lebar
 * daripada layar: pada 360px skala fit cuma ±0,39, jadi teks di atas kertas
 * nyaris tak terbaca. Ketika user menyentuh sebuah field untuk mengeditnya,
 * skala dinaikkan ke **75%** — cukup besar untuk mengetik dengan nyaman —
 * dan field yang sedang diedit **dijejarkan ke tepi kiri** well, supaya
 * "fokus" layar jatuh tepat di tempat user mengetik.
 *
 * FASE 14B mengganti pemusatan tengah menjadi penjajaran kiri: urutan ketik
 * selalu dimulai dari kiri field, jadi tepi kiri — bukan tengah — adalah
 * titik fokus yang benar. Gerak kamera mengikuti caret sendiri ada di
 * `canvasCaretFollow.ts` (FASE 14C).
 *
 * Setelah edit selesai (commit) atau dibatalkan (Escape), zoom **kembali**
 * ke skala ringkasan yang tadi dipakai (biasanya 30% atau Fit), supaya
 * pengguna kembali melihat seluruh kertas seperti semula.
 *
 * Di desktop perilaku lama (D7) tetap berlaku: zoom dinaikkan sekali saja
 * per sesi aplikasi bila skalanya di bawah ambang bacaabilitas, dan **tidak**
 * dikembalikan — di desktop kertas muat di layar, jadi tidak ada masalah
 * "kembali ke 30%".
 */

/** Skala yang dipakai saat mengedit di layar sempit. */
export const EDIT_ZOOM = 0.75

/**
 * Jarak tepi kiri field yang diedit dari tepi kiri konten well.
 *
 * Selaras dengan padding well `p-6` (24px): field mendarat tepat di tepi
 * kiri area yang terlihat, jadi yang terlihat adalah **awal** teks yang
 * sedang diketik, bukan pertengahannya.
 */
export const FOCUS_EDGE_MARGIN_PX = 24

/**
 * Tata letak sempit = panel mode `tabs` (<1024px). Sumber yang sama dengan
 * aturan CSS target sentuh §5.3 (`[data-panel-mode='tabs']`), jadi perilaku
 * JS dan CSS tidak bisa berbeda breakpoint.
 */
export const isNarrowLayout = (): boolean => useUiStore.getState().panelMode === 'tabs'

/**
 * Ukur titik fokus (**tepi kiri** elemen yang disentuh) dalam **koordinat
 * kertas** — koordinat yang tidak ikut berubah saat zoom.
 *
 * Kertas diskalakan dengan `transform: scale()` (origin top-left), jadi
 * jarak titik dari tepi kiri konten dibagi skala saat pengukuran memberi tahu
 * koordinat kertasnya. Dengan begitu titik fokus tetap valid meski skalanya
 * berubah sesaat setelah pengukuran.
 *
 * Sumbunya memang berbeda satu sama lain:
 *  - **horizontal** memakai **tepi kiri** elemen — urutan ketik selalu berjalan
 *    dari kiri ke kanan, jadi titik fokus yang benar adalah tempat teks
 *    dimulai, bukan tengahnya (FASE 14B / K3). segmen dokumen sudah inline
 *    (lebarnya = lebar teks), jadi tepi kirinya = awal teks yang disentuh;
 *  - **vertikal** memakai tepi atas elemen, supaya awal teks yang sedang
 *    diketik selalu terlihat, bukan tengah paragraf.
 */
export const measureFocusPoint = (element: HTMLElement | null): CanvasFocusPoint | null => {
  if (!element) return null
  const content = element.closest<HTMLElement>('[data-probe="preview-content"]')
  if (!content) return null
  const scale = effectiveScaleOf(element)
  if (!Number.isFinite(scale) || scale <= 0) return null
  const contentRect = content.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  // Elemen tanpa kotak (belum dirender / tersembunyi) tidak punya titik fokus.
  if (rect.width === 0 && rect.height === 0) return null
  return {
    x: (rect.left - contentRect.left) / scale,
    y: (rect.top - contentRect.top) / scale,
  }
}

/**
 * Simpan zoom ringkasan (sebelum sesi edit) supaya bisa dikembalikan setelah
 * edit selesai. Hanya layar sempit yang butuh ini — desktop tidak pernah
 * memindahkan zoom saat sesi ditutup.
 */
export const capturePreviewZoom = (): void => {
  if (!isNarrowLayout()) return
  const ui = useUiStore.getState()
  useCanvasStore
    .getState()
    .setPreEditZoom({ before: { zoom: ui.zoom, fitMode: ui.fitMode }, during: null })
}

/**
 * Kembalikan zoom ringkasan setelah sesi edit ditutup.
 *
 * Kalau user mengubah zoom sendiri selama sesi (mis. lewat tombol +/−),
 * keinginannya yang lebih baru — jadi zoom **tidak** ditimpa.
 */
export const restorePreviewZoom = (): void => {
  const canvas = useCanvasStore.getState()
  const snapshot = canvas.preEditZoom
  if (!snapshot) return
  canvas.setPreEditZoom(null)
  const ui = useUiStore.getState()
  if (snapshot.during) {
    const changed = snapshot.during.zoom !== ui.zoom || snapshot.during.fitMode !== ui.fitMode
    if (changed) return
  }
  ui.setFitMode(snapshot.before.fitMode)
  ui.setZoom(snapshot.before.zoom)
}

/**
 * Naikkan zoom sesuai mode tampilan.
 *
 * Layar sempit: naik ke {@link EDIT_ZOOM} (75%) — tapi **tidak pernah
 * memperkecil**: kalau skala yang ada sudah lebih besar (mis. tablet yang
 * muat hampir utuh), biarkan saja.
 *
 * Desktop: pakai guard lama (D7) — naik ke 75% sekali saja per sesi aplikasi
 * kalau skala di bawah ambang bacaabilitas.
 *
 * **Tanpa toast di layar sempit.** Toast mobile duduk di atas kertas (104px
 * dari atas layar) — persis di tempat field yang baru diedit berada, jadi
 * ia menutupi teks yang sedang diketik. Nilai zoom di toolbar sudah
 * memberi tahu ("75%"), jadi tidak perlu toast tambahan. Desktop tetap
 * memakai toast D7 (di sana toast duduk di kanan bawah, jauh dari kertas).
 */
export const applyEditZoom = (element: HTMLElement | null): void => {
  if (!isNarrowLayout()) {
    ensureReadableZoom(element)
    return
  }
  const scale = effectiveScaleOf(element)
  if (scale >= EDIT_ZOOM) return
  const ui = useUiStore.getState()
  ui.setFitMode(false)
  ui.setZoom(EDIT_ZOOM)
  const canvas = useCanvasStore.getState()
  // Catat zoom yang dipakai selama sesi: kalau user mengubahnya sendiri
  // sebelum sesi ditutup, keinginannya tidak boleh ditimpa saat restore.
  const snapshot = canvas.preEditZoom
  if (snapshot) {
    canvas.setPreEditZoom({ ...snapshot, during: { zoom: EDIT_ZOOM, fitMode: false } })
  }
}

/**
 * Satu pintu masuk membuka sesi edit: ukur titik fokus → simpan zoom
 * ringkasan → naikkan zoom → buka sesi.
 *
 * Semua pemanggil (klik segmen, ghost row, tombol "Perbaiki →" di drawer
 * ATS) memakai fungsi ini, supaya aturan zoom & pemusatan tidak pernah
 * berbeda antarjalur.
 */
export const startCanvasEdit = (element: HTMLElement | null, session: CanvasSession): void => {
  const canvas = useCanvasStore.getState()
  canvas.setFocusPoint(measureFocusPoint(element))
  capturePreviewZoom()
  applyEditZoom(element)
  useCanvasStore.getState().openSession(session)
}

/**
 * Geser sumbu pratinjau supaya **tepi kiri** field yang diedit mendarat di
 * margin kiri area yang terlihat.
 *
 * Penjajaran kiri (bukan pemusatan) karena urutan ketik selalu berjalan dari
 * kiri ke kanan: yang harus terlihat pertama adalah **awal** teks yang
 * sedang diketik, bukan pertengahannya. Titik fokus horizontal diukur dari
 * tepi kiri elemen (lihat {@link measureFocusPoint}).
 *
 * Sumbu vertikal hanya dijaga agar field tetap terlihat (gulir secukupnya) —
 * bukan dipusatkan, supaya konteks halaman tetap terasa.
 *
 * Gulir horizontal terjadi di lapisan dalam (`[data-probe="preview-scroll"]`),
 * vertikal di well. Pemisahan itu yang membuat toolbar (nilai zoom,
 * "Tampilan", "Keluar") tetap terlihat saat kertas bergeser.
 */
export const alignFocusStart = (point: CanvasFocusPoint | null): void => {
  if (!point) return
  const well = document.getElementById('pane-preview')
  const scroller = well?.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
  const content = scroller?.querySelector<HTMLElement>('[data-probe="preview-content"]')
  if (!well || !scroller || !content) return
  const scale = effectiveScaleOf(content)
  if (!Number.isFinite(scale) || scale <= 0) return

  const wellRect = well.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const style = getComputedStyle(well)
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0
  // Sisi kiri/atas area konten well (bukan border box).
  const originLeft = wellRect.left + borderLeft
  const originTop = wellRect.top + borderTop

  // Titik fokus di koordinat viewport, memakai skala yang benar-benar dipakai
  // pohon pratinjau saat ini.
  const targetX = contentRect.left + point.x * scale
  const targetY = contentRect.top + point.y * scale

  // Horizontal: tepi kiri field mendarat di margin kiri area terlihat
  // (selaras padding well `p-6`).
  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
  const wanted = scroller.scrollLeft + targetX - (originLeft + FOCUS_EDGE_MARGIN_PX)
  scroller.scrollLeft = Math.min(Math.max(wanted, 0), maxScroll)

  // Vertikal: pastikan field tetap di dalam area yang terlihat. Toolbar
  // lengket menutupi bagian atas well, jadi area terlihat mulai di bawahnya.
  const toolbar = well.querySelector<HTMLElement>('[data-probe="preview-toolbar"]')
  const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0
  const visibleTop = originTop + toolbarHeight
  const visibleBottom = originTop + well.clientHeight
  if (targetY < visibleTop) {
    well.scrollTop += targetY - visibleTop
  } else if (targetY > visibleBottom) {
    well.scrollTop += targetY - visibleBottom
  }
}

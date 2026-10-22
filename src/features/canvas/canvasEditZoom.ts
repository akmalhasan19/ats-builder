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
 * **Addendum — ruang napas kertas.** Penjajaran kiri murni menempelkan tepi
 * kiri field ke tepi layar: tepi kiri *kertas* ikut terpotong, dan di ujung
 * gulir tepi kanan kertas menempel persis di tepi layar — teks tampak
 * "dipotong pisau" di kedua sisi. Karena itu penjajaran sekarang dibatasi
 * ({@link PAPER_EDGE_MARGIN_PX}) dan `PreviewWell` menambahkan padding
 * kiri-kanan di lapisan gulir ({@link EDIT_SIDE_PAD_PX}) saat sesi edit —
 * tepi kertas selalu punya ruang terlihat di kedua sisi.
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
 * Selaras dengan padding well `p-6` (24px). Ini **target awal** penjajaran;
 * batas {@link PAPER_EDGE_MARGIN_PX} bisa menggeser pendaratannya lebih ke
 * kanan supaya tepi kiri kertas tidak ikut terpotong (Addendum ruang napas),
 * dan {@link FIELD_VISIBLE_MIN_PX} menjaga field sendiri tetap terlihat.
 */
export const FOCUS_EDGE_MARGIN_PX = 24

/**
 * Padding kiri-kanan di dalam lapisan gulir (`preview-scroll`) selama sesi
 * edit di layar sempit — "ruang napas" kertas. Dipasang `PreviewWell`.
 *
 * Di 75% kertas A4 (595px) selalu lebih lebar daripada layar, jadi tanpa
 * ruang ini tepi kertas menempel persis di tepi layar: di awal gulir tepi
 * kiri kertas terpotong, di ujung gulir tepi kanannya menempel di layar.
 * Padding ini menambah ruang abu-abu yang ikut tergulir di kedua sisi
 * kertas, jadi di kedua ujung pun tepi kertas tetap punya ruang terlihat.
 *
 * Ukuran **≈ 1 inci** (96px pada 96dpi): pengguna melaporkan ruang 40px
 * masih terasa "dipotong pisau" — tampilan harus menampilkan beberapa inci
 * di sebelah kiri *dan* kanan form, bukan sekadar selebar padding well.
 */
export const EDIT_SIDE_PAD_PX = 96

/**
 * Ruang minimum di kiri kertas saat sesi edit dimulai: bagian dari
 * {@link EDIT_SIDE_PAD_PX} yang sengaja **tidak** dihabiskan oleh
 * penjajaran field. Tanpa batas ini, menjejarkan tepi kiri field ke margin
 * well menggulir tepi kiri kertas sampai keluar layar — persis keluhan
 * "tampilan terpotong di bagian paling kiri form".
 *
 * 40px (≈ 0,4 inci) supaya margin kiri kertas benar-benar tampak sebagai
 * ruang, tidak sekadar leret — ditambah padding well `p-6` (24px) jadi
 * total ±64px ruang abu-abu di kiri layar saat sesi dibuka.
 */
export const PAPER_EDGE_MARGIN_PX = 40

/**
 * Lebar minimum tepi kiri field yang diedit yang harus tetap terlihat.
 *
 * Batas {@link PAPER_EDGE_MARGIN_PX} mengorbankan sisi kanan pandangan;
 * untuk field di kolom kanan kertas (mis. tanggal pada entri pengalaman)
 * itu berarti field-nya sendiri terdorong keluar layar. Aturan ini
 * membaliknya: kertas boleh terpotong di kiri, asal field tetap terlihat.
 */
const FIELD_VISIBLE_MIN_PX = 80

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
 * Baca padding kiri lapisan gulir yang dipasang `PreviewWell` selama sesi
 * edit ({@link EDIT_SIDE_PAD_PX}). Inline style dipakai langsung — sumber
 * yang sama dengan yang terlihat di layar, dan bisa dibaca di unit test.
 */
export const sidePadOf = (scroller: HTMLElement): number =>
  Number.parseFloat(scroller.style.paddingLeft) || 0

/**
 * Rumus pendaratan satu field — dipakai **bersama** oleh penjajaran awal
 * sesi (`alignFocusStart`) dan kembalinya kamera saat caret berpindah baris
 * (`canvasCaretFollow`). Satu rumus, satu perilaku: "kembali ke tampilan
 * seperti awal masuk mode edit" benar-benar sama, bukan hanya mirip.
 *
 * Aturan pendaratan, dari prioritas tertinggi:
 *
 *  1. **Field tetap terlihat.** Tepi kiri field tidak boleh mendarat lebih
 *     kanan dari `FIELD_VISIBLE_MIN_PX` sebelum tepi kanan area terlihat —
 *     field kolom kanan (mis. tanggal entri) tetap harus tampak, walaupun
 *     itu memotong kertas di sebelah kirinya.
 *  2. **Tepi kiri kertas tidak terpotong.** Selama kertas punya padding kiri
 *     di lapisan gulir ({@link EDIT_SIDE_PAD_PX}), penjajaran tidak boleh
 *     menghabiskannya seluruhnya: tersisa {@link PAPER_EDGE_MARGIN_PX} ruang
 *     sebelum tepi kiri kertas, di atas padding well `p-6`. Tanpa padding
 *     (mode ringkasan, atau kertas muat) perilaku lama utuh.
 *  3. **Target penjajaran lama (FASE 14B).** Tepi kiri field mendarat di
 *     {@link FOCUS_EDGE_MARGIN_PX} dari tepi kiri konten well — untuk field
 *     di dekat tepi kiri kertas, aturan (2) yang menang; untuk field yang
 *     meluber ke kanan, aturan (1).
 */
export const landingScrollFor = ({
  scrollLeft,
  offsetX,
  clientWidth,
  maxScroll,
  sidePad,
}: {
  /** Posisi gulir sekarang (px). */
  scrollLeft: number
  /** Jarak tepi kiri field dari tepi kiri konten well (px layar, diukur pada `scrollLeft` sekarang). */
  offsetX: number
  /** Lebar area terlihat lapisan gulir (px). */
  clientWidth: number
  /** Batas gulir maksimum (px). */
  maxScroll: number
  /** Padding kiri lapisan gulir saat ini — "ruang napas" (px). */
  sidePad: number
}): number => {
  // Aturan 3 — target penjajaran lama: tepi kiri field mendarat di margin
  // kiri konten well.
  const wanted = scrollLeft + offsetX - FOCUS_EDGE_MARGIN_PX

  // Aturan 2 — batas atas: sisakan PAPER_EDGE_MARGIN_PX dari padding kiri
  // lapisan gulir, supaya tepi kiri kertas tetap terlihat dengan ruang di
  // sebelah kirinya.
  const paperEdgeCap =
    sidePad >= PAPER_EDGE_MARGIN_PX ? sidePad - PAPER_EDGE_MARGIN_PX : Number.POSITIVE_INFINITY

  // Aturan 1 — batas bawah: jangan sampai field sendiri terdorong keluar
  // layar.
  const fieldFloor = Math.max(
    0,
    offsetX - (FOCUS_EDGE_MARGIN_PX + clientWidth - FIELD_VISIBLE_MIN_PX),
  )

  const upper = Math.min(maxScroll, paperEdgeCap)
  return Math.min(Math.max(wanted, fieldFloor), Math.max(upper, fieldFloor))
}

/**
 * Geser sumbu pratinjau supaya field yang diedit terlihat di awal sesi —
 * dengan **ruang kiri kertas yang tetap terhidup** (Addendum FASE 14).
 *
 * Aturan pendaratan, dari prioritas tertinggi:
 *
 *  1. **Field tetap terlihat.** Tepi kiri field tidak boleh mendarat lebih
 *     kanan dari `FIELD_VISIBLE_MIN_PX` sebelum tepi kanan area terlihat —
 *     field kolom kanan (mis. tanggal entri) tetap harus tampak, walaupun
 *     itu memotong kertas di sebelah kirinya.
 *  2. **Tepi kiri kertas tidak terpotong.** Selama kertas punya padding kiri
 *     di lapisan gulir ({@link EDIT_SIDE_PAD_PX}), penjajaran tidak boleh
 *     menghabiskannya seluruhnya: tersisa {@link PAPER_EDGE_MARGIN_PX} ruang
 *     sebelum tepi kiri kertas, di atas padding well `p-6`. Tanpa padding
 *     (mode ringkasan, atau kertas muat) perilaku lama utuh.
 *  3. **Target penjajaran lama (FASE 14B).** Tepi kiri field mendarat di
 *     {@link FOCUS_EDGE_MARGIN_PX} dari tepi kiri konten well — untuk field
 *     di dekat tepi kiri kertas, aturan (2) yang menang; untuk field yang
 *     meluber ke kanan, aturan (1).
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

  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth)

  scroller.scrollLeft = landingScrollFor({
    scrollLeft: scroller.scrollLeft,
    offsetX: targetX - originLeft,
    clientWidth: scroller.clientWidth,
    maxScroll,
    sidePad: sidePadOf(scroller),
  })

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

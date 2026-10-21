import { A4_PX } from '@/lib/units'

/**
 * Konstanta & rumus zoom pratinjau (FASE 13, D10/D11).
 *
 * Modul ini murni (tanpa React, tanpa DOM) supaya batas-batas zoom bisa diuji
 * tanpa browser. `PreviewWell` mengimpor dari sini; tidak ada lagi konstanta
 * zoom yang terduplikasi di komponen.
 */

/** Batas bawah zoom — 30% masih terbaca untuk sekilas di layar kecil. */
export const MIN_ZOOM = 0.3

/** Plafon zoom mode form (pratinjau di samping panel formulir). */
export const MAX_ZOOM = 1.5

/**
 * Plafon zoom mode kanvas layar penuh (D10). Kertas boleh membesar sampai
 * dua kali ukuran A4 natural: 794×1123 px → 1588×2246 px.
 */
export const MAX_ZOOM_CANVAS = 2.0

/** Langkah zoom tombol +/−. */
export const ZOOM_STEP = 0.1

/** §5.5 — lembar selalu berjarak 48px dari tepi well saat mode Fit. */
export const FIT_PAD_PX = 48

/**
 * Jarak aman fit mode kanvas layar penuh pada ≥1024px: well memakai
 * `lg:p-10` (40px kiri + 40px kanan = 80px), jadi lembar tetap pas di kotak
 * konten.
 *
 * Nilai ini hanya **cadangan**. `PreviewWell` membaca padding well yang
 * sebenarnya dari DOM, sehingga kelas padding dan rumus fit tidak pernah
 * berbeda (§ T2.3).
 */
export const FIT_PAD_PX_CANVAS = 80

/** Jeda penundaan hitung ulang skala fit setelah well berubah lebar. */
export const FIT_RECALC_DEBOUNCE_MS = 100

/** Kunci angka ke rentang [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Plafon zoom aktif untuk mode yang sedang dipakai. */
export const maxZoomFor = (canvasFullscreen: boolean): number =>
  canvasFullscreen ? MAX_ZOOM_CANVAS : MAX_ZOOM

/**
 * Skala "Fit" untuk lebar well tertentu.
 *
 * D11 — fit **hanya** berbasis lebar; tidak ada fit-tinggi. Pada 1920×1080
 * fit-tinggi menghasilkan `(1024−56−48)/1123 ≈ 0,82`, lebih kecil dari skala
 * fit-lebar yang sekarang terukur di mode form pada lebar sama (0,8867 di
 * 1920px, lihat regression anchor di `tests/unit/previewZoom.test.ts`), jadi
 * menambahkannya adalah regresi. Dokumen yang lebih tinggi daripada viewport
 * wajar untuk dokumen yang diedit (perilaku Google Docs) dan kontrol zoom
 * tersedia di toolbar.
 */
export const fitScaleFor = (
  wellWidth: number,
  maxZoom: number,
  padPx: number = FIT_PAD_PX,
): number => clamp((wellWidth - padPx) / A4_PX.w, MIN_ZOOM, maxZoom)

/** Preset zoom mode form (pratinjau di samping panel formulir). */
export const ZOOM_PRESETS_FORM = [0.5, 0.75, 1] as const

/**
 * Preset zoom mode kanvas layar penuh (T2.5): tambahan 125% & 150% supaya
 * pengguna bisa memperbesar kertas tanpa perlu menekan tombol +/− sepuluh
 * kali. 150% sudah ada di mode form (plafon `MAX_ZOOM`), di sini jadi preset
 * yang praktis, bukan batas baru.
 */
export const ZOOM_PRESETS_CANVAS = [0.5, 0.75, 1, 1.25, 1.5] as const

/** Preset zoom yang dipakai toolbar untuk mode yang sedang aktif. */
export const zoomPresetsFor = (canvasFullscreen: boolean): readonly number[] =>
  canvasFullscreen ? ZOOM_PRESETS_CANVAS : ZOOM_PRESETS_FORM

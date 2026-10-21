import { describe, expect, it } from 'vitest'
import * as PreviewWellZoom from '@/app/shell/PreviewWell'
import {
  FIT_PAD_PX,
  FIT_PAD_PX_CANVAS,
  FIT_RECALC_DEBOUNCE_MS,
  MAX_ZOOM,
  MAX_ZOOM_CANVAS,
  MIN_ZOOM,
  ZOOM_PRESETS_CANVAS,
  ZOOM_PRESETS_FORM,
  ZOOM_STEP,
  clamp,
  fitScaleFor,
  maxZoomFor,
  zoomPresetsFor,
} from '@/features/preview/previewZoom'
import { A4_PX } from '@/lib/units'

/**
 * FASE 13 — T0.1/T0.2 — rumus zoom pratinjau.
 *
 * ── REGRESSION ANCHOR (diukur di browser sungguhan, T0.2) ────────────────
 * Alat ukur: `artifacts/fase13/measure.mjs` + `artifacts/fase13/spike.mjs`
 * (Chromium, dev server, viewport 1024/1280/1440/1920 × 900, dokumen contoh
 * bawaan). Angka di bawah adalah hasil baca DOM, bukan hasil hitung ulang.
 *
 * A. Mode form HARI INI (rail + formulir + pratinjau):
 *
 *   viewport | lebar #pane-preview | skala fit | lebar kertas di layar
 *   ---------+---------------------+-----------+---------------------
 *     1024   |        484 px       |  0.5491   |       436 px
 *     1280   |        512 px       |  0.5844   |       464 px
 *     1440   |        672 px       |  0.7859   |       624 px
 *     1920   |        752 px       |  0.8867   |       704 px
 *
 * B. Spike T0.3 — Rail & FormPane disembunyikan (`display:none`) TANPA
 *    mengubah `grid-template-columns`. Pratinjau **menyusut ke track
 *    pertama**, bukan meluas (jebakan auto-placement §1.2):
 *
 *   viewport | lebar #pane-preview (sebelum → sesudah)
 *   ---------+---------------------------------------
 *     1024   |  484 px →   56 px   (track pertama = rail 56px)
 *     1280   |  512 px →  248 px   (track pertama = rail 248px)
 *     1440   |  672 px →  248 px
 *     1920   |  752 px →  248 px
 *
 *    Kesimpulan: menyembunyikan anak grid **wajib** berpasangan dengan
 *    perubahan `grid-template-columns`.
 *
 * C. Spike T0.2 bullet 2 — grid sudah satu kolom, plafon zoom MASIH 1.5:
 *
 *   viewport | lebar #pane-preview | skala fit | lebar kertas di layar
 *   ---------+---------------------+-----------+---------------------
 *     1024   |       1024 px       |  1.2292   |       976 px
 *     1280   |       1280 px       |  1.5000   |      1191 px  ← mentok
 *     1440   |       1440 px       |  1.5000   |      1191 px  ← mentok
 *     1920   |       1920 px       |  1.5000   |      1191 px  ← mentok
 *
 *    Skala mentok di 1.5 pada 1440 & 1920 (padahal 1392/794 = 1.753 dan
 *    1872/794 = 2.358) — kertas berhenti membesar di 1191px dan sisanya jadi
 *    margin mati. Inilah alasan plafon kanvas dinaikkan ke 2.0 (D10).
 *
 * D. FASE 13 T2.1/T2.3 — mode kanvas layar penuh SESUDAH plafon dinaikkan
 *    (alat ukur: `artifacts/fase13/measure-fase2.mjs`, Chromium, dev server,
 *    viewport 1024/1280/1440/1920 × 900). Well = satu kolom (T1.1), padding
 *    `lg:p-10` = 40px kiri + 40px kanan:
 *
 *   viewport | lebar well | padding | skala fit | lebar kertas | luapan horizontal
 *   ---------+------------+---------+-----------+--------------+------------------
 *     1024   |   1024 px  | 40/40px |  1.1889   |    944 px    |      0 px
 *     1280   |   1280 px  | 40/40px |  1.5113   |   1200 px    |      0 px
 *     1440   |   1440 px  | 40/40px |  1.7128   |   1360 px    |      0 px  ← > 1,5
 *     1920   |   1920 px  | 40/40px |  2.0000   |   1588 px    |      0 px  ← mentok 2,0
 *
 *    Bandingkan mode form pada lebar yang sama (bagian A): 0,5491 / 0,5844 /
 *    0,7859 / 0,8867 — kertas di layar penuh jadi 2,2× (1440px) sampai 2,3×
 *    (1920px) lebih lebar. Luapan horizontal 0 px: lembar pas persis di kotak
 *    konten, tidak ada scrollbar horizontal yang tersesat.
 *
 *    Mode form SESUDAH Fase 2 terukur identik dengan baseline T0.2 (lihat
 *    `artifacts/fase13/measure-fase2.json`): 484/512/672/752 px dan skala
 *    0,5491/0,5844/0,7859/0,8867.
 *
 * Angka-angka di bawah mengunci pengukuran di atas sebagai jangkar regresi.
 */

describe('konstanta zoom pratinjau', () => {
  it('mempertahankan batas zoom lama (tidak ada perubahan perilaku)', () => {
    expect(MIN_ZOOM).toBe(0.3)
    expect(MAX_ZOOM).toBe(1.5)
    expect(ZOOM_STEP).toBe(0.1)
    expect(FIT_PAD_PX).toBe(48)
  })

  it('plafon mode kanvas layar penuh dua kali plafon mode form', () => {
    expect(MAX_ZOOM_CANVAS).toBe(2.0)
    expect(MAX_ZOOM_CANVAS).toBeGreaterThan(MAX_ZOOM)
  })
})

describe('clamp', () => {
  it('mengunci angka ke rentang [min, max]', () => {
    expect(clamp(0.5, MIN_ZOOM, MAX_ZOOM)).toBe(0.5)
    expect(clamp(0.1, MIN_ZOOM, MAX_ZOOM)).toBe(MIN_ZOOM)
    expect(clamp(9, MIN_ZOOM, MAX_ZOOM)).toBe(MAX_ZOOM)
  })
})

describe('maxZoomFor', () => {
  it('pakai plafon kanvas hanya saat layar penuh', () => {
    expect(maxZoomFor(true)).toBe(MAX_ZOOM_CANVAS)
    expect(maxZoomFor(false)).toBe(MAX_ZOOM)
  })
})

describe('fitScaleFor — mode form (plafon MAX_ZOOM)', () => {
  it('mengulang skala fit yang terukur di mode form', () => {
    // Ketelitian 3 desimal: angka di komentar adalah bacaan DOM 4 desimal,
    // sedangkan Chrome membulatkan matriks transform ke 6 digitSignificant.
    expect(fitScaleFor(484, MAX_ZOOM)).toBeCloseTo(0.5491, 3)
    expect(fitScaleFor(512, MAX_ZOOM)).toBeCloseTo(0.5844, 3)
    expect(fitScaleFor(672, MAX_ZOOM)).toBeCloseTo(0.7859, 3)
    expect(fitScaleFor(752, MAX_ZOOM)).toBeCloseTo(0.8867, 3)
  })

  it('mengulang skala fit satu kolom dengan plafon lama (T0.2 bullet 2)', () => {
    expect(fitScaleFor(1024, MAX_ZOOM)).toBeCloseTo(1.2292, 3)
    expect(fitScaleFor(1280, MAX_ZOOM)).toBeCloseTo(1.5, 3)
    expect(fitScaleFor(1440, MAX_ZOOM)).toBeCloseTo(1.5, 3)
    expect(fitScaleFor(1920, MAX_ZOOM)).toBeCloseTo(1.5, 3)
  })
})

describe('batas MAX_ZOOM vs MAX_ZOOM_CANVAS', () => {
  it('mode form tidak pernah melewati 1.5', () => {
    for (const width of [1024, 1280, 1440, 1600, 1920, 2560]) {
      expect(fitScaleFor(width, maxZoomFor(false))).toBeLessThanOrEqual(MAX_ZOOM)
    }
  })

  it('mode kanvas boleh sampai 2.0 dan mentok tepat di 2.0', () => {
    expect(fitScaleFor(1440, maxZoomFor(true))).toBeCloseTo(1.75315, 5)
    expect(fitScaleFor(1920, maxZoomFor(true))).toBe(MAX_ZOOM_CANVAS)
    expect(fitScaleFor(2560, maxZoomFor(true))).toBe(MAX_ZOOM_CANVAS)
  })

  it('kertas jadi lebih lebar di mode kanvas pada lebar yang sama', () => {
    for (const width of [1280, 1440, 1920]) {
      expect(fitScaleFor(width, maxZoomFor(true))).toBeGreaterThan(
        fitScaleFor(width, maxZoomFor(false)),
      )
    }
  })

  it('well sempit tetap turun ke MIN_ZOOM, tidak nol', () => {
    expect(fitScaleFor(200, maxZoomFor(true))).toBe(MIN_ZOOM)
    expect(fitScaleFor(0, maxZoomFor(true))).toBe(MIN_ZOOM)
  })

  it('A4_PX dipakai, bukan angka hardcode', () => {
    expect(A4_PX.w).toBe(794)
    expect(fitScaleFor(FIT_PAD_PX + A4_PX.w, MAX_ZOOM)).toBeCloseTo(1, 6)
  })
})

describe('re-export lama dari PreviewWell (T0.1)', () => {
  it('impor lama dari PreviewWell tidak putus', () => {
    // Impor ini sengaja lewat komponen: kontrak "re-export agar impor lama
    // tidak putus" diuji dari sisi pemanggil, bukan dari modul asalnya.
    expect(PreviewWellZoom.MIN_ZOOM).toBe(MIN_ZOOM)
    expect(PreviewWellZoom.MAX_ZOOM).toBe(MAX_ZOOM)
    expect(PreviewWellZoom.MAX_ZOOM_CANVAS).toBe(MAX_ZOOM_CANVAS)
    expect(PreviewWellZoom.ZOOM_STEP).toBe(ZOOM_STEP)
    expect(PreviewWellZoom.FIT_PAD_PX).toBe(FIT_PAD_PX)
    expect(PreviewWellZoom.FIT_PAD_PX_CANVAS).toBe(FIT_PAD_PX_CANVAS)
    expect(PreviewWellZoom.FIT_RECALC_DEBOUNCE_MS).toBe(FIT_RECALC_DEBOUNCE_MS)
    expect(PreviewWellZoom.ZOOM_PRESETS_FORM).toBe(ZOOM_PRESETS_FORM)
    expect(PreviewWellZoom.ZOOM_PRESETS_CANVAS).toBe(ZOOM_PRESETS_CANVAS)
  })
})

/**
 * FASE 13 — T2.1/T2.3 — plafon fit pada mode kanvas layar penuh.
 *
 * Lebar well di layar penuh = lebar viewport (grid satu kolom, T1.1), dan
 * padding well di ≥1024px adalah `lg:p-10` → 80px kiri + kanan. Jadi
 * kotak konten = lebar viewport − 80px, dan skala fit-nya:
 *
 *   viewport | kotak konten | skala fit | lebar kertas di layar
 *   ---------+--------------+-----------+---------------------
 *     1024   |      944 px  |  1.1889   |       944 px
 *     1280   |     1200 px  |  1.5113   |      1200 px
 *     1440   |     1360 px  |  1.7128   |      1360 px   ← > 1,5
 *     1920   |     1840 px  |  2.0000   |      1588 px   ← mentok 2,0
 *
 * Bandingkan mode form pada lebar yang sama (regression anchor T0.2):
 * 1440px → 0,7859 dan 1920px → 0,8867. Kertas di layar penuh jadi 2,2× dan
 * 2,5× lebih lebar — ini bukti "kertas benar-benar membesar", bukan cuma
 * ruang kosong yang bertambah (D10).
 */
describe('T2.1 — skala fit mode kanvas layar penuh', () => {
  const canvasFit = (viewport: number) => fitScaleFor(viewport, maxZoomFor(true), FIT_PAD_PX_CANVAS)

  it('mengulang skala fit kanvas pada 1024/1280/1440/1920', () => {
    expect(canvasFit(1024)).toBeCloseTo(1.1889, 3)
    expect(canvasFit(1280)).toBeCloseTo(1.5113, 3)
    expect(canvasFit(1440)).toBeCloseTo(1.7128, 3)
    expect(canvasFit(1920)).toBe(MAX_ZOOM_CANVAS)
  })

  it('di 1440px skala lewat dari plafon 1,5 — kertas benar-benar membesar', () => {
    expect(canvasFit(1440)).toBeGreaterThan(MAX_ZOOM)
    expect(fitScaleFor(1440, maxZoomFor(true), FIT_PAD_PX_CANVAS) * A4_PX.w).toBeCloseTo(1360, 0)
  })

  it('di 1920px mentok tepat di 2,0 dan tidak pernah lewat', () => {
    expect(canvasFit(1920)).toBe(MAX_ZOOM_CANVAS)
    expect(canvasFit(2560)).toBe(MAX_ZOOM_CANVAS)
  })

  it('kertas di layar penuh selalu lebih lebar daripada mode form', () => {
    // Bandingkan lebar well NYATA: mode form memecah viewport (rail + formulir
    // + pratinjau), mode kanvas memakai seluruh viewport (regression anchor
    // T0.2 di header berkas ini).
    const formWellWidth = { 1024: 484, 1280: 512, 1440: 672, 1920: 752 }
    for (const [viewport, formWidth] of Object.entries(formWellWidth)) {
      const width = Number(viewport)
      expect(canvasFit(width)).toBeGreaterThan(fitScaleFor(formWidth, maxZoomFor(false)))
    }
  })
})

/**
 * FASE 13 — T6.2 — `fitScaleFor` pada lima lebar well yang disebut plan:
 * 400 / 672 / 1024 / 1392 / 1872. Angka 672 & 1024 sudah dikunci di blok
 * atas; blok ini menutup 400 (well sempit), 1392 (well layar penuh pada
 * viewport 1440px) dan 1872 (well layar penuh pada viewport 1920px).
 *
 *   lebar well | (lebar−48)/794 | mode form (plafon 1,5) | kanvas (plafon 2,0)
 *   -----------+----------------+-----------------------+-------------------
 *       400    |    0,4433      |        0,4433         |       0,4433
 *       672    |    0,7859      |        0,7859         |       0,7859
 *      1024    |    1,2292      |        1,2292         |       1,2292
 *      1392    |    1,6927      |        1,5000  ← potong|      1,6927
 *      1872    |    2,2972      |        1,5000  ← potong|      2,0000 ← potong
 */
describe('T6.2 — fitScaleFor pada lebar 400/672/1024/1392/1872', () => {
  it('menghitung skala fit untuk kelima lebar di kedua plafon', () => {
    // 400 — well sempit (mobile): di atas MIN_ZOOM, jauh di bawah kedua plafon.
    expect(fitScaleFor(400, maxZoomFor(false))).toBeCloseTo(0.4433, 4)
    expect(fitScaleFor(400, maxZoomFor(true))).toBeCloseTo(0.4433, 4)
    // 672 — well mode form pada 1440px (regression anchor T0.2 bagian A).
    expect(fitScaleFor(672, maxZoomFor(false))).toBeCloseTo(0.7859, 4)
    // 1024 — well satu kolom pada viewport 1024px (anchor T0.2 bagian C).
    expect(fitScaleFor(1024, maxZoomFor(false))).toBeCloseTo(1.2292, 4)
    expect(fitScaleFor(1024, maxZoomFor(true))).toBeCloseTo(1.2292, 4)
    // 1392 — well layar penuh pada 1440px: mode form dipotong ke 1,5
    // (inilah "mentok" §1.2), mode kanvas lolos pada 1,6927.
    expect(fitScaleFor(1392, maxZoomFor(false))).toBe(MAX_ZOOM)
    expect(fitScaleFor(1392, maxZoomFor(true))).toBeCloseTo(1.6927, 4)
    // 1872 — well layar penuh pada 1920px: keduanya dipotong ke plafonnya.
    expect(fitScaleFor(1872, maxZoomFor(false))).toBe(MAX_ZOOM)
    expect(fitScaleFor(1872, maxZoomFor(true))).toBe(MAX_ZOOM_CANVAS)
  })

  it('batas bawah & atas tetap dijaga: <MIN_ZOOM → 0,3, >plafon → plafon', () => {
    expect(fitScaleFor(100, maxZoomFor(true))).toBe(MIN_ZOOM)
    expect(fitScaleFor(3000, maxZoomFor(false))).toBe(MAX_ZOOM)
    expect(fitScaleFor(3000, maxZoomFor(true))).toBe(MAX_ZOOM_CANVAS)
  })
})

describe('T2.3 — padding well dan jarak aman fit', () => {
  it('mode form memakai p-6 (48px), mode kanvas memakai lg:p-10 (80px)', () => {
    expect(FIT_PAD_PX).toBe(48)
    expect(FIT_PAD_PX_CANVAS).toBe(80)
  })

  it('parameter pad punya bawaan FIT_PAD_PX — perilaku mode form tidak berubah', () => {
    expect(fitScaleFor(672, MAX_ZOOM)).toBe(fitScaleFor(672, MAX_ZOOM, FIT_PAD_PX))
    expect(fitScaleFor(672, MAX_ZOOM)).toBeCloseTo(0.7859, 3)
  })

  it('pad mode kanvas membuat kertas pas persis di kotak konten', () => {
    const viewport = 1440
    const contentBox = viewport - FIT_PAD_PX_CANVAS
    const paperWidth = fitScaleFor(viewport, maxZoomFor(true), FIT_PAD_PX_CANVAS) * A4_PX.w
    expect(paperWidth).toBeCloseTo(contentBox, 0)
  })
})

describe('T2.5 — preset zoom', () => {
  it('mode form tetap tiga preset', () => {
    expect(zoomPresetsFor(false)).toEqual([0.5, 0.75, 1])
    expect(zoomPresetsFor(false)).toBe(ZOOM_PRESETS_FORM)
  })

  it('mode kanvas layar penuh menambah 125% dan 150%', () => {
    expect(zoomPresetsFor(true)).toEqual([0.5, 0.75, 1, 1.25, 1.5])
    expect(zoomPresetsFor(true)).toBe(ZOOM_PRESETS_CANVAS)
  })

  it('semua preset kanvas masih di bawah plafon kanvas', () => {
    for (const preset of zoomPresetsFor(true)) {
      expect(preset).toBeLessThanOrEqual(MAX_ZOOM_CANVAS)
      expect(preset).toBeGreaterThanOrEqual(MIN_ZOOM)
    }
  })

  it('grup preset tetap rapi: 6 item di grid-cols-4 = 2 baris', () => {
    // 5 preset + 1 "Fit" = 6 item; grid 4 kolom → 4 + 2.
    expect(zoomPresetsFor(true).length + 1).toBe(6)
  })
})

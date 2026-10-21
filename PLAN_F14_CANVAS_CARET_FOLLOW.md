# PLAN F14 — KAMERA MENGIKUTI KARET SAAT MENGETIK (LAYAR SEMPIT)

> **Tujuan:** di mode **"Langsung di CV"** pada mobile (panel mode `tabs`,
> <1024px), saat user menyentuh sebuah field untuk mengedit, kamera harus:
> (1) memastikan zoom **75%** (naik dari 30% / berapapun di bawahnya),
> (2) memposisikan diri di **bagian paling kiri field** — awal urutan mengetik,
> (3) **mengikuti karet (caret) sedikit demi sedikit** ke kanan seiring
> bertambahnya kata sampai penghujung field, lalu
> (4) saat teks membungkus (wrap) ke baris berikutnya, **kembali ke kiri**
> supaya user bisa lanjut mengetik baris selanjutnya.
>
> **Status:** rencana, belum ada kode.
>
> **Baseline:** commit `0d68229` (Addendum FASE 13 — zoom edit di layar sempit).
> Addendum itu sudah menuntaskan poin (1): `applyEditZoom` menaikkan skala ke
> `EDIT_ZOOM = 0.75` bila di bawahnya (tidak pernah menurunkan) dan mengembalikan
> zoom ringkasan saat sesi ditutup. F14 **tidak menyentuh logika zoom** — yang
> diubah adalah pemusatan field (poin 2) dan menambah pelacakan karet
> (poin 3–4), dua hal yang belum ada sama sekali.
>
> **Konvensi centang:** setiap Fase, Tugas (T), dan Sub-tugas punya kotak
> centang. Centang Fase hanya boleh dilakukan **setelah semua sub-tugas dan
> Gate-nya centang**. Sub-tugas bertanda *(opsional)* boleh dilewati tanpa
> membatalkan Gate.

---

## 0. Ringkasan eksekutif

Hari ini, begitu sesi edit terbuka di layar sempit, field **dipusatkan**
horizontal di well (`centerFocusPoint`, `src/features/canvas/canvasEditZoom.ts:159`)
— lalu kamera **berhenti bergerak selamanya**. Padahal di 75%, kertas A4 =
±595px sedangkan area terlihat di layar 412px hanya ±364px: begitu teks yang
diketik melewati tepi kanan layar, user mengetik buta, dan browser diam-diam
menggulir **isi input secara internal** (teks meluncur ke kiri di dalam kotak
yang diam) — bukan kertas yang bergerak.

F14 mengganti pemusatan dengan **penjajaran kiri** + **pelacakan karet
(caret-follow)**: posisi karet diukur setiap ketikan lewat div *mirror*
(input/textarea tidak punya API posisi karet), lalu `scrollLeft` lapisan
`[data-probe="preview-scroll"]` digeser sedikit demi sedikit supaya karet selalu
berada di dalam "pita aman" layar. Saat textarea membungkus ke baris baru, karet
otomatis lompat ke kiri-bawah — pita mendesak kamera mundur ke kiri dan (bila
perlu) well turun satu baris. Persis perilaku yang diminta.

---

## 1. Masalah & bukti dari kode saat ini

### 1.1 Kamera diam setelah pemusatan awal

- `src/features/canvas/useCanvasEditFocus.ts:43-46` — pemusatan hanya berjalan
  saat `[session, focusPoint, zoom, fitMode]` berubah. **Tidak ada reaksi
  terhadap ketikan.**
- `src/features/canvas/canvasEditZoom.ts:159-197` — `centerFocusPoint`
  memusatkan **tengah elemen** horizontal; titik fokus diukur dari tengah kotak
  (`measureFocusPoint`, baris 61: `rect.left + rect.width / 2`).

### 1.2 Geometri: field selalu lebih lebar dari layar

Di 412px dengan padding well `p-6` (24px kiri-kanan), area terlihat ±364px.
Kertas 794px × 0.75 = **595px**; kolom teks (margin kertas ±68px) = ±493px.
Jadi hampir semua field lebih lebar dari layar → mengikuti karet ke kanan
adalah satu-satunya cara agar tempat ketik selalu terlihat. Batas gulir
maksimum lapisan dalam = 595 − 364 = ±231px.

### 1.3 Input menggulir isiannya sendiri (jebakan tersembunyi)

`.canvas-editor` (`src/styles/tokens.css:449-481`) memakai `width: 100%`,
`overflow: hidden`. Ketika teks melebihi lebar kotak, browser menggulir **isi
input** (`control.scrollLeft > 0`) untuk menjaga karet tetap terlihat — teks
meluncur di dalam kotak yang diam. Akibatnya: (a) pengalaman "kertas diam,
teks loncat" yang membingungkan, dan (b) setiap pengukuran posisi karet wajib
mengurangi `control.scrollLeft` (lihat K2).

### 1.4 Tidak ada API posisi karet untuk input/textarea

`getSelection().getRangeAt(0).getBoundingClientRect()` hanya berlaku untuk
contenteditable — editor kanvas memakai `<input>`/`<textarea>` asli
(`CanvasFieldEditor.tsx:135-153`). Posisi karet piksel hanya bisa diukur dengan
**teknik mirror**: salin gaya tipografi control ke div bayangan, taruh teks
sampai `selectionStart` + marker, baca `offsetLeft/offsetTop` marker.

### 1.5 Semua jalur ketik berujung di satu komponen

- Klik segmen → `CanvasBlock.tsx:130` → `startCanvasEdit` → `CanvasFieldEditor`.
- Ghost row (entri/bullet baru) → `CanvasGhostRow.tsx:84,99` → sesi pada field
  baru → tetap dirender `CanvasFieldEditor`.
- Tombol "Perbaiki →" di drawer ATS → `canvasAts.ts:128` → sesi field isi
  dokumen → `CanvasFieldEditor`.
- Editor **tanggal** (`CanvasDatesEditor`) di mobile memakai `Sheet` bawah +
  `MonthPicker` — tidak ada ketikan di atas kertas → **di luar cakupan F14**.

Jadi satu titik integrasi follow: `CanvasFieldEditor`.

---

## 2. Keputusan desain (mengikat)

- [x] **K1 — Ukur karet dengan div mirror.** Mirror menyalin properti computed
      style yang memengaruhi lebar/posisi teks: `font`, `fontKerning`,
      `letterSpacing`, `textTransform` (headline ada yang uppercase),
      `whiteSpace` (`pre` untuk input, `pre-wrap` untuk textarea),
      `overflowWrap`, `wordBreak`, `boxSizing`, `padding*`, `textAlign`
      (nama Executive rata tengah), `direction`, `tabSize`; textarea juga
      `width` sama dengan control supaya titik wrap identik. Isi mirror =
      `value.slice(0, selectionStart)` + `<span>` marker; posisi karet =
      `marker.offsetLeft / offsetTop` (koordinat isi control).
- [x] **K2 — Semua matematika follow di koordinat layar.**
      `getBoundingClientRect()` control sudah memperhitungkan skala transform
      dan posisi scroll saat ini, jadi tidak perlu konversi koordinat kertas:
      `caretScreenX = controlRect.left + caretContentX − control.scrollLeft`
      (mengurangi gulir internal input, lihat §1.3);
      `caretScreenY = controlRect.top + caretContentY − control.scrollTop`.
- [x] **K3 — Posisi awal sesi = tepi kiri field di margin kiri** (mengganti
      pemusatan tengah), karena urutan ketik selalu dimulai dari kiri.
      `measureFocusPoint` horizontal berubah dari tengah elemen ke tepi kirinya.
      Zoom naik-turun & restore Addendum F13 **tidak berubah**.
- [x] **K4 — Ikuti karet dengan pita mati (dead zone).** Kamera hanya bergeser
      bila karet melewati ambang kanan (75% dari lebar terlihat) atau mundur
      di bawah margin kiri; besar geseran = seberapa jauh karet keluar pita.
      Hasilnya gerakan "sedikit demi sedikit" mengikuti ketikan — bukan karet
      yang dipaku terus di tengah layar (mengganggu dan membuat vertigo).
- [x] **K5 — Wrap baris baru berarti kembali ke kiri.** Textarea wrap → karet
      lompat ke kiri-bawah → pita X mendesak kamera mundur ke kiri, pita Y
      menggulir well ke bawah bila karet melewati tepi bawah area terlihat.
      Tidak ada logika khusus "baris kedua" — pita X/Y menangani semua baris.
- [x] **K6 — Gulir manual = jeda sementara.** Swipe user pada scroller/well
      saat sesi terbuka menghentikan follow (keinginan user didahulukan);
      ketikan / gerak karet berikutnya menyalakan follow lagi.
- [x] **K7 — Gerakan dihaluskan, hormati reduced-motion.** Lerp eksponensial
      ±120ms menuju target scroll per frame; `prefers-reduced-motion: reduce`
      → langsung tanpa animasi (P8).
- [x] **K8 — Hanya layar sempit, hanya widget ketik.** Gate `isNarrowLayout()`
      (panel mode `tabs`). Berlaku otomatis untuk semua widget yang dirender
      `CanvasFieldEditor` (`input`, `textarea`, `chips`). Editor tanggal
      (Sheet mobile) tidak ikut. Desktop tidak berubah sama sekali.
- [x] **K9 — Follow tidak pernah mengubah zoom.** Zoom sepenuhnya urusan
      `applyEditZoom`/`restorePreviewZoom` (Addendum F13): naik ke 75% bila di
      bawah, tidak pernah menurunkan, restore setelah sesi. Follow hanya
      memindahkan scroll. Bila user memperbesar sendiri ke 100% saat sesi,
      follow tetap jalan (pita dihitung di koordinat layar, tak peduli skala).

---

## 3. Jebakan yang wajib diantisipasi

- [x] **Gulir internal input.** Kalau kamera sempat tertinggal, browser sudah
      menggulir isi input (`control.scrollLeft > 0`). Wajib dikurangkan saat
      mengukur (K2) — kalau tidak, kamera berhenti mengikuti tepat saat
      dibutuhkan.
- [x] **Mirror miring = kamera bergetar.** `text-transform: uppercase`,
      `text-align: center`, dan `white-space` yang tidak tersalin membuat lebar
      mirror meleset beberapa piksel → follow "kejar-kejaran". Salin daftar
      properti K1 lengkap sejak awal.
- [x] **`selectionchange` document-level.** Event ini ikut menyala untuk field
      form di panel lain. Hanya proses bila `document.activeElement` adalah
      control yang dilacak.
- [x] **rAF bocor setelah sesi ditutup.** Loop yang tidak dibatalkan saat
      editor unmount = kamera bergerak sendiri setelah edit selesai. Cleanup
      wajib: batalkan rAF, lepas semua listener, hapus mirror.
- [x] **Scroll buatan sendiri terdeteksi sebagai manual.** Menulis
      `scrollLeft` kita memicu event `scroll` → tanpa flag `programmatic`,
      follow langsung menganggap user menggeser dan berhenti (K6 terpicu oleh
      dirinya sendiri).
- [x] **Textarea auto-grow menulis tinggi tiap ketikan**
      (`CanvasFieldEditor.tsx:67-72`) → tinggi lapisan scroll ikut berubah.
      Tidak konflik (semua ukuran dibaca live per frame), tapi jangan pernah
      meng-cache rect antar-frame.
- [x] **Tes lama mengases pemusatan.** `tests/e2e/canvas-edit-zoom.spec.ts`
      (field di tengah) dan `tests/unit/canvasEditZoom.test.tsx` (kasus
      pemusatan) **wajib diubah di Fase 14B**, jangan menunggu 14D — kalau
      tidak, suite merah di tengah jalan.

---

## 4. Rencana teknis

```
src/features/canvas/canvasCaret.ts          ← FASE 14A (pengukuran karet, mirror)
src/features/canvas/canvasCaretFollow.ts    ← FASE 14C (pita, rAF, pause/resume)
src/features/canvas/canvasEditZoom.ts       ← FASE 14B (measureFocusPoint + alignFocusStart)
src/features/canvas/useCanvasEditFocus.ts   ← FASE 14B (panggil alignFocusStart)
src/features/canvas/CanvasFieldEditor.tsx   ← FASE 14C (pasang/copot follow)
tests/unit/canvasCaret.test.tsx             ← FASE 14A
tests/unit/canvasEditZoom.test.tsx          ← FASE 14B (update)
tests/unit/canvasCaretFollow.test.tsx       ← FASE 14C
tests/e2e/canvas-edit-zoom.spec.ts          ← FASE 14B (update asersi)
tests/e2e/canvas-caret-follow.spec.ts       ← FASE 14D (baru)
playwright.config.ts                        ← FASE 14D (daftarkan spec ke mobileSpecs + mobileOnlySpecs)
```

Tidak ada string UI baru (tanpa perubahan `src/dictionaries/id.ts`) dan tidak
ada token CSS baru — follow murni perilaku scroll.

---

## FASE 14A — Fondasi: pengukuran karet (mirror)

- [x] **FASE 14A**

### T1 — Modul baru `src/features/canvas/canvasCaret.ts`

- [x] **T1** Fungsi mirror + konversi koordinat, tanpa memakainya di UI dulu.

Sub-tugas:

- [x] Buat `mirrorStylesFor(control: HTMLInputElement | HTMLTextAreaElement): Partial<CSSStyleDeclaration>`
      — kumpulkan properti computed style daftar K1 dari control (satu
      `getComputedStyle` per panggilan, dipanggil maksimal sekali per frame).
- [x] Buat `caretContentRect(control): { x: number; y: number; height: number } | null`
      — pakai satu elemen mirror **singleton** (hanya ada satu sesi edit pada
      satu waktu): `position: absolute; visibility: hidden;` di luar viewport,
      `aria-hidden="true"`, `data-probe="caret-mirror"`; isi =
      `control.value.slice(0, control.selectionStart ?? 0)` sebagai text node +
      `<span data-probe="caret-marker">` kosong; mirror `position: relative`
      supaya `marker.offsetLeft/offsetTop` relatif ke mirror; textarea: set
      `width` control dan `white-space: pre-wrap`; input: `white-space: pre`.
      Return null bila `selectionStart === null` atau control tidak terhubung
      DOM (`isConnected === false`).
- [x] Buat fungsi murni `screenXOf(controlRectLeft: number, caretContentX: number, internalScrollLeft: number): number`
      dan `screenYOf(controlRectTop: number, caretContentY: number, internalScrollTop: number): number`
      — dipisah dari DOM supaya bisa diuji di jsdom tanpa layout.
- [x] Buat `caretViewportRect(control): { x: number; y: number; height: number } | null`
      — gabungkan `caretContentRect` + `control.getBoundingClientRect()` +
      `control.scrollLeft/scrollTop` lewat fungsi murni di atas (K2).
- [x] Lepas mirror dari DOM di cleanup (`disposeCaretMirror()`), jangan
      meninggalkan node di `document.body`.

### T2 — Unit test `tests/unit/canvasCaret.test.tsx`

- [x] **T2** Ikuti pola `tests/unit/canvasEditZoom.test.tsx` (stub computed
      style, jsdom tanpa layout).

Sub-tugas:

- [x] `screenXOf/screenYOf`: kasus normal, kasus dengan gulir internal input
      (`scrollLeft = 20` menggeser karet 20px ke kiri di layar), kasus textarea
      `scrollTop`.
- [x] `mirrorStylesFor`: dengan `getComputedStyle` di-stub, pastikan daftar
      properti K1 tersalin (termasuk `textTransform` dan `whiteSpace` berbeda
      untuk input vs textarea).
- [x] `caretContentRect`: stub `offsetLeft/offsetTop` marker (defineProperty)
      → assert marker berada setelah teks dan mirror dilampirkan ke body;
      `disposeCaretMirror` menghapusnya.
- [x] Guard: `selectionStart === null` / control terlepas dari DOM → null.

**Gate 14A:** `pnpm test -- canvasCaret` hijau; `pnpm typecheck`; `pnpm lint`.
Belum ada perubahan perilaku aplikasi.

---

## FASE 14B — Posisi awal: penjajaran kiri (mengganti pemusatan)

- [x] **FASE 14B**

### T1 — `measureFocusPoint`: horizontal pakai tepi kiri

- [x] **T1** `src/features/canvas/canvasEditZoom.ts:50-64`

Sub-tugas:

- [x] Ubah sumbu horizontal dari `rect.left + rect.width / 2` menjadi
      `rect.left` (tepi kiri elemen — awal urutan ketik, K3). Sumbu vertikal
      (tepi atas) tidak berubah.
- [x] Update komentar docblock fungsi (alasan: urutan ketik kiri → kanan).

### T2 — `centerFocusPoint` → `alignFocusStart`

- [x] **T2** `src/features/canvas/canvasEditZoom.ts:159-197`

Sub-tugas:

- [x] Ganti rumus horizontal `scroller.scrollLeft += targetX - centerX`
      menjadi `scroller.scrollLeft += targetX - (originLeft + FOCUS_EDGE_MARGIN_PX)`
      — tepi kiri field mendarat di margin kiri area terlihat.
- [x] Ekspor konstanta `FOCUS_EDGE_MARGIN_PX = 24` (selaras padding well
      `p-6`) di dekat `EDIT_ZOOM` supaya bisa dipakai test.
- [x] Pertahankan logika vertikal apa adanya (guard di bawah toolbar) dan
      clamp `scrollLeft` ke `[0, scrollWidth - clientWidth]`.
- [x] Rename fungsi + update docblock; semua pemanggil
      (`useCanvasEditFocus.ts:4,45`) ikut. Perilaku zoom
      (`applyEditZoom`/`capturePreviewZoom`/`restorePreviewZoom`) **tidak
      disentuh**.

### T3 — Update tes pemusatan yang ada

- [x] **T3** merah → hijau di fase yang sama (jebakan §3).

Sub-tugas:

- [x] `tests/unit/canvasEditZoom.test.tsx`: kasus "field berakhir di tengah
      well" → "tepi kiri field berjarak `FOCUS_EDGE_MARGIN_PX` dari tepi kiri
      konten well"; tambah kasus clamp di batas kanan gulir.
- [x] `tests/e2e/canvas-edit-zoom.spec.ts`: helper `paperCenterOf` →
      `paperLeftOf`; asersi tengah → tepi kiri; aseri zoom 75% & restore
      dibiarkan (regresi Addendum F13).

**Gate 14B:** `pnpm test` hijau; `pnpm test:e2e -- canvas-edit-zoom` hijau di
project `mobile-chrome`. Perilaku terverifikasi manual: buka sesi di 412px →
kertas menampilkan awal field di sebelah kiri, zoom 75%.

---

## FASE 14C — Kamera mengikuti karet saat mengetik

- [x] **FASE 14C**

### T1 — Modul baru `src/features/canvas/canvasCaretFollow.ts`

- [x] **T1** Otak follow: pita, rAF, pause/resume.

Sub-tugas:

- [x] Ekspor konstanta (dipakai unit test): `CARET_RIGHT_RATIO = 0.75`
      (ambang kanan pita, proporsi lebar terlihat), `CARET_LEFT_MARGIN_PX = 24`,
      `CARET_BOTTOM_MARGIN_PX = 32`, `FOLLOW_EASE_MS = 120`.
- [x] Fungsi murni `panDeltaFor(caretX: number, visibleLeft: number, visibleWidth: number): number`
      → `0` bila karet dalam pita `[visibleLeft + CARET_LEFT_MARGIN_PX,
      visibleLeft + visibleWidth * CARET_RIGHT_RATIO]`; di luar pita → seberapa
      jauh karet keluar (positif = geser kanan, negatif = geser kiri). K4.
- [x] `startCaretFollow(control)` — simpan state modul (rAF id, listener,
      flag `paused`, flag `programmaticScroll`); cari `well`/`scroller`/`content`
      dengan pola yang sama seperti `centerFocusPoint`; pasang listener:
      - `input` pada control dan `selectionchange` pada `document`
        (karet pindah karena tap / tahan-lalu-seret / panah) — keduanya hanya
        menjadwalkan satu pengukuran rAF (coalesce), dan bila `paused` →
        nyalakan follow kembali (K6);
      - `scroll` (capture, passive) pada `scroller` dan `well` → bila tanpa
        flag `programmaticScroll` berarti user menggeser sendiri → `paused = true`.
- [x] Loop rAF `tick()`: baca `caretViewportRect(control)`; hitung `deltaX =
      panDeltaFor(...)` → `targetScrollLeft = clamp(scrollLeft + deltaX, 0,
      scrollWidth - clientWidth)`; vertikal: bila `caretY > visibleBottom -
      CARET_BOTTOM_MARGIN_PX` → `well.scrollTop += caretY - (visibleBottom -
      CARET_BOTTOM_MARGIN_PX)` (K5; `visibleBottom` dihitung dari kotak well,
      sama seperti `centerFocusPoint`); gerakkan `scrollLeft` menuju target
      dengan lerp eksponensial `FOLLOW_EASE_MS` (K7), tulis lewat flag
      `programmaticScroll` supaya tidak dianggap manual; setiap penulisan
      scroll selalu mulai dari nilai live (jangan cache rect — §3).
- [x] `prefers-reduced-motion: reduce` (cek sekali saat start lewat
      `matchMedia`, dengarkan perubahanannya) → tulis target langsung tanpa
      lerp.
- [x] Berhenti otomatis bila `control.isConnected === false` (sesi ditutup,
      editor unmount) → panggil pembersihan yang sama dengan
      `stopCaretFollow()`.
- [x] `stopCaretFollow()` — batalkan rAF, lepas semua listener, panggil
      `disposeCaretMirror()`, reset state modul.

### T2 — Integrasi ke `CanvasFieldEditor`

- [x] **T2** `src/features/canvas/CanvasFieldEditor.tsx`

Sub-tugas:

- [x] `useEffect` baru (berjalan sekali saat mount): bila `isNarrowLayout()`
      dan `spec.widget !== 'dates'` → setelah `focus({ preventScroll: true })`,
      panggil `startCaretFollow(control)`; cleanup effect → `stopCaretFollow()`.
- [x] Pastikan urutan benar terhadap effect focus yang sudah ada
      (`CanvasFieldEditor.tsx:59-64`): follow dipasang **setelah** focus, dan
      pemusatan awal (14B) tetap dijalankan `useCanvasEditFocus` — follow tidak
      menggeser apa pun selama karet masih dalam pita (karet awal = kiri field
      yang memang sudah di margin → pita aman → tidak ada geseran ganda).
- [x] Dokumentasikan di komentar: editor tanggal (Sheet mobile) tidak mengetik
      di atas kertas sehingga tidak ikut follow; semua jalur lain (segmen,
      ghost row, "Perbaiki →" ATS) otomatis tercover karena semuanya dirender
      lewat komponen ini (§1.5).

### T3 — Unit test `tests/unit/canvasCaretFollow.test.tsx`

- [x] **T3** Pohon tiruan mengikuti `buildTree` di
      `tests/unit/canvasEditZoom.test.tsx` + stub `scrollLeft/scrollTop`
      (perekam tuluhan, pola `stubScrollLeft`).

Sub-tugas:

- [x] `panDeltaFor`: dalam pita → 0; lewat ambang kanan → delta = kelebihan;
      mundur di bawah margin kiri → delta negatif.
- [x] Ketik (dispatch `input` event pada control stub dengan
      `caretViewportRect` di-mock keluar pita) → `scrollLeft` bertambah sebesar
      kelebihan; karet balik ke kiri (wrap) → `scrollLeft` turun.
- [x] Clamp: delta yang menuntut melewati `scrollWidth - clientWidth` berhenti
      di batas (penghujung form — kamera mentok, input boleh menggulir
      internal di situ).
- [x] Manual: dispatch `scroll` tanpa flag → ketikan berikutnya pertama-tama
      diabaikan (paused), ketikan kedua diikuti kembali (resume).
- [x] Reduced-motion: `matchMedia` di-stub `reduce` → nilai target ditulis
      langsung (tidak ada frame antara).
- [x] Cleanup: `stopCaretFollow` membatalkan rAF (`cancelAnimationFrame`
      di-spy) dan mirror hilang dari body.

**Gate 14C:** `pnpm test` hijau; `pnpm typecheck`; `pnpm lint`. Verifikasi
manual di `pnpm dev` (viewport 412×915, mode kanvas): ketik ringkasan panjang
→ kamera mengikuti ke kanan; teks wrap → kamera kembali ke kiri dan turun;
swipe manual → kamera diam; ketik lagi → mengikuti lagi.

---

## FASE 14D — Bukti e2e & regresi silang

- [x] **FASE 14D**

### T1 — Spec baru `tests/e2e/canvas-caret-follow.spec.ts`

- [x] **T1** Project `mobile-chrome` (pixel7, `testMatch` mobile specs);
      helper `startApp`/`toCanvasMode` disalin dari
      `tests/e2e/canvas-edit-zoom.spec.ts:21-36`.

Sub-tugas:

- [x] Daftarkan spec baru di `playwright.config.ts`: tambahkan `canvas-caret-follow`
      ke regex `mobileSpecs` (testMatch project `mobile-chrome`) **dan** ke
      `mobileOnlySpecs` (supaya tidak ikut project `chromium` desktop). Regex
      itu allowlist — tanpa ini spec mobile tidak pernah dijalankan di Pixel 7.
- [x] **Posisi awal (regresi 14B):** buka sesi di field lebar (headline
      template Executive atau ringkasan) → skala 75% + tepi kiri field ≈
      `FOCUS_EDGE_MARGIN_PX` dari tepi kiri area terlihat.
- [x] **Mengikuti ke kanan:** `page.keyboard.type` teks ±2× lebar layar →
      `expect.poll` monoton: `scroller.scrollLeft` meningkat bertahap, dan
      selama kamera belum mentok `control.scrollLeft === 0` (kamera yang
      bergerak, isi input tidak — bukti mengikuti K2/K4).
- [x] **Penghujung form:** terus mengetik sampai clamp → `scrollLeft` berhenti
      di `scrollWidth - clientWidth`.
- [x] **Wrap balik ke kiri:** di field textarea (ringkasan/bullet), isi sampai
      membungkus ke baris kedua → `scrollLeft` turun dibanding nilai puncaknya
      + elemen editor masih terlihat di area well.
- [x] **Gulir manual (K6):** geser scroller dengan
      `page.mouse`/`touchscreen` (atau `element.scrollLeft = ...` lewat
      evaluate tanpa flag) → ketikan berikutnya diabaikan, ketikan kedua
      diikuti kembali.
- [x] **Escape (regresi Addendum F13):** tutup sesi → zoom kembali ke skala
      ringkasan 30%.

### T2 — Regresi silang & aksesibilitas

- [x] **T2**

Sub-tugas:

- [x] `pnpm test`, `pnpm test:e2e -- canvas`, `pnpm typecheck`, `pnpm lint`
      semua hijau.
- [x] Mirror tidak terbaca pembaca layar / axe: `aria-hidden="true"` +
      `visibility: hidden`; jalankan pola audit axe dari
      `tests/e2e/canvas-a11y.spec.ts` pada layar dengan sesi edit terbuka.
- [x] *(opsional)* Performa: ketik 200 karakter pada 360px - rekam bahwa
      pengukuran terjadi maksimal sekali per frame (rAF coalesced), tanpa
      jank terlihat di trace Playwright.

### T3 — Penutupan

- [x] **T3**

Sub-tugas:

- [x] Centang semua kotak fase 14A-14D di dokumen ini.
- [x] Susun one-liner commit (gaya `feat(kanvas): ...`, Bahasa Indonesia -
      lihat konvensi) dan serahkan ke user; **jangan auto-commit**.

**Gate 14D (penutup F14):** seluruh perintah verifikasi hijau, tidak ada tes
lama yang dikompromikan, perilaku di 412px terbukti sesuai empat poin
"Tujuan".

---

## 5. Perintah verifikasi

```bash
pnpm test                      # vitest (unit)
pnpm test:e2e -- canvas        # playwright: semua spec kanvas (chromium + mobile-chrome)
pnpm typecheck                 # tsc -b
pnpm lint                      # eslint
pnpm dev                       # verifikasi manual di viewport 412×915
```

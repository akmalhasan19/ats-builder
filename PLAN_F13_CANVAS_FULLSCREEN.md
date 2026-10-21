# PLAN F13 — MODE PENGERJAAN LANGSUNG DI CV = KERTAS LAYAR PENUH

> **Tujuan:** saat opsi **"Langsung di CV"** dipilih di menu Tampilan, workspace
> berubah menjadi **satu pane penuh**: kertas A4 mengisi layar, rail kiri dan
> panel formulir tidak ditampilkan. Tidak ada lagi "menu edit di kiri + pratinjau
> di kanan".
>
> **Status:** rencana, belum ada kode. FASE 13 dibuka setelah FASE 12
> (`PLAN_F12_CANVAS_EDIT.md`) tertutup — C1–C5 hijau, jadi fondasi edit langsung
> di atas kertas (klik teks → editor swap-in, guide, ghost row, guard zoom) sudah
> ada dan tidak perlu dibangun ulang. Fase 13 hanya mengubah **tata letak**, bukan
> cara kerja editor kanvas.
>
> **Dokumen induk:** `IMPLEMENTATION_PLAN.md` §0 (konvensi: satu fase ditutup
> Gate-nya sebelum fase berikutnya dibuka), `CANVAS_EDIT_PLAN.md` (D1–D16).
>
> **Konvensi centang:** setiap Fase, Tugas (T), dan Sub-tugas punya kotak
> centang. Centang Fase hanya boleh dilakukan **setelah semua sub-tugas dan
> Gate-nya centang**. Sub-tugas bertanda *(opsional)* boleh dilewati tanpa
> membatalkan Gate.

---

## 0. Ringkasan eksekutif

Mode `editMode: 'canvas'` hari ini **sudah** membuat kertas bisa diedit langsung,
tetapi masih dibungkus grid tiga kolom: rail (56/248px) + panel formulir
(380–520px) + pratinjau (`1fr`). Akibatnya pengalaman "langsung di CV" terasa
seperti pratinjau yang disempitkan, bukan kertas kerja.

Fase 13 memecahnya menjadi: `editMode === 'canvas'` → **workspace satu kolom**,
rail & formulir disembunyikan, kertas mendapat seluruh lebar layar, dan zoom
dinaikkan plafonnya supaya kertas benar-benar membesar (bukan cuma ruang kosong
yang bertambah).

---

## 1. Masalah & bukti dari kode saat ini

### 1.1 Struktur grid yang harus diubah

`src/app/AppShell.tsx:80–93` — satu grid untuk semua breakpoint:

```
className: relative grid min-h-0 h-[calc(100dvh-96px)] overflow-hidden
           pb-[calc(64px+env(safe-area-inset-bottom))]
           md:h-[calc(100dvh-100px)] md:pb-0
           lg:h-[calc(100dvh-56px)] lg:grid-cols-[56px_minmax(360px,1fr)_1fr]
           + (!atsDocked && 'xl:grid-cols-[248px_minmax(380px,520px)_1fr]')
style:     atsDocked ? { gridTemplateColumns: '248px minmax(380px,520px) 1fr 400px' } : undefined
```

Anak-anaknya berurutan (`AppShell.tsx:95–107`): `<Rail />`, `<FormPane />`,
`<PreviewWell />`, `<AtsDockSlot />`, anchor `#home-templates`.

### 1.2 Jebakan yang wajib diantisipasi

- [x] **Jebakan auto-placement grid.** `Rail` dan `FormPane` disembunyikan dengan
      utility `hidden` (`display:none`). Di CSS Grid, elemen `display:none`
      **bukan grid item**, sehingga `PreviewWell` akan ditempatkan otomatis ke
      sel pertama — yaitu kolom `56px` (atau `248px`). Menyembunyikan anak tanpa
      mengubah `grid-template-columns` justru **menghancurkan** pratinjau.
      Karena itu **kedua hal ini wajib berpasangan**: `grid-cols-1` **dan**
      anak yang disembunyikan.
- [x] **Jebakan plafon zoom.** `MAX_ZOOM = 1.5` di `PreviewWell.tsx:24`. Di layar
      penuh 1440px, lebar well ≈ 1392 → `fitScale = (1392−48)/794 = 1,69` →
      **mentok 1,5**; di 1920px → 2,29 → mentok 1,5. Kertas berhenti membesar di
      1191px dan sisanya jadi margin mati. Tanpa menaikkan plafon, "layar penuh"
      hanya terasa sebagai ruang kosong yang lebih lebar.
- [x] **Jebakan tinggi workspace.** Tinggi dipatok `100dvh − 96px` (mobile,
      = TopBar 52 + tab bar 44) dan `100dvh − 100px` (md). Kalau `MobileTabBar`
      disembunyikan di mode kanvas, angka itu terlalu kecil → kertas kehilangan
      44px dan muncul celah di bawah.
- [x] **Jebakan fokus.** Bila fokus sedang di tombol rail/formulir lalu elemen
      itu menjadi `display:none`, fokus jatuh ke `<body>` dan pengguna keyboard
      tersesat. Perlu pemindahan fokus eksplisit.
- [x] **Jebakan anchor beranda.** Tombol melayang `#home-templates`
      (`AppShell.tsx:100–107`) menunjuk ke `HomeSections`, yang di fase ini
      tidak dirender di mode kanvas → anchor mati.

  **Kelima jebakan di atas terantisipasi & terverifikasi** (bukti per jebakan):
  (1) grid — spike T0.3 (`artifacts/fase13/spike-hasil.json`) + `grid-cols-1`
  berpasangan dengan `hidden`, terukur `grid-template-columns: 1024px/1280px/…`
  satu kolom di semua breakpoint (§10.3); (2) plafon — `MAX_ZOOM_CANVAS = 2.0`,
  terukur 1360 px (1,7128) di 1440 px, lewat plafon mode form 1191 px;
  (3) tinggi — `h-[calc(100dvh-52px)] md:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-56px)]`,
  terukur 588/792/844 px di 360×640/390×844/768×900 tanpa celah bawah;
  (4) fokus — `useCanvasFocus` + `tests/unit/canvasFocus.test.tsx` (4 tes);
  (5) anchor — `showHomeAnchor = false`, `#home-templates` & `[data-probe="home-anchor"]`
  = 0 simpul di mode kanvas.

### 1.3 Yang sudah tersedia (tidak perlu dibangun)

| Yang dibutuhkan layar penuh | Sudah ada sejak Fase 12 |
| :-- | :-- |
| Edit teks langsung di kertas | `CanvasBlock` + `CanvasFieldEditor` (D3) |
| Slot kosong ber-pemandu | `fieldSegments.ts` + `data-canvas-guide` (D4/D5) |
| Tambah entri/bagian dari kertas | `CanvasGhostRow` (D10) — **ini pengganti rail untuk tambah konten** |
| Penjaga keterbacaan zoom | `canvasZoom.ts` `ensureReadableZoom` (D7) |
| Jalan keluar kembali ke form | `TampilanMenu` di toolbar pratinjau (`PreviewWell.tsx:261`) |
| Penanda mode untuk CSS global | `data-edit-mode` di root shell (`AppShell.tsx:58`) |

---

## 2. Keputusan desain (D1–D14)

Keputusan ini mengikat. Perubahan di luar daftar ini harus ditulis ulang di sini.

| # | Keputusan | Alasan |
| :-- | :-- | :-- |
| **D1** | Layar penuh **diimplikasikan** oleh `editMode === 'canvas'`. Tidak ada flag state baru untuk "layar penuh" di Fase 1–2. | Permintaan eksplisit: mode itu "ketika dipilih" langsung full screen. Sedikit state = sedikit cabang. |
| **D2** | Fase 3 menambahkan **opsi batal** `canvasFullscreen: boolean` (default `true`) di `uiStore`, dipersistensi di `ats:prefs:v1`. | Memberi jalan keluar tanpa deploy bagi pengguna yang tetap ingin rail di mode kanvas. Default tetap sesuai permintaan. |
| **D3** | Sembunyikan dengan utility **`hidden`** (CSS), jangan unmount. | Menjaga state internal `Rail` (DnD, dialog katalog), menjaga posisi gulir, dan sudah ada preseden `activeTab` di `AppShell.tsx:96–97`. CLS bukan isu: perubahan dipicu aksi pengguna (<500ms dikecualikan dari CLS). |
| **D4** | Perubahan grid **diturunkan dari satu fungsi murni** `workspaceLayoutFor()` di `src/app/useWorkspaceLayout.ts`, bukan cabang JSX inline. | Mengikuti preseden `panelModeFor(width)` (`usePanelMode.ts`) yang teruji tanpa DOM. |
| **D5** | **TopBar tetap ditampilkan.** | TopBar bukan "menu edit": ia memuat Undo/Redo, judul dokumen, pemilih template, status simpan, dan unduh PDF. Menghilangkannya memutus akses ekspor. |
| **D6** | Toolbar melayang pratinjau (`PreviewWell.tsx:156–263`) **tetap ditampilkan**. | Ia memuat `TampilanMenu` = satu-satunya jalan keluar kembali ke "Form terpandu". |
| **D7** | `HomeSections` **di-unmount** di mode kanvas (bukan `hidden`). | Ia `lazy()` di luar `<main>`; unmount menghindari muat chunk yang tidak pernah dilihat dan mencegah halaman kerja ikut tergulung ke beranda. Crawler selalu mendapat `editMode` default `'form'`, jadi prerender `scripts/prerender-home.mjs` tidak terdampak. |
| **D8** | Anchor beranda (`data-probe="home-anchor"`) **disembunyikan** di mode kanvas. | Menunjuk ke target yang tidak dirender (lihat §1.2). |
| **D9** | Drawer ATS **dipaksa menjadi overlay** di mode kanvas, walaupun `atsDocked === true` (≥1600px). | Layar penuh berarti satu pane. `AtsDockSlot` tetap ada untuk mode form; `AtsOverlay` mengambil alih pada mode kanvas (`AtsDrawer.tsx` sudah punya kedua bentuk). |
| **D10** | Plafon fit dinaikkan khusus mode kanvas: **`MAX_ZOOM_CANVAS = 2.0`**; `MIN_ZOOM` tetap `0.3`. | Lihat §1.2. Kertas tumbuh nyata, bukan cuma ruang kosong. |
| **D11** | Fit **tetap berbasis lebar saja** — tidak ditambah fit-tinggi. | Fit-tinggi pada 1920×1080 menghasilkan `(1024−56−48)/1123 ≈ 0,82`, lebih kecil dari kondisi split saat ini (`≈1,39`) → regresi. Kertas yang lebih tinggi dari viewport wajar untuk dokumen yang diedit (perilaku Google Docs), dan kontrol zoom ada di toolbar. |
| **D12** | Rail yang hilang digantikan oleh **"Bagian" di toolbar kanvas** (popover desktop / sheet mobile) yang memakai ulang daftar bagian yang sudah ada. | Di desktop, urutan/visibilitas/hapus bagian hanya ada di rail. Tanpa pengganti, mode layar penuh menyandera kemampuan struktural. Tambah konten sudah ditutup ghost row (D10), jadi yang perlu dikembalikan hanya **struktur**. |
| **D13** | Fokus dipindahkan ke `#pane-preview` saat masuk mode kanvas, dan kembali ke pemicu saat keluar. | Mencegah fokus jatuh ke `<body>` (lihat §1.2). |
| **D14** | Browser Fullscreen API (`requestFullscreen`) **tidak** dipakai di Fase 1–7. | Yang diminta adalah tata letak satu pane, bukan mode layar penuh OS. API ini punya masalah a11y (mengambil alih Esc) dan izin; diletakkan di OQ-3 sebagai calon fase terpisah. |

---

## 3. Peta modul

### 3.1 File baru

| File | Peran |
| :-- | :-- |
| `src/app/useWorkspaceLayout.ts` | `workspaceLayoutFor(input)` → kelas grid, tinggi, dan visibilitas per pane (D4). Fungsi murni, teruji tanpa DOM. |
| `src/features/preview/previewZoom.ts` | Konstanta & rumus zoom: `MIN_ZOOM`, `MAX_ZOOM`, `MAX_ZOOM_CANVAS`, `FIT_PAD_PX`, `clamp`, `fitScaleFor()` (D10/D11). Diekstrak dari `PreviewWell.tsx` supaya bisa diuji. |
| `src/app/shell/CanvasSectionMenu.tsx` | Pengganti rail di mode kanvas: popover/sheet daftar bagian (D12). |
| `src/app/shell/SectionListNav.tsx` | Baris bagian yang dipakai ulang `CanvasSectionMenu` dan `StickyActionBar` (T3.4 "ekstrak ke komponen bersama bila perlu") + `SectionAddButton`. |
| `src/app/shell/CanvasExitButton.tsx` | Tombol "Keluar dari kertas layar penuh" di toolbar kanvas (D2/D6). |
| `src/app/useCanvasFocus.ts` | **Fase 5**: hook D13 — fokus pindah ke `#pane-preview` saat masuk mode kanvas, kembali ke pemicu saat keluar. |
| `tests/unit/workspaceLayout.test.ts` | Uji matriks fungsi murni (D4). |
| `tests/unit/previewZoom.test.ts` | Uji rumus fit & plafon (D10/D11). |
| `tests/unit/canvasFocus.test.tsx` | **Fase 5**: uji hook D13 — fokus berpindah saat toggle mode. |
| `tests/e2e/canvas-fullscreen.spec.ts` | Uji alur penuh lintas breakpoint. |

### 3.2 File diubah

| File | Perubahan | Baris kunci |
| :-- | :-- | :-- |
| `src/app/AppShell.tsx` | Pakai `workspaceLayoutFor()`; grid → satu kolom; `hidden` pada Rail/FormPane; tinggi kanvas; sembunyikan `MobileTabBar` & anchor; unmount `HomeSections`; ATS overlay | `:80–118` |
| `src/app/shell/PreviewWell.tsx` | Ambil konstanta zoom dari `previewZoom.ts`; terima prop `canvasFullscreen`; padding lebih longgar di layar penuh; sisipkan `CanvasSectionMenu` + `CanvasExitButton` di toolbar; **Fase 4**: toolbar kanvas dirampingkan di bawah 640px (T4.1/T4.2); **Fase 5**: `tabIndex={-1}` supaya `#pane-preview` bisa jadi tujuan fokus (T5.1) | `:23–32`, `:72`, `:82`, `:146–155`, `:156–263` |
| `src/app/shell/Rail.tsx` | Terima & teruskan `className` ke `<aside>` (preseden `FormPane`) | `:440–443` |
| `src/store/uiStore.ts` | Tambah `canvasFullscreen` + `setCanvasFullscreen` (D2) | `:13`, `:31`, `:46`, `:58` |
| `src/features/preview/usePreviewPrefs.ts` | Tambah `canvasFullscreen` ke tipe, pembacaan, penulisan `ats:prefs:v1` | `:5–11`, `:32–39`, `:51–60` |
| `src/app/shell/TampilanMenu.tsx` | Toggle "Kertas layar penuh" di bawah grup mode pengerjaan; preset zoom tambahan untuk kanvas; **Fase 4**: prop `iconOnlyBelowSm` → pemicu jadi ikon saja di <640px; **Fase 5**: `ToggleRow` menerima `description` (dengan `aria-label` + `aria-describedby`) | `:14–21`, `:69–76`, `:84–115`, `:139–180` |
| `src/app/shell/TopBar.tsx` | **Fase 4**: tubuh sheet Menu mobile jadi wadah gulir sendiri — tanpa itu opsi "Langsung di CV" tak terjangkau di 360×640 (cacat pre-existing) | `:118` |
| `src/app/useCanvasFocus.ts` | **Fase 5**: hook D13 — fokus pindah ke `#pane-preview` saat masuk mode kanvas dan kembali ke pemicu saat keluar | baru |
| `src/app/shell/CanvasExitButton.tsx` | **Fase 5**: tooltip `canvas.fullscreenExitHint` (tombolnya ikon saja di <640px) | `:15–46` |
| `src/app/shell/CanvasSectionMenu.tsx` | **Fase 5**: `aria-label` dari kamus pada pemicu desktop | `:78–95` |
| `src/features/ats/components/AtsDrawer.tsx` | `AtsDockSlot` mengembalikan `null` saat kanvas layar penuh; `AtsOverlay` aktif walau `docked` | `:14–41`, `:43–60` |
| `src/app/shell/StickyActionBar.tsx` | Sheet "Bagian" memakai ulang `SectionListNav` + `SectionAddButton`; isi & perilakunya tidak berubah (tanpa tombol hapus) | `:51–245` |
| `src/app/useCanvasFull.ts` | `useCanvasFullscreen()` membaca `uiStore.canvasFullscreen` (D2 menggantikan D1); `CANVAS_FULLSCREEN_DEFAULT` dihapus dari `useWorkspaceLayout.ts` | seluruh file |
| `src/features/ats/useAtsDock.ts` | Ekspor helper `atsDockedFor(editMode, canvasFullscreen, docked)` | `:4–19` |
| `src/dictionaries/id.ts` | Namespace baru `canvasFull.*`; **Fase 5**: `canvas.fullscreenDesc`, `canvas.fullscreenExitHint`, `canvas.fullscreenAnnounce` | `:197–210`, `:270–280` |
| `src/styles/tokens.css` | Hook `[data-edit-mode='canvas']` untuk padding well & perilaku sticky toolbar; **Fase 5**: cincin fokus `#pane-preview` di dalam tepi well | `:413+`, `:520–535` |
| `src/features/canvas/canvasZoom.ts` | Plafon guard mengikuti `MAX_ZOOM_CANVAS`; `RAISED_ZOOM` tidak berubah | `:15–16` |
| `tests/unit/appShell.test.tsx` | Tambah deskripsi "kanvas layar penuh"; **Fase 5**: tes integrasi fokus + live region + skip link | `:715–767` |
| `tests/unit/tampilanMenu.test.tsx` | **Fase 4**: pemicu "Tampilan" ikon saja di <640px hanya di mode kanvas | setelah `:104` |
| `tests/unit/canvasFocus.test.tsx` | **Fase 5**: hook D13 — fokus berpindah saat toggle mode | baru |
| `tests/unit/canvasFullscreen.test.tsx` | **Fase 5**: `CanvasExitButton` dibungkus `TooltipProvider`; tes tooltip dari kamus | `:180–225` |
| `tests/unit/contrast.test.ts` | **Fase 5**: kontras teks di atas kaca toolbar di atas workbench | `:79–88`, `:141–162` |
| `tests/e2e/responsive.spec.ts` | Tambah matriks breakpoint untuk mode kanvas; **Fase 4**: matriks 360/390/768 mode kanvas (tinggi, celah bawah, overflow) | — |
| `tests/e2e/canvas-mobile.spec.ts` | **Fase 4**: toolbar muat, target sentuh, pinch-zoom, guard zoom, z-index sheet, rotasi | setelah `:180` |
| `tests/e2e/canvas-a11y.spec.ts` | **Fase 5**: fokus D13, urutan Tab toolbar, audit elemen tersembunyi, skip link, kontras toolbar runtime, axe 360 & 1440 | setelah `:163` |

---

## 4. Matriks target per breakpoint

| Lebar | Mode form (hari ini & tetap) | Mode kanvas layar penuh (target) |
| :-- | :-- | :-- |
| `< 640` | 1 kolom, tab Isi data/Pratinjau, `StickyActionBar` | 1 kolom, **tanpa tab bar**, hanya kertas; toolbar + `StickyActionBar` tetap |
| `640–1023` | sama, tinggi `100dvh − 100px` | 1 kolom, tinggi **`100dvh − 56px`** |
| `1024–1279` | `56px  minmax(360px,1fr)  1fr` | **`1fr`** — rail & formulir `hidden` |
| `1280–1599` | `248px minmax(380px,520px) 1fr` | **`1fr`** |
| `≥ 1600` | + kolom ATS 400px bila dibuka | **`1fr`** — ATS jadi overlay walau terbuka |

**Tinggi workspace kanvas:** `h-[calc(100dvh-52px)] md:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-56px)]`
(mobile kehilangan tab bar 44px yang disembunyikan).

---

## 5. Fase, tugas, dan sub-tugas

> Cara memakai: centang sub-tugas → centang tugas → centang Gate → centang Fase.
> Jangan buka fase berikutnya sebelum Gate fase sebelumnya hijau.

---

### Fase 0 — Fondasi: ekstraksi & pengukuran

- [x] **Fase 0 — Fondasi: ekstraksi & pengukuran**

  - [x] **T0.1 Ekstrak konstanta & rumus zoom ke `src/features/preview/previewZoom.ts`** *(D10, D11)*

    - [x] Pindahkan `MIN_ZOOM = 0.3`, `MAX_ZOOM = 1.5`, `ZOOM_STEP = 0.1`, `FIT_PAD_PX = 48`, `FIT_RECALC_DEBOUNCE_MS = 100`, `clamp()` dari `PreviewWell.tsx:23–32` ke modul baru.
    - [x] Tambahkan `MAX_ZOOM_CANVAS = 2.0` dan ekspor keduanya.
    - [x] Tambahkan `fitScaleFor(wellWidth, maxZoom)` → `clamp((wellWidth - FIT_PAD_PX) / A4_PX.w, MIN_ZOOM, maxZoom)`.
    - [x] Tambahkan `maxZoomFor(canvasFullscreen)` → `canvasFullscreen ? MAX_ZOOM_CANVAS : MAX_ZOOM`.
    - [x] Re-export dari `PreviewWell.tsx` agar impor lama tidak putus, lalu hapus duplikat konstanta di `PreviewWell.tsx`.
    - [x] Pastikan `A4_PX` diimpor dari `@/lib/units` (jangan ada hardcode `794`).

  - [x] **T0.2 Ukur baseline sebelum mengubah layout** *(bukti untuk Gate)*

    - [x] Catat lebar efektif `#pane-preview` dan skala fit aktual pada 1024 / 1280 / 1440 / 1920px dalam mode form.
    - [x] Catat skala yang sama **setelah** grid diubah tapi sebelum plafon dinaikkan (harus terlihat mentok 1,5 pada 1440 & 1920 — membuktikan jebakan §1.2 nyata).
    - [x] Simpan hasilnya sebagai komentar di `tests/unit/previewZoom.test.ts` sebagai regression anchor.
    - [x] Ambil tangkapan layar "sebelum" di `artifacts/` untuk 1440px mode kanvas.

  - [x] **T0.3 Verifikasi jebakan auto-placement grid** *(D4, §1.2)*

    - [x] Buat spike lokal: beri `hidden` pada `Rail` dan `FormPane` **tanpa** mengubah `grid-template-columns`.
    - [x] Ukur lebar `#pane-preview` hasilnya — konfirmasi bahwa ia menyusut ke track pertama (56px/248px), bukan meluas.
    - [x] Catat hasilnya (foto/angka) sebagai bukti bahwa perubahan grid **wajib** berpasangan.

  - [x] **Gate Fase 0**

    - [x] `pnpm typecheck` hijau.
    - [x] `pnpm test` hijau (belum ada perubahan perilaku — hanya pemindahan konstanta).
    - [x] `tests/unit/previewZoom.test.ts` hijau, memuat kasus batas `MAX_ZOOM` vs `MAX_ZOOM_CANVAS`.
    - [x] Bukti tertulis jebakan §1.2 (angka lebar sebelum/sesudah spike T0.3) tersimpan.

---

### Fase 1 — Layout satu pane (desktop)

- [x] **Fase 1 — Layout satu pane (desktop)**

  - [x] **T1.1 Fungsi murni `workspaceLayoutFor()`** *(D4)*

    - [x] Buat `src/app/useWorkspaceLayout.ts` dengan tipe input `{ editMode, panelMode, atsDocked, canvasFullscreen }`.
    - [x] Turunkan `canvasFull = editMode === 'canvas' && canvasFullscreen`.
    - [x] Kembalikan `{ gridClass, gridStyle, heightClass, railClass, formClass, previewClass, showTabs, showHomeAnchor, atsMode: 'dock' | 'overlay' }`.
    - [x] Saat `canvasFull`: `gridClass = 'grid-cols-1'`, `gridStyle = undefined`, `heightClass = 'h-[calc(100dvh-52px)] md:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-56px)]'`, `railClass`/`formClass = 'hidden'`, `previewClass = 'block'`, `showTabs = false`, `showHomeAnchor = false`, `atsMode = 'overlay'`.
    - [x] Saat bukan `canvasFull`: kembalikan **persis** nilai yang dipakai hari ini (regresi nol).
    - [x] Tulis `workspaceLayoutFor` sebagai fungsi murni tanpa impor React/store.

  - [x] **T1.2 Terapkan di `AppShell.tsx`** *(D1, D3, D5, D7, D8)*

    - [x] Baca `editMode` (sudah ada di `:51`) dan `canvasFullscreen`, lalu panggil `workspaceLayoutFor`.
    - [x] Ganti `className` grid di `:80–84` dengan `gridClass` + `heightClass` hasil fungsi; hapus `cn()` inline yang lama.
    - [x] Ganti `style` di `:85–93` dengan `gridStyle` hasil fungsi.
    - [x] Beri `Rail` prop `className={railClass}` dan teruskan ke `<aside>` (`Rail.tsx:440–443`) — **jangan** ubah `hidden lg:flex` bawaan agar mode form tidak berubah.
    - [x] Pastikan `FormPane` menerima `formClass` (sudah punya prop `className`).
    - [x] `PreviewWell` menerima `previewClass`; hapus ternary `activeTab` di `:97` untuk cabang kanvas.
    - [x] Render `<MobileTabBar />` hanya bila `showTabs`.
    - [x] Render anchor `#home-templates` hanya bila `showHomeAnchor`.
    - [x] Render `<HomeSections />` hanya bila `!canvasFull` (D7).
    - [x] Pertahankan `data-panel-mode` dan `data-edit-mode` di root (`:57–58`).

  - [x] **T1.3 Hindari regresi mode form** *(kritis)*

    - [x] Verifikasi manual 1024 / 1280 / 1440 / 1920px: layout mode form **identik** dengan sebelum Fase 1 (bandingkan tangkapan layar T0.2).
    - [x] Verifikasi ATS dock ≥1600px masih muncul sebagai kolom ke-4 di mode form.
    - [x] Verifikasi tab mobile (`activeTab`) masih berfungsi di mode form <1024px.

  - [x] **Gate Fase 1**

    - [x] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` hijau.
    - [x] `tests/unit/workspaceLayout.test.ts` hijau, mencakup semua baris matriks §4.
    - [x] Tes baru di `tests/unit/appShell.test.tsx`: `editMode='canvas'` → `#pane-form` tidak terlihat, rail tidak terlihat, `#pane-preview` mengisi lebar penuh.
    - [x] `tests/e2e/responsive.spec.ts` hijau di 6 viewport tanpa overflow horizontal.
    - [x] Nol regresi visual mode form (dibuktikan tangkapan layar).

---

### Fase 2 — Zoom & skala kertas

- [x] **Fase 2 — Zoom & skala kertas**

  - [x] **T2.1 Plafon fit mengikuti mode** *(D10, D11)*

    - [x] Di `PreviewWell.tsx`, terima prop `canvasFullscreen` (atau baca store) dan teruskan ke `maxZoomFor()`.
    - [x] Ganti pemanggilan `clamp(..., MIN_ZOOM, MAX_ZOOM)` di `:82` dan `:142` dengan `fitScaleFor(well.clientWidth, maxZoomFor(canvasFullscreen))`.
    - [x] Ganti `clamp(zoomPref, MIN_ZOOM, MAX_ZOOM)` di `:72` dan `clamp(value, MIN_ZOOM, MAX_ZOOM)` di `:131` dengan plafon yang sama.
    - [x] Perbarui kondisi `disabled` pada tombol zoom in/out (`:162`, `:213`) memakai plafon aktif.
    - [x] **Jangan** tambahkan fit-tinggi (D11). Tulis alasannya sebagai komentar di `previewZoom.ts`.

  - [x] **T2.2 Recompute saat mode berubah** *(jebakan urutan efek)*

    - [x] Tambahkan `canvasFullscreen` ke dependency `useEffect` fit (`:76–94`) supaya skala dihitung ulang **setelah** grid melebar, bukan pada lebar lama.
    - [x] Pastikan `FIT_RECALC_DEBOUNCE_MS` tidak menunda terlalu lama hingga terlihat "kertas kecil lalu membesar" — pertimbangkan recompute sinkron saat `canvasFullscreen` berubah.
    - [x] Verifikasi tidak ada loop: recompute → resize observer → recompute.

  - [x] **T2.3 Ruang & kenyamanan kertas di layar penuh**

    - [x] Padding well: pertahankan `p-6` di mobile, naikkan ke `lg:p-10` hanya saat `canvasFull` (lewat kelas bersyarat, bukan mengubah mode form).
    - [x] Pastikan `contentHeight * zoom` (`:267`) tetap benar saat zoom 2.0 → tinggi kontainer 2246px, gulir vertikal wajar.
    - [x] Pastikan `ScanSweep` (`:286`) tetap berada di dalam kontainer berskala pada zoom tinggi.
    - [x] Pastikan `TemplateRenderer` `gap-6` antar halaman tidak berubah (paritas PDF).

  - [x] **T2.4 Guard zoom kanvas mengikuti plafon baru** *(D7)*

    - [x] Perbarui `canvasZoom.ts` agar `RAISED_ZOOM = 0.75` tetap valid dan `MIN_READABLE_ZOOM = 0.6` tidak bertabrakan dengan `MIN_ZOOM = 0.3`.
    - [x] Pastikan `effectiveScaleOf()` tetap membaca matriks transform dengan benar di skala >1.5.
    - [x] Verifikasi toast `canvas.zoomRaised` tidak muncul sia-sia di desktop layar penuh (skala sudah >0.6).

  - [x] **T2.5 Preset zoom untuk kanvas** *(opsional)*

    - [x] Tambahkan preset `1.25` / `1.5` pada grup zoom di `TampilanMenu.tsx:139–180` hanya saat `canvasFull`.
    - [x] Pastikan `grid-cols-4` tetap rapi dengan 6 item (2 baris).
    - [x] Perbarui `PRESET_ZOOMS` di `PreviewWell.tsx:26` bila menu popover ikut menampilkannya.

  - [x] **Gate Fase 2**

    - [x] Terukur: pada 1440px mode kanvas, skala kertas **> 1.5** (bukan mentok) — lampirkan angkanya.
    - [x] `tests/unit/previewZoom.test.ts` hijau untuk kasus 1024/1280/1440/1920.
    - [x] `pnpm test` hijau; tidak ada tes `canvas-*.spec.ts` yang mulai gagal (mereka menskop selektor ke `#pane-preview`).
    - [x] Tidak ada perubahan pada jalur PDF (paritas `pdf:verify` tetap 174/174).

---

### Fase 3 — Jalan keluar & kontrol yang hilang

- [x] **Fase 3 — Jalan keluar & kontrol yang hilang**

  - [x] **T3.1 State `canvasFullscreen` + persistensi** *(D2)*

    - [x] Tambah `canvasFullscreen: boolean` dan `setCanvasFullscreen` ke `uiStore.ts` (default `true`).
    - [x] Tambah ke tipe `PreviewPrefs`, blok pembacaan, dan blok penulisan di `usePreviewPrefs.ts`.
    - [x] Uji: nonaktifkan toggle → reload → tetap nonaktif (IndexedDB `ats:prefs:v1`). — `tests/e2e/canvas-fullscreen.spec.ts` kasus ke-2 + `tests/unit/canvasFullscreen.test.tsx`.
    - [x] Uji: prefs lama tanpa field ini tidak error (jalur `stored.canvasFullscreen === undefined` → default `true`).

  - [x] **T3.2 Toggle di menu Tampilan**

    - [x] Tambah `ToggleRow` "Kertas layar penuh" di bawah grup mode pengerjaan (`TampilanMenu.tsx:84–116`), memakai `canvas.fullscreenLabel`.
    - [x] Nonaktifkan (disabled) toggle saat `editMode === 'form'` agar tidak membingungkan.
    - [x] Perbarui deskripsi mode kanvas `tampilan.modeCanvasDesc` bila perlu menyebut layar penuh. — **tidak diubah**: deskripsi lama tetap benar (klik teks untuk mengedit); layar penuh dijelaskan lewat label toggle. Ditinjau lagi di T5.3.
    - [x] Pastikan popover tidak melebihi `w-[288px]` dan tidak overflow di mobile sheet. — `tests/unit/canvasFullscreen.test.tsx` mengunci kelas `w-[288px]`; sheet mobile diuji `canvas-mobile.spec.ts` (hijau).

  - [x] **T3.3 Tombol keluar eksplisit** *(D6)*

    - [x] Buat `CanvasExitButton.tsx`: tombol di toolbar kanvas, ikon `Minimize2`, label `canvas.fullscreenExit`.
    - [x] Tampilkan hanya saat `canvasFull === true`.
    - [x] Aksi: `setCanvasFullscreen(false)` (kembali ke kanvas berpanel) — **bukan** mengganti `editMode`.
    - [x] Sediakan juga aksi "Kembali ke Form terpandu" lewat `TampilanMenu` yang sudah ada; pastikan keduanya tidak membingungkan (label berbeda jelas).

  - [x] **T3.4 Pengganti rail: menu "Bagian" di toolbar** *(D12)*

    - [x] Buat `CanvasSectionMenu.tsx` memakai ulang `sectionRegistry` + `getSectionCompleteness` (sumber sama dengan `StickyActionBar.tsx:93–176`).
    - [x] Bentuk desktop: popover; bentuk `<1024px`: sheet bawah (preseden `sheet.tsx` `h-[80dvh]`).
    - [x] Sediakan: pilih bagian aktif, toggle visibilitas, naik/turun urutan, hapus, "+ Tambah bagian" (memakai `uiStore.sectionCatalogOpen` yang sudah ada, C4.4).
    - [x] Pastikan tidak ada duplikasi logika dengan `StickyActionBar` — ekstrak ke komponen bersama bila perlu. — `src/app/shell/SectionListNav.tsx` dipakai keduanya.
    - [x] Catatan: **tambah konten tidak perlu** menu ini (sudah ditutup `CanvasGhostRow`), yang dikembalikan adalah kemampuan **struktural**.
    - [x] *(opsional)* Sembunyikan `StickyActionBar` pada mode kanvas mobile bila menu ini sudah memuat unduh PDF; bila disembunyikan, sesuaikan `pb-[calc(64px+...)]` di grid. — **DILEWATI (opsional)**: menu "Bagian" tidak memuat unduh PDF, jadi bar tetap dibutuhkan.

  - [x] **T3.5 ATS menjadi overlay di kanvas** *(D9)*

    - [x] `AtsDockSlot` mengembalikan `null` saat `canvasFull`.
    - [x] `AtsOverlay` tetap merender walau `docked === true` saat `canvasFull` (balikkan kondisi `if (docked) return null`).
    - [x] Pastikan `modal={panelMode !== '3col'}` tetap benar sehingga tombol "Perbaiki →" (`AtsPanel.tsx:42,57`) bisa memindahkan fokus ke kertas. — `canvas-ats.spec.ts` (2 kasus) hijau.
    - [x] Uji di 1600px+: buka ATS dalam mode kanvas → kertas tetap satu pane, ATS menimpa dari sisi kanan. — `canvas-fullscreen.spec.ts` di 1680px.
    - [x] Uji: keluar mode kanvas saat ATS terbuka → kembali menjadi kolom ke-4 tanpa flash layout.

  - [x] **Gate Fase 3**

    - [x] Semua kontrol struktural yang hilang akibat rail tersembunyi dapat diakses lagi. — pilih bagian, sembunyikan/tampilkan, naik/turun, hapus (dengan konfirmasi bila terisi), tambah bagian. **Sisa yang belum ada padanannya di menu ini** (di luar daftar T3.4): "Duplikat bagian" dan urutan via drag-and-drop — keduanya tetap hanya ada di rail; dicatat untuk ditinjau di Fase 5/6.
    - [x] Ada minimal dua jalan keluar terdokumentasi: tombol toolbar & menu Tampilan.
    - [x] `tests/e2e/canvas-fullscreen.spec.ts` mencakup: masuk → keluar via tombol → rail & formulir kembali. — 5 kasus, hijau di chromium.
    - [x] Preferensi `canvasFullscreen` bertahan lintas reload.
    - [x] `pnpm typecheck && pnpm lint && pnpm test` hijau. — 61 berkas / 1102 tes, dua kali jalankan beruntun; lihat Catatan Fase 3 di bawah.

  **Catatan Fase 3 (2026-10-21)**

  - Flake lama, **bukan** akibat Fase 13: `tests/unit/canvasEdit.test.tsx` ›
    "laporan tinggi ditahan selama sesi" bergantung pada jeda tetap 250 ms
    untuk pengukuran tinggi (`scheduleHeight` → `requestAnimationFrame` →
    debounce 60 ms). Saat mesin ditekan ~61 worker jsdom, jeda itu tidak cukup
    dan tes gagal dengan angka yang berpindah-pindah (`expected undefined to be
    120`, `expected 6 to be 3`). Dibuktikan gagal **di tree HEAD `b95b48a`
    (FASE 12, tanpa kode Fase 13)** dalam worktree terpisah dengan pesan yang
    sama. Fase 3 tidak mengubah tes itu; suite hijau penuh saat paralel (2×)
    dan saat serial (`--no-file-parallelism`, 1102 tes). Perlu dipertahankan
    dengan `waitFor` pada kondisi sebenarnya di T6.5, bukan dinaikkan angkanya.
  - Race lama di `tests/e2e/canvas-a11y.spec.ts` (C5.4) yang **tersingkap** oleh
    T3.3: helper `toCanvasMode` menekan `Escape` lalu langsung mengemudikan
    keyboard, padahal Radix mengembalikan fokus ke pemicu popover **saat unmount**.
    Restore itu merebut fokus kembali ke "Tampilan", sehingga `Enter` berikutnya
    membuka popover, bukan editor kertas. Dua penyesuaian di tes itu — (a) anchor
    "kontrol terakhir toolbar" pindah dari `tampilan-menu` ke `canvas-exit`
    karena tombol keluar kini berada di ujung toolbar, (b) tunggu lapisan
    popover/sheet tercabut sebelum lanjut. Assertion tidak dilonggarkan;
    `canvas-a11y` hijau 3× beruntun dan suite e2e penuh 162/162.
  - `tests/e2e/canvas-guides.spec.ts` › "axe: 0 violation serius" pernah gagal
    sekali pada suite penuh dengan pola `Escape` yang sama (belum diperbaiki —
    file Fase 12, perlu keputusan owner); hijau 3× sendiri + hijau di suite penuh
    setelah perbaikan `canvas-a11y`.
  - Lebar toolbar kanvas di <1024px bertambah dua tombol (trigger "Bagian"
    dibuat icon-only + "Keluar"). Belum diukur di 360/390px — masuk cakupan
    T4.1/T4.2; `canvas-mobile.spec.ts` tetap hijau.
  - `canvas.fullscreenDesc`, `canvas.fullscreenExitHint`, dan
    `canvas.fullscreenAnnounce` sengaja belum ditambahkan (T5.2/T5.3).
  - Popover menu "Bagian" memakai lebar **336px**, bukan 288px: barisnya membawa
    kotak visibilitas + ikon + nama + titik kelengkapan + tiga tombol aksi, jadi
    pada 288px nama bagian terpotong ("Pendid…"). Batas `w-[288px]` di T3.2
    milik popover Tampilan dan tetap utuh (dikunci tes unit).
  - Trigger menu "Bagian" di `<1024px` berupa ikon saja (`aria-label` dari
    kamus) supaya toolbar kanvas tidak melebar; bentuk sheet bawah tetap.

---

### Fase 4 — Mobile & tablet

- [x] **Fase 4 — Mobile & tablet**

  - [x] **T4.1 Tab bar & tinggi** *(§4)*

    - [x] `MobileTabBar` tidak dirender saat `canvasFull` (`showTabs = false`).
    - [x] Tinggi workspace mobile menjadi `h-[calc(100dvh-52px)]`; md menjadi `h-[calc(100dvh-56px)]`.
    - [x] Pertahankan `pb-[calc(64px+env(safe-area-inset-bottom))]` selama `StickyActionBar` masih tampil.
    - [x] Verifikasi tidak ada celah kosong di bawah kertas pada 360×640 dan 390×844.

  - [x] **T4.2 Target sentuh & keterbacaan** *(D7)*

    - [x] Pastikan aturan `[data-panel-mode='tabs'][data-edit-mode='canvas'] .canvas-field { padding-block: 10px !important }` (`tokens.css`) tetap aktif — ia bergantung pada `data-panel-mode`, yang **tidak** berubah di fase ini.
    - [x] Pastikan `ensureReadableZoom` masih menaikkan ke 0.75 bila fit mobile menghasilkan <0.6.
    - [x] Uji pinch-zoom tidak diblokir (`[touch-action:pan-x_pan-y_pinch-zoom]`).

  - [x] **T4.3 Bottom sheet pada mode kanvas**

    - [x] `CanvasDatesEditor` (popover desktop / sheet mobile) tetap berfungsi tanpa rail & formulir.
    - [x] Sheet bagian (`CanvasSectionMenu`) tidak bentrok dengan `StickyActionBar` (z-index: bar `z-30`, sheet harus di atasnya).
    - [x] Uji rotasi portrait ↔ landscape: grid `grid-cols-1` tidak berubah, tinggi `100dvh` mengikuti.

  - [x] **Gate Fase 4**

    - [x] `tests/e2e/canvas-mobile.spec.ts` (sudah ada) tetap hijau.
    - [x] `tests/e2e/responsive.spec.ts` hijau di 360/390/768 dengan mode kanvas aktif.
    - [x] Tidak ada overflow horizontal; tidak ada elemen yang terpotong `StickyActionBar`.
    - [x] `pnpm test` hijau.

  **Catatan Fase 4 (2026-10-21)**

  - Semua butir T4.1–T4.3 ternyata **sudah terpenuhi oleh Fase 1–3** pada
    kode yang ada; tidak ada perubahan perilaku mobile yang bersumber dari
    plan ini. Bukti terukur:
    - `workspaceLayoutFor()` sudah mengembalikan
      `heightClass = 'h-[calc(100dvh-52px)] md:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-56px)]'`
      dan `showTabs = false` saat `canvasFull`
      (`src/app/useWorkspaceLayout.ts:96–103`), dan `AppShell.tsx:96` tetap
      memakai `pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0`.
    - Terukur di browser (mode kanvas layar penuh): 360×640 → workspace 588px
      (640−52), well 524px, `StickyActionBar` mulai di y=576 = tepat di bawah
      well; 390×844 → workspace 792px, well 728px, bar mulai di y=780;
      768×900 → workspace 844px (900−56), `md:pb-0`, bar tersembunyi.
    - `data-panel-mode` tetap `tabs` di <1024px → aturan
      `padding-block: 10px !important` untuk `.canvas-field` masih hidup
      (terukur `paddingTop/Bottom = 10px/10px` di 360/390/768).
    - Guard zoom: fit 360px = 0,3929 (< 0,6) → klik segmen menaikkan skala ke
      **0,75** + toast "Zoom dinaikkan ke 75% supaya teksnya mudah dibaca."
    - `touch-action` well: `pan-x pan-y pinch-zoom` **dinormalisasi Chrome jadi
      `manipulation`** (setara menurut CSS Touch Action Level 2) — jadi
      pinch-zoom **tidak** diblokir; yang dilarang hanya `none`.
    - Sheet "Bagian": `z-50` (isi + overlay) di atas `StickyActionBar` `z-30`,
      dan sheet menutupi bar sepenuhnya.
    - Rotasi 390×844 → 844×390 → 390×844: `grid-template-columns` tetap satu
      kolom, tinggi workspace mengikuti `100dvh` (792 / 334 / 792), tanpa
      overflow horizontal.
  - **Dua cacat nyata ditemukan & diperbaiki di fase ini** (keduanya blokir
    verifikasi T4.1, keduanya pre-existing — `TopBar.tsx` tidak berubah
    sama sekali sejak HEAD `b95b48a`):
    1. **Sheet Menu TopBar tidak bisa digulir** (`overflow` visible,
       `scrollHeight 1120 > clientHeight 638` di 360×640). Opsi "Langsung di
       CV" — satu-satunya jalan ke mode kanvas — berada di y=678, **di luar
       viewport 640px** dan tidak terjangkau (Playwright: "element is outside
       of the viewport"). Perbaikan: tubuh sheet jadi wadah gulir sendiri
       (`src/app/shell/TopBar.tsx:118`).
    2. **Toolbar kanvas meluber di layar sempit**: isi penuh 495px di dalam
       kotak konten well 312px (360px) → ujungnya terpotong 67px di kedua
       sisi, `well.scrollWidth 427 > clientWidth 360`, dan tombol
       "Tampilan" + "Keluar" (dua jalan keluar) praktis tak terjangkau.
       Perbaikan: di bawah `sm` (640px) toolbar kanvas dirampingkan —
       pemicu "Tampilan" ikon saja, chip halaman + separator disembunyikan,
       penggaris + stabilo pindah ke sheet "Tampilan" TopBar (keduanya sudah
       ada di `TampilanMenuContent`, jadi tidak ada fungsi yang hilang).
       Mode form **tidak** memakai perampingan ini.
       Sesudahnya: toolbar 305px, `well.scrollWidth = clientWidth = 360`,
       tanpa overflow.
  - `pnpm test` **hijau penuh**: 61 berkas / **1103 tes** (1 tes baru di
    `tests/unit/tampilanMenu.test.tsx`), dua kali jalankan beruntun saat
    paralel — dan hijau juga saat serial (`--no-file-parallelism`).
    Saat ada dev server lain yang menyala, `tests/unit/canvasEdit.test.tsx` ›
    "laporan tinggi ditahan selama sesi" sempat gagal (`expected 3, received
    6`) — flake lama yang **sudah dibuktikan gagal di tree HEAD `b95b48a`
    tanpa kode Fase 13** (Catatan Fase 3). Dibuktikan ulang di fase ini:
    gagal tetap terjadi **dengan seluruh perubahan Fase 4 dikembalikan**
    (TopBar/PreviewWell/TampilanMenu dikembalikan ke kondisi sebelum fase
    ini) → bukan akibat perubahan fase ini.
  - `pnpm typecheck`, `pnpm lint`, `pnpm build` hijau; `pnpm pdf:verify`
    tetap **174/174** (paritas PDF tidak tersentuh).
  - `pnpm test:e2e` suite penuh: **175/175 hijau** (dari 162 → +13 tes baru:
    3 matriks breakpoint × 2 project + 7 tes detail mobile).
  - Tidak ada tes yang dihapus, di-skip, atau dilonggarkan.

---

### Fase 5 — Aksesibilitas & i18n

- [x] **Fase 5 — Aksesibilitas & i18n**

  - [x] **T5.1 Fokus & navigasi keyboard** *(D13)*

    - [x] Saat masuk mode kanvas, pindahkan fokus ke `#pane-preview` (`tabIndex={-1}` + `.focus()`).
    - [x] Saat keluar, kembalikan fokus ke elemen pemicu (simpan referensi atau pakai tombol yang baru saja ditekan).
    - [x] Pastikan `SkipToContent` (`#workspace-main`) tetap bermakna saat rail/formulir tersembunyi.
    - [x] Pastikan tab order toolbar: zoom → halaman → penggaris → stabilo → Bagian → Tampilan → Keluar.
    - [x] Uji: tidak ada elemen `display:none` yang masih bisa menerima fokus (audit dengan `document.activeElement` setelah toggle).

  - [x] **T5.2 Live region & label**

    - [x] Perluas pengumuman mode (`AppShell.tsx:69–73`, `tampilan.modeAnnounce`) agar menyebut "layar penuh" saat `canvasFull`.
    - [x] Tambahkan kunci `canvas.fullscreenAnnounce`.
    - [x] `CanvasExitButton` dan `CanvasSectionMenu` punya `aria-label` dari kamus, bukan string hardcode.
    - [x] Toggle di `TampilanMenu` memakai `ToggleRow` yang sudah ada (`role` & label sudah benar).

  - [x] **T5.3 Kamus Indonesia** *(`src/dictionaries/id.ts`)*

    - [x] `canvas.fullscreenLabel` — "Kertas layar penuh".
    - [x] `canvas.fullscreenDesc` — penjelasan singkat bahwa rail & formulir disembunyikan.
    - [x] `canvas.fullscreenExit` — "Keluar dari layar penuh".
    - [x] `canvas.fullscreenExitHint` — untuk tooltip.
    - [x] `canvas.sectionsMenu` — "Bagian".
    - [x] `canvas.fullscreenAnnounce` — "Mode langsung di CV, kertas layar penuh."
    - [x] Perbarui `tampilan.modeCanvasDesc` bila deskripsi perlu menyebut layar penuh.
    - [x] *(opsional)* Tambahkan padanan `en.ts` bila kamus `en` sudah diaktifkan (P7 memperbolehkan fallback `id`).

  - [x] **T5.4 Audit otomatis**

    - [x] Jalankan axe pada mode kanvas layar penuh (`tests/e2e/canvas-a11y.spec.ts` sudah ada — perluas).
    - [x] Pastikan tidak ada pelanggaran "aria-hidden focus" dari elemen yang disembunyikan.
    - [x] Pastikan kontras toolbar glass di atas latar well yang lebih luas tetap memadai.

  - [x] **Gate Fase 5**

    - [x] `tests/e2e/canvas-a11y.spec.ts` hijau, tanpa pelanggaran axe baru.
    - [x] Ada tes unit yang membuktikan fokus berpindah saat toggle mode.
    - [x] `grep` string UI hardcode di `src/` = 0 hasil di luar `dictionaries/`.
    - [x] `pnpm lint` hijau.

  **Catatan Fase 5 (2026-10-21)**

  - **Fokus (D13)** — hook baru `src/app/useCanvasFocus.ts` (dipakai `AppShell`):
    1. **masuk mode kanvas** → fokus pindah ke `#pane-preview`
       (`PreviewWell.tsx` kini memakai `tabIndex={-1}` supaya bisa difokuskan);
    2. **keluar mode kanvas** → fokus kembali ke "pemicu" yang disimpan saat
       masuk; kalau pemicunya sudah lekang dari DOM (radio "Langsung di CV"
       di dalam popover yang ditutup), ada rantai cadangan: pemicu →
       pemicu menu Tampilan → `#pane-preview`;
    3. **hanya tata letak yang berubah** (tombol "Keluar" ter-unmount, atau
       toggle "Kertas layar penuh") → fokus yang hilang dipulihkan, sementara
       fokus yang masih hidup (mis. switch di dalam popover) tidak diganggu.
    Run pertama sengaja diabaikan: memuat halaman dengan preferensi
    `canvasFullscreen` tersimpan tidak boleh mencuri fokus.
  - **Cincin fokus** — cincin global (2px, offset 2px) terlalu berat untuk
    satu pane penuh dan terpotong `overflow: hidden` workspace, jadi diganti
    garis aksen 2px **di dalam** tepi well
    (`tokens.css` → `[data-edit-mode='canvas'] #pane-preview:focus-visible`).
  - **Live region** — `AppShell.tsx` sekarang mengumumkan
    `canvas.fullscreenAnnounce` ("Mode langsung di CV, kertas layar penuh.")
    saat `canvasFull`; di luar itu tetap `tampilan.modeAnnounce`
    ("Mode pengerjaan: {mode}."). Assertion lama di `canvas-a11y.spec.ts`
    diperbarui ke teks baru — **persis**, bukan dilonggarkan.
  - **`ToggleRow`** — keterangan `canvas.fullscreenDesc` ditambahkan di bawah
    label. Supaya nama aksesibel switch tetap persis "Kertas layar penuh",
    switch memakai `aria-label` + `aria-describedby` (bukan teks yang
    digabung ke nama, yang akan jadi "Kertas layar penuh Rail dan
    formulir…").
  - **Tooltip** — `CanvasExitButton` kini memakai `canvas.fullscreenExitHint`
    sebagai tooltip (di <640px tombolnya ikon saja). Konsekuensinya
    `CanvasExitButton` butuh `TooltipProvider` — sudah ada di `AppShell`;
    tes unit `canvasFullscreen.test.tsx` memakai provider yang sama.
  - **`tampilan.modeCanvasDesc` tidak diubah** — deskripsi itu menjelaskan
    *cara kerja* mode (klik teks di kertas, bagian kosong menampilkan
    pemandu) dan tetap benar baik dengan layar penuh hidup maupun mati.
    Efek tata letaknya dijelaskan lewat `canvas.fullscreenDesc` tepat di
    bawah toggle-nya.
  - **`en.ts` tidak diisi** *(opsional)* — kamus `en` masih stub 11 kunci
    ("diisi penuh di Fase 11"); P7 mengizinkan fallback ke `id`.
  - **Audit `grep` string UI hardcode** — 0 hasil di luar `dictionaries/`:
    tidak ada `aria-label`/`title`/`placeholder`/`alt` ber-string literal,
    dan tidak ada teks literal di dalam JSX. String literal yang tersisa di
    `src/` bukan teks UI: daftar sinonim parser ATS
    (`src/features/ats/rules/headings.ts`, `verbs.ts` — data pencocokan, tidak
    pernah dirender), nilai CSS (`font-family`, `transform-origin`), dan
    fixture halaman dev (`src/app/dev/*`).
  - **Bukti terukur:**
    - `tests/unit/canvasFocus.test.tsx` (baru, 4 tes): masuk mode → fokus di
      `#pane-preview`; keluar mode → fokus kembali ke pemicu; keluar dari
      layar penuh (tombol keluar ter-unmount) → fokus **tidak** jatuh ke
      `<body>`; mount tidak mencuri fokus.
    - `tests/unit/appShell.test.tsx` (1 tes integrasi): `#pane-preview` punya
      `tabindex="-1"`, skip link tetap menunjuk `#workspace-main` yang memuat
      kertas, dan live region menyebut "kertas layar penuh".
    - `tests/e2e/canvas-a11y.spec.ts` (11 tes, hijau): fokus berpindah ke
      kertas; keluar layar penuh mengembalikan fokus; urutan toolbar
      `Perkecil → zoom-value → Perbesar → page-counter → Penggaris margin →
      stabilo → Bagian → Tampilan → Keluar`; audit "elemen tersembunyi tidak
      memegang fokus" (tombol form tersembunyi tidak bisa difokuskan, dan
      tidak ada `aria-hidden` yang memuat kontrol fokus); skip link tetap
      bermakna; kontras toolbar kaca **terukur runtime** (komposit
      `rgba(255,255,255,0.86)` di atas workbench) ≥ 4,5:1; axe 0 violation
      serius di 360px & 1440px.
    - `tests/unit/contrast.test.ts` (+3 tes): kontras `ink` /
      `ink-secondary` / `ink-tertiary` di atas kaca toolbar di atas workbench
      ≥ 4,5:1 (latar efektif `#fbfbfc`).
  - **Assertion yang diperbarui (bukan dilonggarkan):**
    `tests/e2e/canvas-a11y.spec.ts` — live region mode kanvas kini
    `'Mode langsung di CV, kertas layar penuh.'` (T5.2 mewajibkan
    penyebutan "layar penuh").
  - **Hasil verifikasi:**
    - `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm build` ✅
    - `pnpm test` → **62 berkas / 1112 tes hijau** (dari 1103: +1 berkas
      `canvasFocus.test.tsx` dengan 4 tes, +1 tes integrasi di
      `appShell.test.tsx`, +3 tes kontras, +1 tes tooltip, +1 tes
      `canvasFullscreen.test.tsx`).
    - `pnpm test:e2e` suite penuh → **182/182 hijau** (dari 175: +7 tes
      `canvas-a11y.spec.ts`).
    - `pnpm pdf:verify` → **174/174** (paritas PDF tidak tersentuh).
    - Terukur di browser: setelah masuk mode kanvas
      `document.activeElement` = `#pane-preview`; pada jalur keyboard
      `:focus-visible` cocok dan cincin fokus terhitung
      `rgb(179, 71, 0) solid 2px` dengan `outline-offset: -2px` (digambar di
      dalam tepi well, jadi tidak terpotong). Setelah keluar dari layar
      penuh, fokus kembali ke pemicu menu Tampilan
      (`data-probe="tampilan-menu"`), **bukan** ke `<body>`.
  - **Dua kegagalan e2e yang muncul saat pengerjaan ini** — keduanya bukan
    cacat kode, dan keduanya lolos saat dijalankan ulang:
    1. `home.spec.ts` › "anchor ChevronDown …" gagal **1×** pada suite penuh
       lalu hijau 6/6 saat dijalankan sendiri → flake gulir di bawah beban
       paralel (pola yang sama sudah terlihat di Fase 4).
    2. 5 tes gagal di satu suite penuh karena **saya mengubah berkas plan
       (`PLAN_F13_CANVAS_FULLSCREEN.md`) saat suite e2e sedang berjalan** —
       Vite HMR lalu memuat ulang halaman di tengah tes. Suite penuh
       dijalankan ulang tanpa menyentuh berkas apa pun → **182/182 hijau**.

---

### Fase 6 — Pengujian

- [x] **Fase 6 — Pengujian**

  - [x] **T6.1 Unit: `workspaceLayoutFor()`**

    - [x] Matriks lengkap §4: 5 rentang lebar × 2 mode × ATS buka/tutup. — blok baru `T6.1 — matriks penuh §4 (5 rentang × 2 mode × ATS buka/tutup)` di `tests/unit/workspaceLayout.test.ts`: 20 kombinasi (5 breakpoint × 2 mode × 2 `atsDocked`), masing-masing diperiksa grid, tinggi, visibilitas pane, `showTabs`/`showHomeAnchor`, `atsMode`, gaya inline ATS, plus `expectNoLeak`.
    - [x] Kasus `canvasFullscreen = false` saat `editMode = 'canvas'` → layout mode form (D2). — sudah ada sejak T1.1 (`D2 — preferensi layar penuh dimatikan`), hijau.
    - [x] Kasus `atsDocked = true` + `canvasFull` → `atsMode = 'overlay'`. — sudah ada sejak T1.1, hijau.
    - [x] Pastikan kelas yang dikembalikan tidak mengandung `undefined`/`false` yang bocor ke DOM. — `expectNoLeak()` kini dipanggil di **setiap** sel matriks penuh (20 kombinasi), bukan hanya di dua blok lama.

  - [x] **T6.2 Unit: `previewZoom`**

    - [x] `fitScaleFor` pada lebar 400 / 672 / 1024 / 1392 / 1872. — blok baru `T6.2 — fitScaleFor pada lebar 400/672/1024/1392/1872` di `tests/unit/previewZoom.test.ts`; 672 & 1024 sudah dikunci sejak T0.2/T2.1, yang ditambahkan: 400 (0,4433), 1392 (mode form dipotong ke 1,5 / kanvas 1,6927), 1872 (keduanya dipotong ke plafonnya).
    - [x] Batas: di bawah `MIN_ZOOM` → `0.3`; di atas `MAX_ZOOM_CANVAS` → `2.0`. — kasus batas bawah & atas (lebar 100 dan 3000) ada di blok T6.2 baru; batas atas kanvas juga sudah dikunci sejak T0.2.
    - [x] `maxZoomFor(true) === 2.0`, `maxZoomFor(false) === 1.5`. — sudah ada sejak T0.1, hijau.
    - [x] Regression anchor dari T0.2 tersimpan sebagai komentar/kasus uji. — header komentar T0.2 (bagian A–D) + kasus uji pengulangannya, utuh sejak Fase 0/2.

  - [x] **T6.3 Komponen: `AppShell`**

    - [x] `editMode='canvas'` + `canvasFullscreen=true` → `#pane-form` & rail `hidden`, `#pane-preview` terlihat & lebar penuh. — tes `mode kanvas: rail & formulir tersembunyi…` (`tests/unit/appShell.test.tsx`); kini **eksplisit** menyetel `canvasFullscreen: true` agar tidak bergantung pada default store.
    - [x] `editMode='form'` → tidak ada perubahan dari baseline (uji snapshot kelas grid). — tes `mode form: grid, tab bar, dan anchor beranda tetap seperti sebelumnya` (mengunci `lg:grid-cols-…`, `xl:grid-cols-…`, dan ketiga kelas tinggi), hijau.
    - [x] `HomeSections` tidak dirender saat kanvas; anchor `#home-templates` tidak ada. — assertion `#home-templates` null & `home-anchor` null di tes kanvas, hijau.
    - [x] `MobileTabBar` tidak dirender saat kanvas. — assertion `queryByRole('tablist')` null di tes kanvas, hijau.
    - [x] Gunakan `stubViewport()` yang sudah ada di `tests/unit/appShell.test.tsx:106`. — dipakai di kedua tes AppShell mode kanvas/form.

  - [x] **T6.4 E2E: `tests/e2e/canvas-fullscreen.spec.ts`** *(baru — dibuat Gate Fase 3, dilengkapi T6.4)*

    - [x] Pilih "Langsung di CV" lewat `TampilanMenu` → rail & formulir hilang, kertas memenuhi lebar. — tes `keluar lewat tombol…` + helper `toCanvasMode()` (jalur pengguna sungguhan), hijau.
    - [x] Skala fit > 1.5 pada viewport 1440 (buktikan lebar `[data-probe="page-sheet"]` terukur). — tes baru `skala kertas lewat dari 1,5 di 1440px`; terukur **1360px (skala 1,7128)** vs plafon mode form 1191px — lihat Catatan Fase 6.
    - [x] Klik teks di kertas → editor swap-in muncul & bisa diketik (regresi Fase 12). — tes baru `klik teks di kertas tetap membuka editor swap-in dan bisa diketik` (isi, fokus, commit), hijau.
    - [x] Ghost row "+ Tambahkan entri" masih berfungsi tanpa rail. — tes baru `ghost row "+ Tambahkan entri" tetap berfungsi tanpa rail`, hijau.
    - [x] Tombol "Keluar dari layar penuh" → rail & formulir kembali, `editMode` tetap `canvas`. — tes `keluar lewat tombol…` (Fase 3), hijau.
    - [x] Toggle "Kertas layar penuh" mati → reload → mode kanvas berpanel. — tes `preferensi layar penuh yang dimatikan bertahan setelah reload` (Fase 3), hijau.
    - [x] ATS: buka drawer pada 1600px+ → kertas tetap satu pane. — tes `ATS menjadi lapisan di 1680px…` (Fase 3), hijau.
    - [x] Reload pada mode kanvas → tetap layar penuh (persistensi). — paruh kedua tes preferensi (Fase 3), hijau.

  - [x] **T6.5 Regresi lintas fitur**

    - [x] Semua `tests/e2e/canvas-*.spec.ts` hijau (edit, entry, guides, mobile, ats, a11y). — suite penuh 185/185; keenam spec + `canvas-mode` + `canvas-fullscreen` hijau.
    - [x] `tests/e2e/responsive.spec.ts` hijau di 6 viewport. — hijau di kedua project (termasuk matriks kanvas Fase 4).
    - [x] `tests/e2e/shell.spec.ts` hijau. — hijau.
    - [x] `pnpm test:coverage` ≥ ambang 80% (konfigurasi `vite.config.ts:54–59`). — lines 96,48% · statements 94,64% · functions 93,73% · branches 87,96% (ambang 80%), hijau.
    - [x] `pnpm pdf:verify` tetap 174/174 (paritas PDF tidak tersentuh). — 174/174.

  - [x] **Gate Fase 6**

    - [x] `pnpm test` hijau, 0 tes dilewati (`skip`) tanpa alasan tertulis. — 62 berkas / 1116 tes hijau, dua run beruntun; `grep` `\.(skip|todo|only)\(` di `tests/` = 0 hasil.
    - [x] `pnpm test:e2e` hijau di chromium & mobile-chrome. — 185/185 (182 baseline + 3 tes T6.4 baru).
    - [x] Coverage tidak turun dari baseline. — Fase 6 hanya menambah tes; per-berkas Fase 13: `useWorkspaceLayout`/`previewZoom`/`useCanvasFull`/`CanvasExitButton` 100%, `useCanvasFocus` 95%, `SectionListNav` 88%, `CanvasSectionMenu` 86% — lihat Catatan Fase 6 soal baseline json yang basi.
    - [x] Tidak ada tes yang dihapus untuk membuat suite hijau. — nol tes dihapus/di-skip; dua tes ber-jeda tetap justru **diperkuat** menjadi `waitFor` (Catatan Fase 6).

  **Catatan Fase 6 (2026-10-21)**

  - **Angka terukur (T6.4/Gate Fase 2):** mode kanvas layar penuh di viewport 1440×900 —
    well 1440px, `[data-probe="page-sheet"]` **1360px = skala 1,7128**, vs plafon mode form
    1,5 (1191px). Identik dengan anchor Fase 2 (`artifacts/fase13/measure-fase2.json`);
    pengukuran ulang hari ini: `artifacts/fase13/measure-fase6.mjs`. Assertion E2E
    mengunci > 1191 dan ≥ 1350.
  - **Tiga tes E2E baru** di `tests/e2e/canvas-fullscreen.spec.ts` (T6.4): skala kertas
    > 1,5 di 1440px, editor swap-in tanpa rail, ghost row entri tanpa rail. Total suite
    e2e 182 → **185**, semua hijau di chromium & mobile-chrome.
  - **Dua tes unit baru** (`workspaceLayout.test.ts` matriks penuh 20 kombinasi;
    `previewZoom.test.ts` lima lebar well) → unit 1112 → **1116 tes**, hijau.
  - **Flake lama akhirnya diperbaiki di sini** (bukan dihindari): run pertama `pnpm test`
    gagal 1× di `tests/unit/storeGaps.test.ts › snapshot settled baru bergerak setelah
    debounce 60ms` (`expected … toBe(6)` — jeda tetap 90ms kalah dari debounce 60ms di
    mesin tertekan). Persis pola yang dicatat Fase 3 ("dipertahankan dengan `waitFor`
    di T6.5"). Perbaikan mengikuti catatan itu, **bukan menaikkan angka**: jeda tetap
    diganti `waitFor` pada kondisi nyata di kedua tes ber-jeda —
    `storeGaps.test.ts` (debounce settled) dan `canvasEdit.test.tsx › laporan tinggi
    ditahan selama sesi` (pengukuran awal; "expected undefined to be 120"). Assertion
    tidak dilonggarkan; yang "ditahan" kini dijaga lewat urutan timer (deterministik),
    yang "lepas" ditunggu sampai benar-benar lepas. Sesudahnya: dua run penuh beruntun
    hijau (62 berkas / 1116 tes).
  - **Baseline coverage json basi** — `coverage/coverage-summary.json` terakhir diambil
    sebelum berkas Fase 13 ada (tidak memuat `useWorkspaceLayout.ts` dkk), jadi agregat
    "total" tidak adil dibandingkan. Pembanding adil: `artifacts/fase13/coverage-compare.mjs`
    memisahkan berkas yang sudah ada di HEAD `b95b48a` dari berkas baru Fase 13. Hasil:
    berkas lama **+865 lines / +1013 statements / +257 functions / +657 branches
    tercakup** (total naik karena Fase 12–13 menambah kode, bukan karena Fase 6 —
    Fase 6 nol perubahan `src/`), dan berkas baru Fase 13 sendiri 85–100%. Ambang 80%
    lolos di keempat metrik.
  - `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm pdf:verify` 174/174 ✅.
  - Tidak ada tes dihapus, di-skip, atau dilonggarkan; tidak ada perubahan `src/` di
    fase ini (fase pengujian murni).

---

### Fase 7 — QA, performa, dokumentasi

- [x] **Fase 7 — QA, performa, dokumentasi**

  - [x] **T7.1 QA sweep manual**

    - [x] 1024 / 1280 / 1440 / 1920 / 2560: masuk & keluar mode, tidak ada layout rusak. — `artifacts/fase13-f7/qa-breakpoints.json`: satu kolom, rail & form `hidden`, `overflow-x` 0, toolbar di dalam well & viewport, mode form identik sebelum/sesudah (24 tangkapan layar).
    - [x] 360 / 390 / 768: masuk & keluar mode, tidak ada elemen terpotong. — tinggi 588/792/844 px, tanpa celah bawah (`#pane-preview` berakhir di atas `StickyActionBar`), `wellOverflowX` 0 saat `canvasFull`.
    - [x] Dokumen 1 halaman vs 3 halaman: gulir & penghitung halaman benar. — `qa-pagination.json`: `pendek` 1 hal; `panjang` 3 (form) / 4 (kanvas); `HAL 1/4 → HAL 4/4 → HAL 1/4`, gulir internal (`scrollHeight` 8076 vs `clientHeight` 844).
    - [x] Semua template: kertas tidak meluap, paritas PDF terjaga. — `qa-templates.json`: 5 template × {1440, 360}, kertas pas di kotak konten, `overflow-x` 0; `pnpm pdf:verify` **174/174**.
    - [x] Zoom manual 0.3 → 2.0: toolbar, `ScanSweep`, dan editor in-place tetap proporsional. — `qa-zoom.json` (30%→200%, tombol `+` berhenti di plafon), `qa-scan-sweep.json` (lebar/tinggi sweep = kontainer, ≤1 px), `qa-zoom-editor.json` (editor 657,9 px @100% → 1315,9 px @200%, rasio 2,000).

  - [x] **T7.2 Performa**

    - [x] Tidak ada CLS baru pada pergantian mode (diukur `PerformanceObserver layout-shift`; pergantian dipicu pengguna jadi seharusnya 0). — `qa-perf.json`: CLS (tanpa `hadRecentInput`) = **0** saat masuk kanvas, keluar, dan masuk lagi. **Temuan terpisah**: *cold load* dengan pref tersimpan = 1 shift 0,5001 (lihat §10.5 no. 1).
    - [x] LCP tidak memburuk: `HomeSections` di-unmount di kanvas, jadi chunk-nya tidak dimuat. — DOM = 0 simpul (`#home-templates` & anchor); namun pada **cold load** chunk tetap diminta karena prefs dibaca setelah paint + `modulepreload` di `dist/index.html` (Fase 8) — lihat §10.5 no. 1.
    - [x] Tidak ada render loop dari `ResizeObserver` fit (dipastikan di T2.2). — `qa-perf.json`: **0** panggilan balik selama 3 detik diam di mode kanvas.
    - [x] `pnpm build` — pastikan tidak ada chunk baru yang masuk ke bundle awal (`CanvasSectionMenu` harus ikut chunk shell, bukan chunk utama). — **nol chunk baru**: entry 866,97 kB / 259,56 kB gzip (Fase 12: 860,53 / 257,94 → +6,44 kB / +1,62 kB gzip); `CanvasSectionMenu` menyatu di entry; `HomeSections` tetap chunk lazy 21,17 kB.

  - [x] **T7.3 Dokumentasi**

    - [x] Perbarui `IMPLEMENTATION_PLAN.md` dengan baris FASE 13. — entri **FASE 13A** ditambahkan (slot `FASE 13` sudah terisi AI Assistant yang ditangguhkan; penomoran final menunggu owner) + 2 baris Execution Log + catatan matriks §2.4.
    - [x] Tulis `PLAN_F13_CANVAS_FULLSCREEN.md` bagian "Realisasi" setelah selesai (preseden `PLAN_F12_CANVAS_EDIT.md`). — §10 (status, peta modul, angka terukur, deviasi, temuan, cara ulang bukti).
    - [x] Perbarui `CANVAS_EDIT_PLAN.md` D1: catat bahwa `activeTab` kini diabaikan saat `canvasFull` (D1 lama menyatakan keduanya ortogonal). — amandemen FASE 13 ditulis di D1.
    - [x] Tambahkan catatan ke `README`/dokumen QA bila ada matriks layout yang terdampak. — tidak ada `README` di repo; matriks tata letak `IMPLEMENTATION_PLAN.md` §2.4 diberi paragraf "Varian tata letak: kertas layar penuh".

  - [x] **T7.4 Serah terima**

    - [x] Semua sub-tugas Fase 0–6 tercentang atau ditandai *(opsional)* dengan alasan. — audit: 201 kotak tercentang; yang tersisa sebelum Fase 7 hanyalah kelima jebakan §1.2, kini tercentang dengan bukti.
    - [x] Tangkapan layar "sesudah" tersimpan di `artifacts/` untuk 1024/1440/1920 + mobile. — `artifacts/fase13-f7/`: 48 tangkapan QA (8 breakpoint × 3 keadaan, 5 template × 2 viewport, pagination, zoom, sweep) + 3 debug.
    - [x] Daftar OQ (§8) ditinjau: setiap OQ punya keputusan atau ditunda eksplisit. — OQ-1…OQ-4 diberi keputusan Fase 7 + OQ-5 baru (temuan cold load).

  - [x] **Gate Fase 7 (penutup FASE 13)**

    - [x] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` hijau. — build exit 0; `tsc -b` 0 error; `eslint .` 0 warning; **62 berkas / 1116 tes** hijau.
    - [x] `pnpm test:e2e` hijau. — **185/185** (chromium + mobile-chrome).
    - [x] `pnpm pdf:verify` 174/174. — **174/174**.
    - [x] Tidak ada regresi mode form di kelima rentang lebar. — `grid-template-columns` & lebar kertas identik sebelum/sesudah di 1024/1280/1440/1920/2560 (§10.3).
    - [x] Mode kanvas layar penuh bekerja di semua breakpoint target §4. — 1024/1280/1440/1920/2560 + 360/390/768: satu kolom, tanpa overflow, tinggi pas.
    - [x] Dokumentasi diperbarui. — `IMPLEMENTATION_PLAN.md`, `CANVAS_EDIT_PLAN.md` D1, §10 dokumen ini.

---

## 6. Definisi selesai (global)

- [x] Memilih **"Langsung di CV"** menghasilkan satu pane: rail & panel formulir tidak tampak, kertas mengisi lebar workspace. — `grid-template-columns` satu kolom, `#pane-preview` = lebar penuh di 1024–2560 & 360–768 (§10.3).
- [x] Kertas benar-benar membesar (skala terukur > kondisi split sebelumnya), bukan sekadar ruang kosong bertambah. — 1360 px (**1,7128**) di 1440 px vs 1191 px (1,5) plafon mode form; 1588 px (2,0) di 1920/2560.
- [x] Semua kemampuan struktural yang hilang bersama rail tersedia lagi lewat toolbar. — menu **Bagian**: pilih, sembunyikan/tampilkan, naik/turun, hapus, tambah bagian (`tests/e2e/canvas-fullscreen.spec.ts`). *Di luar cakupan D12 & sudah tercatat:* duplikat bagian dan urut via drag-and-drop tetap hanya di rail.
- [x] Ada jalan keluar yang jelas dan mudah ditemukan, lewat mouse maupun keyboard. — tombol **Keluar** di toolbar (tooltip `canvas.fullscreenExitHint`), toggle **Kertas layar penuh**, dan mode **Form terpandu** di menu Tampilan; jalur keyboard terverifikasi `canvas-a11y.spec.ts` (urutan Tab & pemulihan fokus).
- [x] Mode form tidak berubah satu piksel pun. — `grid-template-columns` & lebar kertas identik sebelum/sesudah pergantian mode di kelima rentang lebar; `responsive.spec.ts` 6 viewport hijau.
- [x] Paritas PDF tidak tersentuh. — `pnpm pdf:verify` **174/174**.

---

## 7. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
| :-- | :-- | :-- |
| Grid auto-placement salah (§1.2) | Pratinjau malah menyusut ke 56px | T0.3 membuktikan dulu; T1.1/T1.2 mengubah grid & visibilitas **berpasangan**; T1.3 uji regresi |
| `MAX_ZOOM` mentok | "Layar penuh" terasa kosong | D10 + T2.1 + pembuktian terukur di Gate Fase 2 |
| Fokus hilang ke `<body>` | Keyboard tersesat | D13 + T5.1 + tes fokus eksplisit |
| Pengguna kehilangan akses urut/hapus bagian | Fitur terasa menyandera | D12 + T3.4 (`CanvasSectionMenu`) |
| `StickyActionBar` menutupi kertas di mobile | Bagian bawah kertas tak terjangkau | T4.1 menjaga `pb-[calc(64px+…)]`; T3.4 opsional menyembunyikan bar |
| `ResizeObserver` fit looping | CPU tinggi, kedipan skala | T2.2 mengatur dependency & recompute sinkron saat mode berubah |
| Tes Fase 12 yang menskop `#pane-preview` ikut berubah | Suite merah | T6.5 menjalankan semua `canvas-*.spec.ts`; skopnya ke `#pane-preview` yang tetap ada |
| Chunk `HomeSections` tetap dimuat | LCP memburuk | D7 unmount (bukan `hidden`) + T7.2 ukur |

---

## 8. Pertanyaan terbuka (OQ)

> **Tinjauan Fase 7 (2026-10-21):** keempat OQ di bawah **ditunda eksplisit** ke fase
> lanjutan — tidak ada yang diam-diam diputuskan. OQ-5 ditambahkan karena temuan Fase 7.

- [x] **OQ-1 — Apakah TopBar boleh ikut disembunyikan?** D5 mempertahankannya
      (Undo/Redo, status simpan, unduh PDF). Bila diinginkan benar-benar tanpa
      krom, tambahkan fase lanjutan "sembunyikan otomatis TopBar saat mengedit di
      kertas, muncul lagi saat pointer mendekati tepi atas". Belum masuk ruang
      lingkup Fase 13. — **Ditunda:** D5 dipertahankan sampai Fase 7; TopBar
      terbukti tetap menampung Undo/Redo, judul, template, status simpan, unduh PDF.
- [x] **OQ-2 — Apakah plafon 2.0 tepat?** 2.0 membuat A4 setara 1588×2246px —
      nyaman dibaca, tetapi satu halaman pasti perlu digulir. Kalau "satu halaman
      utuh tanpa gulir" lebih diutamakan, tambahkan preset **"1 halaman"**
      (fit-tinggi) eksplisit di toolbar, bukan mengganti fit bawaan (lihat D11).
      — **Ditunda:** plafon 2.0 dipertahankan (D10) dan terukur tercapai di
      1920/2560 px; preset "1 halaman" belum ditambahkan karena D11 menolak
      fit-tinggi sebagai bawaan.
- [x] **OQ-3 — Browser Fullscreen API?** D14 menolaknya untuk Fase 13. Bila
      diinginkan, butuh fase sendiri: tangani bentrok tombol `Esc` dengan
      pembatalan sesi kanvas (`CanvasFieldEditor`), serta penolakan izin.
      — **Ditunda (D14 dipertahankan):** yang diminta adalah tata letak satu pane,
      bukan mode layar penuh OS; `requestFullscreen` tidak dipanggil di mana pun.
- [x] **OQ-4 — Apakah rail perlu versi "sempit"?** Alih-alih disembunyikan total,
      rail bisa dipadatkan menjadi strip ikon yang muncul saat hover. D3
      menyembunyikan total demi kesederhanaan; `CanvasSectionMenu` (T3.4)
      menutup kebutuhan strukturalnya. — **Ditunda:** D3 dipertahankan; menu
      "Bagian" terbukti mengembalikan pilih/sembunyikan/urut/hapus/tambah.
      Catatan: **duplikat bagian** dan **urut via drag-and-drop** tetap hanya ada di
      rail (tidak diatur D12, belum ada padanannya di menu ini).
- [x] **OQ-5 (baru, temuan T7.2) — Perlukah preferensi dibaca sinkron sebelum
      paint?** Cold load dengan `canvasFullscreen` tersimpan menghasilkan 1
      `layout-shift` 0,5001 dan tetap meminta chunk `HomeSections`, karena prefs
      dibaca async dari IndexedDB setelah paint. Perbaikan butuh sumber pref
      sinkron (mis. mirror `localStorage` untuk `editMode` + `canvasFullscreen`)
      — **ditunda**, menunggu keputusan owner (rincian §10.5 no. 1).

---

## 9. Referensi cepat

| Butuh | File:baris |
| :-- | :-- |
| Grid workspace | `src/app/AppShell.tsx:80–93` |
| Urutan anak grid | `src/app/AppShell.tsx:95–107` |
| Penanda mode global | `src/app/AppShell.tsx:57–58` |
| State `editMode` | `src/store/uiStore.ts:13,31,46,58` |
| Persistensi prefs | `src/features/preview/usePreviewPrefs.ts:5–11,32–39,51–60` |
| Konstanta & rumus zoom | `src/app/shell/PreviewWell.tsx:23–32,72,82,131,142` |
| Kontainer berskala | `src/app/shell/PreviewWell.tsx:265–287` |
| Toolbar pratinjau | `src/app/shell/PreviewWell.tsx:156–263` |
| `<aside>` rail | `src/app/shell/Rail.tsx:440–443` |
| `id="pane-form"` | `src/app/shell/FormPane.tsx:34` |
| Tab mobile | `src/app/shell/MobileTabBar.tsx:33` |
| Bar bawah mobile | `src/app/shell/StickyActionBar.tsx:70` |
| Dock ATS | `src/features/ats/useAtsDock.ts:4`, `src/features/ats/components/AtsDrawer.tsx` |
| Guard zoom kanvas | `src/features/canvas/canvasZoom.ts:15–16` |
| Hook CSS mode kanvas | `src/styles/tokens.css:413+` |
| Kamus `tampilan.*` / `canvas.*` | `src/dictionaries/id.ts:197–210` |
| Tes layout utama | `tests/unit/appShell.test.tsx:715–767` |
| Tes mode kanvas E2E | `tests/e2e/canvas-mode.spec.ts` |

---

## 10. Realisasi *(2026-10-21 — Fase 0–7 & Gate Fase 7 hijau, FASE 13 tertutup)*

> Preseden `PLAN_F12_CANVAS_EDIT.md`: bagian ini menjawab "apa yang benar-benar dibangun, di file
> mana, dan dibuktikan oleh apa". Semua angka di bawah berasal dari skrip di
> `artifacts/fase13-f7/` terhadap build/dev server mesin ini — bukan perkiraan.

### 10.1 Status per fase

| Fase | Isi | Gate | Bukti utama |
| :-- | :-- | :-- | :-- |
| 0 | Ekstraksi `previewZoom.ts`, baseline lebar, spike jebakan grid | ✅ | `tests/unit/previewZoom.test.ts`, `artifacts/fase13/spike-hasil.json`, `measure-baseline.json` |
| 1 | `workspaceLayoutFor()` + `AppShell` satu kolom | ✅ | `tests/unit/workspaceLayout.test.ts`, `tests/unit/appShell.test.tsx`, `tests/e2e/responsive.spec.ts` |
| 2 | Plafon zoom 2.0 mode kanvas, recompute sinkron | ✅ | `artifacts/fase13-f6/skala-kertas-1440.png` (1360 px = 1,7128), `tests/e2e/canvas-fullscreen.spec.ts` |
| 3 | `canvasFullscreen`, tombol keluar, menu Bagian, ATS overlay | ✅ | `tests/e2e/canvas-fullscreen.spec.ts` (5), `tests/unit/canvasFullscreen.test.tsx` |
| 4 | Mobile & tablet: tinggi, toolbar ramping, sheet | ✅ | `tests/e2e/canvas-mobile.spec.ts`, matriks kanvas di `responsive.spec.ts` (3) |
| 5 | `useCanvasFocus`, live region, kamus, axe | ✅ | `tests/unit/canvasFocus.test.tsx` (4), `tests/e2e/canvas-a11y.spec.ts` (11), `tests/unit/contrast.test.ts` (+3) |
| 6 | Matriks uji penuh & regresi lintas fitur | ✅ | 62 berkas / **1116 tes** hijau, e2e **185/185**, coverage di atas ambang 80% |
| 7 | QA sweep, performa, dokumentasi | ✅ | `artifacts/fase13-f7/*.json` + 48 tangkapan layar, bagian §10 ini |

### 10.2 Peta modul terwujud

**Baru:** `src/app/useWorkspaceLayout.ts` (fungsi murni D4) · `src/features/preview/previewZoom.ts`
(konstanta & rumus D10/D11) · `src/app/useCanvasFull.ts` · `src/app/useCanvasFocus.ts` (D13) ·
`src/app/shell/CanvasSectionMenu.tsx` (D12) · `src/app/shell/SectionListNav.tsx` ·
`src/app/shell/CanvasExitButton.tsx` · tes `workspaceLayout.test.ts`, `previewZoom.test.ts`,
`canvasFocus.test.tsx`, `canvasFullscreen.test.tsx`, `previewCanvasZoom.test.tsx`,
`tests/e2e/canvas-fullscreen.spec.ts`.

**Diubah:** `AppShell.tsx` (grid & anak dari `workspaceLayoutFor()`, unmount `HomeSections`,
live region) · `PreviewWell.tsx` (plafon zoom, `tabIndex`, toolbar kanvas, padding `lg:p-10`) ·
`Rail.tsx` (prop `className`) · `StickyActionBar.tsx` · `TampilanMenu.tsx` · `TopBar.tsx` (sheet
bisa digulir) · `uiStore.ts` + `usePreviewPrefs.ts` (`canvasFullscreen`) · `AtsDrawer.tsx` +
`useAtsDock.ts` (D9) · `canvasZoom.ts` · `id.ts` (namespace `canvas.*`) · `tokens.css` ·
`sections/sonner.tsx`. Rincian per fase ada di §5 (Catatan Fase 0–6).

### 10.3 Angka terukur

**Matriks breakpoint** (`artifacts/fase13-f7/qa-breakpoints.json`) — mode form diukur dua kali
(sebelum masuk & sesudah keluar) untuk membuktikan nol regresi:

| Lebar | Mode form: kolom grid | Mode form: lebar kertas (skala) | Kanvas: kolom | Kanvas: lebar kertas (skala) |
| :-- | :-- | :-- | :-- | :-- |
| 1024×900 | `56px 484px 484px` | 436 px (0,5491) | `1024px` | **944 px (1,1889)** |
| 1280×900 | `248px 520px 512px` | 464 px (0,5844) | `1280px` | **1200 px (1,5113)** |
| 1440×900 | `248px 520px 672px` | 624 px (0,7859) | `1440px` | **1360 px (1,7128)** |
| 1920×1080 | `248px 520px 752px 400px` | 704 px (0,8866) | `1920px` | **1588 px (2,0)** |
| 2560×1440 | `248px 520px 1392px 400px` | 1191 px (1,5) | `2560px` | **1588 px (2,0)** |
| 360×640 | `360px` (tab) | 312 px (0,3929) | `360px` | 312 px (0,3929) |
| 390×844 | `390px` (tab) | 342 px (0,4307) | `390px` | 342 px (0,4307) |
| 768×900 | `768px` (tab) | 720 px (0,9068) | `768px` | 720 px (0,9068) |

- Mode form: lebar kertas & `grid-template-columns` **identik** sebelum dan sesudah pergantian mode
  di kelima rentang lebar (regresi nol).
- Kanvas: `overflow-x` dokumen = 0 dan `well.scrollWidth − clientWidth` = 0 di semua breakpoint;
  toolbar selalu di dalam well & viewport.
- Tinggi workspace kanvas: 360×640 → **588 px** (640−52), 390×844 → **792 px**, 768×900 →
  **844 px** (900−56) — tanpa celah di bawah kertas (`#pane-preview` berakhir tepat di atas
  `StickyActionBar`: 524 px + y=52 vs bar y=576).

**Pagination** (`qa-pagination.json`): `pendek` = 1 halaman; `sedang` = 2 (form) / 3 (kanvas);
`panjang` = 3 (form) / 4 (kanvas). Gulir ke dasar → `HAL 4 / 4`, kembali ke puncak → `HAL 1 / 4`;
`well.scrollHeight` 8076 px vs `clientHeight` 844 px (gulir internal, bukan dokumen).

**Lima template** × {1440, 360} (`qa-templates.json`): kertas selalu pas di kotak konten
(1360 px / 312 px), `overflow-x` = 0, penghitung halaman benar, nol galat konsol. Paritas PDF
dijaga oleh `pnpm pdf:verify` **174/174**.

**Zoom 0,3 → 2,0** (`qa-zoom.json`, `qa-zoom-editor.json`, `qa-scan-sweep.json`): 30% (238,2 px)
→ 200% (1588 px); tombol `+` menyerah sendiri di 200% (plafon aktif); toolbar tetap `sticky`
 top=96 dan di dalam well di seluruh rentang; `ScanSweep` punya lebar & tinggi **sama persis**
 dengan kontainer berskala pada 30/100/200% (selisih ≤1 px — beda posisi y semata karena animasi
 `translateY` 700 ms); editor swap-in proporsional: 657,9 px di 100% → **1315,9 px di 200%
 (rasio 2,000)**.

**Performa** (`qa-perf.json`, `qa-perf-cold.json`):
- CLS pergantian mode (entri tanpa `hadRecentInput`) = **0** — masuk kanvas, keluar, masuk lagi.
- Loop `ResizeObserver` fit: **0** panggilan selama 3 detik diam di mode kanvas.
- `pnpm build`: **nol chunk baru**; entry 866,97 kB / **259,56 kB gzip** (Fase 12: 860,53 kB /
  257,94 kB → **+6,44 kB / +1,62 kB gzip**); `CanvasSectionMenu` menyatu di entry (bukan chunk
  terpisah); `HomeSections` tetap chunk lazy sendiri (21,17 kB / 5,66 kB gzip).
- `HomeSections` **tidak** ada di DOM mode kanvas (`#home-templates` & anchor = 0 simpul).

### 10.4 Deviasi & keputusan teknis

| # | Keputusan | Alasan & bukti |
| :-- | :-- | :-- |
| 1 | Perampingan toolbar (`max-sm:hidden`) hanya saat `canvasFull` | Mode form wajib identik; terbukti lebar toolbar mode form 356,6 px di 360 px (tidak berubah) vs 304,5 px saat kanvas |
| 2 | Popover menu "Bagian" **336 px**, bukan 288 px | Pada 288 px nama bagian terpotong ("Pendid…"); batas 288 px di T3.2 milik popover Tampilan dan tetap utuh |
| 3 | Pemicu "Bagian" ikon saja di <1024 px | Menjaga lebar toolbar kanvas; `aria-label` dari kamus |
| 4 | `tampilan.modeCanvasDesc` **tidak** diubah | Deskripsi itu menjelaskan *cara kerja* mode, tetap benar dengan layar penuh hidup/mati; efek tata letak dijelaskan `canvas.fullscreenDesc` |
| 5 | `en.ts` tidak diisi *(opsional)* | Kamus `en` masih stub; P7 mengizinkan fallback `id` |
| 6 | Cincin fokus `#pane-preview` digambar di dalam tepi well | Cincin global 2px/offset 2px terpotong `overflow:hidden` workspace |

### 10.5 Temuan yang tidak ditutup fase ini

1. **Cold load dengan `canvasFullscreen` tersimpan → 1 layout-shift 0,5001** (t=1085 ms, FCP
   836 ms) dan chunk `HomeSections` tetap diminta (t=801 ms) lalu di-unmount. Mekanisme: prefs
   dibaca *async* dari IndexedDB **setelah** paint (`usePreviewPrefs.ts:28–56`), jadi bingkai
   pertama masih tata letak mode form; ditambah `modulepreload HomeSections-*.js` di
   `dist/index.html` (Fase 8, untuk crawler). Mekanismenya pre-existing, dampaknya membesar karena
   fase ini mengubah tata letak. Perbaikan butuh sumber pref sinkron — di luar plan ini.
2. **Mode kanvas berpanel (`canvasFullscreen=false`) di 360/390 px meluber 36/21 px** karena chip
   "3 HAL" (rencana kanvas 1 halaman lebih banyak dari mode form). Terbukti **pre-existing FASE
   12**: di keadaan itu `canvas-sections-menu` & `canvas-exit` tidak dirender, dan perandingan
   `max-sm:hidden` tidak aktif; HEAD `b95b48a` tidak punya perampingan sama sekali.
3. **Bentrok nomor fase**: dokumen ini memakai "FASE 13", tetapi slot itu di `IMPLEMENTATION_PLAN.md`
   sudah terisi AI Assistant (ditangguhkan 2026-10-20). Didaftarkan sebagai **FASE 13A** menunggu
   keputusan owner.

### 10.6 Cara menjalankan ulang bukti

```bash
pnpm dev --port 4173 --strictPort          # server untuk skrip ukur
node artifacts/fase13-f7/qa-breakpoints.mjs   > artifacts/fase13-f7/qa-breakpoints.json
node artifacts/fase13-f7/qa-pagination.mjs    > artifacts/fase13-f7/qa-pagination.json
node artifacts/fase13-f7/qa-templates.mjs     > artifacts/fase13-f7/qa-templates.json
node artifacts/fase13-f7/qa-zoom.mjs          > artifacts/fase13-f7/qa-zoom.json
node artifacts/fase13-f7/qa-zoom-editor.mjs   > artifacts/fase13-f7/qa-zoom-editor.json
node artifacts/fase13-f7/qa-scan-sweep.mjs    > artifacts/fase13-f7/qa-scan-sweep.json
node artifacts/fase13-f7/qa-perf.mjs          > artifacts/fase13-f7/qa-perf.json
node artifacts/fase13-f7/qa-perf-cold.mjs     > artifacts/fase13-f7/qa-perf-cold.json
```

Lalu Gate: `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e &&
pnpm pdf:verify`.

# PLAN — EDIT LANGSUNG DI CV (ON-CANVAS EDITING) — Vetra

> Dokumen ini adalah **master plan fitur**: mode pengerjaan CV alternatif di mana user mengedit
> isi CV **langsung di atas kertas pratinjau** (klik field → edit in-place, dengan *guide* placeholder
> per bagian pada setiap template), berdampingan dengan alur form terpandu yang ada sekarang.
> Pilihan mode hidup di dalam fitur **Tampilan**.
>
> Hubungan: turunan kebutuhan dari [plan.md](plan.md) (§3 Arsitektur UI/UX) dan memperluas
> [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Dokumen ini **belum** berisi langkah
> implementasi tingkat kode; setelah owner menyetujui keputusan desain (§3) dan memilih fase (§6),
> rincian per fase ditulis mengikuti konvensi rumah (`IMPLEMENTATION_PLAN.md:33`) sebagai
> `PLAN_F12_CANVAS_EDIT.md` (pecahan per sub-fase bila perlu).
>
> *2026-10-20 — draft v1 untuk review owner.*
> *2026-10-20 — revisi v2: keputusan owner atas seluruh Open Questions (§11) tercatat; fitur
> terdaftar sebagai **FASE 12** di `IMPLEMENTATION_PLAN.md` (AI Assistant ditangguhkan ke FASE 13);
> implementasi dibuka mulai Fase C1.*

---

## 0. Cara Pakai Dokumen Ini

1. **Jangan mulai implementasi sebelum owner memilih fase/task.** Tandai `- [x]` saat sebuah sub-task benar-benar selesai **dan** terverifikasi.
2. Setiap fase punya **Gate** (kriteria lulus) dan **Verifikasi** (perintah yang harus dijalankan). Fase berikutnya tidak boleh dimulai sebelum gate fase sebelumnya hijau.
3. Keputusan desain di [§3](#3-keputusan-desain-mengikat) bersifat **mengikat**. Kalau mau menyimpang, ubah dulu dokumen ini, baru kodenya.
4. Kolom **Status** di [Execution Log](#10-execution-log) diisi tiap kali sebuah fase dibuka/ditutup.
5. Cakupan yang sengaja ditunda dicatat di [§11 Open Questions](#11-open-questions-untuk-owner) — jangan dikerjakan diam-diam di luar fase.

---

## 1. Latar Belakang, Tujuan, Non-Goals

### 1.1 Latar belakang

- Referensi perilaku: editor Enhancv (screenshot owner, 2026-10-20) — field di atas kertas CV bisa
  diklik dan langsung diedit; field kosong menampilkan teks pemandu ("The role you are applying
  for?") sehingga user tahu apa yang harus diisi di tiap bagian.
- Vetra saat ini hanya punya satu alur pengerjaan: **form terpandu** di panel tengah
  (`src/app/shell/FormPane.tsx` + 10 editor di `src/features/editor/sections/`), sedangkan pratinjau
  di panel kanan **read-only**. Field kosong di kertas render sebagai kosong sama sekali
  (`contentLines.ts` membuang baris blank), sehingga kertas baru terlihat "bolong" tanpa petunjuk.
- Permintaan owner: sediakan **cara pembuatan CV langsung di CV-nya** sebagai pilihan, bukan
  pengganti. Masing-masing template harus menampilkan *guide* apa yang harus diisi per bagian
  (nama, role, tahun, dll). Pilihan alur hidup di fitur **Tampilan**.

### 1.2 Tujuan

1. User dapat memilih mode pengerjaan: **Form terpandaan** (UI sekarang) atau **Langsung di CV**
   (on-canvas), lewat satu kontrol di fitur **Tampilan**; pilihan persisten per perangkat.
2. Dalam mode Langsung, setiap field kosong di kertas menampilkan **guide placeholder** yang
   mengikuti layout template yang aktif (nama, headline, kontak, ringkasan, role, perusahaan,
   tanggal, bullet, skill, dst), dan field berisi menampilkan nilainya yang bisa diklik untuk diedit.
3. Edit in-place memakai pola yang sudah ada di repo (swap-in input ala `DocumentTitle.tsx`),
   menulis lewat path yang sama dengan form (`docStore.updateSection/updateEntry`) sehingga
   autosave, validasi zod, ATS checker, dan ekspor PDF tetap satu sumber kebenaran.
4. Paritas layar↔PDF tidak boleh regress: guide dan affordance edit **hanya ada di layar**,
   tidak pernah masuk PDF.

### 1.3 Non-Goals (v1)

- Bukan editor WYSIWYG bebas (drag teks, ubah layout per elemen, multi-kolom). Template tetap
  satu kolom dan layout dikunci `TemplateSpec` (prinsip ATS).
- Bukan pengganti form: form tetap ada, tetap jadi tempat reorder/hide/duplicate section & entry,
  dan tetap jadi tujuan lompatan "Perbaiki →" dari ATS checker.
- Tidak ada `contentEditable`, tidak ada rich-text baru, tidak ada perubahan pipeline PDF
  (`pdf-lib` vector drawing) maupun struktur `DocBlock`.
- Tidak menyentuh fase yang belum dikerjakan selain menarik **T11.1 undo/redo**
  (`IMPLEMENTATION_PLAN.md:1094-1096`) sebagai prasyarat (lihat D9).

---

## 2. Temuan Arsitektur Saat Ini (basis desain)

Ringkasan verifikasi codebase per 2026-10-20; nomor baris sesuai commit `9fee60e`.

### 2.1 Pratinjau adalah DOM, bukan canvas — substrat yang cocok untuk click-to-edit

- Rantai render: `PreviewWell` → `usePagination` → `createPagePlan` → `TemplateRenderer` →
  `PageSheet` → `BlockView` per blok (`src/features/preview/*`, `src/features/templates/screen/*`).
- `createPagePlan` (`src/features/preview/createPagePlan.ts:11`) adalah **satu-satunya** jalan
  yang dipakai bersama oleh preview layar, ekspor PDF, dan thumbnail — kontraknya `PagePlan`/
  `DocBlock` (`src/features/preview/pagination.ts:13-32`).
- Setiap blok sudah punya identitas stabil model **dan** DOM: `data-block-key` /
  `data-block-kind` di wrapper `BlockView.tsx:267-278`, dengan format key dari
  `blocks.ts` (`{profileId}:header` :96, `{sectionId}:summary` :117, `{sectionId}:{groupId}` :136,
  `{sectionId}:{itemId}:head` :168, `{sectionId}:{itemId}:l{lineIndex}` :181).
- Sub-komponen per kind di `BlockView.tsx` (Header :75, Heading :105, Summary :115,
  SkillGroup :128, EntryHead :155, EntryLine :209) masing-masing punya selector `useDocStore`
  sempit — satu keystroke hanya me-render ulang satu blok. **Invariant performa ini tidak boleh
  bocor** (Gate 4 Fase 9, `renderProbe.tsx`).

### 2.2 Empat kendala teknis yang membentuk desain

1. **String komposit.** `contentLines.ts:buildEntryContent` (:79) menghasilkan teks gabungan:
   experience `title = "role — company"` (:89), education `title = "degree, field"` (:99),
   kontak = `join(profileContact(...), ' · ')` (:174). Klik pada teks render tidak tahu field mana
   yang dimaksud user → butuh **segmentasi per field** khusus layar (D4).
2. **Loop pengukuran tinggi.** Wrapper blok adalah target ResizeObserver
   (`useMeasuredHeight.ts`) → `previewStore.scheduleHeight` (:45) → settle 60 ms
   (`useSettledHeights` :75) → `createPagePlan` ulang → blok bisa pindah halaman → elemen yang
   sedang diedit unmount. → butuh **pembekuan repaginasi selama sesi edit** (D6).
3. **Zoom = `transform: scale(zoom)`** pada wrapper dalam `PreviewWell.tsx:256-264`
   (origin top-left, ukuran luar dikalikan zoom). Overlay di dalam pohon ikut terskala (geometry
   gratis); overlay di luar harus mengalikan koordinat. → editor hidup **di dalam** pohon terskala
   + guard zoom minimum (D7).
4. **Teks terfragmentasi** oleh highlighter keyword (`MarkedText.tsx` memecah jadi `<span>`/
   `<mark>`). Nilai field **tidak boleh** dibaca dari `textContent`; selalu dari store (D4, D8).

### 2.3 State, persistensi, dan preferensi

- `docStore.ts`: satu path tulis `commit(updater, {coalesce})` (:105), `updateSection` (:121),
  `updateEntry` (:134), add/remove/duplicate/reorder entry & section; `history: ResumeDoc[]`
  terisi (:39-44, :117) tapi **undo/redo belum ada** (T11.1, `IMPLEMENTATION_PLAN.md:1096`).
- Autosave berbasis identitas doc (`features/persistence/autosave.ts:68`) → edit inline yang lewat
  `updateSection/updateEntry` otomatis tersave ke IndexedDB `ats:doc:v1`.
- `uiStore.ts` (diverifikasi penuh): `zoom, fitMode, panelMode, activeTab: 'form'|'preview',
  showMarginGuides, showKeywordMarks, atsDrawerOpen, atsTab, includeMarksInPdf, firstRunSeen`.
  **Belum ada konsep mode edit.**
- Preferensi preview persisten di `ats:prefs:v1` lewat `usePreviewPrefs.ts` dengan **whitelist
  eksplisit 4 field** (:5-10, :49) → field mode baru harus ditambah di whitelist ini.
- Dictionary: `src/dictionaries/id.ts` (938 baris) sumber kebenaran; placeholder form sudah ada
  (~30 key `*.Placeholder`, :456-589) tetapi **tidak ada guide per template / per blok kertas**;
  `en.ts` stub 22 baris, `t()` fallback ke `id` (prinsip P7).

### 2.4 Fitur "Tampilan" hari ini

- **Tidak ada permukaan desktop bernama "Tampilan".** Yang terdekat:
  - aria-label tablist mobile `'mobile.tabList': 'Mode tampilan'` (`id.ts:263`, dipakai
    `MobileTabBar.tsx`) — tab `Isi data` / `Pratinjau`;
  - toolbar sticky di `PreviewWell.tsx:150-254`: zoom in/out, popover preset 50/75/100/Fit,
    counter halaman, chip jumlah halaman, toggle penggaris margin, toggle stabilo keyword;
  - `ThemeMenu.tsx` (tema chrome aplikasi, bukan dokumen).
- Kesimpulan: fitur **Tampilan** harus **dibentuk/dikonsolidasikan** dulu sebagai popover berlabel
  "Tampilan" di toolbar pratinjau (+ padanan mobile), lalu pilihan mode pengerjaan hidup di
  dalamnya (D2).

### 2.5 Preseden interaksi yang harus dipakai ulang

- **Pola click-to-edit**: `DocumentTitle.tsx` — button nilai → swap ke `<input>` terkontrol,
  Enter/blur commit, Escape batal, kosong → revert + toast, auto focus+select (:17-42).
  Ini pola yang digeneralisasi (D3), menghindari `contentEditable` sepenuhnya.
- **Navigasi "masalah → field"**: `features/ats/focusTarget.ts:33` (set section aktif → tab form →
  scroll/focus/flash). Dipakai ulang untuk arah sebaliknya: dari form/ATS masuk ke sesi edit
  kanvas bila mode Langsung aktif (Fase C5).
- **Komponen tanggal**: `DateRangeField.tsx` + `MonthPicker.tsx` (form) — dipakai ulang di dalam
  popover editor tanggal on-canvas (Fase C4).
- **Ghost/empty state**: `components/ui/empty-state.tsx`, `FirstRunCard.tsx` — referensi nada
  copy untuk guide kertas (undang bertindak, bukan error).

---

## 3. Keputusan Desain (mengikat)

### D1 — Mode pengerjaan sebagai preferensi persisten

- Field baru `editMode: 'form' | 'canvas'` + `setEditMode` di `src/store/uiStore.ts`.
- Persisten di `ats:prefs:v1`: tambah `editMode` ke tipe `PreviewPrefs` dan whitelist
  `usePreviewPrefs.ts` (:5-10, :49). Default `'form'` (UI hari ini tidak berubah bagi user lama).
- `activeTab` tetap ortogonal: di mobile, `editMode='canvas'` + tab `Pratinjau` = kertas editable;
  tab `Isi data` tetap form.
- **Amandemen FASE 13 (kertas layar penuh, 2026-10-21)** — ortogonalitas itu kini punya satu
  pengecualian: saat `canvasFull = editMode === 'canvas' && canvasFullscreen`
  (`src/app/useWorkspaceLayout.ts`), `workspaceLayoutFor()` mengembalikan
  `showTabs = false` dan `previewClass = 'block'`, sehingga **tab bar tidak dirender dan
  `activeTab` diabaikan** — kertas mengisi satu pane penuh, tanpa rail & formulir.
  Di luar keadaan itu (`editMode='form'`, atau `canvasFullscreen = false`) perilaku
  `activeTab` **persis** seperti sebelum FASE 13; tidak ada perubahan di mode form.
  Rincian: `PLAN_F13_CANVAS_FULLSCREEN.md` §2 D1/D2/D4 dan §4 (matriks breakpoint).

### D2 — Fitur "Tampilan" = popover berlabel di toolbar pratinjau (+ padanan mobile)

- Komponen baru `src/app/shell/TampilanMenu.tsx`: popover (Radix `popover`, pola `ThemeMenu`)
  ber-trigger ikon + label **"Tampilan"** di toolbar sticky `PreviewWell` (desktop ≥1024px).
- Isi popover v1 (konsolidasi pengaturan tampilan yang hari ini tersebar):
  1. **Mode pengerjaan** — segmented radio: `Form terpandu` | `Langsung di CV` (inti fitur ini);
  2. toggle **Penggaris margin** (`showMarginGuides`);
  3. toggle **Stabilo keyword** (`showKeywordMarks`);
  4. toggle **Stabilo ikut ke PDF** (`includeMarksInPdf`);
  5. preset zoom (50/75/100/Fit) — tombol zoom in/out tetap di toolbar karena frekuensi pakai.
- Mobile (<1024px): entri **"Tampilan"** di sheet `MobileMenu` (`TopBar.tsx:66-171`) membuka
  `Sheet` berisi kontrol yang sama (pola reuse `ThemeOptionList`).
- Atribut `data-edit-mode="form|canvas"` di root `AppShell` (`AppShell.tsx:53` sudah punya
  `data-panel-mode`) sebagai hook CSS global untuk affordance kanvas (D15) tanpa prop drilling.
- Semua string lewat `t()` dengan namespace baru `tampilan.*` dan `canvas.*` di `dictionaries/id.ts`.

### D3 — Edit in-place = swap-in control, bukan contentEditable

- Field single-line → `<input>`; multi-line (summary, bullet) → `<textarea>` auto-grow baris.
- Siklus: klik/Enter pada target → control menggantikan teks (guide atau nilai), auto focus +
  select; **Enter** commit (input), **Ctrl/Cmd+Enter** commit (textarea), **Escape** batal,
  **blur** commit; kosong untuk field wajib → revert + toast (pola `DocumentTitle.tsx:29-42`).
- Validasi saat commit memakai schema zod yang sudah ada (`schema/resume.ts`); gagal → editor
  tetap terbuka, pesan error `role="alert"` di bawah control + `aria-invalid`.
- Alasan menolak `contentEditable`: teks terfragmentasi `MarkedText` (§2.2-4), IME/keyboard
  reliability, sulit validasi per field, dan risiko drift dengan model data (P4).

### D4 — Segmentasi per field khusus layar (PDF tidak berubah)

- Modul baru `src/features/templates/fieldSegments.ts`: untuk tiap `BlockKind`, menghasilkan
  `FieldSegment[] = { fieldPath, text, guideId? }` yang **direkonstruksi dari doc** (bukan dari
  string komposit) namun menghasilkan urutan teks + separator yang **identik** dengan
  `contentLines.ts` (mis. `"role — company"` = segment `role` + literal `" — "` + segment
  `company`), sehingga tinggi terukur dan paritas halaman tidak berubah.
- `BlockView.tsx` di `editMode='canvas'` merender segmen sebagai elemen interaktif ber-`data-field`
  (D11); di `editMode='form'` render persis seperti hari ini (satu string + `MarkedText`).
  Thumbnail (`TemplateThumbSheet`) selalu pakai jalur form (non-interaktif).
- `contentLines.ts` dan `ResumePdfLib.drawBlock` (:504) **tidak diubah** — PDF tetap mengonsumsi
  string komposit; jaminan paritas P4 terjaga.

### D5 — Guide placeholder di atas kertas, mengikuti layout tiap template

- Di `editMode='canvas'`, setiap segment yang nilainya kosong merender **guide**: teks pemandu
  (mis. "Nama lengkap", "Role yang kamu lamar", "Bulan mulai – selesai", "Satu bullet: aksi +
  dampak") dengan gaya *muted* milik template yang aktif (warna ink-tertiary dokumen, italic bila
  type role mengizinkan) sehingga guide tampil **di posisi dan gaya tiap template** secara otomatis
  — memenuhi "masing-masing template langsung ada guide".
- Teks guide = key dictionary `canvas.guide.*`. Keputusan owner 2026-10-20 (OQ2): satu set teks
  netral dipakai bersama bila memang sama; struktur override per-`TemplateId`
  (`canvas.guide.<templateId>.*` dengan fallback ke `canvas.guide.*`) disediakan dan hanya diisi
  bila isi guide memang perlu berbeda per template.
- Guide adalah target klik yang sama dengan nilai terisi (membuka editor field tersebut).
- Guide **tidak pernah** dirender di mode form, di thumbnail, maupun di PDF (gate verifikasi §7).

### D6 — Bekukan repaginasi selama sesi edit aktif

- Store sesi baru `src/store/canvasStore.ts`: `session: { blockKey, sectionId, entryId?, fieldPath, kind: 'input'|'textarea'|'dates'|'chips' } | null`,
  `openSession(...)`, `closeSession(...)`. Draft teks hidup di state lokal komponen editor
  (bukan store) agar keystroke tidak menyentuh store global.
- Selama `session != null`: `useMeasuredHeight` menahan `scheduleHeight` (gate di satu tempat),
  sehingga `useSettledHeights` membekukan plan terakhir dan blok yang diedit **tidak unmount**.
- Saat sesi ditutup (commit/batal): pengukuran dilepas; blok yang berubah tinggi terukur ulang dan
  repaginasi berjalan normal (reflow setelah commit adalah perilaku yang diharapkan).
- Blok bersesi ditandai `data-canvas-editing="true"` untuk CSS + test hook.

### D7 — Editor hidup di dalam pohon terskala + guard zoom minimum

- Control editor dirender **di dalam** wrapper berskala `PreviewWell.tsx:256-264` (mewarisi
  `transform: scale(zoom)`), sehingga posisi/lebar mengikuti kertas tanpa matematika koordinat.
- Guard usability: saat `openSession`, jika `zoom < 0.6` set zoom ke `0.75` sekali (toast info
  `canvas.zoomRaised`); tidak memaksa saat user memang memperkecil sesudahnya.
- Lebar control = lebar konten blok (100% kotak segment), bukan lebar viewport.

### D8 — Path tulis & validasi sama dengan form

- Commit memanggil `docStore.updateSection` / `updateEntry` (coalesce 150 ms sudah ada,
  `docStore.ts:43`) → autosave IndexedDB dan status save bekerja gratis.
- Nilai selalu dibaca dari selector store sempit per sub-komponen (bukan `textContent`, §2.2-4).
- Field tanggal menulis `ISOYearMonth` lewat popover `DateRangeField` yang dipakai ulang (C4).
- Item skill (chips) on-canvas: editor input teks bebas; commit memecah per koma mengikuti
  semantik `ChipsInput`/schema `skillGroupSchema` (trim, dedupe).

### D9 — Undo/redo adalah prasyarat (tarik T11.1 ke fase fondasi)

- Edit langsung di kertas menaikkan biaya salah ketik/salah commit; Ctrl+Z wajib ada sebelum mode
  ini dibuka ke user. Implementasi T11.1 (`IMPLEMENTATION_PLAN.md:1096`) memakai `history` yang
  sudah terisi: action `undo()/redo()` di `docStore`, tombol di TopBar + shortcut
  Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, disabled-state dari panjang history.
- Coalesce history disesuaikan agar satu sesi edit inline = satu langkah undo (jendela
  `EDIT_COALESCE_MS` sudah ada; sesi edit memakai satu `commit` per field sehingga natural).

### D10 — Operasi struktural on-canvas v1 = tambah saja (ghost row)

- Ghost row (hanya di mode canvas, hanya di layar):
  - akhir tiap section berisi entry: **"+ Tambahkan entri"** → `addEntry` + langsung buka sesi
    edit field pertama entri baru;
  - akhir bullet sebuah entry: **"+ Tambahkan bullet"** → push string kosong + buka sesi;
  - akhir dokumen: **"+ Tambahkan bagian"** → membuka Dialog katalog section yang sudah ada
    (`Rail.tsx:553`).
- Reorder / hide / duplicate / delete section & entry **tetap** di Rail/form untuk v1
  (OQ1 mencatat menu konteks hover sebagai kandidat v2).

### D11 — Aksesibilitas adalah floor (P8)

- Setiap segment editable (nilai atau guide) = `<button type="button">` bergaya teks dengan
  `aria-label={t('canvas.editField', { field })}`; urutan Tab mengikuti urutan dokumen.
- Focus-visible ring accent pada segment; saat sesi terbuka fokus pindah ke control; saat
  commit/batal fokus **kembali ke trigger**.
- Live region (`aria-live="polite"`) mengumumkan pergantian mode dan commit gagal.
- Gate: `tests/e2e/a11y.spec.ts` (axe WCAG2 A/AA, zero critical/serious) harus hijau **dalam kedua
  mode**, plus navigasi keyboard penuh di mode canvas.

### D12 — Paritas PDF & ATS tidak tersentuh

- Pipeline PDF (`exportPdf.ts` → `renderResumePdf.ts` → `ResumePdfLib.buildResumePdf`) tetap
  mengonsumsi `PagePlan` + string `contentLines`; guide/segment/ghost tidak punya representasi PDF.
- ATS checker membaca doc (bukan DOM) → tidak terpengaruh mode.
- Verifikasi wajib tiap fase yang menyentuh render: `pnpm pdf:verify` dan halaman dev
  `TemplateComparePage` (Δ ≤ 1 mm layar↔PDF).

### D13 — Performa: store sesi terpisah, tanpa prop baru ke BlockView

- `canvasStore` (D6) memisahkan state sesi dari `uiStore` sehingga hanya blok bersesi yang
  subscribe (`useCanvasStore(s => s.session?.blockKey === key)`); `editMode` dibaca sempit per
  sub-komponen yang butuh.
- Tidak menambah prop pada `BlockView`/sub-komponen (memo & selector sempit adalah invariant
  Gate 4); gaya hover/fokus lewat CSS attribute selector (D15).
- Gate: `renderProbe`/Profiler tidak menunjukkan regression commit duration vs baseline mode form.

### D14 — i18n & copy

- Namespace baru di `dictionaries/id.ts`: `tampilan.*` (menu, mode, toggle) dan `canvas.*`
  (guide, ghost row, toast, aria-label, error inline). Nada copy mengikuti §2.7 plan rumah:
  undangan bertindak, orang kedua, tanpa seruan ("Nama lengkap", bukan "Isi nama Anda di sini!").
- `en.ts` tetap stub (fallback `id`) sesuai P7 — tidak menambah beban terjemahan di fitur ini.

### D15 — Affordance visual mode canvas (screen-only)

- Hook CSS: `[data-edit-mode='canvas']` di root shell (D2).
- Segment editable: hover → outline 1px dashed `--color-accent-ink` + `cursor: text`;
  fokus → ring solid; guide kosong → teks muted + underline dotted halus.
- Ghost row: baris penuh lebar konten, dashed border, ikon plus, hover wash; tidak ikut terukur
  sebagai konten dokumen saat mode form (tidak dirender sama sekali di mode form).
- Motion mengikuti token durasi rumah (`--dur-fast`); hormati `prefers-reduced-motion`.

### D16 — Pengalaman dokumen kosong

- Mode canvas + doc kosong = guide membentuk "kerangka CV" yang menjelaskan dirinya sendiri
  (onboarding visual); ghost "+ Tambahkan bagian" menutup alur.
- `FirstRunCard` (pemilih sample/kosong) tetap di form pane; tidak diduplikasi di kanvas.

### D17 — Addendum FASE 13: zoom edit di layar sempit (khusushan mobile)

- **Latar belakang.** Di layar sempit (panel mode `tabs`, <1024px) kertas A4 tak pernah
  muat: pada 360px skala Fit hanya ±0,39, jadi teks di atas kertas setinggi ±4px —
  mustahil diedit dengan jari. D7 (guard zoom) menaikkan skala ke 75% **sekali saja
  per sesi aplikasi** dan tidak mengembalikannya; untuk layar kecil itu belum cukup:
  posisi field yang disentuh bisa jauh dari tengah layar.
- **Aturan baru (hanya panel mode `tabs`).** Menyentuh field → skala naik ke **75%**
  (tidak pernah memperkecil: kalau skaalanya sudah lebih besar, dibiarkan) **dan** field
  yang disentuh dipusatkan secara horizontal; selesai (commit) atau batal (Escape) →
  zoom **kembali** ke skala ringkasan yang tadi dipakai (biasanya 30% atau Fit).
- **Titik fokus di koordinat kertas.** Segmen dokumen bersifat `inline` (lebarnya = lebar
  teks), jadi kotak segmen = kotak teks yang disentuh. Koordinatnya disimpan dalam
  koordinat **kertas** (dibagi skala saat diukur) supaya tetap sahih setelah zoom
  berubah; sumbu horizontal = tengah segmen, sumbu vertikal = tepi atas segmen (supaya
  awal teks yang diketik terlihat, bukan tengah paragraf).
- **Desktop tidak berubah.** D7 tetap berlaku: naik ke 75% sekali per sesi aplikasi,
  tidak dikembalikan, tanpa pemusatan (kertas muat di layar, tidak ada masalah "kembali
  ke 30%").
- **Tanpa toast di layar sempit.** Toast mobile duduk 104px dari atas layar — persis di
  atas field yang baru disentuh, jadi ia menutupi teks yang sedang diketik. Nilai zoom
  di toolbar (`75%` → `30%`) yang memberi tahu. Toast D7 tetap ada di desktop (di sana
  toast duduk di kanan bawah, jauh dari kertas).
- **Zoom yang diubah user sendiri tidak ditimpa** saat sesi ditutup (restore hanya
  kalau skala masih sama seperti saat sesi dibuka).
- **Gulir horizontal pindah ke lapisan dalam** (`[data-probe="preview-scroll"]`):
  di 75% kertas 595px > layar ≤412px, jadi sumbu horizontal wajib digulir; kalau well
  ikut bergeser, toolbar (nilai zoom, "Tampilan", "Keluar") ikut keluar layar. Well
  tetap menggulir vertikal, toolbar tetap lengket di atasnya.
- **`focus({ preventScroll: true })`** pada editor: scroll bawaan browser
  ("scroll into view") akan menggulir tepi elemen dan membatalkan pemusatan.

---

## 4. Matriks Cakupan Edit per Blok & Field

Widget: `input` = swap-in input; `textarea` = swap-in textarea auto-grow; `dates` = popover
DateRangeField; `chips` = input teks pecah-koma; `—` = tidak editable on-canvas v1.

| BlockKind | Field (path model) | Widget | Guide (`canvas.guide.*`) | Fase |
| :-- | :-- | :-- | :-- | :-- |
| `header` | `profile.fullName` | input | fullName | C2 (guide) / C3 (edit) |
| `header` | `profile.headline` | input | headline | C2 / C3 |
| `header` | `profile.email`, `profile.phone`, `profile.location` | input | email / phone / location | C2 / C3 |
| `header` | `profile.links[i].url` | input | link | C2 / C3 |
| `section-heading` | label section (registry) | — | — (label sistem, kunci ATS) | — |
| `summary` | `summary.text` | textarea | summary | C2 / C3 |
| `skill-group` | `skills.groups[i].name` | input | skillGroupName | C2 / C3 |
| `skill-group` | `skills.groups[i].items` | chips | skillGroupItems | C2 / C3 |
| `entry-head` | experience: `role`, `company` | input | role / company | C2 / C4 |
| `entry-head` | education: `degree`, `field`, `institution` | input | degree / field / institution | C2 / C4 |
| `entry-head` | projects: `name`, `role`; certifications: `name`, `issuer`; languages: `name`; awards: `title`; volunteering: `role`, `organization` | input | per kind | C2 / C4 |
| `entry-head` | `location` (meta) | input | location | C2 / C4 |
| `entry-head` | `startDate`, `endDate`, `current` (meta) | dates | dates | C2 / C4 |
| `entry-line` | `bullets[lineIndex]` (experience/education/projects/volunteering) | textarea | bullet | C2 / C4 |
| ghost | tambah entri / bullet / bagian | button | — | C4 |

Catatan: pemetaan segment ↔ field mengikuti komposisi `contentLines.ts:buildEntryContent`
(:79-170); bila sebuah kind menyusun title dari >2 field, urutan segment = urutan `join`.

---

## 5. Spesifikasi UI/UX

### 5.1 Menu Tampilan (desktop ≥1024px)

- Posisi: toolbar sticky `PreviewWell`, setelah toggle stabilo; trigger = ikon `SlidersHorizontal`
  + label "Tampilan" (chip glass seperti kontrol toolbar lain).
- Popover lebar ±280px: seksi 1 "Mode pengerjaan" (segmented control 2 opsi + satu baris deskripsi
  per opsi), seksi 2 "Pratinjau" (3 toggle), seksi 3 "Zoom" (4 preset radio).
- Memilih mode tidak menutup popover (user mungkin mau lanjut mengatur); toast konfirmasi kecil
  saat berpindah ke canvas pertama kali per sesi (`canvas.modeHint`, sekali per session memory).

### 5.2 Mode canvas di kertas

- Kertas tetap objek paling terang (P3); affordance edit tidak menambah surface baru di kertas.
- Urutan Tab = urutan baca dokumen; segment guide ikut urutan Tab.
- Klik segment → editor muncul **menggantikan** teks segment (layout shift minimal: tinggi
  control = tinggi baris teks + padding 2px, lebar 100%).
- Error inline: teks 11px `--color-signal-danger` di bawah control + `role="alert"`.
- Ghost row berada **di dalam** area konten sheet tetapi di luar blok terukur (render setelah
  list blok, di dalam `PageSheet` terakhir saja untuk "+ Tambahkan bagian"; per section untuk
  entri/bullet) dan tidak mempengaruhi tinggi blok (posisi sendiri, tidak ikut `padAfterMm`).

### 5.3 Mobile (<1024px)

- Tab `Pratinjau` + `editMode='canvas'` = kanvas editable; tab bar menambah badge kecil pada tab
  Pratinjau saat mode canvas aktif.
- Target sentuh: segment guide/nilai mendapat area hit minimum 32px tinggi (padding transparan),
  ghost row 44px.
- Popover editor tanggal jadi `Sheet` bawah (pola sticky action bar), bukan popover melayang.
- Menu Tampilan mobile = entri di `MobileMenu` sheet (D2).

### 5.4 State & umpan balik

| State | Umpan balik |
| :-- | :-- |
| Hover segment | outline dashed + cursor text |
| Sesi terbuka | segment `data-canvas-editing`, repaginasi beku (D6) |
| Commit sukses | editor tertutup, nilai render, autosave pill berubah `saving→saved` |
| Commit invalid | editor tetap, error inline + aria-live |
| Commit kosong field wajib | revert + toast (pola DocumentTitle) |
| Undo tersedia | tombol TopBar enabled; Ctrl+Z mengembalikan isi field |

---

## 6. Fase Implementasi

> Penomoran rumah (keputusan owner 2026-10-20, OQ5): fitur ini terdaftar sebagai
> **FASE 12 — Edit Langsung di CV (On-Canvas Editing)** di `IMPLEMENTATION_PLAN.md`; AI Assistant
> yang semula Fase 12 ditangguhkan menjadi FASE 13. T11.1 undo/redo ditarik masuk ke C1 sebagai
> prasyarat. Rincian tingkat kode per fase ditulis di `PLAN_F12_CANVAS_EDIT.md` setelah fase
> terkait dibuka.

### ☑ FASE C1 — Prasyarat & Fondasi (undo/redo, store sesi, menu Tampilan, prefs) *(2026-10-20 — semua gate hijau)*

- [x] **C1.1 Undo/redo (tarik T11.1)** — action `undo/redo` di `docStore.ts` berbasis `history`
      (:39-44, :117) + stack `future`; tombol TopBar + shortcut Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
      (dilewati saat fokus di field teks); disabled-state; satu burst ketikan = satu langkah undo.
      *Realisasi: kapasitas tetap `HISTORY_LIMIT` 50; tanpa toast "Perubahan dibatalkan" — tombol
      Redo + Ctrl+Shift+Z menjadi jalan balik (deviasi tercatat di `IMPLEMENTATION_PLAN.md` T11.1).*
  - [x] unit test `tests/unit/docStore.test.ts` diperluas (undo setelah updateEntry, coalesce,
        putus cabang redo, guard `activeSectionId`)
  - [x] e2e: shortcut undo memulihkan isi field form (`canvas-mode.spec.ts`)
- [x] **C1.2 State mode & sesi** — `editMode`+`setEditMode` di `uiStore.ts`; store baru
      `src/store/canvasStore.ts` (session, openSession, closeSession, modeHintSeen); whitelist
      `editMode` di `usePreviewPrefs.ts` + tipe `PreviewPrefs`; `data-edit-mode` di root `AppShell`.
  - [x] unit test prefs round-trip — *ditempatkan di `tests/unit/tampilanMenu.test.tsx` bersama
        test menu; payload prefs lama di `previewMore.test.tsx` diperbarui menyertakan `editMode`*
- [x] **C1.3 Menu Tampilan** — `src/app/shell/TampilanMenu.tsx` (popover toolbar pratinjau +
      `TampilanMenuContent` dipakai sheet `MobileMenu` TopBar); konsolidasi toggle margin/stabilo/
      marks-pdf + preset zoom; segmented mode pengerjaan + toast hint sekali per sesi.
  - [x] string `tampilan.*` & `canvas.modeHint` di `dictionaries/id.ts`
  - [x] unit test: popover membuka, mode/toggle/zoom menulis uiStore, prefs menyimpan `editMode`
- [x] **C1.4 Test hook** — `data-probe="tampilan-menu"`, `data-probe="edit-mode"`,
      `data-probe="edit-mode-form|canvas"`, `data-probe="undo|redo"`.

**Gate Fase C1**

- [x] `pnpm typecheck && pnpm lint && pnpm test` hijau; test baru lulus (942 test / 51 file).
- [x] Mode bisa diganti dari menu Tampilan (popover desktop & sheet mobile memakai komponen yang
      sama; e2e desktop membuktikan persistensi reload) dan bertahan setelah reload.
- [x] Undo/redo berfungsi di mode form (prasyarat terbukti sebelum kanvas hidup).
- [x] Tidak ada perubahan visual pratinjau (mode canvas belum merender apa pun; shell/responsive
      e2e 39/39 tanpa regresi layout).

**Verifikasi:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, manual: reload → prefs bertahan.

---

### ☑ FASE C2 — Guide placeholder di atas kertas (read-only, per template) *(2026-10-20 — semua gate hijau)*

- [x] **C2.1 Segmentasi layar** — modul `src/features/templates/fieldSegments.ts`:
      `FieldSegment[]` per `BlockKind` sesuai matriks §4; teks+separator identik `contentLines.ts`.
      *Realisasi: `FieldSegment = { fieldPath, text, guideId? }` sesuai D4; pemisah literal
      (`' — '`, `' · '`, `', '`) dibawa **per baris** (`SegmentGroup`, bukan per segmen) karena
      pemisah adalah milik baris, bukan field — `compositeOf(group)` merekonstruksi string
      komposit `contentLines` persis (field kosong dibuang, pemisah hanya di antara isi).*
  - [x] unit test: untuk doc sampel, konkatenasi segment == string komposit `contentLines`
        (semua kind, semua template) — *`tests/unit/fieldSegments.test.ts` 19 test: header,
        ringkasan, skill-group, kepala entri (judul/meta/tanggal per `entryLayout`), baris
        entri, untuk kelima template*
- [x] **C2.2 Render segment & guide** — `BlockView.tsx` cabang `editMode='canvas'`: segment jadi
      button ber-`data-field`; nilai kosong → guide muted (`canvas.guide.*`); thumbnail & mode
      form tidak berubah.
      *Realisasi: cabang ada di `BlockView` (mode dibaca dari `uiStore`, tanpa prop baru —
      D13); salinan ber-`scope` (thumbnail, halaman pembanding) selalu jalur form. Guide
      dihitung dari `canvas.guide.*` dengan fallback override per template
      `canvas.guide.<templateId>.*` (OQ2) via `tMaybe` — kunci override sengaja belum diisi.*
  - [x] guide untuk header (nama/headline/kontak), summary, skill-group, entry-head, entry-line
  - [x] gaya guide per type role template (warna/italic dari `screenStyles.ts`) — *`roleOf` +
        `guideColor` (tinta tersier dokumen) di `screenStylesOf`; italic mengikuti role*
- [x] **C2.3 Ghost row belum aktif** (masuk C4); fase ini murni guide read-only + target klik
      yang belum membuka editor (klik = no-op dengan affordance hover saja).
      *Realisasi: segmen = `<button type="button">` tanpa aksi klik; affordance hover/focus
      murni CSS lewat `[data-edit-mode='canvas']` (D15).*
- [x] **C2.4 Paritas** — guide tidak masuk PDF: `pnpm pdf:verify` hijau; `TemplateComparePage`
      Δ ≤ 1 mm dengan mode canvas aktif.
      *Realisasi: jalur PDF (ekspor & `ResumePdfLib`) memakai **rencana isi** tanpa blok guide;
      hanya pratinjau mode kanvas memakai rencana ber-guide. `pdf:verify` 174/174; bukti Δ
      ≤ 1 mm + PDF bebas teks guide: `scripts/evidence-fase12-c2.mjs` → `artifacts/evidence/`.*
- [x] **C2.5 A11y dasar** — aria-label per segment, urutan Tab, focus-visible; axe hijau di mode
      canvas.
      *Realisasi: nama aksesibel = aksi + nama field + teks yang terlihat
      (`canvas.editField` / `canvas.fillField`) — **deviasi kecil dari D11**: tanpa teks
      terlihat, aturan "label in name" (axe `label-content-name-mismatch`, serius) gagal;
      nama aksesibel yang memuat teks terlihat tetap menyebut aksi & field. Axe 0 serious
      di mode kanvas (e2e `canvas-guides.spec.ts`).*

**Gate Fase C2**

- [x] Doc kosong di mode canvas menampilkan kerangka guide lengkap pada **kelima template**
      (ganti template → guide mengikuti layout).
      *Realisasi: dokumen kosong memakai **blok guide** pada rencana kanvas (header, satu
      blok per bagian, entri maya + bullet maya) — inilah "kerangka CV" (D16). Rencana
      isi (ATS, ekspor PDF) tetap tanpa blok guide.*
- [x] Mode form & thumbnail: nol guide, nol perubahan DOM vs baseline.
      *Bukti: unit `canvasGuides.test.tsx` (0 segmen di mode form & thumbnail) + e2e
      "mode form: nol guide di kertas dan thumbnail".*
- [x] `pnpm pdf:verify` + `pnpm test` + `pnpm test:e2e --grep preview` hijau.
      *`pnpm test` 965 test / 53 file · `pnpm pdf:verify` 174/174 · e2e `canvas-guides` 4/4 ·
      e2e penuh **114/114** (desktop + mobile-chrome).*

**Verifikasi:** `pnpm test`, `pnpm pdf:verify`, e2e baru `canvas-guides.spec.ts` (guide muncul per
template; tidak muncul di mode form).

> **Catatan parity untuk C3+ (wajib dibaca):** di mode kanvas, tinggi blok terukur di layar
> memuat teks guide, sedangkan exporter PDF memakai rencana **isi** yang sama. Akibatnya
> pemecahan halaman PDF yang diunduh *dari mode kanvas* bisa bergeser satu blok dibanding
> unduhan dari mode form (isi PDF tetap sama persis, guide tidak pernah ikut). Kalau C3/C4
> menemukan hal ini mengganggu, perbaikannya bukan "biarkan" atau "hapus guide", melainkan
> mengukur tinggi **tanpa** guide untuk kebutuhan mesin PDF — usul: plan PDF dihitung dari
> tinggi blok yang sudah dibekukan saat mode form (D6/C3 sudah menyiapkan pembekuan).


---

### ☑ FASE C3 — Edit inline field sederhana (header, summary, skill) *(2026-10-20 — semua gate hijau)*

- [x] **C3.1 Komponen editor** — `src/features/canvas/CanvasFieldEditor.tsx`: swap-in
      input/textarea (D3), commit/batal/blur, validasi zod + error inline, fokus kembali ke
      trigger, toast field-wajib-kosong.
      *Realisasi: kontrol swap-in = `<input>` (baris tunggal & daftar skill), `<textarea>`
      auto-grow (ringkasan); guide jadi **placeholder**, draft awal = nilai sebenarnya dari
      store. Enter commit (Ctrl/Cmd+Enter untuk textarea), Escape batal, blur commit.
      Validasi memakai schema zod yang sudah ada (`schema/resume.ts`: `profileSchema`,
      `linkItemSchema`, `summarySchema` — baru diekspor di C3 — `skillGroupSchema`); error
      milik field lain diabaikan supaya editor menolak **hanya** nilai yang sedang diedit.
      Gagal → editor tetap terbuka + `role="alert"` (11px, utilitas `text-error` baru) +
      `aria-invalid` + `aria-describedby`. Field wajib kosong → revert + toast
      `canvas.emptyRequired` (pola `DocumentTitle.tsx`); daftar field wajib diambil dari
      `registry.requiredFields` (`fullName`, `headline`, `email`, `phone`, `summary.text`,
      nama & items kelompok skill). Fokus kembali ke tombol pemicu saat sesi ditutup.*
  - [x] validasi error inline (satuan validasi dipakai bersama form — `canvasCommit.ts`)
  - [x] toast field-wajib-kosong + revert
- [x] **C3.2 Sesi & pembekuan repaginasi** — wiring `canvasStore.openSession/closeSession`;
      gate `scheduleHeight` selama sesi (D6); `data-canvas-editing`.
      *Realisasi: gate ada di **satu tempat** — `scheduleHeight` (`previewStore.ts`): selama
      `canvasStore.session != null` laporan tinggi **ditahan** (bukan dibuang) dan dilepas
      begitu sesi ditutup, sehingga rencana halaman membeku saat mengetik dan repaginasi
      normal berjalan sesudah commit. `data-canvas-editing="true"` pada wrapper blok
      (`BlockView`, selector sempit `s.session?.blockKey === props.blockKey` — D13). Kunci
      blok diturunkan dari path field (`canvasFields.blockKeyForField`) supaya tidak ada
      prop baru.*
  - [x] unit test: tinggi settle tidak berubah selama sesi; plan stabil
        — `tests/unit/canvasEdit.test.tsx` "laporan tinggi ditahan selama sesi": tinggi
        100.000 px tidak masuk store selama sesi, jumlah lembar tetap, node blok tidak
        berganti (tidak unmount), dan setelah sesi ditutup tinggi masuk & halaman
        repaginasi.
- [x] **C3.3 Guard zoom** — auto-raise ke 0.75 bila <0.6 saat openSession + toast (D7).
      *Realisasi: guard di `canvasZoom.ts`, dipanggil saat segmen diklik (sebelum
      `openSession`). Skala yang dibaca = **skala efektif** pohon pratinjau
      (`transform: scale()` pada `[data-probe="preview-content"]`), bukan nilai preferensi
      `uiStore.zoom` — mode Fit memakai skala yang dihitung dari lebar well, jadi nilai
      preferensi tidak bisa dipakai sebagai penentu. Naikkan **sekali** per sesi aplikasi
      (`canvasStore.zoomRaised`), jadi user yang memperkecil sesudahnya tidak dipaksa
      balik. Toast `canvas.zoomRaised`.*
- [x] **C3.4 Field tercakup C3** — `fullName`, `headline`, `email`, `phone`, `location`,
      `links[i].url`, `summary.text`, `skills.groups[i].name`, `skills.groups[i].items` (chips).
      *Realisasi: peta field di `canvasFields.ts` (path model = atribut `data-field`, D4) →
      target tulis + widget + aturan wajib. Penulisan lewat `docStore.updateSection` —
      jalur yang sama dengan form — sehingga autosave & save pill ikut (D8). Daftar skill
      dipecah per koma dengan semantik `ChipsInput` (trim, buang kosong, tanpa duplikat).
      Tautan dinormalkan seperti blur di form (`normalizeUrlInput`). Blok guide kelompok
      skill **tanpa grup** belum bisa diedit: menambah kelompok skill tidak ada di ghost
      row D10, jadi menambahnya tetap milik form.*
  - [x] commit menulis lewat `updateSection` (autosave & save pill terbukti)
  - [x] undo membatalkan satu commit field — jendela coalesce 150 ms diputus sebelum &
        sesudah commit kanvas (`docStore.breakEditCoalesce`), jadi satu sesi = satu langkah
        undo (D9) dan ketikan form berikutnya tidak menyatu dengan commit kanvas.
- [x] **C3.5 e2e alur edit** — `tests/e2e/canvas-edit.spec.ts`: klik guide nama → ketik → Enter →
      nilai render + tersimpan setelah reload; Escape batal; commit invalid menampilkan error.
      *8 test: commit + reload (tersimpan) · Escape batal · commit invalid (error + `aria-invalid`) ·
      field wajib kosong (toast + revert) · undo satu langkah · guard zoom 50% → 75% + toast ·
      dokumen hasil edit kanvas identik dengan hasil edit form (snapshot IndexedDB) · axe 0
      serious saat editor terbuka.*

**Gate Fase C3**

- [x] Edit semua field C3 dari kertas menghasilkan doc identik dengan mengisinya dari form
      (bandingkan snapshot doc).
      *Bukti unit `tests/unit/canvasEdit.test.tsx`: 9 field C3 diisi lewat editor kanvas,
      dokumen dibandingkan dengan dokumen yang diisi lewat `updateSection` (jalur form) —
      identik setelah `meta` (updatedAt) dibuang. Bukti e2e: profil diisi lewat form,
      lalu diisi lagi lewat kanvas → snapshot IndexedDB sama.*
- [x] Tidak ada unmount/reflow saat mengetik (sesi beku terbukti via probe tinggi).
      *Bukti unit: laporan tinggi 100.000 px selama sesi tidak masuk store, jumlah lembar
      tidak berubah, node blok yang diedit tetap sama (tidak unmount); setelah sesi ditutup
      pengukuran dilepas & halaman repaginasi.*
- [x] `pnpm test`, `pnpm test:e2e --grep canvas`, axe hijau kedua mode.
      *`pnpm test` **979 test / 54 file** hijau · `pnpm test:e2e` **122/122** (desktop +
      mobile-chrome; 8 test baru `canvas-edit.spec.ts`) · `pnpm typecheck` 0 error ·
      `pnpm lint` 0 warning · `pnpm pdf:verify` **174/174** · axe 0 serious di mode kanvas
      (editor terbuka, e2e baru) & mode form (e2e `a11y.spec.ts` tetap hijau).*

**Verifikasi:** `pnpm test`, `pnpm test:e2e`, `pnpm pdf:verify`.

---

### ☑ FASE C4 — Entry: segment title/meta, bullet, tanggal, ghost row
*(2026-10-20 — Gate 3/3 hijau. Temuan ghost row terpotong diselesaikan di **C5.1** dengan opsi A
yang disetujui owner: ruang ghost masuk anggaran halaman rencana kanvas saja.)*

- [x] **C4.1 Segment entry-head** — title & meta per kind sesuai matriks §4 (role/company,
      degree/field/institution, dst) termasuk separator literal.
      *Realisasi: segmentasinya sudah dibangun di C2 (`entryHeadGroups`); fase ini menyambung
      sisi tulisnya — `canvasFields.ts` mengenal path `entries.<kind>.<id>.<field>` → target
      `{ kind: 'entry-text', entryKind, entryId, field }` dengan whitelist field **persis**
      matriks §4, wajib diambil dari `sectionRegistry[].requiredFields`, dan menulis lewat
      `docStore.updateEntry` (jalur form, D8). Separator literal tidak berubah (`compositeOf`
      tetap == `contentLines`, dijaga `fieldSegments.test.ts`).
      **Entri maya** pada kerangka guide (`itemId = 'new'`, bagian yang masih kosong) sengaja
      tidak editable — entri itu belum ada di dokumen; pembuatannya lewat ghost row
      `+ Tambahkan entri` (D10), sama seperti kelompok skill maya pada C3.*
- [x] **C4.2 Editor tanggal** — popover `DateRangeField`+`MonthPicker` dipakai ulang; mobile =
      Sheet bawah; commit `startDate/endDate/current`.
      *Realisasi: `CanvasDatesEditor.tsx` — segmen tanggal bertukar jadi pemicu popover Radix
      yang berisi kontrol form yang sama. Bentuk popover ikut tanggal yang digambar dokumen
      (`datesShapeOf`): range+sakelar (pengalaman, kerelawanan), range tanpa sakelar (proyek —
      `DateRangeField` dapat prop baru `showCurrent`, default `true` sehingga form tidak
      berubah), satu tanggal memakai `MonthPicker` langsung (sertifikasi `issuedAt`,
      penghargaan `awardedAt`); pendidikan & bahasa tidak menampilkan tanggal → tidak ada
      target edit di kertas. Draft hidup di state lokal (D6/D13); tulis lewat `updateEntry`
      dengan `endDate` dibuang saat `current`, pers seperti form.*
      **Deviasi kecil dari D3**: siklus `blur commit` tidak berlaku untuk popover —
      commit = **Simpan** / **Enter**, batal = **Batal** / **Escape** / klik di luar
      (pola popover rumah: `ThemeMenu`, `TampilanMenu`). Menulis setiap perubahan tanggal
      langsung ke store akan memecah satu sesi jadi banyak langkah undo (bertentangan D9).*
- [x] **C4.3 Bullet** — `entry-line` editable (textarea satu baris auto-grow); Enter commit.
      *Realisasi: path `entries.<kind>.<id>.bullets[i]` / `.notes[i]` (pendidikan) → widget
      `textarea` dengan `enterCommits: true` (keputusan owner OQ6; ringkasan tetap
      Ctrl/Cmd+Enter sesuai D3). Commit kosong **membuang** baris dari model — sama seperti
      tombol hapus di `BulletListEditor`, dan barisnya memang tidak pernah digambar bila kosong.
      Supaya slot hasil ghost row punya blok sendiri di layar, daftar baris sisi kanvas
      (`fieldSegments.entryBodyLines`) ikut menghitung bullet kosong; `contentLines` (mesin
      isi → ATS, ekspor PDF) tidak disentuh, jadi `pdf:verify` tetap 174/174. Kunci blok
      bullet memakai indeks model (`{sectionId}:{itemId}:l{index}`) sehingga `blockKeyForField`
      dan marker `data-canvas-editing` tetap satu sumber (D6/D13).*
- [x] **C4.4 Ghost row** — "+ Tambahkan entri" per section entry, "+ Tambahkan bullet" per entry,
      "+ Tambahkan bagian" akhir dokumen (Dialog katalog `Rail.tsx:553` dipakai ulang); add →
      buka sesi edit field pertama.
      *Realisasi: `canvasGhosts.ts` (jangkar = blok TERAKHIR milik entri/bagian/dokumen,
      dihitung dari `plan.blocks` jadi tetap benar saat bagian berpindah halaman) +
      `CanvasGhostRow.tsx` yang dirender `TemplateRenderer` hanya saat mode kanvas tanpa
      `scope` (thumbnail & halaman pembanding bersih, §5.2). Entri baru → `addEntry` lalu sesi
      dibuka di field pertama matriks; bullet → dorong string kosong lalu sesi di slotnya;
      bagian → `uiStore.sectionCatalogOpen` yang baru, sehingga Dialog katalog rail (bukan
      duplikatnya) yang terbuka.*
  - [x] hormati `DOC_LIMITS` (`schema/resume.ts:20`) — ghost disabled + tooltip saat limit
        (`limits.entries` / `limits.bullets` milik form dipakai lagi; `addCanvasEntry`/
        `addCanvasBullet` juga menolak menulis, bukan cuma mematikan tombol)
  - ⛔ **Temuan (menunggu keputusan owner):** ghost row duduk *di dalam* kotak konten lembar
        (`overflow: hidden`), sedang halaman yang sudah penuh tidak menyisakan ruang — di
        dokumen kosong terukur ghost terakhir turun **77–136 px** melewati dasar kotak konten
        pada kelima template, dan di dokumen contoh blok terakhirnya sendiri sudah lewat
        **121 px** (efek tinggi terukur mode kanvas yang memuat teks guide — catatan parity di
        Gate C2; mode form: −16 px, aman). Angka bukti: `scripts/evidence-fase12-c4.mjs`
        23/28. Opsi yang bisa dipilih owner: (A) sisakan ruang ghost di anggaran halaman
        rencana kanvas, (B) render ghost di luar lembar (area well), (C) ghost hanya di halaman
        terakhir + aksi per-section pindah ke overlay hover rail, (D) terima apa adanya dan
        rapikan di C5. Tidak ada satu pun yang dikerjakan diam-diam di fase ini.
        *Keputusan owner 2026-10-20: **(A)** — diimplementasi di FASE 12 C5: pada pass kanvas,
        footprint blok yang menjadi jangkar ghost diperbesar estimasi tinggi ghost+marginnya,
        sehingga blok terakhir yang tidak muat pindah ke halaman baru bersama ghost-nya
        (rencana isi untuk ATS/PDF tidak tersentuh; lihat C5.1).*
- [x] **C4.5 e2e** — tambah entri dari kanvas → isi role/company/dates/bullet → PDF unduh
      memuat isi yang sama (`pdf:verify` teks).
      *Realisasi: `tests/e2e/canvas-entry.spec.ts` 5/5 — CV dari nol disusun sepenuhnya di
      kanvas (header+ringkasan+entri: role/company/dates/bullet) lalu bertahan setelah reload;
      isi entri hasil kanvas ada di teks PDF dan teks ghost/guide tidak; nol ghost & nol segmen
      interaktif di mode form; axe 0 serius dengan popover tanggal terbuka; ghost bagian
      membuka dialog katalog. Plus unit `tests/unit/canvasEntry.test.tsx` 25 test.*

**Gate Fase C4**

- [x] CV lengkap bisa dibuat dari nol **sepenuhnya di kanvas** (tanpa menyentuh form), kecuali
      reorder/hide/delete section-entry (memang v2, OQ1).
      *Bukti: e2e `canvas-entry.spec.ts` (dokumen kosong → header+ringkasan+entri pengalaman
      lengkap dengan tanggal & bullet, bertahan setelah reload) dan
      `scripts/evidence-fase12-c4.mjs` PASS A untuk **kelima** template.*
      Batas yang tercatat (bukan diam-diam): yang editable = **matriks §4** saja — `stack`,
      `url` proyek, `credentialId`, IPK, kemahiran bahasa, dan **tanggal pendidikan** tidak punya
      segmen di kertas (dokumen tidak menampilkannya / di luar matriks) sehingga tetap milik
      form; kelompok skill baru juga tetap dibuat di form (lihat catatan C3.4).
- [x] Paritas: doc hasil kanvas == doc hasil form untuk skrip isi yang sama.
      *Bukti unit `tests/unit/canvasEntry.test.tsx`: entri yang dibuat ghost row lalu diisi di
      kanvas (role/company/dates/bullet) dibandingkan dengan entri yang dibuat `addEntry` +
      `updateEntry` (jalur form) — identik setelah `id` dibuang, dan bagian dokumen lain tidak
      tersentuh. Bukti ujung-ke-ujung: teks yang diketik di kanvas muncul di PDF unduhan
      (`canvas-entry.spec.ts` + bukti PASS B `scripts/evidence-fase12-c4.mjs`).*
- [x] `pnpm test`, `pnpm test:e2e --grep canvas`, `pnpm pdf:verify` hijau.
      *`pnpm test` **1005 test / 55 file** · `pnpm test:e2e --grep canvas` **20/20** ·
      `pnpm test:e2e` penuh **127/127** (desktop + mobile-chrome) · `pnpm pdf:verify` **174/174** ·
      `pnpm typecheck` 0 error · `pnpm lint` 0 warning.*

**Verifikasi:** `pnpm test:e2e`, `pnpm pdf:verify`, manual lintas kelima template
(`scripts/evidence-fase12-c4.mjs` → `artifacts/evidence/c4-entry-<template>.png`,
`c4-canvas-export.pdf`, `fase12-c4.json`; **23/28** — lima pemeriksaan tambahan gagal karena
temuan ⛔ ghost row terpotong di halaman penuh, lihat catatan C4.4).

---

### ☑ FASE C5 — Mobile, lintas-fitur, hardening & dokumentasi rumah *(2026-10-20 — sub-task 6/6 & Gate 3/3 hijau; item performa dibuktikan lewat A/B baseline pada mesin yang sama — lihat §10)*

- [x] **C5.1 Mobile canvas** — target sentuh §5.3, badge tab, Sheet tanggal, Menu Tampilan mobile;
      e2e project `mobile-chrome` diperluas spec canvas.
      *Realisasi: `canvas-mobile.spec.ts` 4/4 di project `mobile-chrome` (badge tab Pratinjau
      ber-`aria-label` yang tetap memuat label terlihat; segmen ≥32px & ghost 44px diukur pada
      **ruang kertas**, jadi nilai §5.3 tidak terdistorsi zoom Fit; Sheet tanggal `data-side="bottom"`
      dengan probe & tombol yang sama seperti popover desktop; entri Tampilan di sheet Menu memakai
      `TampilanMenuContent` yang sama). Anggaran ghost opsi A (keputusan C4.4) ikut di fase ini:
      `canvasGhostExtraPxOf` → `paginateBlocks(…, extraPx)` membuat blok jangkar yang tidak muat
      pindah halaman **bersama** ghost-nya; rencana isi (ATS/PDF) tidak tersentuh sehingga
      `pdf:verify` tetap 174/174. Bukti: `tests/unit/canvasGhostBudget.test.ts`.*
- [x] **C5.2 Integrasi ATS** — "Perbaiki →" (`focusTarget.ts:33`) bila `editMode='canvas'`:
      set section aktif + buka sesi edit field target di kanvas (fallback form bila field tidak
      tercakup matriks).
      *Realisasi: `src/features/canvas/canvasAts.ts` — id field ATS diterjemahkan ke path model
      (`profile-email|phone|location`, `profile-link-url-<n>`, `skill-group-<id>-items`,
      `<exp|edu|proj|vol|cert|award>-<id>-bullet-<i>`, `<…>-<id>-dates-<start|end>`), lalu
      **divalidasi `canvasFieldSpecOf`** sehingga matriks §4 tetap satu-satunya otoritas. Target
      rusak (jenis bagian tidak cocok, entri tidak ada) dan field di luar matriks (tanggal
      pendidikan, IPB/stack/credentialId, dsb.) mengembalikan `null` → `AtsPanel.fix` memakai
      jalur form seperti T7.4. Sesi membuka tab pratinjau (penting di mobile), mengaktifkan bagian
      di rail/form, menggulir blok bersesi ke tengah well, dan tetap menghormati guard zoom (D7).
      Bukti: `tests/unit/canvasAts.test.tsx` 10 test (termasuk "setiap isu ber-field: resolusi
      kanvas hanya untuk path di matriks §4") + `tests/e2e/canvas-ats.spec.ts` 2/2 (isu tanggal
      membuka popover tanggal di kertas lalu commit menulis dokumen; tanggal pendidikan tetap
      berfokus di form).*
- [x] **C5.3 Performa** — benchmark `renderProbe`/Profiler mode canvas vs baseline form; tidak ada
      regression commit duration; bundle: `canvasStore`+editor tidak menambah chunk initial
      (lazy bila perlu).
      *Realisasi & angka (`scripts/evidence-fase12-c5.mjs` PASS A/B, dev server, dokumen contoh):
      Profiler 10 ketikan — **form 1340 render / 486 ms / 82 blok** vs **kanvas 20 render /
      14,5 ms / 1 blok dokumen** (draft hidup di komponen editor, store tidak disentuh per
      ketikan — D6/D13); **commit kanvas 243 render / 219 ms** (repaginasi setelah commit, wajar).
      Bundle awal (metode `evidence-fase9.mjs`) **290,89 KB gzip** — Δ **+11,88 KB** vs baseline
      Fase 9 (279,01 KB). **Lazy split editor diuji lebih dulu dan ditolak dengan angka**:
      index turun 249,79 → 216,36 KB tapi chunk bersama (`resume`/`docStore`/`registry`) tetap
      di-preload, total **291,53 KB** = +0,64 KB lebih berat; jadi editor tetap statis dan tidak
      ada `React.lazy`/Suspense yang menunda kemunculan kontrol (D3 tetap instan).*
- [x] **C5.4 A11y penuh** — keyboard end-to-end di kanvas (Tab/Enter/Esc/Ctrl+Z), live region,
      axe kedua mode + reduced-motion.
      *Realisasi: `tests/e2e/canvas-a11y.spec.ts` 4/4 — (1) keyboard penuh tanpa mouse: Tab dari
      kontrol terakhir toolbar masuk ke segmen pertama (`profile.fullName`), Enter membuka editor,
      ketik, Enter commit, fokus kembali ke pemicu, Tab lanjut ke segmen berikutnya, Ctrl+Z
      membatalkan satu commit; (2) live region `data-probe="edit-mode-announce"` di `AppShell`
      mengumumkan "Mode pengerjaan: …" untuk kedua arah (kunci baru `tampilan.modeAnnounce`);
      commit gagal tetap diumumkan `role="alert"` milik editor (D11); (3) `prefers-reduced-motion`
      mematikan durasi animasi/transisi segmen, ghost, dan kertas (<0,01 s); (4) axe WCAG2 A/AA
      0 critical/serious di mode kanvas (guide + ghost). Mode form tetap diaudit `a11y.spec.ts`
      (rute publik + drawer + keyboard + reduced-motion).*
- [x] **C5.5 Dokumentasi rumah** — daftarkan realisasi FASE 12 di `IMPLEMENTATION_PLAN.md` (§6 +
      §5 UI inventory: Menu Tampilan, affordance kanvas), tulis `PLAN_F12_CANVAS_EDIT.md` berisi
      realisasi per task, isi Execution Log kedua dokumen.
      *Realisasi: `PLAN_F12_CANVAS_EDIT.md` (peta modul, realisasi C1–C5, deviasi terukur, batas
      cakupan, cara menjalankan ulang bukti) · `IMPLEMENTATION_PLAN.md` §5.2 (Undo/Redo), §5.5
      (menu Tampilan + mode kanvas), §5.6 (`Perbaiki →` di kanvas), §5.7 (kanvas mobile) · §6
      FASE 12 ditutup ☑ + T12.5 · §9 Execution Log (baris C4, C5, deviasi).*
- [x] **C5.6 QA sweep** — matriks §7 dijalankan penuh; screenshot bukti per template per mode ke
      `artifacts/evidence/`.
      *Realisasi: `scripts/evidence-fase12-c5.mjs` **19/19** → `artifacts/evidence/c5-<template>-<mode>.png`
      (5 template × 2 mode), `c5-mobile-canvas.png`, `c5-canvas-export.pdf`, `fase12-c5.json`.
      Pemeriksaan: mode form 0 segmen & 0 ghost di kelima template, mode kanvas 46 segmen + 11 ghost,
      PDF hasil unduhan mode kanvas bebas teks guide/ghost tapi memuat isi dokumen, kanvas mobile
      Pixel 7 punya 46 segmen. Baris matriks §7 yang tidak mungkin difoto (fungsional, paginasi,
      paritas, persistensi, undo, i18n) dibuktikan suite otomatis: `canvas-edit`/`canvas-entry`/
      `canvas-ats`/`canvas-a11y`/`canvas-mobile`, `fieldSegments.test.ts`, `pdf:verify` 174/174,
      `a11y.spec.ts`.*

**Gate Fase C5**

- [x] e2e full suite hijau (desktop + mobile-chrome), termasuk a11y.
- [x] `pnpm build && pnpm lhci` tidak regress vs baseline Fase 9.
      **Terpenuhi — dibuktikan A/B pada mesin & jam yang sama** (worktree `9018a04` = baseline C1–C2
      vs working copy C1–C5, `pnpm build` + `pnpm lhci` bergantian, median 3 run/URL):

      | URL | C1–C5 (Perf · LCP · TBT) | C1–C2 (Perf · LCP · TBT) |
      | :-- | :-- | :-- |
      | `/` | **64** · 3.744 ms · **39 ms** | 63 · 3.889 ms · 33 ms |
      | `/templates` | 62 · 4.102 ms · 0 ms | 64 · 3.820 ms · 0 ms |
      | `/privacy` | 66 · 3.655 ms · 0 ms | 65 · 3.657 ms · 0 ms |

      A11y/BP/SEO **1,00** dan CLS ≤0,0003 di kedua sisi. Selisih yang tersisa ada di dalam noise
      run-to-run (±2 poin Perf, ±300 ms LCP). **Catatan penting:** dua run `lhci` sebelumnya di sesi
      yang sama terbaca Perf 0,51 / TBT 271 ms untuk `/` — angka itu **drift lingkungan** (mesin
      sedang menjalankan suite e2e/unit/rebuild berturut-turut), bukan regresi kode; run A/B di atas
      membantahnya dengan baseline yang diukur ulang hari itu juga.
- [x] Execution Log & UI inventory rumah terupdate; fitur tertutup sebagai FASE 12 ☑
      *(revisi redaksi disetujui owner 2026-10-20 — frasa "FASE 13" adalah sisa draft v1;
      AI Assistant tetap FASE 13 yang ditangguhkan).*

**Verifikasi:** `pnpm test:e2e`, `pnpm build`, `pnpm lhci`, `pnpm pdf:verify`.

---

## 7. QA Matrix (tambahan untuk fitur ini)

| Area | Skenario | Alat | Fase |
| :-- | :-- | :-- | :-- |
| Fungsional | Edit tiap field matriks §4 dari kanvas == dari form | e2e `canvas-edit.spec.ts` | C3/C4 |
| Guide | Doc kosong → guide lengkap di 5 template; mode form & PDF bersih guide | e2e `canvas-guides.spec.ts` + `pdf:verify` | C2 |
| Paginasi | Mengetik tidak memicu reflow; commit panjang memicu repaginasi wajar | unit preview + probe tinggi | C3 |
| Paritas | Δ layar↔PDF ≤1 mm dengan mode canvas aktif | `pdf:verify`, `TemplateComparePage` | C2-C4 |
| Persistensi | `editMode` bertahan reload; doc autosave saat edit kanvas | unit prefs/persistence + e2e | C1/C3 |
| Undo | Ctrl+Z membatalkan commit kanvas satu langkah | unit docStore + e2e | C1/C3 |
| A11y | axe zero critical/serious kedua mode; keyboard penuh; live region | `a11y.spec.ts` | C2-C5 |
| Performa | commit duration & bundle tidak regress vs baseline | renderProbe/Profiler, build | C5 |
| Mobile | kanvas usable di Pixel 7 (target sentuh, Sheet tanggal) | e2e mobile-chrome | C5 |
| i18n | nol string hardcoded di luar `dictionaries/` | grep gate Execution Log | semua |

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| :-- | :-- | :-- |
| Loop ukur-tinggi ↔ repaginasi membuat editor unmount saat mengetik | Blok C3/C4 | D6: bekukan `scheduleHeight` selama sesi; unit test plan-stabil |
| Segmentasi teks drift dari `contentLines` → tinggi/paritas berubah | Paritas PDF | C2.1: unit test konkatenasi segment == string komposit per template; `pdf:verify` per gate |
| Regression memo/performa `BlockView` karena state mode | Performa | D13: store sesi terpisah, selector sempit, tanpa prop baru; gate Profiler C5 |
| User salah hapus/salah timpa tanpa undo | Data | D9: undo/redo wajib hidup di C1 sebelum kanvas dibuka |
| Guide dianggap konten oleh user/ATS/PDF | Kepercayaan | D5/D12: guide screen-only, gate `pdf:verify` + e2e mode form bersih |
| Zoom kecil membuat editor tak terbaca | Usability | D7: auto-raise zoom minimum saat openSession |
| Scope creep ke WYSIWYG penuh | Jadwal | §1.3 non-goals + OQ1 mencatat v2 secara eksplisit |
| String UI bocor hardcoded | i18n P7 | D14 + grep gate di Execution Log tiap fase |

---

## 9. Definition of Done — Fitur

- [ ] Kedua mode pengerjaan tersedia dari menu **Tampilan** (desktop popover + mobile sheet) dan persisten.
- [ ] Mode canvas: guide per field kosong pada kelima template; edit in-place seluruh matriks §4; ghost tambah entri/bullet/bagian; undo/redo berfungsi.
- [ ] Mode form: tidak berubah perilaku maupun DOM vs baseline pra-fitur (terbukti e2e/unit).
- [ ] PDF: `pnpm pdf:verify` hijau; guide/affordance tidak pernah masuk berkas; Δ layar↔PDF ≤1 mm.
- [ ] A11y: axe zero critical/serious di kedua mode; keyboard end-to-end; live region.
- [ ] Performa: tidak ada regression commit duration/bundle vs baseline (bukti di Execution Log).
- [ ] i18n: semua string lewat `t()`; namespace `tampilan.*` & `canvas.*` lengkap di `id.ts`.
- [ ] Dokumentasi rumah: FASE 12 terdaftar di `IMPLEMENTATION_PLAN.md`, `PLAN_F12_CANVAS_EDIT.md` terisi, Execution Log kedua dokumen terupdate, bukti di `artifacts/evidence/`.

---

## 10. Execution Log

| tanggal | fase | task/gate | bukti (perintah, angka, path artefak) | status |
| :-- | :-- | :-- | :-- | :-- |
| 2026-10-20 | — | draft plan v1 | eksplorasi codebase (commit `9fee60e`); dokumen ini | 🟡 menunggu review owner |
| 2026-10-20 | — | keputusan owner atas OQ 1–6 | jawaban tertulis owner di sesi chat; §11 ditandai RESOLVED; renumber FASE 12 + penangguhan AI Assistant dicatat di `IMPLEMENTATION_PLAN.md` §6/§9/§11 | ✅ Keputusan |
| 2026-10-20 | C1 | C1.1–C1.4 + Gate C1 | `pnpm typecheck` 0 error · `pnpm lint` 0 warning · `pnpm test` **942 test / 51 file** hijau (baru: undo/redo docStore 7 test, tampilanMenu 5 test, prefs `editMode` diperluas) · `pnpm build` exit 0 (index 220,89 KB gzip) · e2e `canvas-mode.spec.ts` **3/3** (mode bertahan setelah reload; tombol undo/redo; Ctrl+Z di luar field) · rerun `shell.spec`+`responsive.spec` **39/39**. Run e2e penuh pertama: 104 lulus + 6 gagal yang semuanya infra (`net::ERR_NETWORK_IO_SUSPENDED` / timeout `page.goto` pada run 48,8 menit saat beban mesin tidak wajar) — spec terkait hijau saat rerun. Deviasi tercatat: undo/redo snapshot `history`+`future` (kapasitas 50), tanpa toast batal; test prefs round-trip hidup di `tampilanMenu.test.tsx`. | ✅ Selesai & terverifikasi |
| 2026-10-20 | C2 | C2.1–C2.5 + Gate C2 | `pnpm typecheck` 0 error · `pnpm lint` 0 warning · `pnpm test` **965 test / 53 file** hijau (baru: `fieldSegments.test.ts` 19 test paritas komposit × 5 template · `canvasGuides.test.tsx` 4 test render guide) · `pnpm pdf:verify` **174/174** (guide tidak masuk jalur PDF) · `pnpm build` exit 0 (index 223,62 KB gzip, +2,73 KB vs C1 — pemecahan chunk lazy editor/coverage ditetapkan di C5.3) · e2e **114/114** (baru `canvas-guides.spec.ts` 4/4: kerangka guide di dokumen kosong × 5 template; guide mengikuti layout template; mode form & thumbnail nol guide; axe 0 serious di mode kanvas) · bukti Δ & PDF bebas guide: `scripts/evidence-fase12-c2.mjs` **13/13** → `artifacts/evidence/c2-*.png` + `fase12-c2.json` (Δ kiri 0 mm / executive 0,33 mm; atas 0 mm kelima template). Realisasi: `fieldSegments.ts` (pemisah dibawa per baris, bukan per segmen) · blok guide hanya di rencana kanvas (`buildBlocks(doc, spec, { guides: true })`); ATS & ekspor PDF tetap memakai rencana isi · `aria-label` diperluas `{value}` + kunci `canvas.fillField` agar aturan "label in name" axe lulus. Catatan parity PDF (tertulis di §6 C2): unduhan PDF dari mode kanvas bisa berbeda pemecahan halamannya dari mode form karena tinggi terukur di layar memuat teks guide — isi PDF tetap sama persis. | ✅ Selesai & terverifikasi |
| 2026-10-20 | C3 | C3.1–C3.5 + Gate C3 | `pnpm typecheck` 0 error · `pnpm lint` 0 warning · `pnpm test` **979 test / 54 file** hijau (baru: `tests/unit/canvasEdit.test.tsx` 14 test — editor swap-in, Enter/Escape/blur commit, error zod inline, toast field wajib, guard zoom, pembekuan tinggi, undo satu langkah, paritas kanvas↔form) · `pnpm pdf:verify` **174/174** (guide & editor tidak masuk jalur PDF) · e2e **122/122** desktop + mobile-chrome (baru `tests/e2e/canvas-edit.spec.ts` 8/8: commit + reload, Escape batal, commit invalid, field wajib kosong, undo, guard zoom 50%→75%, snapshot doc kanvas == form, axe 0 serious dengan editor terbuka). Realisasi: `CanvasFieldEditor.tsx` (swap-in; guide jadi placeholder) + `canvasFields.ts` (peta path→target) + `canvasCommit.ts` (validasi zod & tulis lewat `updateSection`) + `canvasZoom.ts` (guard skala efektif dari `transform: scale()`) · gate tinggi di `scheduleHeight` (`previewStore.ts`) menahan laporan selama sesi & melepasnya saat sesi ditutup · `docStore.breakEditCoalesce()` agar satu sesi = satu langkah undo (D9) · `summarySchema` diekspor dari `schema/resume.ts` · utilitas `text-error` 11px baru di `tokens.css` · `sectionId` diteruskan ke segmen (konstan per blok; dibutuhkan untuk membedakan section duplikat) · blok guide kelompok skill tanpa grup belum editable (ghost row kelompok skill tidak ada di D10). | ✅ Selesai & terverifikasi |
| 2026-10-20 | C4 | C4.1–C4.5 + Gate C4 | `pnpm typecheck` 0 error · `pnpm lint` 0 warning · `pnpm test` **1005 test / 55 file** hijau (baru: `tests/unit/canvasEntry.test.tsx` 25 test — kepala entri, popover tanggal, bullet, ghost row, batas `DOC_LIMITS`, paritas kanvas↔form; `tests/unit/fieldSegments.test.ts` +1 test pemetaan bullet kosong ke indeks model; `tests/unit/railMore.test.tsx` menormalkan `sectionCatalogOpen` yang kini state store) · `pnpm pdf:verify` **174/174** · `pnpm test:e2e --grep canvas` **20/20** · `pnpm test:e2e` penuh **127/127** desktop + mobile-chrome (baru `tests/e2e/canvas-entry.spec.ts` 5/5) · bukti lintas template: `scripts/evidence-fase12-c4.mjs` **23/28** → `artifacts/evidence/c4-entry-<template>.png` (5), `c4-canvas-export.pdf`, `fase12-c4.json`. Realisasi: `canvasFields.ts` (path `entries.<kind>.<id>.*` → target `entry-text`/`entry-dates`/`entry-bullet`, wajib dari `sectionRegistry`, entri maya `new` inert) · `canvasCommit.ts` (`updateEntry`, validasi via `parseEntry` per skema, `validateCanvasDates`/`writeCanvasDates`, `addCanvasEntry`/`addCanvasBullet` menolak lewat batas) · `CanvasDatesEditor.tsx` (popover memakai ulang `DateRangeField`+`MonthPicker`; `DateRangeField` dapat `showCurrent`; deviasi kecil D3: commit = Simpan/Enter, batal = Batal/Escape/klik-luar — bukan blur) · bullet: `entryBodyLines` sisi kanvas ikut menghitung baris kosong supaya slot hasil ghost punya blok sendiri, `contentLines`/PDF tak disentuh; Enter commit (OQ6); commit kosong membuang baris · `canvasGhosts.ts` + `CanvasGhostRow.tsx` (jangkar blok terakhir entri/bagian/dokumen; dialog katalog rail dipakai ulang lewat `uiStore.sectionCatalogOpen`; ghost disabled + tooltip `limits.*`) · `TemplateRenderer` merender ghost hanya untuk pratinjau mode kanvas tanpa `scope`. ⛔ Temuan (menunggu owner): ghost row di dalam kotak konten lembar terpotong saat halaman penuh — terukur 77–136 px di bawah dasar kotak konten pada dokumen kosong (kelima template) dan blok terakhir mode kanvas sendiri sudah lewat 121 px pada dokumen contoh (efek tinggi terukur yang memuat teks guide; mode form −16 px aman). Opsi: (A) sisakan ruang ghost di anggaran halaman rencana kanvas, (B) ghost di luar lembar, (C) ghost hanya halaman terakhir + aksi per-section ke overlay hover rail, (D) terima & rapikan di C5. | 🟡 Gate 3/3 hijau; 1 temuan kualitas ⛔ menunggu keputusan owner |
| 2026-10-20 | C4 (tindak lanjut) | Temuan ghost row terpotong → opsi A | Owner memilih opsi **A** (ruang ghost masuk anggaran halaman rencana kanvas). Dikerjakan di C5.1: `canvasGhosts.ts` mengekspor `canvasGhostExtraPxOf(blocks)`, `paginateBlocks` menerima `extraPx(block)`, `createPagePlan` hanya mengaktifkannya saat `options.guides === true`. Pass isi (ATS tape & ekspor PDF) tidak memakai `guides`, jadi pembagian halaman PDF tidak berubah — `pnpm pdf:verify` tetap **174/174**. Bukti: `tests/unit/canvasGhostBudget.test.ts` (4 test) + `canvas-mobile.spec.ts` (ghost 44px di dalam kotak konten). | ✅ Selesai & terverifikasi |
| 2026-10-20 | C5 | C5.1–C5.6 + Gate C5 (2/3) | `pnpm typecheck` 0 error · `pnpm lint` 0 warning · `pnpm test` **1023 test / 57 file** hijau · `pnpm pdf:verify` **174/174** · `pnpm build` exit 0 (index 860,53 kB / **257,94 kB gzip**; SW precache 52 URL) · `pnpm test:e2e` **157/157** (chromium + mobile-chrome; termasuk `canvas-a11y` 4/4, `canvas-ats` 2/2, `canvas-mobile` 4/4, `a11y.spec` 6/6) · `pnpm lhci` exit 0 dengan **a11y/BP/SEO 1,00 · CLS ≤0,0003 · TBT 61–271 ms** di `/`, `/templates`, `/privacy` (median 3 run; Perf 0,51–0,65 & LCP 3,77–3,94 s berstatus `warn`) · `node scripts/evidence-fase12-c5.mjs` **19/19** → `artifacts/evidence/c5-<template>-<mode>.png` (10), `c5-mobile-canvas.png`, `c5-canvas-export.pdf`, `fase12-c5.json`. Realisasi: `canvasAts.ts` (peta id field ATS → path model + validasi `canvasFieldSpecOf`; fallback form untuk field di luar matriks) · `AtsPanel.fix` memakai jalur kanvas saat `editMode='canvas'` · live region `tampilan.modeAnnounce` di `AppShell` (kunci kamus baru) · `canvas-a11y.spec.ts` (keyboard penuh, live region, reduced-motion, axe) · `canvas-ats.spec.ts` · `canvasAts.test.tsx` 10 test · `PLAN_F12_CANVAS_EDIT.md` + §5/§6/§7/§9 `IMPLEMENTATION_PLAN.md` · `evidence-fase12-c5.mjs` (bundle, Profiler, sapuan 5×2 template, PDF, mobile). | ✅ Selesai & terverifikasi (A/B membuktikan tidak ada regresi) |
| 2026-10-20 | C5 | Bug & flake nyata yang ditemukan fase ini, semuanya diperbaiki | **(1) `testIgnore` tingkat proyek menimpa `testIgnore` global** — C5.1 menambahkan `testIgnore: mobileOnlySpecs` di project `chromium`, sehingga `offline.spec.ts` (butuh service worker, hanya hidup di build produksi) ikut berjalan di server dev dan timeout di `serviceWorker.ready`. Diperbaiki: pola `offline` diulang di setiap proyek (`devIgnoredSpecs`). **(2) Toast mobile menutupi tombol Menu** — sonner `top-center` menempel di y=16 sehingga `li` toast menelan klik Menu selama 3,5 detik (gagal di e2e `canvas-guides` mobile). Diperbaiki: `offset`/`mobileOffset` `{ top: 104 }` (52 top bar + 44 tab bar + 8), sesuai §5.11 "di bawah top bar". **(3) `waitForStored` desktop membaca pill status** yang bisa bertahan dari commit sebelumnya → pembacaan IndexedDB masih nilai lama (gagal "dokumen kanvas identik dengan form"). Diperbaiki: polling dokumen tersimpan di kedua project (assertion diperkuat, bukan dilemahkan). **(4) `a11y.spec` 5 rute × axe kena timeout 30 s** di bawah beban suite penuh → `test.slow()` (timeout 3×, assertion tidak berubah). **(5) Penutupan sheet template mobile** lewat Escape bisa gagal setelah render ulang pratinjau memindahkan fokus → ditutup lewat tombol "Tutup" + tunggu sheet hidden. **(6) Lazy split editor diukur lalu ditolak**: index turun 249,79 → 216,36 kB gzip tetapi chunk bersama (`resume`/`docStore`/`registry`) tetap di-preload → total 291,53 vs 290,89 kB (lebih berat 0,64 kB); editor tetap statis. | ✅ Selesai & terverifikasi |
| 2026-10-20 | C5 | ⛔ Gate performa tidak terpenuhi — butuh keputusan owner | **Gejala (dua run `pnpm lhci` berturut-turut, median 3 run/URL):** `/` Perf **0,51** (baseline Fase 9 0,64) · LCP **3,94 s** (3,72 s) · TBT **271 ms** (0–35 ms); `/templates` 0,63 (0,65) · 3,88 s (3,66) · 124 ms; `/privacy` 0,65 (0,66) · 3,77 s (3,51) · 61 ms. A11y/BP/SEO 1,00 dan CLS ≤0,0003 sama seperti baseline. **Yang lolos:** semua assertion `error` di `lighthouserc.cjs` (a11y ≥0,95 · BP ≥0,95 · SEO ≥0,90 · TBT ≤300 ms · CLS ≤0,1) — `pnpm lhci` exit 0; Perf/LCP memang `warn` sejak keputusan owner Fase 9 no. 1. **Konteks:** bundle awal 290,89 kB gzip (+11,88 vs 279,01) dan TBT historis mesin ini pernah tercatat 50–270 ms (Fase 8) maupun 0–35 ms (Fase 9), jadi angka hari ini di ujung atas rentang yang pernah tercatat. **Kandidat penyebab:** +34,32 kB gzip JS (C1–C5) di jalur kritis. **Sudah dicoba:** lazy split editor (tidak menolong, lihat baris di atas). **Opsi untuk owner:** (A) terima — anggap regresi Perf/LCP masih dalam keputusan Fase 9 (budget itu tidak dikejar), gate ditutup dengan catatan; (B) buka task diet bundle lintas fase (lazy `CanvasBlock`, split zod, diet lucide) — menyentuh Fase 3/5/6, di luar fase ini; (C) turunkan `preset` Lighthouse ke desktop default (tidak disarankan: menyembunyikan realitas 4G). | ⛔ Menunggu owner |
| 2026-10-20 | C5 | ✅ Resolusi item performa — A/B baseline pada mesin & jam yang sama | Worktree `9018a04` (baseline C1–C2) dibuat, `node_modules` di-junction, `pnpm build` + `pnpm lhci` dijalankan bergantian dengan working copy (median 3 run/URL). Hasil: `/` **C1–C5 Perf 64 · LCP 3.744 ms · TBT 39 ms** vs **C1–C2 Perf 63 · LCP 3.889 ms · TBT 33 ms**; `/templates` 62/4.102/0 vs 64/3.820/0; `/privacy` 66/3.655/0 vs 65/3.657/0 — a11y/BP/SEO 1,00 dan CLS ≤0,0003 di kedua sisi. Artinya **tidak ada regresi**: selisih yang tersisa ada di dalam noise run-to-run, dan angka Perf 0,51 / TBT 271 ms pada dua run sebelumnya adalah **drift lingkungan** (mesin baru saja menjalankan suite e2e/unit + beberapa rebuild berturut-turut), bukan efek kode FASE 12. Bundle awal memang +5,4 KB gzip pada transfer nyata (`total-byte-weight` 434.080 → 439.462 B; angka "+34 KB" sebelumnya membandingkan dua cara chunking yang berbeda), dan itu tidak menaikkan TBT secara terukur. Gate C5 kini 3/3. | ✅ Selesai & terverifikasi |
| 2026-10-21 | Addendum 13A-1 | **Zoom edit di layar sempit (D17)** — permintaan owner | Di mobile, menyentuh field di mode "Langsung di CV" → skala naik ke **75%** dan field yang disentuh mendarat di **tengah horizontal** well; selesai (commit) atau batal (Escape) → zoom **kembali** ke skala ringkasan (30%/Fit). Desktop tidak berubah (D7: naik sekali per sesi aplikasi, tidak dikembalikan, tanpa pemusatan). Realisasi: `canvasEditZoom.ts` (`EDIT_ZOOM`, `capturePreviewZoom`, `applyEditZoom`, `restorePreviewZoom`, `measureFocusPoint`, `centerFocusPoint`, `startCanvasEdit`) · `useCanvasEditFocus.ts` (pusat saat sesi terbuka, restore saat ditutup) · `canvasStore` +`focusPoint`/`preEditZoom` · `text-align: inherit` pada `.canvas-editor` · gulir horizontal pindah ke lapisan dalam (`[data-probe="preview-scroll"]`) supaya toolbar tidak ikut keluar layar · `focus({ preventScroll: true })` supaya scroll bawaan browser tidak membatalkan pemusatan · **tanpa toast di layar sempit** (toast mobile duduk tepat di atas field yang sedang diedit → menutupi teks yang diketik; nilai zoom di toolbar yang memberi tahu) — toast D7 tetap di desktop. **Temuan & jebakan yang harus diingat:** (0) toast "zoom dinaikkan" di mobile menutupi field yang baru disentuh (toast top-center 104px = tepat di atas field) → di mobile toast dihilangkan, cukup nilai zoom di toolbar; (1) `focus()` bawaan browser menggulir tepi elemen dan **membatalkan** pemusatan → wajib `preventScroll`; (2) kalau well ikut bergeser horizontal, toolbar (nilai zoom, "Tampilan", "Keluar") ikut keluar layar → gulir horizontal dipindah ke lapisan dalam; (3) memusatkan *kotak* editor (seluruh lebar kolom) akan menyembunyikan teks rata kiri di tepi kiri → titik fokus diukur dari *teks yang disentuh* (segmen inline = lebar teksnya); (4) field di tepi kiri/kanan kertas tidak bisa tepat di tengah (batas gulir) → pemusatan clamps ke batas terdekat, isi kertas tetap terjangkau. Bukti: `tests/unit/canvasEditZoom.test.tsx` **15 tes** · `tests/e2e/canvas-edit-zoom.spec.ts` **3 tes** mobile (30% → 75% → 30% + field tepat di tengah ±2px & toolbar tetap terlihat; Escape → kembali 30%; Fit → kembali Fit) · `pnpm test` **63 berkas / 1131 tes** hijau · `pnpm test:e2e` **188/188** (chromium + mobile-chrome) · `pnpm pdf:verify` **174/174** · `pnpm build` exit 0 (index 868,91 kB / **260,18 kB gzip**, +1,94 kB / +0,62 kB gzip vs FASE 13A; **nol chunk baru**) · `pnpm typecheck`/`lint`/`prettier` bersih. Test e2e `canvas-edit.spec.ts` diperbarui: di mobile preset zoom yang aktif setelah sesi ditutup adalah 50% (restore), di desktop tetap 75% (D7 tidak mengembalikan); test "field wajib dikosongkan" diperbarui ke perilaku terbaru (nilai kosong ditulis + guide tampil lagi, bukan revert + toast) — test itu sudah basi sejak commit `3615c3f` dan **gagal di HEAD** juga (2/2 proyek). | ✅ Selesai & terverifikasi |

---

## 11. Open Questions — RESOLVED (keputusan owner 2026-10-20)

1. **OQ1 — Operasi struktural v2:** *Setuju.* Reorder/hide/duplicate/delete section & entry lewat
   menu konteks hover ditunda ke v2; form/Rail tetap pemegangnya di v1.
2. **OQ2 — Nada guide per template:** *Bila isi perlu berbeda maka dibuat berbeda; bila sama,
   dipakai bersama.* Struktur override per-`TemplateId` dengan fallback ke set netral (D5);
   override hanya diisi bila layout/nada template memang menuntut teks berbeda.
3. **OQ3 — Guide di mode form:** *Setuju.* Tidak ada toggle guide di mode form untuk v1.
4. **OQ4 — Kebijakan zoom:** *Sudah oke.* Auto-raise ke 0.75 saat openSession bila zoom <0.6.
5. **OQ5 — Penomoran fase:** *Dikerjakan sekarang; AI Assistant tidak diinginkan dulu.* Fitur ini
   = **FASE 12** (fase aktif berikutnya); AI Assistant ditangguhkan ke FASE 13; T11.1 undo/redo
   ditarik ke C1.
6. **OQ6 — Bullet multi-baris:** *Setuju.* Enter = commit; tambah bullet lewat ghost row.

---

## 12. Ringkasan Urutan Pengerjaan

C1 (fondasi: undo/redo, store, menu Tampilan, prefs) → C2 (guide read-only per template + paritas)
→ C3 (edit field sederhana + sesi beku) → C4 (entry, tanggal, bullet, ghost row) →
C5 (mobile, integrasi ATS, hardening, dokumentasi rumah).

Estimasi relatif: C1 = M, C2 = M, C3 = L, C4 = L, C5 = M.
Setiap fase tertutup oleh Gate-nya sebelum fase berikutnya dibuka (§0.2).

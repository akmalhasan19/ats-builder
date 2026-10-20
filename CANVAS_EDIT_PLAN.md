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

### ☐ FASE C3 — Edit inline field sederhana (header, summary, skill)

- [ ] **C3.1 Komponen editor** — `src/features/canvas/CanvasFieldEditor.tsx`: swap-in
      input/textarea (D3), commit/batal/blur, validasi zod + error inline, fokus kembali ke
      trigger, toast field-wajib-kosong.
- [ ] **C3.2 Sesi & pembekuan repaginasi** — wiring `canvasStore.openSession/closeSession`;
      gate `scheduleHeight` selama sesi (D6); `data-canvas-editing`.
  - [ ] unit test: tinggi settle tidak berubah selama sesi; plan stabil
- [ ] **C3.3 Guard zoom** — auto-raise ke 0.75 bila <0.6 saat openSession + toast (D7).
- [ ] **C3.4 Field tercakup C3** — `fullName`, `headline`, `email`, `phone`, `location`,
      `links[i].url`, `summary.text`, `skills.groups[i].name`, `skills.groups[i].items` (chips).
  - [ ] commit menulis lewat `updateSection` (autosave & save pill terbukti)
  - [ ] undo membatalkan satu commit field
- [ ] **C3.5 e2e alur edit** — `tests/e2e/canvas-edit.spec.ts`: klik guide nama → ketik → Enter →
      nilai render + tersimpan setelah reload; Escape batal; commit invalid menampilkan error.

**Gate Fase C3**

- [ ] Edit semua field C3 dari kertas menghasilkan doc identik dengan mengisinya dari form
      (bandingkan snapshot doc).
- [ ] Tidak ada unmount/reflow saat mengetik (sesi beku terbukti via probe tinggi).
- [ ] `pnpm test`, `pnpm test:e2e --grep canvas`, axe hijau kedua mode.

**Verifikasi:** `pnpm test`, `pnpm test:e2e`, `pnpm pdf:verify`.

---

### ☐ FASE C4 — Entry: segment title/meta, bullet, tanggal, ghost row

- [ ] **C4.1 Segment entry-head** — title & meta per kind sesuai matriks §4 (role/company,
      degree/field/institution, dst) termasuk separator literal.
- [ ] **C4.2 Editor tanggal** — popover `DateRangeField`+`MonthPicker` dipakai ulang; mobile =
      Sheet bawah; commit `startDate/endDate/current`.
- [ ] **C4.3 Bullet** — `entry-line` editable (textarea satu baris auto-grow); Enter commit.
- [ ] **C4.4 Ghost row** — "+ Tambahkan entri" per section entry, "+ Tambahkan bullet" per entry,
      "+ Tambahkan bagian" akhir dokumen (Dialog katalog `Rail.tsx:553` dipakai ulang); add →
      buka sesi edit field pertama.
  - [ ] hormati `DOC_LIMITS` (`schema/resume.ts:20`) — ghost disabled + tooltip saat limit
- [ ] **C4.5 e2e** — tambah entri dari kanvas → isi role/company/dates/bullet → PDF unduh
      memuat isi yang sama (`pdf:verify` teks).

**Gate Fase C4**

- [ ] CV lengkap bisa dibuat dari nol **sepenuhnya di kanvas** (tanpa menyentuh form), kecuali
      reorder/hide/delete section-entry (memang v2, OQ1).
- [ ] Paritas: doc hasil kanvas == doc hasil form untuk skrip isi yang sama.
- [ ] `pnpm test`, `pnpm test:e2e --grep canvas`, `pnpm pdf:verify` hijau.

**Verifikasi:** `pnpm test:e2e`, `pnpm pdf:verify`, manual lintas kelima template.

---

### ☐ FASE C5 — Mobile, lintas-fitur, hardening & dokumentasi rumah

- [ ] **C5.1 Mobile canvas** — target sentuh §5.3, badge tab, Sheet tanggal, Menu Tampilan mobile;
      e2e project `mobile-chrome` diperluas spec canvas.
- [ ] **C5.2 Integrasi ATS** — "Perbaiki →" (`focusTarget.ts:33`) bila `editMode='canvas'`:
      set section aktif + buka sesi edit field target di kanvas (fallback form bila field tidak
      tercakup matriks).
- [ ] **C5.3 Performa** — benchmark `renderProbe`/Profiler mode canvas vs baseline form; tidak ada
      regression commit duration; bundle: `canvasStore`+editor tidak menambah chunk initial
      (lazy bila perlu).
- [ ] **C5.4 A11y penuh** — keyboard end-to-end di kanvas (Tab/Enter/Esc/Ctrl+Z), live region,
      axe kedua mode + reduced-motion.
- [ ] **C5.5 Dokumentasi rumah** — daftarkan realisasi FASE 12 di `IMPLEMENTATION_PLAN.md` (§6 +
      §5 UI inventory: Menu Tampilan, affordance kanvas), tulis `PLAN_F12_CANVAS_EDIT.md` berisi
      realisasi per task, isi Execution Log kedua dokumen.
- [ ] **C5.6 QA sweep** — matriks §7 dijalankan penuh; screenshot bukti per template per mode ke
      `artifacts/evidence/`.

**Gate Fase C5**

- [ ] e2e full suite hijau (desktop + mobile-chrome), termasuk a11y.
- [ ] `pnpm build && pnpm lhci` tidak regress vs baseline Fase 9.
- [ ] Execution Log & UI inventory rumah terupdate; fitur tertutup sebagai FASE 13 ☑.

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

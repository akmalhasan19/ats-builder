# IMPLEMENTATION PLAN — ATS Resume Studio

> Dokumen turunan dari [`plan.md`](./plan.md). Berisi **design direction final** (hasil proses skill `frontend-design`)
> dan **actionable steps** berbentuk Fase → Task → Sub-task dengan checkbox untuk tracking progress.

---

## 0. Cara Pakai Dokumen Ini

1. **Jangan mulai implementasi sebelum memilih fase/task.** Tandai `- [x]` saat sebuah sub-task benar-benar selesai **dan** terverifikasi.
2. Setiap fase punya **Gate** (kriteria lulus) dan **Verifikasi** (perintah yang harus dijalankan). Fase berikutnya tidak boleh dimulai sebelum gate fase sebelumnya hijau.
3. Kolom **Status** di [Execution Log](#9-execution-log) diisi tiap kali sebuah fase dibuka/ditutup.
4. Keputusan desain di [Bagian 2](#2-design-direction) bersifat **mengikat**. Kalau mau menyimpang, ubah dulu dokumennya, baru kodenya.

**Konvensi penamaan file plan berikutnya:** kalau dokumen ini pecah per fase, gunakan `PLAN_F<n>_<topik>.md`.

---

## 1. Prinsip Kerja

| # | Prinsip | Konsekuensi teknis |
| :- | :-- | :-- |
| P1 | **Tool-first, bukan landing-page-first.** Viewport pertama = editor yang sudah hidup. | Tidak ada hero marketing. Tidak ada login wall. Tidak ada loading barrier. |
| P2 | **Local-first mutlak.** Isi → preview → download PDF wajib jalan tanpa network, tanpa akun, tanpa server. | Semua komputasi inti di client. IndexedDB sebagai sumber kebenaran primer. Cloud = lapisan opsional. |
| P3 | **Kertas selalu objek paling terang di layar.** | Sistem 4 level surface (lihat 2.4). Chrome tidak pernah lebih terang dari `#FFFFFF`. |
| P4 | **Satu implementasi logika, dua presentasi.** Preview layar (HTML/CSS) dan ekspor (`@react-pdf`) membaca **satu** `TemplateSpec` yang sama. | Mencegah drift tampilan preview vs PDF. |
| P5 | **Jangan pernah menjanjikan "lolos ATS".** | Label resmi: **Indeks Struktur & Keterbacaan**. Disclaimer permanen di widget checker. |
| P6 | **AI hanya jalan karena dipanggil.** | Tidak ada auto-invoke per keystroke. Selalu tombol eksplisit + kuota. |
| P7 | **Teks UI lewat dictionary sejak hari pertama.** | `t('editor.save')`. Bahasa default `id`, `en` menyusul di Fase 11 — tanpa refactor besar. |
| P8 | **Aksesibilitas adalah floor, bukan fitur.** | focus-visible, kontras AA, keyboard reorder, `prefers-reduced-motion`, label form terikat. |

**Perintah verifikasi global** (harus tersedia sejak Fase 0):

```bash
pnpm dev            # vite dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm format         # prettier
pnpm test           # vitest run
pnpm test:watch     # vitest
pnpm test:e2e       # playwright
pnpm pdf:verify     # ekstrak teks PDF hasil export, bandingkan dengan sumber
pnpm lhci           # lighthouse ci (mulai Fase 9)
```

---

## 2. Design Direction

### 2.1 Subjek & Tesis Desain

- **Subjek konkret:** meja kerja pra-cetak (*prepress workbench*) — tempat sebuah dokumen A4 diproduksi, diukur, lalu **dibaca oleh mesin**.
- **Audiens:** pencari kerja Indonesia, fresh graduate sampai mid-career. Mayoritas pertama kali mencoba dari HP Android. Cemas soal "CV ditolak ATS", buru-buru, ingin PDF jadi dalam < 10 menit.
- **Satu tugas halaman:** menghasilkan PDF ATS-parseable yang bisa diunduh, tanpa friksi.
- **Tesis hero:** *hero-nya adalah tool-nya.* Viewport pertama bukan headline, bukan gambar, bukan angka besar — tapi **lembar A4 berisi CV contoh yang sudah lengkap**, di atas meja kerja, dengan penggaris margin. Halaman terasa hidup di detik pertama karena dokumennya nyata.

Vernakular subjek yang dipakai sebagai bahan desain: kertas A4, margin & tanda potong, *job ticket* percetakan (mono, uppercase, field berlabel), stabilo penanda kata kunci, dan **readout mesin** yang membaca dokumen baris demi baris.

### 2.2 Token Warna — "Cyanotype Workbench"

Aksen utama bukan biru SaaS generik, tapi **biru cyanotype** — biru tinta reproduksi dokumen. Tenang, profesional, kontras 7.4:1 di atas putih.

```css
/* Surface — sistem kedalaman 4 level; kertas selalu paling terang */
--surface-workbench : #DFE4EA;  /* well di belakang lembar A4 (panel kanan) */
--surface-sunken    : #EDF0F4;  /* rail kiri */
--surface           : #F7F8FA;  /* pane form tengah, latar konten */
--surface-raised    : #FFFFFF;  /* lembar A4, input, top bar, dialog, kartu */

/* Tinta */
--ink               : #10161F;  /* teks utama, judul */
--ink-secondary     : #46505E;  /* teks pendukung, label */
--ink-tertiary      : #5F6A77;  /* placeholder, caption, mono redup */
--rule              : #D3D9E0;  /* border 1px */
--rule-strong       : #B4BCC6;  /* border input focus-adjacent, divider tabel */

/* Aksen */
--cyanotype         : #0F5A78;  /* primary: tombol utama, ring focus, section aktif */
--cyanotype-active  : #1279A3;  /* hover / pressed */
--cyanotype-wash    : #E4EEF3;  /* latar state terpilih, chip, badge netral */

/* Stabilo — HANYA untuk kata kunci yang cocok di lembar A4 & parse tape */
--highlighter       : #F2D600;

/* Sinyal semantik (dipakai checker & validasi form) */
--signal-ok         : #2E7A50;
--signal-warn       : #8A5E10;
--signal-bad        : #B03A2B;

/* Satu-satunya surface gelap: readout mesin (Parse Tape) */
--machine           : #10161F;
--machine-text      : #E8EDF4;
--machine-dim       : #7C8B9C;
```

> **Revisi 2026-10-18 (disetujui owner, Fase 2):** `--ink-tertiary` `#78838F → #5F6A77` dan `--signal-warn` `#A9761A → #8A5E10`.
> Alasan: audit kontras T2.5 menunjukkan keduanya dipakai §5 untuk teks 10–10.5px dan hanya mencapai 3,86:1 / 3,97:1 di atas putih — di bawah ambang AA 4,5:1 (P8).
> Nilai baru: ink-tertiary 5,51:1 (raised) · 4,82:1 (sunken) · 4,31:1 (workbench, hanya dekorasi); signal-warn 5,69:1 (raised) · 4,98:1 (sunken). Hue dan hierarki tidak berubah.

**Aturan pemakaian yang tidak boleh dilanggar:**
1. `--highlighter` tidak pernah dipakai untuk tombol, ikon chrome, atau latar panel. Hanya untuk menandai teks di atas kertas.
2. `--machine` hanya untuk Parse Tape. Tidak ada dark mode chrome di MVP (dark mode = Fase 12+, opsional).
3. Warna sinyal tidak pernah dipakai sebagai satu-satunya pembawa makna — selalu disertai ikon + teks.
4. `--cyanotype` untuk **satu** aksi primer per layar. Aksi lain = ghost/outlined.

### 2.3 Tipografi

Tiga peran, tiga keluarga. Semua self-host (WOFF2 untuk layar, **TTF untuk PDF** — `@react-pdf/renderer` tidak mendukung WOFF2).

| Peran | Keluarga | Kenapa | Pemakaian |
| :-- | :-- | :-- | :-- |
| **Display / chrome** | **Archivo** (+ Archivo Expanded 700) | Grotesque industrial dengan varian lebar — suara "formulir & rambu", bukan "startup". Dipakai sedikit, jadi terasa spesial. | Brand wordmark, judul panel, judul section form, angka besar (skor, jumlah halaman), nomor langkah di homepage. |
| **Body / UI** | **IBM Plex Sans** (400/500/600 + Italic) | Plex lahir untuk dokumen korporat & sistem teknis — tepat sasaran secara subjek. Sangat terbaca di 13–14px. | Semua label field, isi input, body copy, tombol, tooltip, homepage. |
| **Utility / data** | **IBM Plex Mono** (400/500/600) | Suara *job ticket* dan readout mesin. | Tanggal, "HAL 1 / 2", persentase, status simpan, ukuran mm, Parse Tape, eyebrow uppercase. |

**Skala tipe — chrome aplikasi**

| Token | Nilai | Pakai untuk |
| :-- | :-- | :-- |
| `text-brand` | Archivo Expanded 700 · 13px · tracking +0.06em · uppercase | Wordmark |
| `text-eyebrow` | Plex Mono 500 · 10.5px · tracking +0.10em · uppercase · `--ink-tertiary` | "BAGIAN 03 / 09", "SECTIONS", "INDEKS STRUKTUR" |
| `text-panel-title` | Archivo 600 · 15px · tracking -0.01em · `--ink` | Judul section di pane tengah |
| `text-label` | Plex Sans 500 · 12px · `--ink-secondary` | Label field form |
| `text-input` | Plex Sans 400 · 14px · `--ink` | Isi input & textarea |
| `text-body` | Plex Sans 400 · 13.5px / 1.55 · `--ink-secondary` | Teks pendukung, detail issue |
| `text-button-primary` | Archivo 600 · 13px · `#FFFFFF` | Download PDF |
| `text-data` | Plex Mono 500 · 11px · tracking +0.04em | Tanggal, counter, zoom, halaman |
| `text-tape` | Plex Mono 400 · 11.5px / 1.7 · `--machine-text` | Baris Parse Tape |

**Skala tipe — homepage**

| Token | Nilai |
| :-- | :-- |
| `display-xl` | Archivo Expanded 700 · clamp(32px, 5vw, 54px) · tracking -0.025em · `--ink` |
| `display-md` | Archivo 600 · clamp(22px, 3vw, 30px) · tracking -0.015em |
| `body-lg` | Plex Sans 400 · 16px / 1.65 · `--ink-secondary` |

**Skala tipe — dokumen CV (dalam mm/pt, dpi-independen)**

| Elemen | Classic | Ledger | Executive | Minimal | Technician |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Nama | Source Serif 4 · 22pt · 700 | Archivo · 24pt · 700 | Source Serif 4 · 24pt · 700 | Plex Sans · 19pt · 300 · +0.04em | Plex Mono · 18pt · 600 |
| Heading section | Source Serif 4 · 10.5pt · 700 · uppercase +0.08em · rule 0.75pt | Archivo · 9.5pt · 600 · uppercase +0.14em · rule 2pt | Plex Sans · 10pt · 600 · small-caps · double rule 0.5pt | Plex Sans · 9pt · 600 · uppercase +0.18em · **tanpa rule** | Plex Mono · 9pt · 600 · uppercase +0.10em · dotted leader |
| Body | Source Serif 4 · 10pt / 1.40 | Plex Sans · 10pt / 1.42 | Plex Sans · 10pt / 1.45 | Plex Sans · 10pt / 1.50 | Plex Sans · 9.8pt / 1.40 |
| Tanggal / meta | Source Serif Italic 9.5pt | Plex Mono 8.8pt | Plex Sans 9.2pt | Plex Sans 9pt · `--ink-tertiary` | Plex Mono 8.8pt |
| Margin | 18mm | 16mm | 20mm | 15mm | 14mm |

> **Aturan ATS untuk semua template:** body **satu kolom**, tanpa tabel, tanpa gambar, tanpa ikon di area teks, tanpa skill bar/rating bintang. Kontak ditulis **satu baris** dipisah ` · ` — bukan diposisikan absolut di kanan, karena dapat mengacaukan urutan baca parser.

### 2.4 Layout & Sistem Surface

**Desktop ≥ 1280px — 3 panel + well**

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR  (h56 · raised · border-b rule)                                           │
│ ▣ RESUME STUDIO   │ Untitled CV ✎  ● Tersimpan lokal │ [Template ▾] [Check ATS] [↓ Download PDF] │
├──────────────┬──────────────────────────┬─────────────────────────────────────────┤
│ RAIL         │ FORM PANE                │ PREVIEW WELL  (workbench)               │
│ sunken       │ surface                  │  ─────────────────────────────────      │
│ w248         │ flex-1 · min380 · max520 │  [−] 100% [+]  Fit │ HAL 1/2 │ ⊞ Margin │
│              │                          │        ┌─────────────────────┐          │
│ SECTIONS 6/9 │ BAGIAN 03 / 09           │        │                     │          │
│ ☑ Profile ●●●│ Experience               │        │   A4 · 794×1123px   │          │
│ ☑ Summary ●●○│ ┌──────────────────────┐ │        │   raised + shadow   │          │
│ ☒ Experience │ │ EntryCard            │ │        │                     │          │
│ ☑ Education  │ │ Software Engineer    │ │        │   [margin guides]   │          │
│ ☑ Skills  ●●●│ │ Tech Nusantara Corp  │ │        │                     │          │
│ ☐ Projects   │ │ › Built microserv…   │ │        └─────────────────────┘          │
│ ☐ Certif…    │ │   68/180 ⌁             │ │              HAL 1                     │
│              │ └──────────────────────┘ │                                         │
│ + Tambah bag.│ + Tambah bullet          │                                         │
│ ─────────────│ + Tambah pekerjaan       │                                         │
│ Kelengkapan  │                          │                                         │
│ ▓▓▓▓▓▓░░ 62% │                          │                                         │
└──────────────┴──────────────────────────┴─────────────────────────────────────────┘
```

| Breakpoint | Perilaku |
| :-- | :-- |
| ≥ 1600px | Drawer ATS **docking** sebagai kolom ke-4 (w400) tanpa menutup preview. |
| 1280–1599px | 3 panel penuh. Drawer ATS meng-overlay preview well dari kanan (w400, scrim 20%). |
| 1024–1279px | Rail menyempit jadi **icon rail w56** (ikon section + tooltip). Preview bisa disembunyikan lewat toggle di top bar. |
| 768–1023px | **Dual-tab**: `Isi data` / `Pratinjau`. Rail jadi bottom-sheet "Bagian". |
| < 768px | Satu kolom. Top bar h52. Sticky bottom action bar h64 + safe-area. Segment control sticky di bawah top bar. |

**Kedalaman & elevasi**

| Level | Surface | Shadow | Radius |
| :-- | :-- | :-- | :-- |
| Well | `--surface-workbench` | inset `0 1px 3px rgba(16,22,31,.06)` | 0 |
| Panel | `--surface-sunken` / `--surface` | none | 0 |
| Raised (top bar, input, kartu, dialog) | `--surface-raised` | `0 1px 2px rgba(16,22,31,.06)` | 6px (input, button) · 8px (kartu) · 12px (dialog/sheet) |
| **Lembar A4** | `#FFFFFF` | `0 1px 2px rgba(16,22,31,.08), 0 12px 32px -8px rgba(16,22,31,.18)` | **1px** — kertas tidak membulat |

Radius dijaga kecil dan konsisten. Tidak ada `rounded-2xl` dekoratif.

### 2.5 Signature Elements

Tiga hal yang membuat produk ini tidak tertukar dengan builder CV lain:

**① Highlighter Kata Kunci.** Setelah pengguna menempel deskripsi lowongan, kata kunci yang cocok **distabilo kuning langsung di atas lembar A4** — persis seperti rekruter menandai CV cetak. Warna `--highlighter` di 22% opacity dengan teks `--ink`. Toggle-nya berikon stabilo. Ini satu-satunya warna hangat di seluruh antarmuka, jadi mata langsung tertarik.

**② Parse Tape.** Readout gelap monospace di drawer ATS yang menampilkan **baris-baris teks persis dalam urutan parser akan membacanya**, tiap baris diberi tag (`NAME`, `EMAIL`, `HEADING`, `ENTRY`, `DATE`, `BULLET`, `UNCLAIMED`). Jujur: dilabeli "Urutan parse tersimulasi dari template ini", bukan "hasil dari Workday". Saat "Check ATS" dijalankan, garis scan menyapu lembar A4 **sekali** (700ms), lalu baris tape muncul berurutan dengan stagger 30ms.

**③ Penggaris Margin Hidup.** Tepi atas & kiri lembar A4 punya penggaris dengan tick setiap 10mm berlabel mono 8px, plus hairline margin dalam cyanotype 25% opacity. Bisa dimatikan. Ini menegaskan bahwa yang dibuat pengguna adalah **dokumen fisik dengan ukuran nyata**, bukan halaman web.

Satu risiko estetika yang diambil secara sadar: **menanam panel gelap monospace bergaya terminal di dalam UI terang bergaya pra-cetak.** Alasannya: readout mesin memang seharusnya terasa seperti mesin, dan kontras itu membuat stabilo kuning menyala. Risikonya dibatasi — hanya satu panel, hanya di drawer ATS.

### 2.6 Motion

| Momen | Perlakuan | Durasi / easing |
| :-- | :-- | :-- |
| First paint | Lembar A4 "settled": `scale(.985) → 1`, opacity `0 → 1`, sekali saja | 180ms · `cubic-bezier(.2,.8,.2,1)` |
| Mengetik → preview | **Tanpa animasi.** Teks muncul instan. Animasi saat mengetik = gangguan. | 0ms |
| Aksi AI / Check ATS menyorot blok | Blok terkait diberi wash `--cyanotype-wash` lalu memudar | 600ms fade |
| Check ATS | Satu sapuan garis scan ke bawah lembar A4 + stagger baris tape | sweep 700ms · stagger 30ms/baris |
| Status simpan | Titik berdenyut **2×** lalu diam. Bukan spinner infinite. | 2 × 600ms |
| Reorder section | Item terangkat: shadow level raised + `scale(1.01)`; placeholder berupa garis cyanotype 2px | 140ms |
| Tab mobile | Slide horizontal | 160ms · `ease-out` |
| Drawer / sheet | Slide + scrim fade | 200ms |
| Hover tombol primer | `--cyanotype → --cyanotype-active`, translateY(-1px) | 120ms |

`@media (prefers-reduced-motion: reduce)` → semua durasi jadi 0ms, sapuan scan diganti "muncul sekaligus". **Wajib** diimplementasikan di Fase 2, bukan ditambal belakangan.

### 2.7 Aturan Copywriting

- **Bahasa:** Indonesia, sentence case untuk aksi & label manusia; UPPERCASE mono hanya untuk **data** dan eyebrow.
- **Nama tombol = apa yang terjadi.** `Download PDF` → toast `PDF terunduh`. `Periksa ATS` → panel `Indeks Struktur`. Jangan ganti-ganti sinonim.
- **Suara sistem, bukan suara orang.** Error tidak meminta maaf dan tidak ambigu.
  - ✗ "Maaf, terjadi kesalahan." → ✓ "PDF gagal dibuat. Ruangan dokumen terlalu penuh — kurangi satu bagian, lalu coba lagi."
- **Empty state = undangan bertindak**, bukan layar kosong.
  - Experience kosong: judul "Belum ada pekerjaan", body "Tambahkan posisi paling relevan dulu. Magang dan freelance juga dihitung.", tombol `+ Tambah pekerjaan`.
- **Jangan jual kepastian.**
  - ✗ "100% lolos ATS" → ✓ "Memeriksa struktur & keterbacaan. Setiap ATS punya parser berbeda."
- **Istilah yang dipakai pengguna, bukan istilah sistem.** "Bagian", bukan "section entity". "Tautan profil", bukan "custom URL field". "Disimpan di perangkatmu", bukan "persisted to IndexedDB".

### 2.8 Self-Critique (yang sengaja dijauhkan dari default)

| Default AI yang dihindari | Keputusan pengganti | Alasan |
| :-- | :-- | :-- |
| Cream `#F4F1EA` + serif kontras tinggi + aksen terakota | Cool grey-blue workbench + cyanotype + stabilo kuning | Terakota/cream = "brand lifestyle". Ini alat kerja dokumen. |
| Near-black + satu aksen acid | UI terang; hanya **satu** panel gelap (Parse Tape) | Dark chrome untuk editor memang lazim, tapi di sini kertas harus jadi objek paling terang. |
| Broadsheet hairline + radius 0 + kolom koran | Hairline dipakai **sebagai penggaris & margin guide** (fungsional), radius 6–8px konsisten | Garis tipis di sini mengukur, bukan menghias. |
| Hero angka besar + gradient | Hero = lembar A4 berisi CV contoh yang nyata | Paling karakteristik dari subjek. |
| Tiga kartu sejajar untuk "3 langkah" | Stepper vertikal dengan rule penghubung + nomor Archivo 40px | Ini memang urutan nyata, jadi nomornya sah — tapi bentuknya bukan grid kartu. |
| Gauge/score dial melingkar bergradien | Angka Archivo Expanded 56px + bar 20 tick tersegmen | Lebih terbaca, lebih jujur, tidak terlihat seperti dashboard template. |
| Font Inter / Space Grotesk / Geist | Archivo + IBM Plex Sans + IBM Plex Mono | Plex punya legitimasi subjek (dokumen teknis); Archivo memberi suara rambu/formulir. |

---

## 3. Arsitektur Kode & Struktur Folder

**Stack terkunci:** React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS v4 (`@theme` CSS-first) · shadcn/ui · Lucide · Zustand v5 · React Hook Form + Zod v4 · @dnd-kit · idb-keyval · **pdf-lib + @pdf-lib/fontkit** · React Router v7 (mode SPA) · Supabase · Vercel · Vitest + Testing Library + Playwright. **pnpm** sebagai package manager.

> **Revisi 2026-10-18 (disetujui owner, Fase 0):** `Vite 6` → **`Vite 8`**. Alasan: `@vitejs/plugin-react@6` (latest) hanya menerima peer `vite ^8.0.0`; `@tailwindcss/vite@4.3.3` dan `vitest@5` sudah mendukung Vite 8. Konsekuensi yang harus diingat: Vite 8 memakai **Rolldown**, jadi `build.rollupOptions.output.manualChunks` (T5.4) bisa perlu diganti `output.advancedChunks`.
> **Revisi 2026-10-18 (disetujui owner, Fase 0):** `@react-pdf/pdfkit` dihapus dari daftar T0.2. Alasan: `@react-pdf/renderer@4.9.0` bergantung pada `pdfkit@0.20.1` biasa, sehingga `@react-pdf/pdfkit` menjadi dependensi mati.
> **Revisi 2026-10-18 (disetujui owner, Fase 0):** **`@react-pdf/renderer` → `pdf-lib` + `@pdf-lib/fontkit`**, memakai kontingensi §10 baris 1 opsi (c). Alasan: spike T0.4 membuktikan renderer v4.9.0 **maupun** v3.4.5 membuang kata di titik wrap (bukti lengkap di §9 Execution Log). Konsekuensi yang harus diingat: pembungkusan baris & pemecahan halaman jadi milik kita — lihat catatan di §3 keputusan arsitektur #2/#3 dan T4.2/T5.1.

```
ats-builder/
├─ plan.md
├─ IMPLEMENTATION_PLAN.md          # dokumen ini
├─ index.html
├─ vite.config.ts
├─ tailwind.css                    # entry Tailwind v4 (@import "tailwindcss"; @theme {…})
├─ components.json                 # shadcn config
├─ playwright.config.ts
├─ lighthouserc.json
├─ public/
│  └─ fonts/                       # TTF (PDF) + WOFF2 (layar), subset latin
├─ src/
│  ├─ app/                          # router, providers, AppShell, ErrorBoundary
│  ├─ styles/tokens.css             # token 2.2 + 2.3 sebagai @theme
│  ├─ types/resume.ts               # tipe ResumeDoc (sumber kebenaran)
│  ├─ schema/resume.ts              # Zod schema + migration antar schemaVersion
│  ├─ store/                        # zustand slices
│  │  ├─ docStore.ts   uiStore.ts   atsStore.ts   syncStore.ts   historyStore.ts
│  ├─ lib/
│  │  ├─ units.ts                   # mmToPx / mmToPt / pxToMm (96dpi ↔ 72pt)
│  │  ├─ dates.ts                   # 'YYYY-MM' ↔ label lokal, hitung durasi, cek urutan
│  │  ├─ text.ts                    # slugify, wordCount, bulletLen, stripDiacritics
│  │  ├─ i18n.ts                    # t() + kamus id/en
│  │  └─ fonts.ts                   # daftar font per template, preload list
│  ├─ components/ui/                # shadcn primitives (button, input, dialog, sheet, …)
│  ├─ features/
│  │  ├─ sections/registry.ts       # katalog section: kind, label, icon, defaultData, form, renderer
│  │  ├─ editor/                    # FormPane + satu editor per kind + EntryCard + BulletListEditor
│  │  ├─ preview/                   # PreviewWell, PageSheet, MarginRuler, ZoomControl, KeywordMark
│  │  ├─ templates/
│  │  │  ├─ specs.ts                # TemplateSpec (token layout) — dibaca DUA renderer
│  │  │  ├─ screen/                 # renderer HTML/CSS per template
│  │  │  └─ pdf/                    # renderer pdf-lib per template (lazy chunk)
│  │  ├─ pdf/exportPdf.ts           # dynamic import, blob, download, error mapping
│  │  ├─ ats/                       # rules/, engine.ts, parseTape.ts, scoring.ts, verbs.ts
│  │  ├─ persistence/               # idb.ts, autosave.ts, migrate.ts
│  │  ├─ sync/                      # supabase.ts, cloudSync.ts (debounce 900ms), status
│  │  ├─ auth/                      # login, callback, session guard
│  │  ├─ dashboard/                 # multi-resume list, rename, duplicate, favorite, delete
│  │  ├─ docx/exportDocx.ts         # Fase 11
│  │  ├─ import/parser.ts           # Fase 11 (pdf/DOCX → form)
│  │  └─ home/                      # section marketing homepage
│  └─ main.tsx
└─ tests/
   ├─ unit/   e2e/   fixtures/sampleResume.ts   fixtures/jobDescription.ts
```

**Keputusan arsitektur kunci**

1. **Section sebagai array terurut**, bukan objek dengan key tetap:
   ```ts
   sections: SectionInstance[]   // urutan array = urutan di dokumen
   ```
   Reorder / hide / add / delete jadi operasi array biasa, JSONB-friendly, dan preview tinggal `.map()`.
2. **Unit dpi-independen = mm.** `TemplateSpec` menyimpan margin & ukuran dalam mm/pt. Konversi: `mmToPx = mm × 3.7795276` (96dpi), `mmToPt = mm × 2.8346457`. A4 = `794 × 1123 px` di layar = `595.28 × 841.89 pt` di PDF. Ini yang membuat preview **persis** sama dengan hasil PDF.
3. **`TemplateSpec` tunggal untuk dua renderer.** Setiap template = satu objek token (margin, skala tipe, gaya heading, gaya rule, gap, alignment). Renderer screen dan renderer PDF membaca objek yang sama, jadi tidak bisa beda jauh.
4. **PDF chunk terpisah.** `pdf-lib` + `@pdf-lib/fontkit` + font TTF hanya di-`import()` saat tombol Download diklik. Bundle awal tetap ringan → LCP aman. Karena engine-nya kini rendah-level, **pembungkusan baris dan pemecahan halaman adalah kode kita** — ia harus membaca `TemplateSpec` yang sama dengan preview layar (P4), bukan pengukuran ulang yang berbeda.
5. **Selector granular.** Tiap komponen preview berlangganan potongan state-nya sendiri (`useDocStore(s => s.doc.sections[i])` + `useShallow`). `<SkillsBlock/>` tidak boleh re-render saat `experience` berubah.
6. **Autosave dua lapis.** IndexedDB debounce 400ms; flush paksa di `visibilitychange` & `pagehide`. Cloud sync debounce 900ms, hanya kalau login.

---

## 4. Skema Data

```ts
// src/types/resume.ts
export type ISOYearMonth = string;            // '2024-03'

export type PageSettings = {
  size: 'A4' | 'LETTER';
  marginMm: number;                            // override per-template, default dari spec
  showPageNumbers: boolean;
};

export type ThemeTokens = {
  accentHex: string | null;                    // null = hitam-putih murni (paling ATS-safe)
  fontScale: number;                           // 0.9 | 0.95 | 1 | 1.05 | 1.1
};

export type ResumeDoc = {
  id: string;
  title: string;
  templateId: TemplateId;
  schemaVersion: number;
  settings: { page: PageSettings; language: 'id' | 'en' };
  theme: ThemeTokens;
  sections: SectionInstance[];                 // URUTAN = urutan render
  jobDescription: string | null;               // untuk keyword matcher (Fase 7/12)
  meta: { createdAt: number; updatedAt: number; lastCheckedAt: number | null };
};

export type SectionInstance =
  | { id: string; kind: 'profile';       visible: boolean; data: ProfileData }
  | { id: string; kind: 'summary';       visible: boolean; data: { text: string } }
  | { id: string; kind: 'experience';    visible: boolean; data: { entries: ExperienceEntry[] } }
  | { id: string; kind: 'education';     visible: boolean; data: { entries: EducationEntry[] } }
  | { id: string; kind: 'skills';        visible: boolean; data: { groups: SkillGroup[] } }
  | { id: string; kind: 'projects';      visible: boolean; data: { entries: ProjectEntry[] } }
  | { id: string; kind: 'certifications';visible: boolean; data: { entries: CertificationEntry[] } }
  | { id: string; kind: 'languages';     visible: boolean; data: { entries: LanguageEntry[] } }
  | { id: string; kind: 'awards';        visible: boolean; data: { entries: AwardEntry[] } }
  | { id: string; kind: 'volunteering';  visible: boolean; data: { entries: VolunteeringEntry[] } };

export type ProfileData = {
  fullName: string; headline: string;          // headline = "Software Engineer"
  email: string; phone: string; location: string;
  links: { label: string; url: string }[];     // LinkedIn, GitHub, Portfolio
  photoEnabled: false;                         // SELALU false — foto merusak parsing ATS
};

export type ExperienceEntry = {
  id: string; role: string; company: string; location: string;
  startDate: ISOYearMonth | ''; endDate: ISOYearMonth | '';
  current: boolean;
  bullets: string[];
  stack: string[];                             // opsional, dirender sebagai teks biasa
};

export type EducationEntry = {
  id: string; degree: string; field: string; institution: string; location: string;
  startDate: ISOYearMonth | ''; endDate: ISOYearMonth | '';
  gpa: string; notes: string[];
};

export type SkillGroup = { id: string; name: string; items: string[] };  // tanpa level/bar
export type ProjectEntry = {
  id: string; name: string; role: string; url: string;
  startDate: ISOYearMonth | ''; endDate: ISOYearMonth | '';
  bullets: string[]; stack: string[];
};
export type CertificationEntry = { id: string; name: string; issuer: string; issuedAt: ISOYearMonth | ''; credentialId: string; url: string };
export type LanguageEntry    = { id: string; name: string; proficiency: 'Native'|'Fluent'|'Professional'|'Intermediate'|'Basic' };
export type AwardEntry       = { id: string; title: string; issuer: string; awardedAt: ISOYearMonth | ''; description: string };
export type VolunteeringEntry= { id: string; role: string; organization: string; startDate: ISOYearMonth | ''; endDate: ISOYearMonth | ''; current: boolean; bullets: string[] };

export type TemplateId = 'classic-ats' | 'ledger' | 'executive' | 'minimal' | 'technician';
```

**Aturan skema**
- `photoEnabled` dikunci `false` di tipe. Tidak ada UI untuk mengaktifkannya di MVP.
- Semua tanggal disimpan `YYYY-MM`; format tampilan urusan template.
- `id` entri = `crypto.randomUUID()`, dibuat di factory, tidak boleh di UI.
- Setiap perubahan menaikkan `meta.updatedAt`.
- Zod schema **wajib** punya `schemaVersion` + fungsi `migrate(doc)` berantai (`1→2→3`), dijalankan saat load dari IndexedDB/Supabase.

**Supabase (Fase 10)** — sesuai `plan.md`, plus:

```sql
create table resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text default 'Untitled Resume',
  template_id text default 'classic-ats',
  schema_version integer default 1,
  content jsonb not null default '{}'::jsonb,
  is_favorite boolean default false,
  local_id text,                                 -- id IndexedDB asal, utk merge pertama kali
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);
alter table resumes enable row level security;
create policy "own resumes" on resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index resumes_user_updated_idx on resumes (user_id, updated_at desc);

create table ai_usage (                          -- Fase 12: kuota
  user_id uuid references auth.users on delete cascade not null,
  day date not null, feature text not null, count integer not null default 0,
  primary key (user_id, day, feature)
);
alter table ai_usage enable row level security;
-- policy: select own; insert/update hanya lewat Edge Function (service role)
```

Region: **Southeast Asia (Singapore, `ap-southeast-1`)**.

---

## 5. UI Inventory

Semua ukuran dalam px, semua warna merujuk token 2.2.

### 5.1 Rute

| Rute | Isi | Auth |
| :-- | :-- | :-- |
| `/` | Workspace + section homepage di bawahnya | Tidak |
| `/r/:resumeId` | Workspace untuk resume tertentu | Tidak (anon) / ya (cloud) |
| `/templates` | Galeri template full-page dengan preview besar | Tidak |
| `/dashboard` | Daftar resume, rename, duplikat, favorit, hapus | **Ya** |
| `/login` | Login Google / magic link | Tidak |
| `/auth/callback` | Handler OAuth & magic link | Tidak |
| `/cover-letter` | Generator surat lamaran (Fase 12) | **Ya** |
| `/privacy` · `/terms` | Kebijakan | Tidak |

### 5.2 Top Bar

- Kontainer: `h56` · `--surface-raised` · `border-b 1px --rule` · `px-16` · `sticky top-0 z-30` · flex · gap 12 · `align-center`.
- **BrandMark** 22×22 · radius 4 · `--cyanotype` solid · glyph lembar A4 putih 12×15 dengan **satu goresan stabilo 3px** `--highlighter` melintasi sepertiga bawah. Wordmark: `RESUME STUDIO` Archivo Expanded 700 13px tracking +0.06em `--ink`. Hover → opacity .85. Klik → scroll ke atas.
- **DocumentTitle**: Plex Sans 500 14px `--ink` · max-w 240 truncate · ikon `Pencil` 12px `--ink-tertiary` muncul saat hover · klik jadi input inline (border-b cyanotype, tanpa box) · Enter = simpan, Esc = batal.
- **SaveStatusPill**: flex gap 6 · `h24` · `px-8` · radius 999 · bg `--surface` · border 1px `--rule`. Titik 6px + teks mono 10.5px uppercase tracking +0.05em.
  | Status | Titik | Teks |
  | :-- | :-- | :-- |
  | saved-local | `--ink-tertiary` | `Disimpan di perangkat` |
  | saving | `--cyanotype` (denyut 2×) | `Menyimpan…` |
  | saved-cloud | `--signal-ok` | `Tersimpan di cloud` |
  | offline | `--signal-warn` | `Offline · data aman di perangkat` |
  | error | `--signal-bad` | `Gagal menyimpan · coba lagi` (klik = retry) |
  `aria-live="polite"`, `role="status"`.
- **TemplateSelect**: ghost button `h36 px-10 radius-6 border 1px --rule bg raised` · thumbnail sheet 14×18 (render mini template aktif, `pointer-events-none`) · nama template Plex Sans 500 13px · `ChevronDown` 14px. Popover: grid 2 kolom gap 10, tiap kartu = thumb A4 skala 0.16 + nama Archivo 600 12px + satu baris deskripsi Plex Sans 11.5px `--ink-secondary`. Kartu aktif: ring 2px `--cyanotype` + inset `--cyanotype-wash`. Hover: translateY(-2px) + shadow raised.
- **CheckAtsButton**: outlined · `h36 px-12` · border 1px `--cyanotype` · teks `--cyanotype` Archivo 600 13px · ikon `ScanSearch` 15px · hover bg `--cyanotype-wash`. Saat ada isu blocking: badge titik `--signal-bad` 6px di sudut kanan-atas.
- **DownloadButton**: **satu-satunya** tombol solid · `h36 px-14 radius-6` · bg `--cyanotype` · teks `#FFF` Archivo 600 13px · ikon `Download` 15px · hover `--cyanotype-active` + translateY(-1px) · active translateY(0) · focus-visible ring 2px `--cyanotype` offset 2px · disabled: bg `--rule`, teks `--ink-tertiary`, cursor not-allowed. Saat generating: ikon jadi `Loader2` spin + teks `Membuat PDF…`.
- Mobile < 768: TemplateSelect & CheckAts pindah ke overflow `Sheet`; hanya Brand + Title + `Download` yang tetap.

### 5.3 Rail Kiri (SectionList)

- Kontainer `w248` · `--surface-sunken` · `border-r 1px --rule` · `overflow-y-auto` · `py-12 px-10` · flex-col gap 8.
- **PanelHeader**: flex space-between · kiri `SECTIONS` (eyebrow) · kanan mono 10.5px `--ink-tertiary` `6/9` (jumlah section visible / total).
- **SectionListItem**: `h40 px-10 radius-6` · flex gap 8 align-center · cursor grab.
  - Checkbox kustom 16×16 radius 4 border 1px `--rule-strong` bg raised; checked → bg `--cyanotype` + `Check` 12px putih. Ini **visibility toggle**, bukan seleksi.
  - Ikon section 15px `--ink-tertiary` (Lucide: `User`, `AlignLeft`, `Briefcase`, `GraduationCap`, `Wrench`, `FolderGit2`, `BadgeCheck`, `Languages`, `Trophy`, `HeartHandshake`).
  - Label Plex Sans 500 13.5px `--ink`. Section tersembunyi → label `--ink-tertiary` + `line-through` tipis? **Tidak** — pakai opacity .55 tanpa coretan (lebih terbaca).
  - Kanan: **CompletenessDots** — 3 titik 4px gap 2. 0 terisi = kosong, 1 = mulai, 2 = sebagian, 3 = lengkap (`--signal-ok`). Tooltip mono 10px menjelaskan: "Lengkap: 4/4 field wajib".
  - Drag handle `GripVertical` 14px `--ink-tertiary`, opacity 0 → 1 saat hover/focus.
  - **Aktif**: bg `--cyanotype-wash` · label `--ink` 600 · inset `box-shadow: 2px 0 0 var(--cyanotype)`.
  - Hover (non-aktif): bg `rgba(16,22,31,.04)`.
- **AddSectionButton**: full-width `h36` · border 1px dashed `--rule-strong` · radius 6 · teks Plex Sans 500 13px `--ink-secondary` · `+ Tambah bagian` · hover: border+teks `--cyanotype`, bg `--cyanotype-wash`. Membuka Dialog berisi katalog section yang belum ada + deskripsi 1 baris + tombol `Tambah`.
- **CompletenessMeter** (di bawah, dipisah `border-t 1px --rule` pt-10): eyebrow `KELINGKAPAN CV` + track `h4 radius-999 bg --rule` + fill `--cyanotype` + mono 10.5px `62%`. Klik → buka drawer ATS.
- **Icon rail 1024–1279px**: `w56`, hanya ikon section 18px + dots vertikal 3px di bawahnya; tooltip shadcn di kanan.

### 5.4 Form Pane (Center)

- Kontainer: `flex-1 min-w-[380px] max-w-[520px]` · `--surface` · `overflow-y-auto` · `px-20 py-16`.
- **FormPaneHeader**: eyebrow `BAGIAN 03 / 09` (nomor = posisi nyata dalam dokumen, jadi sah) · judul Archivo 600 15px `--ink` · subjudul Plex Sans 12.5px `--ink-secondary` satu kalimat penjelas ("Urutan terbaru dulu. Gunakan bullet untuk pencapaian, bukan daftar tugas.").
- **Field**: `mb-14`. Label `text-label` `mb-5` flex space-between; kanan opsional = hint mono 10px `--ink-tertiary` (`opsional`, `68/180`). Input `h38 px-11 radius-6 border 1px --rule bg raised` Plex Sans 400 14px `--ink`, placeholder `--ink-tertiary`. Hover border `--rule-strong`. **Focus**: border `--cyanotype` + `box-shadow 0 0 0 3px rgba(15,90,120,.16)`; outline none hanya jika ring ada. Error: border `--signal-bad` + ring `rgba(176,58,43,.14)` + teks error 12px `--signal-bad` dengan `AlertCircle` 13px, dihubungkan `aria-describedby`.
- **TextArea**: min-h 84 · auto-grow · `resize-none` · `py-10` · line-height 1.55.
- **DateRangeField**: dua `MonthPicker` (input `type=month` native + fallback popover kalender bulan) dipisah `–` mono `--ink-tertiary`. Di bawahnya `ToggleRow` "Saya masih bekerja di sini" → mengunci & menyembunyikan field tanggal selesai, menampilkan chip mono `SEKARANG` bg `--cyanotype-wash` teks `--cyanotype`.
- **ToggleRow**: `h40 flex justify-between align-center px-11 radius-6 bg raised border 1px --rule`. Kiri: label 13.5px + detail 12px `--ink-secondary`. Kanan: Switch 36×20 (shadcn), checked = `--cyanotype`.
- **EntryCard** (experience/education/project/dll): border 1px `--rule` · radius 8 · bg raised · `mb-10` · overflow hidden.
  - Header `h44 px-12` flex gap 8 align-center · cursor pointer untuk collapse: kiri `ChevronRight` 14px yang rotate 90° saat terbuka; tengah ringkasan dua baris (role Plex Sans 600 13.5px `--ink`; company · tanggal mono 11px `--ink-secondary` truncate); kanan kluster ikon 16px `GripVertical` `Copy` `Trash2` dalam `--ink-tertiary`, hover masing-masing → `--cyanotype` / `--cyanotype` / `--signal-bad`. Hover ikon muncul hanya saat kartu di-hover/focus (mengurangi noise).
  - Body `px-12 pb-12` · border-t 1px `--rule` saat terbuka.
  - Kartu invalid (ada error Zod) → strip 2px `--signal-bad` di tepi kiri via inset shadow + badge mono 10px `1 isu`.
- **BulletListEditor**: tiap bullet = baris flex gap 8 `mb-6`. Prefix mono `›` 12px `--ink-tertiary` `pt-9 w-10`. TextArea auto-grow flex-1. Kanan bawah: counter mono 10px — `--ink-tertiary` normal, `--signal-warn` < 40 char ("terlalu pendek"), `--signal-bad` > 200 char ("terlalu panjang"). Ikon `Trash2` 14px muncul saat hover. Tombol `+ Tambah bullet` ghost `h32` Plex Sans 500 12.5px `--cyanotype`.
  - Fase 12 menambahkan ikon `Sparkles` 14px + teks `Perbaiki dengan AI` di kanan tiap bullet, **hanya saat hover/focus**, dengan kuota tersisa di tooltip.
- **ChipsInput** (skills, stack): kontainer seperti input, flex-wrap gap 6 `py-7 px-9`. Chip = `h24 px-8 radius-4 bg --cyanotype-wash` teks Plex Sans 500 11.5px `--cyanotype` + `X` 11px. Enter/koma = buat chip. Backspace di input kosong = hapus chip terakhir. Placeholder "Ketik lalu tekan Enter".
- **SkillGroups**: tiap grup = header (nama grup, input inline Archivo 600 13px) + ChipsInput + `Trash2`. `+ Tambah grup`. **Tidak ada** level/bintang/progress bar — dilarang P5 & `plan.md`.
- **FirstRunCard** (kunjungan pertama, di dalam Form Pane, bukan modal): border 1px `--rule` radius 8 bg raised p-14 · eyebrow `MULAI DARI MANA?` · tiga baris opsi radio-kartu:
  1. `Pakai contoh CV` — "Terisi data Alex Morgan, Software Engineer. Bisa kamu ubah semua." **(default, terpilih)**
  2. `Mulai dari kosong` — "Dokumen bersih, semua bagian kosong."
  3. `Nanti saja` — menutup kartu.
  Baris = `h48 px-12 radius-6 border 1px --rule` flex align-center gap 10; terpilih → border 2px `--cyanotype` + bg `--cyanotype-wash`. Tombol bawah `Lanjut` solid cyanotype `h36`. Setelah dipilih, tidak muncul lagi (flag di IndexedDB).
- **EmptyState** generik: ikon 28px `--ink-tertiary` di dalam lingkaran 48px bg `--surface` · judul Plex Sans 600 14px `--ink` · body 13px `--ink-secondary` max-w 320 center · tombol primer/ghost.

### 5.5 Preview Well (Kanan)

- Kontainer: `flex-1` · `--surface-workbench` · `inset shadow` · `overflow-auto` · `p-24` · flex-col align-center gap 16.
- **PreviewToolbar** (sticky di atas well, `h40` · bg `rgba(255,255,255,.86)` + `backdrop-blur(6px)` · radius 8 · border 1px `--rule` · px-10 flex gap 6 align-center):
  - `Minus` / pers mono 11px `--ink` (klik = popover preset) / `Plus`, lebar 28×28 ghost radius 4. Preset: 50 · 75 · 100 · **Fit** (menghitung skala agar lebar sheet = lebar well − 48).
  - Divider 1px `--rule` h20.
  - `HAL 1 / 2` mono 11px uppercase `--ink-secondary`.
  - Divider.
  - Toggle ikon `Ruler` (margin guides) & `Highlighter` (kata kunci cocok, disabled + tooltip "Tempel deskripsi lowongan dulu" sebelum Fase 7 aktif). Toggle on = bg `--cyanotype-wash` + ikon `--cyanotype`.
- **PageSheet**: `w-[794px] h-[1123px]` · bg `#FFF` · radius 1px · shadow seperti 2.4 · `transform-origin: top center` · `transform: scale(var(--zoom))`. Kontainer pembungkus diberi tinggi hasil kalkulasi agar scrollbar benar (`h-[calc(1123px*var(--zoom))]`).
- **MarginRuler** (opsional, `pointer-events-none absolute inset-0`): 4 hairline 1px `--cyanotype` opacity .25 pada jarak margin; tick setiap 10mm (panjang 4px, opacity .35) di tepi atas & kiri **di dalam pita margin kertas** (revisi Fase 4: bukan −14px di luar sheet — di luar sheet ia memicu scroll horizontal well pada zoom ≤100% karena well sudah pas dengan lebar lembar saat Fit), label mm Plex Mono 8px `--ink-tertiary` setiap 20mm.
- **PageCaption**: di bawah tiap sheet, mono 10.5px uppercase tracking +0.08em `--ink-secondary` → `HAL 1`. Antar sheet gap 24px.
- **ScanSweep** (saat Check ATS): `absolute` garis 2px `--cyanotype` opacity .55 + gradien vertikal 120px di belakangnya, animasi `translateY(0 → 100%)` 700ms sekali.
- **KeywordMark**: `<mark>` di dalam renderer screen · bg `color-mix(in srgb, var(--highlighter) 34%, transparent)` · color inherit · `padding 0 1px` · radius 2px · `box-decoration-break: clone`.
- **PreviewSkeleton**: saat hydrate pertama, sheet placeholder bg raised dengan 6 bar `--surface` beranimasi shimmer halus (hanya jika > 250ms).

### 5.6 Drawer ATS

- Trigger: `CheckAtsButton`. Kontainer: fixed kanan, `w400` (mobile: full-screen sheet dari bawah, `h-[92dvh]`, radius atas 12) · bg `--surface` · border-l 1px `--rule` · shadow `-8px 0 32px -12px rgba(16,22,31,.22)` · z-40 · scrim `rgba(16,22,31,.20)`.
- Header `h56 px-16` flex space-between border-b 1px `--rule`: judul Archivo 600 15px `Periksa ATS` + `X` 18px ghost.
- **Tabs** dua: `Masalah (7)` · `Parse tape`. Tab bar `h40 px-16`, indikator bawah 2px `--cyanotype`, label Plex Sans 600 13px; non-aktif `--ink-secondary`.
- **ScoreBlock** `px-16 py-16 border-b 1px --rule`:
  - Kiri: angka Archivo Expanded 700 **56px** line-height .9 `--ink`, di bawahnya eyebrow `INDEKS STRUKTUR`.
  - Kanan: **bar 20 tick** — tiap tick `w4 h20 radius-1 gap-2`, warna mengikuti sebaran severity (bad/warn/ok). Bukan gauge melingkar.
  - Bawah: band label Plex Sans 600 13px (`Baik`) + **disclaimer permanen** 12px `--ink-secondary` line-height 1.5: "Memeriksa struktur & keterbacaan. Setiap ATS punya parser berbeda, jadi tidak ada jaminan lolos."
  - Meta mono 10.5px `--ink-tertiary`: `DIPERIKSA 14.32 · TEMPLATE LEDGER`.
- **IssueRow** `px-16 py-12 border-b 1px --rule` flex gap 10:
  - Kiri glyph 20×20 radius 4: bad = bg `rgba(176,58,43,.12)` + `AlertOctagon` `--signal-bad`; warn = `rgba(169,118,22,.14)` + `AlertTriangle` `--signal-warn`; ok = `rgba(46,122,80,.12)` + `Check` `--signal-ok`; info = `--cyanotype-wash` + `Info`.
  - Tengah: judul Plex Sans 500 13.5px `--ink`; detail 12.5px/1.5 `--ink-secondary`; bila bisa dilokalisasi → link tombol `Perbaiki →` Plex Sans 600 12.5px `--cyanotype` (klik: tutup drawer di < 1280px, scroll + focus field terkait, flash `--cyanotype-wash` 600ms).
  - Grup berdasarkan severity: **Wajib diperbaiki** → **Sebaiknya** → **Sudah baik** (collapsible, default terbuka untuk dua pertama).
- **ParseTape**: bg `--machine` · `px-14 py-12` · mono 11.5px / 1.7 · `overflow-auto` · max-h 60dvh.
  - Tiap baris: tag `w-[74px] inline-block` uppercase 9.5px tracking +0.08em `--machine-dim` · lalu teks `--machine-text`. Tag `UNCLAIMED` diberi warna `--signal-warn` (menandakan teks yang mungkin tidak terpeta oleh parser).
  - Kata kunci cocok: `<mark>` bg `rgba(242,214,0,.22)` teks `--highlighter`.
  - Header tape: eyebrow `URUTAN PARSE TERSIMULASI · LEDGER` `--machine-dim` + tombol ghost `Salin teks` (ikon `Copy`, mono 10.5px `--machine-text`).
  - Footer tape: mono 10px `--machine-dim` → `1 248 karakter · 187 kata · 2 halaman`.

### 5.7 Mobile

- **Top bar** `h52 px-12`: BrandMark 20 + title truncate flex-1 + `Menu` ghost 36×36 → Sheet berisi: pilih template, ukuran kertas, margin, bahasa, periksa ATS, simpan ke cloud, reset dokumen, privasi.
- **SegmentedTab** sticky `top-52 h44 px-12 bg --surface-sunken border-b 1px --rule`: dua segmen flex-1 `h32 radius-6`, indikator geser `--surface-raised` + shadow raised; label Plex Sans 600 13px; aktif `--ink`, non-aktif `--ink-secondary`. Isi: `Isi data` · `Pratinjau`.
- **StickyActionBar** `fixed bottom-0 h64 px-12 bg --surface-raised border-t 1px --rule` + `padding-bottom: env(safe-area-inset-bottom)`: kiri ghost `Bagian` (ikon `List` + label 12.5px) `h44 px-12`; kanan `Download PDF` flex-1 `h44` solid cyanotype Archivo 600 14px.
- **SectionSheet**: bottom sheet `h-[80dvh]` radius atas 12 · daftar section seperti rail + **tombol panah `ArrowUp`/`ArrowDown` 32×32** di tiap baris sebagai alternatif drag (sesuai `plan.md`) · `+ Tambah bagian` sticky di bawah sheet.
- **Preview mobile**: sheet diskalakan `Fit`, bisa di-pinch-zoom; toolbar mini di atas (zoom + margin toggle).

### 5.8 Homepage (di bawah workspace)

Urutan mengikuti `plan.md` §3C. Semua section memakai `content-visibility: auto` + `contain-intrinsic-size` supaya tidak membebani LCP/INP.

| # | Section | Look |
| :-- | :-- | :-- |
| 1 | **Workspace** | Viewport pertama. `h-[calc(100dvh-56px)]` min-h 640. Tidak ada headline marketing. |
| 2 | **Template Gallery** | `py-72 px-24 max-w-1200 mx-auto`. Eyebrow `PILIHAN TEMPLATE` cyanotype · judul display-md "Lima template, satu aturan: satu kolom." · grid `repeat(auto-fill, minmax(220px,1fr)) gap-20`. Tiap kartu = **render A4 nyata** (komponen template diskalakan 0.24, bukan gambar) dalam frame bg `--surface-workbench` p-12 radius 8 · nama Archivo 600 13px · deskripsi 12px `--ink-secondary` 2 baris · hover: translateY(-3px) + shadow raised + tombol `Pakai template` fade-in. Aktif: ring 2px cyanotype. |
| 3 | **Panduan Format ATS** | Layout 2 kolom ≥1024: kiri sticky `top-96` (eyebrow + display-md + body-lg), kanan daftar aturan. Tiap aturan = baris `py-16 border-t 1px --rule` dengan nomor mono 11px `--ink-tertiary` `01` (ini urutan baca nyata), judul Plex Sans 600 14px, body 13.5px. **Pusat visual:** dua lembar A4 mini berdampingan — kiri bergaris `--signal-bad` dengan tanda `✗` pada foto, skill bar, tabel 2 kolom, ikon; kanan bergaris `--signal-ok` dengan `✓`. Caption mono 10.5px uppercase. |
| 4 | **3 Langkah** | Stepper **vertikal**, bukan 3 kartu sejajar. Rule 1px `--rule` di kiri sebagai penghubung. Tiap langkah: nomor Archivo Expanded 700 40px `--cyanotype` di dalam lingkaran 64px bg `--cyanotype-wash`, judul display-md kecil, body-lg max-w 560, dan **screenshot/mini-render nyata** di kanan pada ≥1024. Langkah: `1 Buka — langsung ke editor` · `2 Isi — preview berubah saat kamu mengetik` · `3 Unduh — PDF berbasis teks, gratis`. |
| 5 | **FAQ** | `max-w-760 mx-auto py-72`. Accordion shadcn, `border-t 1px --rule` tiap item, pertanyaan Plex Sans 600 14.5px, ikon `+` mono 16px `--cyanotype` rotate 45° saat terbuka, jawaban 13.5px/1.65 `--ink-secondary` `pb-16`. Isi wajib: privasi data (diproses di browser), apa itu ATS, kenapa tidak ada jaminan lolos, apakah PDF-nya bisa dibaca mesin, apakah benar-benar gratis, batasan AI. |
| 6 | **Footer** | bg `--surface-sunken` border-t 1px `--rule` `py-48 px-24`. Grid 4 kolom (Produk · Template · Sumber daya · Legal) gap 32; link Plex Sans 400 13px `--ink-secondary` hover `--cyanotype`. Bawah: border-t + flex space-between: kiri BrandMark kecil + mono 11px `--ink-tertiary`; kanan **pernyataan privasi satu baris** Plex Sans 12.5px `--ink-secondary`: "Semua data CV diproses di browser kamu. Tidak ada yang diunggah, kecuali kamu login dan memilih menyimpan." |

### 5.9 Dashboard (Fase 10)

- Header `py-24`: display-md "CV kamu" + tombol `+ Buat CV baru` solid cyanotype.
- Grid `repeat(auto-fill, minmax(240px,1fr)) gap-20`. Kartu: thumb A4 nyata skala 0.26 bg workbench · judul Plex Sans 600 14px (rename inline) · meta mono 10.5px `--ink-tertiary` `LEDGER · DIUBAH 2 HARI LALU` · `Star` favorit · overflow `⋯` → Edit nama / Duplikat / Unduh PDF / Hapus (konfirmasi Dialog, teks merah).
- Empty state: "Belum ada CV tersimpan di cloud" + body menjelaskan bahwa dokumen anonim tetap ada di perangkat ini + tombol `Buat CV baru`.

### 5.10 Auth (Fase 10)

- Layout split ≥1024: kiri 45% bg `--surface-sunken` dengan lembar A4 contoh + satu kutipan mono; kanan form `max-w-360`.
- Tombol `Lanjut dengan Google` (outlined, logo Google, h44) · divider `atau` · input email + `Kirim tautan login` (solid cyanotype h44).
- Copy jujur di bawah: "Login hanya perlu kalau kamu ingin menyimpan CV di cloud atau memakai fitur AI. Membuat dan mengunduh PDF tetap gratis tanpa akun."

### 5.11 Dialog & Toast

- **Dialog**: overlay `rgba(16,22,31,.42)` + `backdrop-blur(2px)` · panel bg raised radius 12 shadow `0 24px 64px -16px rgba(16,22,31,.32)` · `w-full max-w-440 p-20` · judul Archivo 600 16px · body 13.5px `--ink-secondary` · footer flex justify-end gap 8 (`Batal` ghost, aksi primer solid; aksi destruktif = solid `--signal-bad`).
- **Toast**: pojok kanan-bawah (mobile: atas, di bawah top bar) · bg `--machine` teks `--machine-text` · radius 8 · px-14 py-10 · Plex Sans 500 13px + ikon status · auto-dismiss 3.5s · maksimal 3 bertumpuk.

---

## 6. Fase Implementasi

> 13 fase. Fase 0–9 = MVP publik (Tier 1 `plan.md`). Fase 10–11 = Tier 2. Fase 12 = Tier 3.

### ☑ FASE 0 — Fondasi Proyek & Validasi Teknis *(selesai 2026-10-18, semua gate hijau)*

- [x] **T0.1 Bootstrap repo**
  - [x] `pnpm create vite . --template react-ts` di `ats-builder`, target ES2022, `strict: true`, `noUncheckedIndexedAccess: true`
  - [x] Pasang & konfigurasi Tailwind CSS v4 (`@import "tailwindcss"` + `@theme`), ESLint (flat config) + Prettier + `eslint-plugin-jsx-a11y`
  - [x] Path alias `@/*` → `src/*` di `tsconfig.json` + `vite.config.ts`
  - [x] Husky + lint-staged (pre-commit: lint + typecheck pada file berubah)
  - [x] Script package.json sesuai daftar §1 — *kecuali `lhci`*, yang oleh §1 sendiri ditandai "mulai Fase 9" (beserta `lighthouserc.json`); sisanya ada: `dev` `build` `typecheck` `lint` `format` `test` `test:watch` `test:e2e` `pdf:verify`, plus `build:spike` untuk mengukur chunk PDF
  - [x] `.gitignore` (node_modules, dist, .env*, playwright-report, test-results) + commit awal
- [x] **T0.2 Dependensi inti**
  - [x] `zustand`, `zod`, `react-hook-form`, `@hookform/resolvers`, `idb-keyval`, `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities`, `lucide-react`, `react-router`, `clsx`, `tailwind-merge`, `class-variance-authority`
  - [x] `pdf-lib` + `@pdf-lib/fontkit` (pengganti `@react-pdf/renderer` — lihat revisi §3; fontkit dibutuhkan pdf-lib untuk menanam TTF)
  - [x] Init shadcn/ui (button, input, textarea, label, dialog, sheet, popover, tabs, switch, tooltip, accordion, dropdown-menu, toast/sonner, checkbox, scroll-area, separator)
  - [x] Dev: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `fake-indexeddb`
- [x] **T0.3 Token desain → kode** *(mengeksekusi §2.2–2.3)*
  - [x] `src/styles/tokens.css`: semua token warna sebagai `@theme` Tailwind v4 (`--color-workbench`, `--color-cyanotype`, dst.)
  - [x] Token tipografi sebagai utility/class (`text-eyebrow`, `text-panel-title`, `text-data`, …)
  - [x] Unduh & self-host font: **Archivo** (600, Expanded 700), **IBM Plex Sans** (400, 400i, 500, 600), **IBM Plex Mono** (400, 500, 600) → WOFF2 subset latin di `public/fonts/`
  - [x] Unduh **TTF** untuk PDF: IBM Plex Sans (Regular, Italic, Medium, SemiBold, Bold), IBM Plex Mono (Regular, Medium, SemiBold), Archivo (SemiBold, Bold), Source Serif 4 (Regular, Italic, Bold)
  - [x] `@font-face` dengan `font-display: swap`; preload hanya Plex Sans 400 + Archivo 600
  - [x] Base layer: `body { background: var(--surface); color: var(--ink); font-feature-settings: "cv05","ss01"; }`, `:focus-visible` ring global 2px `--cyanotype` offset 2px
  - [x] `@media (prefers-reduced-motion: reduce)` global (durasi → 0.01ms, animasi non-esensial mati)
  - [x] Halaman token internal `/dev/tokens`: swatch warna + skala tipe + semua state tombol/input (dipakai sebagai living spec; tidak di-index, di-exclude dari build prod lewat env)
- [x] **T0.4 Spike PDF — gate paling penting fase ini**
  - [x] Cek kompatibilitas `@react-pdf/renderer` dengan React 19; bila bermasalah, dokumentasikan opsi (pin React 18 di subtree PDF / downgrade ke v3 / fallback `pdf-lib`) — *v4.9.0 deklarasikan peer `react ^19.0.0` dan jalan, tapi engine-nya terbukti membuang teks → lihat §10 & Execution Log; diputuskan pindah ke `pdf-lib`*
  - [x] `src/lib/units.ts` + unit test: `mmToPx`, `mmToPt`, `pxToMm`, `A4_PX = {w:794,h:1123}`, `A4_PT = {w:595.28,h:841.89}`
  - [x] Dokumen uji: 1 halaman A4, margin 16mm, nama + 3 bullet, font TTF terdaftar via `Font.register`
  - [x] Render lewat `pdf(<Doc/>).toBlob()` → unduh via object URL + `URL.revokeObjectURL`
  - [x] Verifikasi: teks **bisa diseleksi & di-copy**, urutan baca benar, tidak ada glyph pecah, ukuran A4 tepat
  - [x] Uji `wrap` & page-break otomatis dengan 60 bullet; uji prop `fixed` untuk header berulang
  - [x] Ukur: durasi render 1 halaman & 2 halaman; ukuran chunk PDF (harus lazy, tidak masuk bundle awal)
- [x] **T0.5 Spike preview layar**
  - [x] Kotak `794×1123` dengan `transform: scale(z)`, `transform-origin: top center`, kontainer ber-tinggi terkalkulasi
  - [x] Bandingkan render HTML vs PDF untuk teks yang sama: margin, ukuran font, line-height harus cocok secara visual (toleransi ±1mm) — *Δ 0,00 mm di sisi layar; sisi PDF tepat (45.35pt/24pt/10pt/14.2pt)*

**Gate Fase 0**
- [x] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` semua hijau
- [x] PDF hasil spike: teks ter-copy, urutan benar (dibuktikan dengan output `pnpm pdf:verify` yang dilampirkan di PR/commit message) — *15/15 pemeriksaan lolos setelah engine pindah ke pdf-lib*
- [x] Bundle awal (sebelum chunk PDF) < 220 KB gzip — *terukur 110,6 KB gzip*
- [x] `/dev/tokens` menampilkan seluruh token §2.2 dan skala §2.3 tanpa deviasi

---

### ☑ FASE 1 — Skema Data, Store, dan Persistensi Lokal *(selesai 2026-10-18, semua gate hijau)*

- [x] **T1.1 Tipe & skema**
  - [x] `src/types/resume.ts` — salin persis §4
  - [x] `src/schema/resume.ts` — Zod schema untuk `ResumeDoc` + tiap entri; pesan error dalam Bahasa Indonesia & spesifik ("Email belum benar. Contoh: nama@domain.com")
  - [x] `schemaVersion = 1` + `migrate(doc: unknown): ResumeDoc` berantai, dengan test fixture dokumen v0/rusak
  - [x] Factory `createEmptyDoc()`, `createSampleDoc()` (Alex Morgan, Software Engineer, 2 pengalaman, 1 pendidikan, 3 grup skill, 2 proyek, 1 sertifikasi, 2 bahasa) — **lengkap dan realistis**, ini yang dilihat pengguna di detik pertama
  - [x] `src/features/sections/registry.ts`: per kind → `{ kind, labelId, icon, defaultData(), isComplete(data), requiredFields[], maxEntries? }`
- [x] **T1.2 Zustand store**
  - [x] `docStore`: `doc`, `activeSectionId`, aksi `updateSection`, `updateEntry`, `addEntry`, `removeEntry`, `duplicateEntry`, `reorderSection`, `reorderEntry`, `toggleSectionVisible`, `addSection`, `removeSection`, `setTemplate`, `setTitle`, `setPageSettings`, `setThemeTokens`, `resetDoc`, `loadDoc`
  - [x] Semua aksi melewati satu `commit(mutator)` yang menaikkan `meta.updatedAt` dan mendorong ke history stack (siap dipakai Fase 11)
  - [x] `uiStore`: `zoom`, `fitMode`, `panelMode('3col'|'icon-rail'|'tabs')`, `activeTab('form'|'preview')`, `showMarginGuides`, `showKeywordMarks`, `atsDrawerOpen`, `atsTab`, `firstRunSeen`
  - [x] `atsStore`: `report`, `isChecking`, `lastCheckedAt`, `keywords`
  - [x] `syncStore`: `status('saved-local'|'saving'|'saved-cloud'|'offline'|'error')`, `lastSyncedAt`, `error`
  - [x] Uji selector: pastikan perubahan `experience` **tidak** merender komponen `skills` (test dengan render counter)
- [x] **T1.3 Persistensi IndexedDB**
  - [x] `src/features/persistence/idb.ts` via `idb-keyval`: key `ats:doc:v1`, `ats:prefs:v1`, `ats:firstRun`
  - [x] `autosave.ts`: subscribe `docStore`, debounce 400ms → tulis; status `saving` → `saved-local`
  - [x] Flush paksa di `visibilitychange`(hidden) & `pagehide`
  - [x] Load saat boot: baca → `migrate` → validasi Zod → kalau gagal, simpan salinan di `ats:doc:corrupt:<ts>` lalu mulai dari `createSampleDoc()` + toast penjelasan (bukan layar kosong)
  - [x] Fallback bila IndexedDB ditolak (private mode): pakai in-memory + banner non-blocking "Perubahan tidak tersimpan di perangkat ini"
  - [x] Deteksi `navigator.onLine` + event `online`/`offline` → `syncStore.status`
- [x] **T1.4 Utilitas**
  - [x] `lib/dates.ts`: `formatMonth('2024-03', lang)` → `Mar 2024` / `Mar 2024` (id: `Mar 2024`), `durationLabel(start,end,current)` → `1 thn 4 bln`, `isReverseChronological(entries)`, `hasGapOver(entries, months)`
  - [x] `lib/text.ts`: `wordCount`, `charLen`, `startsWithActionVerb`, `containsMetric`, `stripDiacritics`, `tokenize`
  - [x] `lib/i18n.ts`: `t(key)` + `dictionaries/id.ts` (lengkap) + `en.ts` (stub). Semua string UI **wajib** lewat `t()` sejak fase ini
- [x] **T1.5 Test**
  - [x] Unit: Zod schema (valid/invalid per field), migrate, dates, text
  - [x] Unit: setiap aksi docStore (termasuk reorder & undo-able commit)
  - [x] Integration (fake-indexeddb): tulis → reload store → data identik

**Gate Fase 1**
- [x] `pnpm test` hijau, coverage `lib/` + `store/` + `schema/` ≥ 85%
- [x] Isi form → refresh browser → data utuh (dibuktikan test Playwright mini `tests/e2e/persistence.spec.ts`)
- [x] `pnpm typecheck` hijau tanpa `any` di `types/` & `store/`
- [x] Tidak ada string UI hardcoded (grep `'Simpan'` dll. hanya muncul di `dictionaries/`)

---

### ☑ FASE 2 — Design System & App Shell *(selesai 2026-10-18, semua gate hijau)*

- [x] **T2.1 Primitif sesuai token**
  - [x] `Button` varian: `primary` (solid cyanotype) · `secondary` (outlined cyanotype) · `ghost` · `subtle` (bg surface) · `destructive`; ukuran `sm 32` `md 36` `lg 44`; state hover/active/disabled/focus-visible persis §5.2
  - [x] `Input`, `Textarea` (auto-grow), `Label`, `FieldWrapper` (label + hint + error + `aria-describedby`), `Switch`, `Checkbox` kustom 16px
  - [x] `Dialog`, `Sheet` (kanan & bawah), `Popover`, `DropdownMenu`, `Tooltip`, `Tabs`, `Accordion`, `ScrollArea`, `Separator`, `Sonner/Toast` bertema `--machine`
  - [x] `IconButton` (28/32/36), `Chip`, `Badge`, `EmptyState`, `PanelHeader`, `Eyebrow`
  - [x] Storybook-**lite**: perluas `/dev/tokens` jadi katalog semua komponen & state (tanpa dependensi Storybook)
- [x] **T2.2 Routing & shell**
  - [x] React Router: `/`, `/r/:resumeId`, `/templates`, `/dashboard`, `/login`, `/auth/callback`, `/privacy`, `/terms`, `/cover-letter`
  - [x] `AppShell`: `TopBar` + `main` grid; breakpoint listener (`matchMedia`) → `uiStore.panelMode`
  - [x] `ErrorBoundary` root + per-route: layar bg `--surface`, ikon `AlertOctagon` `--signal-bad`, judul Archivo 600 18px "Ada yang tidak beres", body menjelaskan + tombol `Muat ulang` dan `Kembali ke editor` (data lokal aman)
  - [x] `SkipToContent` link (muncul saat Tab pertama)
- [x] **T2.3 Top Bar** — implementasi penuh §5.2
  - [x] `BrandMark` (SVG inline 22×22, goresan stabilo), wordmark Archivo Expanded
  - [x] `DocumentTitle` editable inline (Enter/Esc, blur = simpan, kosong → revert + toast)
  - [x] `SaveStatusPill` 5 status + `aria-live="polite"` + klik retry saat error
  - [x] Slot kanan: `TemplateSelect` (popover grid — isi thumbnail menyusul Fase 6, sementara nama + ikon), `CheckAtsButton` (disabled + tooltip "Tersedia setelah Fase 7" selama dev), `DownloadButton` — *tombol unduh tampil dengan state disabled + tooltip "Tersedia setelah Fase 5" sampai jalur PDF ada; state `Membuat PDF…` menyusul bersama T5.2*
  - [x] Mobile: collapse ke Brand + Title + `Download` + `Menu` sheet — *di 768–1023 unduh tetap di top bar, di <768 pindah ke sticky bar (§5.7)*
- [x] **T2.4 Grid 3 panel + responsif**
  - [x] Layout `grid-cols-[248px_minmax(380px,520px)_1fr]` ≥1280; `grid-cols-[56px_minmax(360px,1fr)_1fr]` 1024–1279; single-col + `SegmentedTab` 768–1023; mobile < 768
  - [x] `Rail` (sunken) dengan scroll-area; mode icon-rail + tooltip — *isi rail masih navigasi minimum; visibility checkbox, completeness dots, dan reorder adalah T3.1–T3.2*
  - [x] `PreviewWell` (workbench) dengan inset shadow
  - [x] `MobileTabBar` segmented dengan indikator geser
  - [x] `StickyActionBar` mobile + `env(safe-area-inset-bottom)` + body padding-bottom agar tidak menutupi konten
- [x] **T2.5 Motion & a11y dasar**
  - [x] `MotionProvider`/CSS vars untuk durasi; semua animasi lewat token (`--dur-fast 120ms`, `--dur-base 180ms`, `--dur-slow 280ms`)
  - [x] Reduced-motion menghormati §2.6 (uji manual dengan emulasi Chrome)
  - [x] `focus-visible` di semua interaktif; uji Tab penuh tanpa mouse di desktop & mobile
  - [x] Kontras: audit semua pasangan teks/latar ≥ 4.5:1 (body) & ≥ 3:1 (teks besar, ikon) — *`tests/unit/contrast.test.ts`, 25 pasangan; dua token digelapkan minimal sesuai revisi §2.2*

**Gate Fase 2**
- [x] `/dev/tokens` menampilkan seluruh komponen dengan semua state
- [x] Resize 360 → 1920 tanpa layout rusak, tanpa horizontal scroll (kecuali di PreviewWell)
- [x] Navigasi keyboard penuh: semua kontrol bisa dicapai & dioperasikan tanpa mouse
- [x] `pnpm build` hijau; CLS pada shell = 0 (diukur Lighthouse lokal) — *terukur 0,0000 lewat PerformanceObserver `layout-shift` (metrik yang sama dengan Lighthouse); `lhci` baru dipasang di Fase 9 sesuai §1*
- [x] Tidak ada warna/ukuran hardcoded di komponen — semua lewat token (verifikasi: grep hex di `src/components` & `src/features` = 0 hasil di luar `tokens.css` dan renderer template)

---

### ☑ FASE 3 — Rail Section & Form Editor Lengkap *(selesai 2026-10-18, semua gate hijau)*

- [x] **T3.1 SectionList (rail kiri)** — §5.3
  - [x] Render dari `doc.sections` (urutan array)
  - [x] Visibility checkbox, ikon per kind, label, `CompletenessDots` (0–3) + tooltip penjelasan
  - [x] State aktif (wash + inset bar 2px cyanotype) terikat `activeSectionId`
  - [x] PanelHeader `SECTIONS` + counter `visible/total`
  - [x] `AddSectionButton` + Dialog katalog (hanya kind yang belum ada; tiap baris: ikon, nama, deskripsi 1 kalimat, tombol `Tambah`)
  - [x] Menu konteks per item (klik kanan / `⋯`): Sembunyikan · Duplikat · Hapus (dengan Dialog konfirmasi bila berisi data)
  - [x] `CompletenessMeter` + klik membuka drawer ATS
- [x] **T3.2 Reorder section (@dnd-kit)**
  - [x] `SortableContext` vertical, `PointerSensor` (activationConstraint distance 5) + `KeyboardSensor` (Space angkat, panah pindah, Space lepas)
  - [x] DragOverlay: kartu bg raised radius 6 shadow raised scale 1.01; placeholder garis 2px `--cyanotype`
  - [x] **Alternatif non-drag**: tombol `ArrowUp`/`ArrowDown` 28×28 muncul saat hover/focus (wajib di mobile & untuk keyboard)
  - [x] `aria-live` mengumumkan urutan baru ("Experience pindah ke posisi 3")
- [x] **T3.3 Field & EntryCard dasar**
  - [x] `Field`, `MonthPicker`, `DateRangeField` + toggle `Saya masih bekerja di sini` (mengunci endDate, chip `SEKARANG`)
  - [x] `EntryCard` collapse/expand, header ringkasan, kluster ikon (drag/duplikat/hapus), strip error
  - [x] `EntryList`: `+ Tambah <entri>`, reorder entri (dnd-kit + panah), duplikat (id baru), hapus dengan konfirmasi bila > 1
  - [x] Auto-expand entri baru & scroll ke dalamnya; entri lain collapse otomatis (satu terbuka pada satu waktu, bisa di-override)
- [x] **T3.4 Editor per section** (binding langsung ke store: controlled components, validasi Zod per field saat nilai berubah, `updateSection`/`updateEntry` menimpa history dalam jendela 150ms supaya undo nanti per-burst ketikan, bukan per-ketikan — keputusan owner 2026-10-18 mengganti "React Hook Form + `watch` debounced")
  - [x] **Profile**: fullName, headline, email, phone, location, `LinksEditor` (label + url, tambah/hapus, validasi URL, auto-prefix `https://`)
  - [x] **Summary**: TextArea auto-grow + counter kata (target 40–90 kata, hint mono) + tombol `Contoh` (mengisi contoh yang bisa diubah)
  - [x] **Experience**: role, company, location, DateRangeField+current, `BulletListEditor`, `ChipsInput` stack
  - [x] **Education**: degree, field, institution, location, DateRange, gpa (validasi 0–4.00), notes (bullet)
  - [x] **Skills**: `SkillGroups` + `ChipsInput`. **Tanpa** level/bintang/bar
  - [x] **Projects**: name, role, url, DateRange, bullets, stack
  - [x] **Certifications**: name, issuer, issuedAt, credentialId, url
  - [x] **Languages**: name + `ProficiencySelect` (5 tingkat, teks bukan bar)
  - [x] **Awards**: title, issuer, awardedAt, description
  - [x] **Volunteering**: role, organization, DateRange+current, bullets
- [x] **T3.5 BulletListEditor detail** — §5.4
  - [x] Auto-grow textarea, prefix `›`, counter char dengan ambang 40/200 berwarna warn/bad
  - [x] Reorder bullet (dnd + panah), hapus, `+ Tambah bullet`
  - [x] Deteksi `startsWithActionVerb` & `containsMetric` → hint inline non-blocking mono 10.5px `--signal-warn` ("Belum ada angka. Tambahkan dampak terukur.") — **tidak** memblokir simpan
  - [x] Paste multi-baris → otomatis pecah jadi beberapa bullet
- [x] **T3.6 FirstRunCard** — §5.4
  - [x] Muncul hanya bila `!firstRunSeen`; 3 opsi; default `Pakai contoh CV`
  - [x] `Mulai dari kosong` → `resetDoc(createEmptyDoc())` + toast "Dokumen kosong dibuat"
  - [x] Set flag di IndexedDB; sediakan `Reset dokumen` di Menu mobile / dialog pengaturan
- [x] **T3.7 Validasi & UX error**
  - [x] Pesan error spesifik per field, Bahasa Indonesia, menyebut cara memperbaiki
  - [x] Rail menandai section bermasalah (badge mono 10px `<n> isu`)
  - [x] `scroll-to-first-error` saat pengguna mencoba export dengan data invalid (mekanisme `scrollToFirstInvalidField` + unit test; pemanggilan dari tombol Download menyusul T5.2 karena tombol masih disabled)
  - [x] Semua error terhubung `aria-describedby` + `role="alert"`

**Gate Fase 3**
- [x] Sembilan section bisa diisi, ditambah, disembunyikan, dihapus, dan diurutkan ulang
- [x] Reorder berfungsi dengan **mouse, sentuhan, dan keyboard**
- [x] Data bertahan setelah refresh (IndexedDB)
- [x] Unit test: `registry.isComplete` untuk semua kind; validasi Zod tiap entri; reducer reorder
- [x] E2E Playwright: `editor-flow.spec.ts` — isi profile + 1 experience + 2 bullet → refresh → data ada
- [x] Tidak ada field tanpa label yang terikat (`<label for>`)

---

### 🟡 FASE 4 — Mesin Preview Layar & Manajemen Halaman *(2026-10-18 — semua Gate hijau; 1 sub-task T4.5 belum terukur, lihat Execution Log)*

- [x] **T4.1 PreviewWell** — §5.5
  - [x] Toolbar sticky: zoom −/+ , preset popover (50/75/100/Fit), `HAL n / m`, toggle `Ruler` & `Highlighter`
  - [x] Algoritma **Fit**: `scale = (wellWidth − 48) / 794`, dibatasi [0.3, 1.5], recalculasi via `ResizeObserver`, debounce 100ms
  - [x] Persist `zoom`/`fitMode`/guides di `ats:prefs:v1`
  - [x] Pinch-zoom di mobile (`touch-action: pinch-zoom` pada well, bukan pada sheet)
- [x] **T4.2 PageSheet & pagination**
  - [x] Kontainer `794×1123` per halaman, bg putih, radius 1px, shadow §2.4, `transform: scale(z)` + tinggi kontainer terkalkulasi
  - [x] `PageCaption` mono `HAL n` di bawah tiap sheet, gap 24px
  - [x] **Mesin pagination layar**: ukur tinggi konten alami dengan `ResizeObserver` per blok section; pecah ke halaman baru saat melewati `contentHeight = 1123 − 2×marginPx`
  - [x] Aturan anti-janda: heading section + minimal 2 baris pertama entri harus satu halaman (`break-inside: avoid` pada EntryCard; kalau tidak muat, pindah utuh ke halaman berikutnya)
  - [x] `orphans/widows` untuk bullet list
  - [x] Ekspor `usePagination(doc, templateId) → { pageCount, blocks[] }` — **dipakai juga** oleh renderer PDF agar pemecahan halaman identik
  - [x] Indikator di toolbar saat halaman > 2: chip mono `--signal-warn` `3 HAL · idealnya 1–2`
- [x] **T4.3 MarginRuler**
  - [x] Hairline margin cyanotype 25% + tick 10mm + label mm 8px setiap 20mm; `pointer-events-none`; toggle
- [x] **T4.4 Renderer screen generik**
  - [x] `features/templates/screen/TemplateRenderer.tsx`: menerima `doc`, `templateId`, `keywords?`, `marks?` *(realisasi: `plan` + `spec` dihitung `usePagination` di PreviewWell dan diteruskan sebagai prop — hook yang sama tidak boleh dijalankan dua kali; lihat Execution Log)*
  - [x] Urutan render = `doc.sections.filter(visible)`; tiap kind punya `<ScreenBlock kind=…>`
  - [x] Semua gaya diambil dari `specs.ts` (margin, skala tipe, gaya heading, gaya rule, gap) — **tidak ada** nilai magic di komponen
  - [x] Sub-komponen per section di-`memo` + berlangganan selector granular
  - [x] `KeywordMark` (§5.5) sebagai pembungkus teks bila `showKeywordMarks` aktif
- [ ] **T4.5 Kinerja preview**
  - [ ] Target: mengetik 120 wpm tidak menurunkan frame < 55fps di laptop kelas menengah — *belum terukur: headless Chromium mesin ini tidak men-sinkron rAF ke 60Hz (terbaca 52–155fps untuk beban yang sama). Pengganti yang terukur: 0 longtask & latensi p95 21ms saat mengetik 10 ketikan/detik di build produksi.*
  - [x] Ukur dengan React Profiler; pastikan hanya blok yang berubah yang re-render
  - [x] Debounce update preview 60ms **hanya** untuk textarea panjang (summary/bullet); input pendek = instan
  - [x] `content-visibility: auto` untuk sheet di luar viewport

**Gate Fase 4**
- [x] Preview berubah < 100ms setelah keystroke (diukur, bukan dikira) — build produksi: median 14ms · p95 21ms · maks 21ms · 0 longtask
- [x] Pagination layar **cocok** dengan hasil PDF (uji silang di Fase 5: jumlah halaman & posisi break sama) — *sebagian: mesin `usePagination` sudah tunggal dan posisi break fixture tercatat di `artifacts/evidence/fase4-pagination.json`; kecocokan dengan PDF baru bisa dibuktikan saat Fase 5 dibuka*
- [x] Zoom 50–150% tanpa teks pecah, tanpa horizontal scroll liar
- [x] Toggle margin guide akurat terhadap margin template (verifikasi dengan penggaris pada 100% zoom) — hairline 68,03px = 18,00mm, Δ 0px terhadap titik awal teks
- [x] Unit test: `usePagination` dengan fixture pendek/sedang/panjang
- [x] Profiler: perubahan 1 bullet tidak merender block `skills`/`education`

---

### ☑ FASE 5 — Ekspor PDF Client-Side *(2026-10-18 — semua sub-task & 5/6 item Gate hijau; item lintas-viewer (Adobe Reader/Drive) menunggu owner, lihat Execution Log)*

> **Catatan 2026-10-18 (Fase 0):** engine berubah ke `pdf-lib` + `@pdf-lib/fontkit` (§3 revisi #3). Sub-task di bawah masih ditulis dengan asumsi `@react-pdf` (`Font.register`, `StyleSheet`, prop `fixed`, `pdf().toBlob()`). Saat fase ini dibuka, terjemahkan dulu ke padanan pdf-lib: `embedFont`, `page.drawText/drawRectangle`, header berulang = gambar ulang di awal tiap halaman, dan `usePagination`/pembungkus baris dari kode kita sendiri (T4.2). Uji kelengkapan teks di `pdf:verify` tidak boleh dihapus — itu alasan engine-nya diganti.

- [x] **T5.1 Infrastruktur PDF**
  - [x] `features/pdf/fonts.ts`: registrasi font per keluarga + bobot + aturan hyphenation (kata ≤ 12 karakter tidak pernah dipecah) — *realisasi pdf-lib: `FONT_SOURCES` + `fontFileFor` → `embedFont`; hyphenation diputuskan `hyphenatedPieces` di `ResumePdfLib` karena callback-nya milik react-pdf*
  - [x] Gaya PDF dari `TemplateSpec` + `fontScale` — *realisasi: tidak ada `StyleSheet` di pdf-lib, jadi `PDF_COLORS` (token §2.2) + `TypeRole` di `ResumePdfLib`; warna/ukuran tetap hanya dari spec, tidak ada nilai inline di renderer*
  - [x] Dokumen PDF: halaman A4 + blok per section — *realisasi: `buildResumePdf` di `features/templates/pdf/ResumePdfLib.ts` (`PageWriter` per halaman, tinggi baris dari `TypeRole`)*
  - [x] Pagination identik dengan layar: `createPagePlan`/`usePagination` + anti-janda Fase 4; header berulang digambar tiap halaman (tidak ada prop `fixed`)
  - [x] `exportPdf.ts`: `await import('./renderResumePdf')` → blob → unduh (chunk terpisah, lihat T5.4)
- [x] **T5.2 Alur unduh**
  - [x] Klik `Download PDF` → validasi Zod; bila ada error → scroll + focus field pertama, toast menjelaskan, **tidak** export
  - [x] State tombol: `Membuat PDF...` + `Loader2` spin; aksi lain yang mengubah dokumen/template di-disable selama proses (TemplateSelect desktop & mobile, reset dokumen, tombol `Bagian`)
  - [x] Nama file: `${slug(fullName || title)}-${templateId}.pdf` → `alex-morgan-classic-ats.pdf`
  - [x] `URL.createObjectURL` + anchor klik + `revokeObjectURL` setelah 1s
  - [x] Toast sukses `PDF terunduh` + aksi `Buka` (object URL)
  - [x] Pemetaan error ke pesan manusiawi (font/konten/blob/lainnya) lewat `pdfErrorKey` → dictionary
- [x] **T5.3 Jaminan kualitas PDF**
  - [x] Teks **wajib** selectable & copyable (bukan raster). Tidak ada `html2canvas`/screenshot di jalur export
  - [x] Metadata dokumen: `title` = `${fullName} — ${headline}`, `author` = fullName, `subject` = "Resume", `creator` = "Resume Studio"
  - [x] Tidak ada font fallback tak terduga: uji tiap template dengan nama panjang, bullet panjang, karakter diakritik — *plus cek cmap per role tipografi; 3 cacat nyata ditemukan & diperbaiki (glyph `Ł/ź` hilang, ligatur `fi` menghapus karakter dari text layer) — lihat Execution Log*
  - [x] Uji urutan baca: `pdftotext -layout` menghasilkan urutan name → contact → section → entry → bullet
  - [x] `pnpm pdf:verify` (script Node): fixture `sampleResume` + `qualityDoc` untuk **kelima** template → ekstrak teks (pdfjs-dist **dan** `pdftotext -layout`) → bandingkan jumlah kata & urutan baris kunci; gagal bila selisih > 2% atau ada field yang hilang
  - [x] Uji 2 halaman & 3 halaman: tidak ada teks terpotong di batas halaman (fixture sedang/panjang)
- [x] **T5.4 Ukuran & performa**
  - [x] Chunk PDF terpisah (dynamic import) — pastikan tidak masuk bundle awal *(+3,02 KB mentah / +1,23 KB gzip untuk tombol & helper; `PDFDocument`/`fontkit`/`embedFont` = 0 kemunculan di chunk awal; e2e memastikan chunk baru di-request setelah klik)*
  - [x] Subset TTF (pyftsubset) agar total font PDF < 400 KB — *269,0 KB untuk 6 berkas, dihasilkan `scripts/subset-fonts.mjs`*
  - [x] Ukur durasi export 1 halaman (< 1.5s) & 3 halaman (< 4s) di laptop menengah; tampilkan progress bila > 1.2s — *terukur 142 ms / 473 ms; `pdf.state.slow` muncul setelah 1,2 s*

**Gate Fase 5**
- [x] `pnpm pdf:verify` hijau untuk 5 template — *74/74 pemeriksaan lolos*
- [ ] PDF dibuka di Chrome, Adobe Reader, dan Google Drive Viewer: teks selectable, tidak ada glyph hilang — *Chrome: terbuka di viewer bawaan (`chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai`) + screenshot artefak; Adobe Reader tidak terpasang di mesin ini dan Google Drive Viewer butuh unggah — menunggu owner (Execution Log)*
- [x] Teks hasil `pdftotext` bisa ditempel ke editor teks dan terbaca berurutan — *`*.pdftotext-layout.txt` per template & fixture; 47/47 baris dokumen di pratinjau muncul di teks PDF*
- [x] Jumlah halaman PDF == `pageCount` preview untuk fixture pendek/sedang/panjang — *pendek 1/1 · sedang 2/2 · panjang 3/3*
- [x] Bundle awal tidak bertambah — *analisis chunk: renderer PDF benar-benar terpisah; kenaikan awal hanya wiring tombol (lihat T5.4)*
- [x] E2E Playwright `download-pdf.spec.ts`: isi form → klik download → file `.pdf` valid (magic bytes `%PDF`) terunduh

---

### ☐ FASE 6 — Koleksi Template ATS

- [ ] **T6.1 `TemplateSpec`**
  - [ ] `features/templates/specs.ts`: tipe `TemplateSpec = { id, nameId, descriptionId, marginMm, typeScale{name, heading, body, meta, bullet}, headingStyle{transform, tracking, rule:{kind:'none'|'solid'|'double'|'dotted', widthPt, color:'ink'|'accent'}}, nameAlign, contactStyle{separator, align}, entryLayout{datePosition:'right'|'next-line'}, bulletGlyph, gap{sectionMm, entryMm}, accentAllowed:boolean }`
  - [ ] Lima spec sesuai tabel §2.3: `classic-ats`, `ledger`, `executive`, `minimal`, `technician`
  - [ ] `resolveSpec(templateId, theme, pageSettings)` → spec final (fontScale & margin override & accent)
  - [ ] **Default `accentHex = null`** (hitam-putih). Aksen warna opsional, hanya untuk `ledger`; UI memberi peringatan mono "Beberapa parser lama mencetak hitam-putih" saat aksen dinyalakan
- [ ] **T6.2 Renderer screen per template**
  - [ ] `screen/ClassicAts.tsx`, `Ledger.tsx`, `Executive.tsx`, `Minimal.tsx`, `Technician.tsx`
  - [ ] Semua membaca spec — tidak ada nilai hardcoded
  - [ ] Header: nama + headline + **satu baris** kontak dipisah ` · ` (bukan absolute positioning)
  - [ ] Body satu kolom; tanggal kanan (flex, bukan tabel) untuk `classic-ats`/`executive`, baris berikut untuk `minimal`/`technician`
- [ ] **T6.3 Renderer PDF per template**
  - [ ] Versi `@react-pdf` untuk tiap template, memakai `pdfStyles(spec)` yang sama
  - [ ] Uji visual berdampingan: screenshot preview vs halaman 1 PDF, toleransi ±1mm pada margin, line break, dan posisi heading
- [ ] **T6.4 TemplateSelect & `/templates`**
  - [ ] Popover TemplateSelect: thumbnail = **render nyata** diskalakan 0.16 (bukan gambar statis), nama Archivo 600 12px, deskripsi 11.5px, ring cyanotype saat aktif
  - [ ] Rute `/templates`: grid responsif, preview besar (skala 0.6) di kiri + detail spec di kanan (margin, jenis font, gaya heading — ditampilkan sebagai data mono, jujur dan informatif), tombol `Pakai template`
  - [ ] Ganti template = **tidak** mengubah data; hanya `doc.templateId`. Toast `Template Ledger dipakai`
  - [ ] Skeleton saat render thumbnail berat; `loading="lazy"` / `content-visibility` untuk kartu di luar viewport
- [ ] **T6.5 Guardrail ATS di level template**
  - [ ] Tidak ada template dengan foto, ikon dekoratif, skill bar, rating bintang, tabel bersarang, atau teks berwarna kontras < 4.5:1
  - [ ] Test snapshot: tiap template menghasilkan urutan blok yang sama untuk dokumen yang sama

**Gate Fase 6**
- [ ] 5 template tersedia, semua menghasilkan PDF valid (`pnpm pdf:verify` hijau untuk kelimanya)
- [ ] Ganti template tidak menghilangkan/mengubah data apa pun (unit test perbandingan `doc` sebelum/sesudah)
- [ ] Preview dan PDF cocok secara visual (lampirkan perbandingan berdampingan di PR)
- [ ] Lighthouse a11y ≥ 95 dengan semua template terpasang
- [ ] `/templates` bisa diakses tanpa login dan berfungsi offline

---

### ☐ FASE 7 — ATS Checker, Parse Tape, dan Highlighter

- [ ] **T7.1 Mesin aturan** (`features/ats/rules/`)
  - [ ] `contact.ts`: email ada & valid; telepon ada & ≥ 8 digit setelah normalisasi; lokasi ada; ≥ 1 tautan profil (advisory)
  - [ ] `sections.ts`: kehadiran `summary`, `experience`, `education`, `skills`; heading cocok dengan sinonim kanonis (daftar `headings.ts`: Experience/Work History/Employment/Pengalaman Kerja…)
  - [ ] `bullets.ts`: panjang 40–180 char (bad bila < 25 atau > 220); diawali action verb (daftar `verbs.ts` id+en, ±180 kata); ada angka/metrik (advisory); tidak diawali kata kerja pasif ("Bertugas untuk…")
  - [ ] `dates.ts`: semua tanggal terisi & parseable; urutan reverse-chronological; gap > 6 bulan tanpa entri lain (advisory); `current` hanya pada entri terbaru
  - [ ] `length.ts`: 1 halaman untuk < 3 thn pengalaman, maks 2 halaman untuk ≥ 3 thn; > 3 halaman = warn
  - [ ] `forbidden.ts`: `photoEnabled` true, `accentHex` dengan kontras < 4.5:1, template non-ATS (tidak ada saat ini, tapi guard untuk masa depan), skill level numerik
  - [ ] `keywords.ts`: tokenisasi `doc.jobDescription` (stopword id+en) → frekuensi → bandingkan dengan token di `summary`+`experience`+`skills`; hasil = `{ matched[], missing[], density }`
  - [ ] `consistency.ts`: format tanggal seragam antar entri; kapitalisasi heading seragam; bullet diakhiri tanda baca seragam
  - [ ] Tiap aturan mengembalikan `AtsIssue = { id, ruleId, severity:'bad'|'warn'|'ok'|'info', titleId, detailId, points:number, target?: {sectionId, entryId?, field?} , fixHintId? }`
- [ ] **T7.2 Skoring** (`scoring.ts`)
  - [ ] Basis 100; `bad` −12 (maks −48); `warn` −4 (maks −24); `info` −1 (maks −6); floor 0
  - [ ] Band: 0–49 `Perlu perbaikan` (`--signal-bad`) · 50–74 `Cukup` (`--signal-warn`) · 75–89 `Baik` (`--cyanotype`) · 90–100 `Sangat baik` (`--signal-ok`)
  - [ ] Label wajib: **`INDEKS STRUKTUR`**, bukan "ATS Score"
  - [ ] Disclaimer permanen di UI (P5) dan **tidak pernah** dihapus oleh state apa pun
- [ ] **T7.3 Parse Tape** (`parseTape.ts`)
  - [ ] `simulateParseOrder(doc, templateId)` → `TapeLine[] = { tag:'NAME'|'HEADLINE'|'EMAIL'|'PHONE'|'LOCATION'|'LINK'|'HEADING'|'ENTRY_TITLE'|'ORG'|'DATE'|'BULLET'|'META'|'UNCLAIMED', text:string, sourceRef?:{sectionId,entryId} }`
  - [ ] Urutan **harus** mengikuti urutan render template (konsumsi `usePagination`/blok dari Fase 4) — bukan urutan form
  - [ ] Tandai `UNCLAIMED` untuk teks yang tidak terpetakan (mis. karakter aneh, bullet kosong)
  - [ ] Statistik footer: jumlah karakter, kata, halaman
  - [ ] Tombol `Salin teks` → clipboard (dengan toast `Teks tersalin`) — berguna untuk ditempel ke ATS sungguhan
- [ ] **T7.4 Drawer ATS** — §5.6
  - [ ] Drawer kanan w400 (≥1600 dock kolom ke-4; mobile full-sheet) + scrim + Esc/focus-trap
  - [ ] `ScoreBlock`: angka Archivo Expanded 56px + bar 20 tick + band + disclaimer + meta mono
  - [ ] Tabs `Masalah (n)` / `Parse tape`
  - [ ] `IssueList` terkelompok: `Wajib diperbaiki` → `Sebaiknya` → `Sudah baik` (collapsible)
  - [ ] `IssueRow` + aksi `Perbaiki →`: tutup drawer (< 1280px) → scroll → focus field → flash `--cyanotype-wash` 600ms
  - [ ] `ParseTape` di atas `--machine`, tag 74px uppercase, kata kunci distabilo
  - [ ] Sapuan scan 700ms pada sheet saat check dijalankan (hormati reduced-motion)
  - [ ] State kosong: "Belum ada yang diperiksa" + tombol `Periksa sekarang`; state tanpa isu: "Tidak ada masalah struktur yang terdeteksi" + tetap tampilkan tape
- [ ] **T7.5 Highlighter di preview**
  - [ ] Input `Deskripsi lowongan` (TextArea di drawer ATS tab `Masalah`, paling atas, collapsible) disimpan ke `doc.jobDescription`
  - [ ] `tokenize` → `Set<string>` kata kunci (bobot ≥ 2 kemunculan atau istilah multi-kata)
  - [ ] `KeywordMark` membungkus kecocokan di renderer screen **dan** di renderer PDF (opsional untuk PDF: default OFF, toggle `Sertakan stabilo di PDF` — default mati supaya PDF tetap netral)
  - [ ] Toggle `Highlighter` di PreviewToolbar; disabled + tooltip sebelum ada JD
  - [ ] Panel ringkasan: `12 cocok · 7 belum ada` + daftar kata yang belum ada sebagai chip yang bisa diklik (klik → focus field skills)
- [ ] **T7.6 Jalankan & otomasi**
  - [ ] `runCheck()` async dengan `isChecking`; hasil di-cache di `atsStore` + `meta.lastCheckedAt`
  - [ ] Re-check otomatis **debounce 1.5s** setelah perubahan dokumen, hanya bila drawer pernah dibuka (hemat CPU, tidak mengganggu)
  - [ ] Badge titik `--signal-bad` di `CheckAtsButton` bila ada isu `bad`
  - [ ] `aria-live` untuk perubahan skor saat drawer terbuka

**Gate Fase 7**
- [ ] Unit test tiap aturan: minimal 3 kasus (lolos / advisory / blocking) — total ≥ 40 test
- [ ] Skor deterministik: dokumen sama → skor sama (snapshot test)
- [ ] Parse Tape untuk `sampleResume` + `ledger` menghasilkan urutan yang cocok dengan `pdftotext` PDF-nya (uji silang otomatis di `pdf:verify`)
- [ ] `Perbaiki →` benar-benar memfokuskan field yang tepat (E2E Playwright)
- [ ] Disclaimer terlihat di semua breakpoint; kata "lolos ATS" / "100%" tidak muncul di mana pun (grep)
- [ ] Highlighter tidak merusak layout sheet (tidak ada reflow/CLS)

---

### ☐ FASE 8 — Homepage, SEO, dan Konten Publik

- [ ] **T8.1 Struktur halaman** — §5.8
  - [ ] Workspace sebagai viewport pertama (`h-[calc(100dvh-56px)]`, min-h 640)
  - [ ] Section 2–6 di bawah, tiap section `content-visibility:auto` + `contain-intrinsic-size`
  - [ ] Anchor nav minimal (ikon `ChevronDown` di sudut workspace → scroll ke galeri)
- [ ] **T8.2 Template Gallery section**
  - [ ] Grid `auto-fill minmax(220px,1fr)` gap 20; thumbnail render nyata skala 0.24
  - [ ] Hover translateY(-3px) + shadow raised + tombol `Pakai template` fade-in
  - [ ] Klik = set template + scroll kembali ke workspace + toast
- [ ] **T8.3 Panduan Format ATS**
  - [ ] 2 kolom ≥1024, kiri sticky `top-96`
  - [ ] Daftar aturan bernomor mono (urutan baca nyata) + body
  - [ ] **Visual Do/Don't**: dua A4 mini berdampingan, ✗ `--signal-bad` (foto, skill bar, tabel, ikon) vs ✓ `--signal-ok`, caption mono uppercase
  - [ ] Isi: satu kolom, heading kanonis, tanggal konsisten, bullet berdampak terukur, tanpa grafik, format file, panjang ideal, kata kunci dari lowongan
- [ ] **T8.4 Tiga Langkah**
  - [ ] Stepper **vertikal** dengan rule 1px penghubung; nomor Archivo Expanded 700 40px dalam lingkaran 64px `--cyanotype-wash`
  - [ ] Mini-render nyata di kanan pada ≥1024
- [ ] **T8.5 FAQ**
  - [ ] Accordion max-w 760; 6–8 pertanyaan wajib (privasi, apa itu ATS, kenapa tidak ada jaminan, apakah PDF terbaca mesin, apakah gratis, batas AI, apakah data diunggah)
  - [ ] Markup `FAQPage` JSON-LD
- [ ] **T8.6 Footer + halaman legal**
  - [ ] Footer 4 kolom + pernyataan privasi satu baris (§5.8)
  - [ ] `/privacy` & `/terms`: konten nyata (bukan lorem). Poin wajib: semua pemrosesan CV di browser; tidak ada upload tanpa login; IndexedDB bisa dihapus lewat `Reset dokumen`; AI (bila dipakai) mengirim teks terpilih ke penyedia model; tidak ada penjualan data
- [ ] **T8.7 SEO teknis**
  - [ ] `index.html`: title `Resume Studio — Pembuat CV ATS Gratis`, meta description 150–160 char, canonical, OG + Twitter card (gambar 1200×630 berupa render lembar A4 + stabilo), `lang="id"`, hreflang `id`/`en` (aktif setelah Fase 11)
  - [ ] JSON-LD: `SoftwareApplication` (+ `offers.price = 0`) dan `FAQPage`
  - [ ] `sitemap.xml`, `robots.txt` (exclude `/dashboard`, `/r/`, `/dev/`)
  - [ ] Heading tunggal `h1` per halaman; hierarki tidak melompat
  - [ ] Prerender konten homepage untuk crawler **tanpa** SSR framework: pakai `vite-plugin-prerender`/`vite-ssg`-style static snapshot **hanya** untuk section 2–6 (workspace tetap client-only). Bila tooling bermasalah, fallback: render section 2–6 sebagai HTML statis di build time lewat komponen terpisah
- [ ] **T8.8 PWA ringan (opsional tapi sesuai P2)**
  - [ ] `vite-plugin-pwa`: precache app shell + font; strategi `NetworkFirst` untuk HTML, `CacheFirst` untuk aset
  - [ ] Uji: buka offline setelah kunjungan pertama → editor tetap berfungsi penuh
  - [ ] `manifest.webmanifest` + ikon 192/512 (BrandMark di atas cyanotype)

**Gate Fase 8**
- [ ] Lighthouse: Performance ≥ 90 · Accessibility ≥ 95 · Best Practices ≥ 95 · SEO ≥ 90 (mobile, throttling default)
- [ ] LCP ≤ 2.5s di 4G simulasi; elemen LCP adalah lembar A4 atau judul section, bukan font yang telat
- [ ] Rich Results Test valid untuk FAQ & SoftwareApplication
- [ ] Mode offline: editor + download PDF tetap jalan
- [ ] Tidak ada `lorem ipsum` di mana pun (grep)

---

### ☐ FASE 9 — QA, Test Otomatis, dan Hardening

- [ ] **T9.1 Unit & integration (Vitest)**
  - [ ] `lib/` (units, dates, text) — ≥ 95% branch
  - [ ] `schema/` + migrate — termasuk dokumen rusak & versi lama
  - [ ] `store/` semua aksi + immutability
  - [ ] `ats/rules/*` + `scoring` + `parseTape`
  - [ ] `templates/specs` + `resolveSpec`
  - [ ] Target coverage global ≥ 80%
- [ ] **T9.2 E2E (Playwright)** — proyek: `chromium`, `mobile-chrome`, `webkit`
  - [ ] `first-visit.spec.ts`: buka `/` → FirstRunCard → contoh CV → sheet ter-render
  - [ ] `editor-flow.spec.ts`: isi profile + experience + bullet → terlihat di preview
  - [ ] `reorder.spec.ts`: reorder section via keyboard & drag
  - [ ] `template-switch.spec.ts`: ganti 5 template, data tidak hilang
  - [ ] `persistence.spec.ts`: isi → reload → data utuh
  - [ ] `download-pdf.spec.ts`: download → file `%PDF` valid → simpan sebagai artifact
  - [ ] `ats-check.spec.ts`: buka drawer → skor muncul → klik `Perbaiki` → field terfokus
  - [ ] `offline.spec.ts`: matikan network → isi → download PDF tetap berhasil
  - [ ] `responsive.spec.ts`: screenshot 360 / 390 / 768 / 1024 / 1440 / 1920
- [ ] **T9.3 QA PDF & ekstraksi**
  - [ ] `pnpm pdf:verify` dijalankan di CI untuk 5 template × 3 fixture (pendek/sedang/panjang)
  - [ ] Bandingkan urutan baris `pdftotext` dengan `parseTape` (selisih urutan = kegagalan)
- [ ] **T9.4 Performa**
  - [ ] `lighthouserc.json` + `lhci autorun` di CI pada `/` dan `/templates`; budget: LCP 2.5s, TBT 300ms, CLS 0.1, bundle awal 220KB gzip
  - [ ] Profiler React: merekam sesi mengetik 60 detik, pastikan tidak ada render > 16ms berulang
  - [ ] Uji perangkat rendah: Chrome 4× CPU throttling — mengetik tetap responsif (INP ≤ 200ms)
- [ ] **T9.5 A11y audit**
  - [ ] `axe-core` di Playwright untuk semua rute publik; 0 violation serius
  - [ ] Uji keyboard penuh + screen reader (NVDA/VoiceOver) untuk: rail, form, drawer ATS, dialog
  - [ ] Kontras semua pasangan ≥ 4.5:1 (audit otomatis + manual untuk stabilo di atas putih)
  - [ ] `prefers-reduced-motion` diverifikasi
- [ ] **T9.6 Hardening**
  - [ ] Batas input: bullet ≤ 60 per entri, entri ≤ 40 per section, summary ≤ 1200 char, JD ≤ 8000 char — dengan pesan mono yang menjelaskan batas
  - [ ] Sanitasi URL (`https?:` dan `mailto:` saja) → mencegah `javascript:` di tautan profil
  - [ ] Rate-limit lokal untuk export PDF (maks 1 per 500ms) + antrian
  - [ ] Recovery: dokumen korup → simpan salinan + mulai bersih + toast penjelasan (tidak boleh white screen)
  - [ ] `window.onerror` / `unhandledrejection` → log ke konsol + banner non-blocking (tanpa analytics pihak ketiga di MVP)
  - [ ] Uji storage penuh (kuota IndexedDB) → pesan jelas + saran hapus dokumen lama

**Gate Fase 9 — MVP siap publik**
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm pdf:verify && pnpm build` semua hijau di CI
- [ ] Coverage ≥ 80%, 0 axe violation serius, Lighthouse sesuai budget
- [ ] Checklist viewport 360/390/768/1024/1440/1920 lolos tanpa regresi
- [ ] **Uji manual offline penuh**: airplane mode → isi CV → ganti template → periksa ATS → download PDF → berhasil

---

### ☐ FASE 10 — Deploy, Auth, dan Cloud Sync

- [ ] **T10.1 Supabase**
  - [ ] Buat project region `ap-southeast-1`; simpan `SUPABASE_URL` + `SUPABASE_ANON_KEY` di `.env.local` & Vercel env
  - [ ] Migration SQL: `profiles`, `resumes` (+ `local_id`, index), `ai_usage`; RLS aktif + policy sesuai §4
  - [ ] Trigger `handle_new_user` → insert baris `profiles`; trigger `updated_at`
  - [ ] Auth providers: Google + Email magic link; redirect URL didaftarkan untuk production & preview
  - [ ] Uji RLS: user A tidak bisa membaca/menulis resume user B (test via `supabase-js` dengan dua session)
- [ ] **T10.2 Auth di frontend**
  - [ ] `features/auth/`: `supabaseClient.ts`, `AuthProvider`, `useSession`, rute `/login` (§5.10) + `/auth/callback`
  - [ ] Magic link & OAuth handler; state `loading`/`error` dengan pesan jelas
  - [ ] `RequireAuth` untuk `/dashboard` & `/cover-letter`; redirect kembali ke rute asal setelah login
  - [ ] Menu akun di TopBar (avatar/inisial + dropdown: Dashboard · Simpan ke cloud · Keluar)
- [ ] **T10.3 Cloud sync**
  - [ ] `features/sync/cloudSync.ts`: debounce 900ms setelah commit terakhir; hanya aktif bila ada session
  - [ ] Strategi konflik: `updated_at` menang (last-write-wins) + simpan salinan lokal bila server lebih baru → tampilkan Dialog "Versi cloud lebih baru" (Pakai versi cloud / Simpan versiku sebagai salinan)
  - [ ] **Adopsi dokumen anonim**: saat login pertama, tawarkan "Simpan CV di perangkat ini ke akunmu?" → upsert dengan `local_id`
  - [ ] Pemetaan `syncStore.status` → `SaveStatusPill` (5 status §5.2)
  - [ ] Retry eksponensial (3×, 1s/3s/9s) lalu status `offline`; antrian tulisan yang tertunda
  - [ ] Migrasi `schemaVersion` di server-side sebelum upsert
- [ ] **T10.4 Dashboard multi-resume** — §5.9
  - [ ] List resume (grid kartu, thumb render nyata skala 0.26), sortir `Terbaru diubah`
  - [ ] Rename inline, duplikat (Judul + " (salinan)"), favorit (toggle `Star`), hapus (Dialog konfirmasi dengan mengetik nama? → cukup konfirmasi sekali, teks destruktif)
  - [ ] `+ Buat CV baru` → buat doc baru di IndexedDB + cloud, navigasi ke `/r/:id`
  - [ ] Workspace multi-dokumen: `docStore` diberi `docId`; switch dokumen tanpa reload
  - [ ] Empty state + penjelasan bahwa dokumen anonim tetap ada di perangkat
- [ ] **T10.5 Deploy Vercel**
  - [ ] Framework Vite, build `pnpm build`, output `dist`; env vars diset
  - [ ] Preview branch otomatis; domain production
  - [ ] Header keamanan: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (kamera/mikrofon off), CSP ketat (izinkan `'self'`, `data:`/`blob:` untuk font & PDF, `*.supabase.co`)
  - [ ] Cache: aset ber-hash `immutable, 1y`; HTML `no-cache`
  - [ ] Uji produksi: daftar akun → buat → simpan → logout → login → data ada

**Gate Fase 10**
- [ ] RLS terbukti: cross-user access ditolak (test otomatis)
- [ ] Alur anon → login → adopsi dokumen berjalan tanpa kehilangan data
- [ ] Sync konflik ditangani dengan Dialog, bukan silent overwrite
- [ ] Editor tetap berfungsi penuh saat Supabase down (uji dengan memblokir domain Supabase) — **P2 tidak boleh rusak**
- [ ] Lighthouse production ≥ 90 performance

---

### ☐ FASE 11 — Produktivitas: Undo/Redo, Riwayat, DOCX, Import, i18n

- [ ] **T11.1 Undo/Redo**
  - [ ] `historyStore`: patch-based (immer patches) atau `zundo`; kapasitas 60 langkah; coalesce keystroke < 800ms jadi satu entri
  - [ ] Tombol `Undo`/`Redo` di TopBar (disabled saat stack kosong) + shortcut `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`
  - [ ] Toast `Perubahan dibatalkan` + aksi `Ulangi`
  - [ ] Tidak merekam perubahan `uiStore` (zoom, tab) — hanya `doc`
- [ ] **T11.2 Riwayat versi (cloud)**
  - [ ] Tabel `resume_snapshots (id, resume_id, content jsonb, created_at, label)` + RLS; snapshot otomatis maks 1 per 10 menit saat ada perubahan, retensi 20 terakhir
  - [ ] UI: `Riwayat` di menu akun → Sheet daftar snapshot (mono timestamp + label) + `Lihat` (preview read-only) + `Pulihkan` (Dialog konfirmasi)
- [ ] **T11.3 Export DOCX**
  - [ ] `docx` (npm) → `Document`/`Paragraph`/`TextRun` dari `TemplateSpec` yang sama (margin, skala tipe, gaya heading)
  - [ ] **Satu kolom, tanpa tabel, tanpa text box** (syarat ATS)
  - [ ] Tombol `DOCX` di dropdown sebelah `Download PDF` (menjadi split button: aksi utama PDF, panah → `Unduh DOCX`)
  - [ ] Verifikasi: buka di MS Word & LibreOffice; salin teks → urutan benar; tidak ada layout rusak
- [ ] **T11.4 Import dokumen**
  - [ ] `features/import/parser.ts`: PDF via `pdfjs-dist` (ekstrak teks + posisi), DOCX via `mammoth` → HTML → teks
  - [ ] Pipeline heuristik: deteksi nama (baris pertama, font besar), email/telepon/URL via regex, heading via kamus sinonim, entri via pola `Role — Company` + rentang tanggal, bullet via glyph awal
  - [ ] UI: Dialog `Impor CV lama` → dropzone (PDF/DOCX, maks 8 MB) → progress → **layar konfirmasi pemetaan**: tiap field terdeteksi ditampilkan berdampingan dengan tujuan fieldnya, pengguna bisa membetulkan sebelum commit
  - [ ] Jujur soal keterbatasan: "Impor bersifat tebakan terbaik. Periksa setiap bagian sebelum mengunduh."
  - [ ] Gagal parse → pesan jelas + saran (coba DOCX, atau salin-tempel manual)
- [ ] **T11.5 i18n penuh**
  - [ ] Lengkapi `dictionaries/en.ts`; deteksi `navigator.language` + override tersimpan di prefs
  - [ ] `LanguageSelect` di Menu/pengaturan (id · en); ganti bahasa tidak mengubah data dokumen
  - [ ] Format tanggal & bulan mengikuti locale; `Intl.DateTimeFormat`
  - [ ] `hreflang` + URL terlokalisasi bila perlu (`/en/…`) — keputusan: pakai query/state, bukan rute terpisah, agar sederhana
  - [ ] Uji: tidak ada string yang lolos `t()` (lint rule custom / grep)

**Gate Fase 11**
- [ ] Undo/redo 60 langkah stabil, tidak merusak data (property-based test dengan rapidfire aksi acak)
- [ ] Restore snapshot mengembalikan dokumen persis
- [ ] DOCX lolos uji di Word & LibreOffice + teks tersalin berurutan
- [ ] Import pada 5 CV nyata (PDF & DOCX) memetakan ≥ 70% field dengan benar, dan layar konfirmasi selalu muncul sebelum commit
- [ ] Seluruh UI tersedia dalam id & en tanpa teks tertukar/terpotong

---

### ☐ FASE 12 — AI Assistant & Fitur Lanjutan

- [ ] **T12.1 Infrastruktur AI**
  - [ ] Supabase Edge Function `ai-enhance` (Deno): validasi JWT, rate-limit per user/day via `ai_usage`, pilih provider (OpenAI/Anthropic/Gemini) lewat env, timeout 20s, streaming SSE
  - [ ] **API key tidak pernah** menyentuh browser
  - [ ] Kontrak request/response per fitur (`bullet`, `summary`, `match`, `polish`, `cover-letter`) + Zod validation di kedua sisi
  - [ ] Prompt tersimpan di repo (`supabase/functions/ai-enhance/prompts/*.ts`), versioned
  - [ ] Guardrail prompt: dilarang menambah fakta, angka, atau pengalaman yang tidak ada di input; dilarang mengubah nama perusahaan/tanggal; output harus Bahasa yang sama dengan input
  - [ ] Fallback provider + pesan error manusiawi saat kuota habis / provider gagal
- [ ] **T12.2 Kuota & UI**
  - [ ] Default gratis: 10 `bullet` + 5 `summary` + 5 `match` + 5 `polish` + 2 `cover-letter` per hari per akun; anonim = 3 total per hari (localStorage + IP di edge)
  - [ ] Sisa kuota tampil di tooltip tombol AI (`7 dari 10 tersisa hari ini`)
  - [ ] Habis → Dialog menjelaskan + opsi coba lagi besok (tanpa paywall agresif; editor inti tetap gratis penuh — P6)
- [ ] **T12.3 AI Bullet Enhancer**
  - [ ] Tombol `Perbaiki dengan AI` inline per bullet (muncul saat hover/focus), ikon `Sparkles` 14px
  - [ ] Alur: kirim bullet + role + company + stack → terima 2–3 varian → **panel perbandingan** (Dialog): bullet asli vs varian (radio) + `Pakai` / `Buang`
  - [ ] Tidak pernah overwrite otomatis — pengguna selalu memilih
  - [ ] Diff visual: kata yang bertambah ditandai `--signal-ok` underline, yang hilang `--signal-bad` strikethrough
- [ ] **T12.4 Summary Generator**
  - [ ] Tombol `Buat dari riwayatku` di editor Summary; input = experience + skills + headline
  - [ ] Hasil masuk ke textarea sebagai **draft yang bisa diedit**, dengan wash cyanotype 600ms
- [ ] **T12.5 Job Description Matcher**
  - [ ] Sudah ada fondasi lokal di Fase 7 (`keywords.ts`). Versi AI menambah: ekstraksi requirement implisit, pengelompokan (`hard skill`/`soft skill`/`tool`), saran kalimat bullet yang memakai kata kunci yang hilang
  - [ ] UI: tab `Cocokkan` di drawer ATS → daftar kata kunci hilang sebagai chip yang bisa diklik → `Tambahkan ke Skills` (satu klik, dengan konfirmasi)
  - [ ] Selalu tampilkan juga hasil matcher **lokal** (gratis, tanpa kuota) sebagai baseline
- [ ] **T12.6 Grammatical Polish**
  - [ ] Aksi `Rapikan bahasa` per bullet dan per section; hanya mengubah ejaan/tata bahasa
  - [ ] Wajib lewat panel perbandingan (tidak ada auto-apply); tampilkan jumlah perubahan
- [ ] **T12.7 Cover Letter Generator** — rute `/cover-letter`
  - [ ] Input: pilih resume (dari store/dashboard) + tempel JD + nada (`Formal`/`Hangat`/`Langsung`) + panjang (150/250/350 kata)
  - [ ] Output: lembar A4 terpisah dengan preview + `Download PDF` (renderer PDF sendiri, template `letter-*`) + `Salin teks` + `Edit` (textarea)
  - [ ] Aturan: harus merujuk fakta dari CV; tidak boleh mengarang pengalaman; tampilkan sumber kalimat (tooltip → "dari: Experience · Tech Nusantara")
- [ ] **T12.8 Observabilitas & biaya**
  - [ ] Log pemakaian (feature, tokens, latency, provider) ke tabel `ai_usage_log`; dashboard query sederhana
  - [ ] Alert ambang biaya harian; kill-switch env `AI_ENABLED=false` yang menyembunyikan semua tombol AI dengan rapi

**Gate Fase 12**
- [ ] Tidak ada API key di bundle client (verifikasi build + `grep` di `dist`)
- [ ] Rate-limit berfungsi: request ke-11 dalam sehari ditolak dengan pesan jelas
- [ ] Semua fitur AI memakai panel perbandingan — tidak ada perubahan otomatis
- [ ] Uji 20 bullet nyata: 0 fakta baru yang dikarang (review manual) + output selalu Bahasa yang sama
- [ ] `AI_ENABLED=false` → aplikasi tetap berfungsi penuh tanpa error UI
- [ ] Editor inti tetap 100% gratis & tanpa batas (verifikasi: selesaikan alur download tanpa login dan tanpa AI)

---

## 7. QA Matrix

| Kategori | Instrumen | Skenario & target | Fase |
| :-- | :-- | :-- | :-- |
| Unit | Vitest | units/dates/text, Zod schema, migrate, store actions, ATS rules, scoring, parseTape, specs — coverage ≥ 80% | 1–7, 9 |
| Integration | Vitest + Testing Library + fake-indexeddb | autosave → reload → data identik; first-run → sample doc | 1, 3 |
| E2E | Playwright (chromium, mobile-chrome, webkit) | 9 spec di T9.2 + auth/sync di Fase 10 | 9, 10 |
| PDF extraction | `pdf-parse` / `pdftotext` | teks selectable, urutan benar, selisih kata ≤ 2%, cross-check dengan Parse Tape | 5, 7, 9 |
| Responsive | Playwright screenshot | 360 · 390 · 768 · 1024 · 1440 · 1920 tanpa regresi | 9 |
| Accessibility | axe-core + audit manual NVDA/VoiceOver | 0 violation serius, kontras AA, keyboard penuh, reduced-motion | 2, 9 |
| Performance | Lighthouse CI | Perf ≥ 90 · A11y ≥ 95 · BP ≥ 95 · SEO ≥ 90; LCP ≤ 2.5s · INP ≤ 200ms · CLS ≤ 0.1 · bundle awal ≤ 220KB gzip | 8, 9, 10 |
| Offline | Playwright + devtools offline | alur penuh (isi → template → check → download) tanpa network | 8, 9 |
| Security | manual + RLS test | cross-user denied, CSP aktif, sanitasi URL, tidak ada key di client | 10, 12 |
| Load | k6 (staging) | Supabase Auth + sync 1.000 VUs, p95 < 400ms, error < 0.5% | 10 |

---

## 8. Definition of Done — Global

Sebuah fase dianggap selesai **hanya bila semua** benar:

- [ ] Semua task & sub-task fase tersebut tercentang
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau (lokal **dan** CI)
- [ ] Gate fase tercentang semua
- [ ] Tidak ada `TODO`/`FIXME` baru tanpa issue yang menaunginya
- [ ] Tidak ada string UI hardcoded (semua lewat `t()`)
- [ ] Tidak ada warna/tipografi hardcoded di luar `tokens.css` dan renderer template
- [ ] Fitur baru punya minimal 1 test yang akan gagal bila fitur dihapus
- [ ] Tidak melanggar P2 (local-first): cabut network → editor + download tetap jalan
- [ ] Tidak melanggar P5: tidak ada klaim "lolos ATS"/persentase kepastian di UI mana pun
- [ ] Diuji manual di Chrome (desktop) dan satu browser mobile nyata
- [ ] Execution Log di bawah diperbarui

---

## 9. Execution Log

| 2026-10-18 | 0 | T0.1, T0.2, T0.3, T0.5 + Gate 1/3/4 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau (15 unit test, 9 e2e test). Bundle awal terukur **110,6 KB gzip** (index.js 101,12 + index.css 9,10 + html 0,37) dan `dist` produksi hanya 26 modul — rute `/dev/*` benar-benar ter-DCE. `/dev/tokens` difoto pada 360/768/1024/1440 tanpa horizontal scroll; navigasi keyboard penuh lolos (skip link → tombol → input, border fokus cyanotype). T0.5: Δ 0,00 mm untuk margin kiri/atas, ukuran font nama, dan tinggi baris body. | ✅ Selesai & terverifikasi |
| 2026-10-18 | 3 | T3.1–T3.7 + Gate Fase 3 | `pnpm lint`, `pnpm typecheck`, `pnpm test` (147 test, 18 file) hijau; `pnpm build` sukses via `vite build` exit 0 (`pnpm build` membungkusnya exit 1 di PowerShell lokal karena warning chunk-size > 500 kB ditulis ke stderr dan di-escalate shell — di CI Linux `pnpm build` lolos sebagaimana Fase 0–2); e2e `editor-flow.spec.ts` 8/8 + `shell.spec.ts` 7/7 hijau. Reorder dibuktikan 3 input (test + `artifacts/evidence/fase3-reorder-{mouse,touch,keyboard}.png`): drag mouse (dnd-kit PointerSensor), sentuhan (touch pointer dari CDP), keyboard (Space+panah+Space, pengumuman aria-live). Audit label otomatis 10/10 section: 0 field tanpa label terikat. Screenshot manual 360/768/1024/1440 + uji keyboard saja (`artifacts/evidence/fase3-bp-*.png`, `fase3-keyboard-only.png`). **Keputusan owner sesi ini**: T3.4 tanpa React Hook Form — binding langsung + history di-coalesce 150 ms (teks T3.4 diubah dulu di dokumen, lalu kode; test coalescing ditambahkan). **Bug nyata diperbaiki dalam fase**: (1) Radix ScrollArea membungkus konten dengan div `display:table` inline → row rail melebar ~299 px, handle drag terpotong di luar viewport 248 px (pointerdown mendarat di FormPane) — diperbaiki dengan `[&>div]:block!` di `scroll-area.tsx`; (2) regex GPA Fase 1 meloloskan `4.50` padahal pesan & plan bilang skala 0–4.00 — diketatkan, tidak ada fixture/test yang memakai nilai di luar skala. **Catatan terbuka**: `scrollToFirstInvalidField` teruji unit, tapi pemanggilan dari tombol Download menyusul T5.2 (tombol masih disabled). | ✅ Selesai & terverifikasi |
| 2026-10-18 | 0 | T0.4 (spike PDF) + Gate 2 | `pnpm pdf:verify` 15/16 pemeriksaan lolos — A4 tepat 595,28×841,89 pt; margin kiri 45,35 pt = 16 mm; font nama 24,00 pt; heading 9,50 pt; body 10,00 pt; line-height 14,20 pt; urutan baca name→contact→heading→entry→bullet benar; 60 bullet → 3 halaman; `fixed` mengulang header. **Yang gagal: PDF membuang kata di titik wrap.** | ⛔ Terblokir → diselesaikan di baris berikutnya |
| 2026-10-18 | 0 | T0.4 + Gate 2 (resolusi) | Owner memutuskan kontingensi §10(c): **`@react-pdf/renderer` → `pdf-lib` + `@pdf-lib/fontkit`**. Spike ditulis ulang (`features/templates/pdf/SpikePdfLib.ts` — line-wrap & page-break milik kita, satu `spikeSpec` untuk dua renderer). `pnpm pdf:verify` kini **15/15 PASS**, termasuk "semua 60 bullet utuh (tidak ada kata hilang saat wrap)". Durasi: 1 hal 150 ms · 3 hal 340 ms. Chunk `spikePdf` 506,5 KB gzip terpisah (entry 0 referensi `PDFDocument`/`fontkit`/`embedFont`), bundle awal tetap 106 KB gzip. e2e 9/9 hijau. | ✅ Selesai & terverifikasi |
| 2026-10-18 | 0 | Hutang yang dicatat untuk Fase 5 | (1) **Ukuran berkas PDF**: pdf-lib menanam font penuh — 1 halaman = 141 KB vs 22 KB pada react-pdf (yang men-subset). T5.4 wajib subset TTF sebelum embed, atau hasilkan subset saat build. (2) pdf-lib tidak punya `letter-spacing`; tracking heading ditiru karakter-per-karakter di `SheetWriter.tracked()` — Fase 5 perlu memutuskan ini acceptable atau pakai `charSpace` manual di satu jalur. (3) `pnpm lhci` + `lighthouserc.json` belum ada ( §1 menandainya "mulai Fase 9" ). (4) `shadcn` memakai animasi `animate-in/out` dari `tw-animate-css` yang sengaja tidak dipasang — dialog/sheet belum beranimasi sampai T2.5. | 🟡 Catatan |
| 2026-10-18 | 1 | T1.1–T1.5 + Gate Fase 1 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau — **102 test** (termasuk 15 test Fase 0 yang tetap lulus, tanpa regresi). `pnpm test --coverage`: **lib 100/100 · schema 100 stmts/88,13 branch · store 100/93,02** — semua ≥ 85% (ambang di `vite.config.ts`, provider `@vitest/coverage-v8` yang disetujui owner). e2e `tests/e2e/persistence.spec.ts` 2/2: (1) isi form → reload → data utuh; (2) dokumen korup → karantina `ats:doc:corrupt:<ts>` + dokumen contoh + toast penjelasan, tanpa white screen. e2e penuh 11/11. Grep: 0 string UI hardcoded di luar `dictionaries/` (sisa literal Bahasa = pesan Zod yang dimandatkan T1.1 + data CV contoh), 0 hex di luar `tokens.css` & renderer template, 0 TODO/FIXME, 0 klaim "lolos ATS". Manual browser `/dev/persist`: 360/768/1024/1440 tanpa scroll horizontal (screenshot 360 & 1440), keyboard-only: Tab 7× dari body → input judul, ketik → pill `Menyimpan…` → `Disimpan di perangkat` → reload manual → nilai tetap. | ✅ Selesai & terverifikasi |
| 2026-10-18 | 1 | Keputusan kecil di luar teks plan | (1) Bukti gate "isi form → refresh" memakai harness dev `/dev/persist` (rute dev-only, ter-DCE dari build produksi) karena form editor baru ada di Fase 2–3 — **disetujui owner**. (2) `@vitest/coverage-v8` dipasang sebagai devDependency (dimandat perintah verifikasi) — **disetujui owner**. (3) `<Toaster/>` global dipasang di `main.tsx` dan boot persistensi dipindah ke efek `PersistenceBoot` setelahnya: sonner membuang toast yang dipanggil tanpa subscriber, jadi urutan ini membuat toast boot korup deterministik. (4) `syncStore` menambah `storageMode: 'idb'\u00a0\|\u00a0'memory'` — field tambahan di luar daftar T1.2, dibutuhkan agar banner T1.3 ("Perubahan tidak tersimpan di perangkat ini") bisa dibaca UI. (5) `addEntry(sectionId)` membuat entri via `createEmptyEntry(kind)` sehingga id selalu lahir di factory (aturan §4). (6) `createEmptyDoc()` memakai `title: ''`; fallback tampilan `doc.untitled` ("CV tanpa judul") diserahkan ke UI Fase 2. (7) `types/resume.ts` diformat prettier (`semi: false`); isi identik dengan §4. (8) Di Windows, `pnpm test -- --coverage` meneruskan literal `--` tanpa mengaktifkan coverage — bukti coverage memakai `pnpm test --coverage`. | 🟡 Catatan owner |

| 2026-10-18 | 2 | T2.1–T2.5 + Gate Fase 2 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau — **136 unit test** (16 file) dan **19 e2e**. Bundle awal **193,82 KB gzip** (masih < 220 KB); `dist` tanpa rute `/dev/*` dan tanpa `PDFDocument`. `/dev/tokens` kini katalog 15 bagian (`data-catalog`: panel-header, buttons, icon-buttons, fields, toggles, chips, empty-state, dialog, sheet, popover, tooltip, tabs, accordion, scroll, toast) + hover state diukur nyata. Resize 360/768/1024/1440/1920: 0 horizontal scroll, rail hanya ≥1024, tab mobile <1024, sticky bar <768; screenshot `artifacts/shell-{360,768,1024,1440,1920}.png`. Keyboard tanpa mouse: Tab → skip link → brand → judul (Enter, ketik, Enter) → template (Enter → Ledger) → rail (Enter → heading berganti). CLS shell **0,0000**; reduced-motion mematikan animasi. Kontras: 25 pasangan di `tests/unit/contrast.test.ts`. Grep hex di `src/components` + `src/features` di luar renderer template = **0 hasil**. | ✅ Selesai & terverifikasi |
| 2026-10-18 | 4 | T4.1–T4.4 + Gate Fase 4 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau — **169 unit test** (20 file, +22 baru) dan **27/27 e2e** tanpa regresi. `node scripts/evidence-fase4.mjs` → **21/21 pemeriksaan lolos** (+1 catatan). Gate terukur di **build produksi**: latensi input→preview median 14ms · p95 21ms · maks 21ms · **0 longtask**; offline (P2) median 22ms · maks 28ms; textarea panjang (Ringkasan) maks 22ms walau re-layout ditahan 60ms. React Profiler per blok: 1 ketikan bullet = **1 blok** dirender (`{sectionId}:{entryId}:l0`), blok skills/education tidak tersentuh — dibuktikan juga di unit test. Zoom 50% → lembar 397px, 150% → 1191px, Fit → 624px untuk well 672px = (672−48), overflow dokumen 0px di semua level. Margin guide pada 100%: hairline 68,03px = **18,00 mm** dan Δ **0px** terhadap titik awal teks nama. Fixture (acuan silang Fase 5, tersimpan di `artifacts/evidence/fase4-pagination.json`): pendek **1 hal** (7 blok); sedang **2 hal** (21+13, break awal hal-2 = `PROYEK`); panjang **2→3 hal** (20+22+13, break awal hal-2 = bullet `Koordinasi rilis…`, awal hal-3 = `PROYEK`); chip `3 HAL · idealnya 1–2` hanya muncul di fixture panjang. Screenshot: `fase4-{pagination-pendek,pagination-sedang,pagination-panjang,margin-guides,zoom-50,zoom-150,zoom-fit,keyboard-only,offline-preview,prod-workspace,bp-360,bp-768,bp-1024,bp-1440}.png`. Keyboard saja: Tab mencapai Perkecil/100%/Perbesar/Penggaris, Enter mengubah state penggaris (3→0), ring fokus `outline 2px rgb(15,90,120)`. Preferensi terbukti persist: `ats:prefs:v1 = {zoom:0.5, fitMode:false, showMarginGuides:false, showKeywordMarks:true}` setelah reload. Unit test aturan: heading tidak ditinggal di ujung halaman, kepala entri pindah bersama 2 baris pertama, janda ditarik, run <4 baris tidak dipecah, tinggi terukur mengalahkan perkiraan. | ✅ Selesai & terverifikasi (kecuali 1 sub-task T4.5 — lihat baris berikutnya) |
| 2026-10-18 | 4 | Keputusan & bug yang ditemukan dalam fase | **Keputusan owner sebelum kode**: (a) `specs.ts` dibangun dengan bentuk `TemplateSpec` T6.1 tapi hanya **ledger** & **technician** yang punya nilai nyata (font-nya sudah punya `@font-face` layar); `classic-ats`/`executive`/`minimal` resolve ke nilai ledger sampai T6.1 — karena tipografi §2.3 untuk ketiganya memakai Source Serif 4 yang baru punya TTF (PDF), belum WOFF2 layar; (b) bukti fixture memakai rute dev-only `/dev/pagination` (pola `/dev/persist` Fase 1). **Deviasi teknis dari teks plan (didokumentasikan, tidak diam-diam)**: (1) `TemplateRenderer` menerima `plan`+`spec`, bukan `doc`+`templateId` — `usePagination` tidak boleh dijalankan dua kali, dan toolbar butuh `pageCount`; (2) tick penggaris dipindah ke pita margin kertas (±14px di luar sheet memicu scroll horizontal saat Fit) — §5.5 sudah diubah lebih dulu; (3) `entryLayout.datePosition:'right'` belum dirender (semua spec Fase 4 `next-line`) — jadi milik T6.2; (4) spacing antar blok disimpan sebagai `padAfterMm` milik blok itu sendiri supaya tinggi terukur = footprint (plan tidak menyebut mekanismenya). **Bug nyata yang diperbaiki saat mengukur**: (5) `wellRef` menempel di toolbar, bukan di well → Fit mengukur elemen yang salah (lembar 576px, bukan 624px); (6) popover preset tidak menutup setelah dipilih (kini controlled); (7) `formatMonth` membuat `new Intl.DateTimeFormat` per panggilan → ~280ms/ketikan, kini di-cache per bahasa; (8) pemetaan entri→baris dihitung ulang untuk semua blok tiap store change → kini di-`WeakMap` per objek entri immutable; (9) ResizeObserver menulis store per elemen → render berantai, kini ditampung dan di-flush sekali per `requestAnimationFrame`; (10) `transform-origin: top center` pada kontainer yang lebih sempit dari lembar memotong tepi kertas → `top left`. **Hutang yang dicatat**: (11) target T4.5 «≥55fps @120wpm di laptop kelas menengah» **tidak terukur** di sini — rAF headless Chromium tidak ter-sinkron 60Hz (beban sama terbaca 52 / 106 / 155 fps); pengganti yang sah sudah hijau (0 longtask, p95 21ms). (12) Dengan CPU throttle 4× (proxy mesin lambat), biaya per ketikan 160–460ms dan **tetap sama ketika pane preview disembunyikan** → bottleneck ada di jalur form (Fase 3: `ExperienceEditor`/`EntryCard`/auto-grow textarea me-render ulang semua entri), bukan di preview Fase 4 — perlu diputuskan owner apakah dibuka sebagai task Fase 9 atau ditambal sekarang. (13) Bundel awal sekarang **242,39 KB gzip** (Fase 2 mencatat 193,82 KB; Fase 3 tidak mencatat angka) → melewati budget §7 «≤220 KB gzip»; `dist` tetap bebas rute `/dev/*`, fixture, dan `PDFDocument` (sudah diverifikasi grep). (14) Test Fase 3 disesuaikan karena placeholder preview digantikan renderer nyata: selector `[data-probe="paper"]` → `page-sheet` (4 test) dan urutan keyboard-reorder diberi jeda 1 frame sebelum `ArrowDown` (sensor dnd-kit butuh rect tersusun ulang) — **assertion tidak dilemahkan**, urutan & pengumuman aria-live tetap diperiksa. (15) `scripts/evidence-fase3.mjs` ikut diperbarui ke probe baru supaya bisa dijalankan lagi. | 🟡 Catatan owner |
| 2026-10-18 | 2 | Keputusan kecil di luar teks plan | (1) Dua token digelapkan sesuai keputusan owner: `--ink-tertiary #78838F→#5F6A77`, `--signal-warn #A9761A→#8A5E10`; `--color-ok-wash` 0,12→0,10 agar badge ok ≥4,5:1 — §2.2 diperbarui lebih dulu. (2) `index.html` memuat 7 preload font (dari 2): penyebab CLS 0,0010 adalah font swap pada wordmark/rail/status pill; setelah preload CLS 0,0000. (3) Utilitas tipe turunan §5 ditambahkan ke `tokens.css` (`text-button`, `text-button-strong`, `text-button-lg`, `text-caption`, `text-rail-label`, `text-chip-label`, `text-hint`, `text-dialog-title`, `text-page-title`) supaya tidak ada ukuran font hardcoded di komponen. (4) `docStore.setActiveSection` ditambahkan untuk rail & sheet mobile (`activeSectionId` tidak lewat commit). (5) `saveNow()` diekspor dari autosave untuk tombol retry SaveStatusPill. (6) `demoFocusRing` + `data-demo-focus` dipakai katalog untuk memperlihatkan state fokus tanpa memaksa Tab pada elemen tertentu. (7) `vitest.setup.ts` menambah stub `ResizeObserver` (ScrollArea Radix); `tsconfig.app.json` menambah types `node` karena test kontras membaca `tokens.css` dari disk. (8) Test Fase 1 `resetDoc` yang bergantung milidetik dibekukan waktunya dengan `vi.spyOn(Date,'now')` — assertion tidak dilemahkan. (9) Stub `RootPage` Fase 0 dihapus; `/` sekarang render AppShell. | 🟡 Catatan owner |
| 2026-10-18 | 5 | T5.1–T5.4 + Gate Fase 5 | `pnpm lint` · `pnpm typecheck` · `pnpm test` (**177 test**, 21 file; +8 baru di `tests/unit/pdfExport.test.ts`) · `pnpm build` exit 0 · `pnpm pdf:verify` **74/74 pemeriksaan lolos** · `pnpm test:e2e` **28/28** (termasuk `download-pdf.spec.ts` baru). Alur unduh nyata (skrip QA `artifacts/fase5-qa.mjs`): keyboard saja → Tab ke-5 = `Download PDF` → Enter → `alex-morgan-classic-ats.pdf` 141.122 byte, magic bytes `%PDF`, toast `PDF terunduh`, 0 error konsol; jumlah halaman PDF (pdf-lib `getPageCount`) == `HAL 1 / 2` di pratinjau; 47/47 baris dokumen yang terlihat di pratinjau ada di `pdftotext -layout` (0 baris hilang), urutan name → contact → heading → entry → bullet; Chrome membuka berkas di viewer bawaannya (`chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai`, screenshot `fase5-chrome-pdf-page1.png`). Gate ukuran: chunk `renderResumePdf` **507,29 KB gzip terpisah** (0 kemunculan `PDFDocument`/`fontkit`/`embedFont`/`IBMPlexSans` di chunk awal; e2e membuktikan chunk baru di-request setelah klik); bundle awal 799,51 KB / **243,62 KB gzip** vs 796,49 KB / **242,39 KB gzip** di commit Fase 4 (diukur dengan worktree `HEAD` + junction `node_modules`) → **+1,23 KB gzip** murni untuk tombol & helper unduh. Font PDF subset **269,0 KB** (6 berkas). Durasi export 1 hal **142 ms**, 3 hal **473 ms**. Screenshot 360/768/1024/1440 + fokus keyboard: `artifacts/fase5/fase5-*`; screenshot tidak bisa saya periksa sendiri (model ini tanpa input gambar) — daftar artefaknya terlampir. | ✅ Selesai (6/6 item Gate: 1 item menunggu owner) |
| 2026-10-18 | 5 | Tiga cacat PDF nyata yang ditemukan & diperbaiki dalam fase | Semuanya ditemukan `pdf:verify`, bukan dikira: (1) **glyph hilang senyap** — TTF yang di-self-host Fase 0/2 ternyata potongan "latin" Google Fonts (±250 cmap), jadi `Ł`/`ź`/`ő`/`ș` tidak ada; pdf-lib menggantinya `.notdef` tanpa error dan teks `Núñez-Łukasz` ter-ekstrak `Núñez- ukasz`. Diperbaiki `scripts/subset-fonts.mjs`: unduh sumber penuh (Plex Sans & Archivo variabel → `fontTools.varLib.instancer`, Plex Mono statis), subset ke Latin Dasar + Extended-A/B + tanda puncak. **`pdf:verify` kini juga memeriksa cmap tiap role tipografi**, bukan hanya teks hasil ekstraksi. (2) **ligatur GSUB menghapus karakter dari text layer** — `fi` disubstitusi jadi satu glyph gabungan tanpa padanan Unicode sehingga parser membaca `high-traf c`; subset kini dijalankan `--layout-features=kern` (hanya feature penempatan). Ini cacat sekelas pembuang-kata `@react-pdf` yang memicu ganti engine di Fase 0, ditemukan oleh uji kelengkapan teks. (3) **tracking heading ditulis karakter-demi-karakter** (hutang Fase 0 no. 2) — text layer pecah jadi huruf terpisah; kini pakai operator `Tc` (`setCharacterSpacing`) + kunci resource font sendiri per halaman, dibungkus `q`/`Q`. Karena itu teks heading utuh sebagai satu string di stream. | 🟡 Catatan owner |
| 2026-10-18 | 5 | Deviasi & keputusan yang perlu diketahui owner | (1) **histogram kata versi pdfjs**: pdfjs menyisipkan spasi antar huruf pada teks ber-tracking (`R I N G K A S A N`) sehingga jumlah kata terlihat +14,6% padahal `pdftotext -layout` membaca `RINGKASAN`; pengukuran jumlah kata karena itu menggabung token satu-huruf berurutan (`collapseLetterSpacing`) **dan** `pdf:verify` menjalankan dua extractor independen — pdfjs (halaman/metadata/glyph) + `pdftotext -layout` (urutan baca, persis yang dinamai Gate). §2.3 (+0,14em) **tidak** diubah; PDF memakai tracking yang sama dengan layar. Sisa selisih pdfjs terbesar 0,30% (fixture sedang), pdftotext 0,00%. (2) `pdfStyles.ts`/`PdfDocument.tsx` T5.1 tidak dibuat sebagai berkas terpisah: pdf-lib tidak punya `StyleSheet`/komponen `Document`, padanannya hidup di `ResumePdfLib.ts` yang membaca `TemplateSpec` yang sama (bentuk yang diminta catatan fase). (3) Subset font memperluas "latin" §3 menjadi Latin Extended-A/B karena Gate menuntut "tidak ada glyph hilang"; WOFF2 layar tidak diubah (karakter eksotis jatuh ke font sistem di pratinjau — perilaku lama, tanpa kehilangan data). (4) Boot script pembuat subset butuh jaringan saat cache kosong (`artifacts/font-sources/`); hasil subset di-commit karena diambil exporter saat runtime. (5) Chunk awal naik 1,23 KB gzip — tidak bisa nol karena tombol unduh memang harus ada di shell; batas ≤ 220 KB gzip dibawa ke Gate Fase 8/9. | 🟡 Keputusan owner |
| 2026-10-18 | 5 | :no_entry: satu item Gate tidak bisa dibuktikan di mesin ini | Gate Fase 5 baris 2 minta PDF dibuka di **Chrome, Adobe Reader, dan Google Drive Viewer**. Yang terbukti: Chrome (viewer bawaan Chrome terdeteksi + screenshot). Yang **tidak** terbukti: **Adobe Reader tidak terpasang** di mesin ini (`AcroRd32.exe`/`Acrobat.exe` tidak ada) dan **Google Drive Viewer butuh unggah berkas** ke akun. Bukti pengganti yang ada: (a) dua extractor independen membaca 100% teks dalam urutan benar; (b) setiap karakter yang digambar dicocokkan ke cmap font (0 tanpa glyph) — akar risiko "glyph hilang" sudah diperiksa di level font, bukan di level viewer; (c) Adobe/Drive tidak memakai mesin yang sama dengan pdfjs/poppler, jadi bukti (b) tidak menjamin tampilan visual mereka. Opsi untuk owner: **(A)** nyatakan item ini diterima dengan bukti pengganti di atas (risiko sisa: render Adobe/Drive tidak pernah dilihat mata); **(B)** owner memasang Adobe Reader / mengunggah ke Drive lalu memeriksa manual (5 menit, tidak ada perubahan kode); **(C)** tambahkan Playwright Firefox (pdf.js, ±90 MB unduhan) sebagai viewer ketiga otomatis — mesin render berbeda, tapi tetap bukan Adobe. Saya berhenti di sini dan menunggu keputusan; tidak ada sub-task lain yang tersisa. | ⛔ Menunggu owner |

#### Arsip akar masalah T0.4 — `@react-pdf/renderer` membuang teks saat wrap (RESOLVED: pindah ke pdf-lib)

**Reproduksi minimal.** Satu `<Text>` berisi satu paragraf di `<Page size="A4" style={{margin:45, fontSize:10}}>`. Kalimat sumber:
`"...paragraph of the resume before sending it to the hiring manager..."` → PDF hanya menyimpan
`"...resume before"` + baris berikutnya `"it to the hiring manager..."`. Kata **"sending" hilang permanen** dari berkas.

**Bukti bahwa ini cacat pustaka, bukan alat ukur saya:**
1. Dua pengekstrak independen setuju: `pdfjs-dist` dan `pdftotext` (poppler) sama-sama melaporkan kata yang hilang.
2. `pdfkit` murni (mesin PDF yang sama di bawah react-pdf) dengan kalimat yang sama menghasilkan teks **lengkap** → rantai pengukuran valid.
3. Bukan soal font: terjadi pada Helvetica standar maupun TTF subset kami.
4. Bukan soal `fixed`, flex row, atau margin: reproduksi memakai `<Text>` polos.
5. Bukan soal bahasa: terjadi pada teks Inggris dan Indonesia.
6. `Font.registerHyphenationCallback` terbukti dipanggil tetapi **tidak mengubah hasil**; varian `(word)=>[word]`, `(word)=>word.split('')`, dan `hyphenationPenalty` 0/100000 semuanya tetap kehilangan teks.
7. **Kontingensi §10(b) tidak menolong:** `@react-pdf/renderer@3.4.5` + React 18 menunjukkan cacat yang sama persis. Yang tersisa dari daftar §10 hanya (a) pin React 18 di subtree PDF — tidak relevan karena v3 juga cacat — dan (c) fallback `pdf-lib`.

**Konsekuensi.** Ini tepat di jantung P2/§2 roadmap: PDF berbasis teks yang bisa dibaca parser. Kehilangan kata terjadi senyap, jadi pengguna akan mengira CV-nya sudah benar lalu melamar dengan dokumen yang cacat. Gate Fase 0 sengaja tidak saya centang dan `pnpm pdf:verify` dibiarkan gagal (exit 1) supaya tidak bisa lolos tanpa keputusan.

**Opsi yang saya butuhkan keputusannya:** (A) ganti engine PDF ke `pdf-lib` + layout sendiri dari `TemplateSpec`; (B) tetap di `@react-pdf/renderer` tapi render tiap baris sebagai `<Text>` satu-baris yang sudah kami wrap sendiri (butuh pengukur lebar teks sendiri, dan bertentangan dengan semangat "biarkan pustaka yang menata"); (C) tunda dan ajukan bug ke hulu `diegomura/react-pdf` sambil Fase 1–3 jalan (tidak menyentuh PDF). Detail trade-off disampaikan di percakapan.

**Keterangan status:** ⬜ Belum mulai · 🟡 Sedang berjalan · ✅ Selesai & terverifikasi · ⛔ Terblokir (tulis alasannya di Catatan)

---

## 10. Risiko & Kontingensi

| Risiko | Dampak | Mitigasi |
| :-- | :-- | :-- |
| ~~`@react-pdf/renderer` bermasalah dengan React 19~~ → **terkonfirmasi, tapi lebih buruk dari yang dikira**: v4.9.0 dan v3.4.5 sama-sama membuang kata di titik wrap (bukti: §9 Execution Log 2026-10-18). | Ekspor PDF menghasilkan dokumen yang kehilangan teks secara senyap — merusak seluruh alasan produk ini ada | **Diputuskan & dieksekusi di Fase 0:** pindah ke `pdf-lib` + `@pdf-lib/fontkit` (opsi (c)). Konsekuensi yang sekarang jadi tanggung jawab kita: line-wrap, page-break, dan anti-janda ditulis sendiri dari `TemplateSpec`. Jangan pernah kembali ke `@react-pdf/renderer` sebelum ada uji kelengkapan teks di `pdf:verify` yang hijau. |
| Preview layar ≠ hasil PDF | Kepercayaan pengguna runtuh | P4 + satu `TemplateSpec` + satu mesin pagination (`usePagination`) dipakai kedua renderer + uji silang otomatis di `pdf:verify` |
| Font TTF membuat ekspor lambat / berat | UX download buruk | Subset `pyftsubset` latin-only, total < 400 KB, lazy chunk, tampilkan progress bila > 1.2s |
| Pagination salah saat konten panjang | Teks terpotong di PDF | Aturan anti-jonda di Fase 4 + fixture pendek/sedang/panjang di E2E + uji 3 halaman |
| Pengguna mengira checker menjamin lolos ATS | Masalah kepercayaan/etika | P5: label `INDEKS STRUKTUR`, disclaimer permanen, Parse Tape yang menunjukkan bukti, FAQ menjelaskan |
| Scope creep ke fitur AI sebelum MVP stabil | MVP tidak pernah rilis | Urutan fase ketat: Fase 12 tidak boleh dibuka sebelum Gate Fase 9 hijau |
| IndexedDB ditolak (private mode) / kuota penuh | Data hilang | Fallback in-memory + banner jujur (T1.3) + penanganan kuota penuh (T9.6) |
| Biaya AI membengkak | Operasional | Kuota per hari, kill-switch `AI_ENABLED`, logging token, alert ambang (T12.8) |

---

## 11. Ringkasan Urutan Pengerjaan

```
FASE 0  Fondasi + spike PDF            → gate: PDF teks ter-copy
FASE 1  Skema, store, IndexedDB        → gate: refresh tidak kehilangan data
FASE 2  Design system + app shell      → gate: token & responsif & a11y dasar
FASE 3  Rail + semua form section      → gate: 9 section + reorder 3 input
FASE 4  Preview layar + pagination     → gate: <100ms, break akurat
FASE 5  Ekspor PDF                     → gate: pdf:verify 5 template
FASE 6  5 template ATS                 → gate: preview == PDF
FASE 7  ATS checker + Parse Tape       → gate: aturan teruji, disclaimer ada
FASE 8  Homepage + SEO + PWA           → gate: Lighthouse sesuai budget
FASE 9  QA & hardening                 → gate: MVP SIAP PUBLIK 🚀
──────────────────────────────────────────────────────────────
FASE 10 Deploy + Auth + Cloud sync     → gate: RLS + local-first tetap utuh
FASE 11 Undo/redo, riwayat, DOCX, import, i18n
FASE 12 AI assistant + cover letter    → gate: kuota & tanpa halusinasi
```

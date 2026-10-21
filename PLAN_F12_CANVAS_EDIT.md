# PLAN F12 — EDIT LANGSUNG DI CV (ON-CANVAS EDITING) — REALISASI

> Dokumen ini adalah **catatan realisasi** FASE 12, turunan dari
> [CANVAS_EDIT_PLAN.md](CANVAS_EDIT_PLAN.md) (keputusan desain D1–D16, matriks §4,
> fase C1–C5). Master plan tetap pemegang keputusan yang mengikat; dokumen ini
> menjawab "apa yang benar-benar dibangun, di file mana, dan dibuktikan oleh apa".
>
> Konvensi rumah: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §0 — satu fase
> ditutup Gate-nya sebelum fase berikutnya dibuka. Status per 2026-10-20:
> **C1–C5 selesai & terverifikasi**, FASE 12 tertutup.

---

## 0. Status per fase

| Fase | Isi | Gate | Bukti utama |
| :-- | :-- | :-- | :-- |
| C1 | undo/redo (T11.1), `editMode` + `canvasStore`, menu Tampilan, prefs | ✅ | `tests/unit/docStore.test.ts`, `tampilanMenu.test.tsx`, `tests/e2e/canvas-mode.spec.ts` |
| C2 | segmentasi per field + guide per template + paritas PDF | ✅ | `fieldSegments.test.ts` (19), `canvasGuides.test.tsx`, `pdf:verify` 174/174, `evidence-fase12-c2.mjs` 13/13 |
| C3 | editor swap-in, sesi beku, guard zoom, field header/summary/skill | ✅ | `canvasEdit.test.tsx` (14), `tests/e2e/canvas-edit.spec.ts` (8) |
| C4 | kepala entri, tanggal, bullet, ghost row | ✅ | `canvasEntry.test.tsx` (25), `canvas-entry.spec.ts` (5), `evidence-fase12-c4.mjs` 23/28 (temuan ghost → opsi A di C5) |
| C5 | mobile, integrasi ATS, performa, a11y penuh, dokumentasi, QA sweep | ✅ | `canvas-mobile.spec.ts` (4), `canvasAts.test.tsx` (10), `canvas-ats.spec.ts` (2), `canvas-a11y.spec.ts` (4), `evidence-fase12-c5.mjs` 19/19 |

---

## 1. Peta modul

### Baru

| File | Peran |
| :-- | :-- |
| `src/store/canvasStore.ts` | Sesi edit (`session`, `modeHintSeen`, `zoomRaised`) terpisah dari `uiStore` (D6/D13) |
| `src/app/shell/TampilanMenu.tsx` | Popover "Tampilan" + `TampilanMenuContent` (dipakai sheet mobile) — D2 |
| `src/features/templates/fieldSegments.ts` | Segmentasi layar per `BlockKind`; pemisah literal dibawa per baris (D4) |
| `src/features/canvas/CanvasBlock.tsx` | Render mode kanvas: segmen tombol, guide, editor swap-in, tanggal |
| `src/features/canvas/canvasFields.ts` | Peta path model → target tulis/widget/wajib; `blockKeyForField`, `entryIdForField` |
| `src/features/canvas/canvasCommit.ts` | Validasi zod + tulis lewat `updateSection`/`updateEntry`; `addCanvasEntry`/`addCanvasBullet` |
| `src/features/canvas/CanvasFieldEditor.tsx` | Editor input/textarea/chips in-place (D3) |
| `src/features/canvas/CanvasDatesEditor.tsx` | Popover/Sheet tanggal memakai ulang `DateRangeField`+`MonthPicker` (C4.2) |
| `src/features/canvas/canvasGhosts.ts` | Jangkar ghost row dihitung dari `plan.blocks` (C4.4) + anggaran ruang ghost (C5.1) |
| `src/features/canvas/CanvasGhostRow.tsx` | "+ Tambahkan entri/bullet/bagian" (D10) |
| `src/features/canvas/canvasZoom.ts` | Guard zoom efektif (D7) |
| `src/features/canvas/canvasAts.ts` | Jembatan ATS → sesi kanvas + fallback form (C5.2) |
| `src/features/canvas/canvasButtonStyle.ts` | Reset gaya tombol segmen (tanpa surface baru di kertas) |

### Diubah (yang penting)

| File | Perubahan |
| :-- | :-- |
| `src/store/docStore.ts` | `undo/redo` + stack `future` + `breakEditCoalesce` |
| `src/store/uiStore.ts` | `editMode`, `sectionCatalogOpen` |
| `src/store/previewStore.ts` | `scheduleHeight` menahan laporan tinggi selama sesi (D6) |
| `src/app/AppShell.tsx` | `data-edit-mode`, live region pergantian mode (C5.4) |
| `src/app/shell/PreviewWell.tsx` | `TampilanMenu` di toolbar pratinjau |
| `src/app/shell/MobileTabBar.tsx` | Badge tab Pratinjau saat mode kanvas (C5.1) |
| `src/app/shell/TopBar.tsx` | Tombol Undo/Redo |
| `src/features/preview/blocks.ts`, `createPagePlan.ts`, `paginate.ts` | Rencana kanvas ber-guide + anggaran ghost (opsi A C4.4); rencana isi tidak berubah |
| `src/features/templates/screen/BlockView.tsx` | Cabang mode kanvas, `data-canvas-editing` |
| `src/features/templates/screen/TemplateRenderer.tsx` | Ghost row hanya pratinjau kanvas tanpa `scope` |
| `src/features/ats/components/AtsPanel.tsx` | `Perbaiki →` membuka sesi kanvas bila field tercakup (C5.2) |
| `src/features/editor/DateRangeField.tsx` | Prop `showCurrent` (proyek tanpa sakelar "masih berjalan") |
| `src/schema/resume.ts` | `summarySchema` diekspor |
| `src/dictionaries/id.ts` | Namespace `tampilan.*` + `canvas.*` |
| `src/styles/tokens.css` | Affordance kanvas, editor, ghost, target sentuh mobile |

---

## 2. Realisasi per task

### C1 — Fondasi

- **C1.1** `docStore.undo/redo` memakai snapshot `history` yang sudah ada + stack
  `future` (kapasitas `HISTORY_LIMIT` 50). Tombol TopBar (`data-probe="undo|redo"`),
  shortcut Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y, dilewati saat fokus di field teks.
  Coalesce 150 ms membuat satu burst ketikan = satu langkah undo.
- **C1.2** `editMode` + `setEditMode` di `uiStore`; `canvasStore` baru; `editMode`
  masuk whitelist `usePreviewPrefs` (`ats:prefs:v1`); `data-edit-mode` di root shell.
- **C1.3** `TampilanMenu` (popover desktop) + `TampilanMenuContent` (sheet mobile):
  mode pengerjaan, toggle penggaris/stabilo/stabilo-PDF, preset zoom; toast hint
  sekali per sesi (`canvas.modeHint`).
- **C1.4** Probe: `tampilan-menu`, `edit-mode`, `edit-mode-form|canvas`, `undo|redo`.

### C2 — Guide read-only

- `fieldSegments.ts` merekonstruksi teks dari doc per field, dengan pemisah literal
  **milik baris** (`SegmentGroup`) supaya konkatenasi == `contentLines` (19 test).
- Mode kanvas merender segmen sebagai `<button>` ber-`data-field`; nilai kosong
  menampilkan guide `canvas.guide.*` (fallback override per template lewat `tMaybe`,
  belum diisi — OQ2). Thumbnail & halaman pembanding selalu jalur form (`scope`).
- Dokumen kosong: rencana kanvas menambahkan **blok guide** (header, satu blok per
  bagian, entri maya + bullet maya) → "kerangka CV" D16. Rencana isi (ATS, PDF)
  tetap tanpa blok guide.
- Paritas: `pnpm pdf:verify` 174/174; Δ kiri 0 mm / executive 0,33 mm, atas 0 mm
  (`scripts/evidence-fase12-c2.mjs`).

### C3 — Edit inline field sederhana

- `CanvasFieldEditor`: `<input>` / `<textarea>` auto-grow / input chips; guide jadi
  placeholder; Enter commit (Ctrl/Cmd+Enter untuk textarea), Escape batal, blur
  commit; validasi zod per field (error `role="alert"` + `aria-invalid`); field
  wajib kosong → revert + toast; fokus kembali ke pemicu.
- Pembekuan repaginasi: `scheduleHeight` menahan laporan tinggi selama
  `canvasStore.session != null`, melepasnya saat sesi ditutup.
- Guard zoom: skala **efektif** dibaca dari `transform: scale()` (mode Fit tidak
  terbaca dari preferensi), naik ke 0,75 sekali per sesi aplikasi.
- Satu sesi = satu langkah undo (`breakEditCoalesce` sebelum & sesudah commit).

### C4 — Entri, tanggal, bullet, ghost

- Path `entries.<kind>.<id>.*` → `entry-text` / `entry-dates` / `entry-bullet`;
  whitelist field persis matriks §4, wajib dari `sectionRegistry`.
- Tanggal: popover `DateRangeField`/`MonthPicker` sesuai bentuk yang digambar
  dokumen (`datesShapeOf`); commit = Simpan/Enter, batal = Batal/Escape/klik luar.
- Bullet: textarea satu baris, Enter commit (OQ6), commit kosong membuang baris;
  daftar baris sisi kanvas ikut menghitung bullet kosong agar slot ghost punya blok.
- Ghost row: jangkar = blok terakhir entri/bagian/dokumen; batas `DOC_LIMITS`
  mematikan tombol + tooltip; "+ Tambahkan bagian" membuka dialog katalog rail.
- Temuan ⛔ C4.4 (ghost terpotong di halaman penuh) diselesaikan di C5.1 opsi A.

### C5 — Mobile, lintas-fitur, hardening

- **C5.1** Anggaran ghost pada pass kanvas (`canvasGhostExtraPxOf` → `paginateBlocks`
  `extraPx`): blok jangkar yang tidak muat pindah halaman bersama ghost-nya; rencana
  isi (ATS/PDF) tidak tersentuh. Target sentuh mobile (padding transparan 10px
  → area hit ≥32px; ghost 44px), badge tab Pratinjau, Sheet tanggal, entri Tampilan
  di sheet Menu. `tests/unit/canvasGhostBudget.test.ts` + `canvas-mobile.spec.ts` 4/4.
- **C5.2** `canvasAts.ts`: id field ATS → path model (`profile-*`,
  `skill-group-*-items`, `<prefix>-<id>-bullet-<i>`, `<prefix>-<id>-dates-*`), lalu
  divalidasi `canvasFieldSpecOf` (matriks §4 sebagai otoritas). `AtsPanel.fix`
  memakai jalur ini hanya saat `editMode='canvas'`; field di luar matriks
  (mis. tanggal pendidikan) tetap `focusTarget` → form. Sesi dibuka + tab pratinjau
  + gulir ke blok bersesi + guard zoom.
- **C5.3** Performa terukur (`scripts/evidence-fase12-c5.mjs` PASS A/B):
  Profiler 10 ketikan — form 1340 render / 486 ms / 82 blok; kanvas 20 render /
  14,5 ms / 1 blok dokumen; commit kanvas 243 render / 219 ms (repaginasi wajar).
  Bundle awal 290,89 KB gzip (+11,88 KB vs Fase 9 279,01 KB). **Lazy split editor
  diukur dan ditolak**: 291,53 KB (lebih berat) karena chunk bersama zod/store.
- **C5.4** `canvas-a11y.spec.ts`: keyboard penuh (Tab → Enter → ketik → Enter →
  Tab → Ctrl+Z), live region `tampilan.modeAnnounce` (AppShell), reduced-motion,
  axe 0 serious di mode kanvas. Mode form tetap diaudit `a11y.spec.ts`.
- **C5.5** Dokumen ini + §5 UI inventory + §6/§9 `IMPLEMENTATION_PLAN.md` +
  Execution Log kedua dokumen.
- **C5.6** Sapuan QA: `scripts/evidence-fase12-c5.mjs` **19/19** — 5 template ×
  2 mode (segmen/ghost 0 di form, 46/11 di kanvas) + screenshot
  `artifacts/evidence/c5-<template>-<mode>.png`, PDF mode kanvas bersih dari guide
  & ghost, kanvas mobile Pixel 7.

---

## 3. Deviasi & keputusan teknis (semua terukur, tidak ada yang diam-diam)

1. **C1.1 — undo/redo**: snapshot `history`+`future` (bukan immer/zundo), kapasitas
   50, tanpa toast "Perubahan dibatalkan" (tombol Redo + shortcut jadi jalan balik).
   Tercatat juga di `IMPLEMENTATION_PLAN.md` T11.1.
2. **C2.1 — pemisah per baris**, bukan per segmen: pemisah adalah milik baris
   (`" — "`, `" · "`, `", "`), dan menyimpannya per segmen membuat konkatenasi
   bergantung pada field kosong.
3. **C2.5 — nama aksesibel segmen** memuat teks yang terlihat (aksi + field +
   nilai). Tanpa itu aturan axe "label in name" (`label-content-name-mismatch`,
   serius) gagal. Aksi & field tetap disebut.
4. **C3.4 — kelompok skill tanpa grup belum editable**: menambah kelompok skill
   tidak ada di ghost row D10, jadi tetap milik form.
5. **C4.2 — commit tanggal tanpa blur**: popover memakai Simpan/Enter; menulis
   store per perubahan tanggal akan memecah satu sesi jadi banyak langkah undo (D9).
6. **C4.4 → C5.1 — ghost terpotong**: keputusan owner opsi A (ruang ghost masuk
   anggaran halaman **rencana kanvas** saja).
7. **C5.2 — fallback form tetap ada**: field yang tidak punya segmen di kertas
   (tanggal pendidikan, IPK, `stack`, `credentialId`, kemahiran bahasa, `url`
   proyek) tidak dibuatkan segmen baru; `Perbaiki →` menuju form seperti T7.4.
8. **C5.3 — lazy split editor ditolak** dengan angka (lihat di atas). Kode editor
   tetap statis; yang dijaga adalah *tidak ada regresi* durasi render.

---

## 4. Batas cakupan yang tetap berlaku

- Reorder / hide / duplicate / delete section & entry tetap di Rail/form (OQ1 → v2).
- Tidak ada `contentEditable`, tidak ada perubahan pipeline PDF, tidak ada
  perubahan struktur `DocBlock`.
- Guide, ghost, dan affordance edit tidak pernah masuk PDF/thumbnail (D12, terbukti
  `pdf:verify` + e2e mode form).

---

## 5. Cara menjalankan ulang bukti

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm pdf:verify
pnpm test:e2e                 # chromium + mobile-chrome
pnpm build && pnpm lhci

# bukti lintas template & performa (butuh dev server 5173)
pnpm dev --port 5173 --strictPort
node scripts/evidence-fase12-c5.mjs   # 19 pemeriksaan + screenshot
```

Artefak: `artifacts/evidence/c5-*.png`, `fase12-c5.json`, `c5-canvas-export.pdf`;
bukti C2/C4 di `artifacts/evidence/` dengan prefiks `c2-`/`c4-`.

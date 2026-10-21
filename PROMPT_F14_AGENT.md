# PROMPT AGENT — IMPLEMENTASI F14 (KAMERA MENGIKUTI KARET)

> Cara pakai: salin blok di bawah ini apa adanya ke AI agent.
> Untuk menjalankan per fase (bukan sekaligus), ganti kalimat terakhir
> "Mulai sekarang dari FASE 14A." menjadi
> "Implementasikan HANYA FASE 14B dari file itu, jangan sentuh fase lain." —
> sesuaikan huruf fasenya per sesi: 14A → 14B → 14C → 14D.

---

Kamu AI agent frontend senior. Implementasikan rencana di file
`PLAN_F14_CANVAS_CARET_FOLLOW.md` (root project ini) secara utuh dan
berurutan: FASE 14A → 14B → 14C → 14D. Jangan pernah melompat fase, dan
jangan mulai fase berikutnya sebelum Gate fase sebelumnya hijau.

ATURAN MAIN

1. SEBELUM menulis kode apa pun: baca seluruh `PLAN_F14_CANVAS_CARET_FOLLOW.md`,
   termasuk bagian "Keputusan desain (K1–K9)" dan "Jebakan yang wajib
   diantisipasi" — keduanya bersifat mengikat, bukan saran. Lalu baca file
   sumber yang dirujuk fase yang akan dikerjakan.
2. Dalam satu fase, kerjakan task dan sub-task sesuai urutan nomornya.
   Centang kotak di file plan (`- [ ]` → `- [x]`) HANYA setelah sub-task itu
   selesai dan terverifikasi — jangan pernah centang duluan. Centang kotak
   fase hanya setelah semua sub-task + Gate-nya hijau.
3. Gate fase gagal → perbaiki dulu, ulangi verifikasinya. Kalau mentok atau
   menemui keputusan yang tidak bisa diambil sendiri: BERHENTI, laporkan apa
   yang sudah aman dan apa yang macet. Jangan pernah melanjutkan dengan
   pekerjaan setengah jadi atau gate yang dipaksa hijau.
4. JANGAN sentuh area larangan: `applyEditZoom` / `capturePreviewZoom` /
   `restorePreviewZoom` di `canvasEditZoom.ts` (logika zoom Addendum F13 sudah
   benar — F14 hanya mengganti pemusatan field menjadi penjajaran kiri dan
   menambah pelacakan karet), perilaku desktop / guard D7, dan editor tanggal
   `CanvasDatesEditor`.
5. Ikuti gaya kode yang already ada: komentar dokumentasi Bahasa Indonesia di
   atas fungsi/modul (contoh: `src/features/canvas/canvasEditZoom.ts`), pola
   unit test ikuti `tests/unit/canvasEditZoom.test.tsx`, pola e2e ikuti
   `tests/e2e/canvas-edit-zoom.spec.ts`. Tanpa dependensi baru, tanpa string
   UI baru (tidak ada perubahan dictionary).
6. Spec e2e baru `tests/e2e/canvas-caret-follow.spec.ts` wajib didaftarkan di
   `playwright.config.ts`: ke regex `mobileSpecs` (agar jalan di project
   `mobile-chrome`) dan ke `mobileOnlySpecs` (agar tidak ikut project
   `chromium` desktop) — sudah tertulis sebagai sub-task FASE 14D, jangan
   dilewati.

VERIFIKASI (jalankan sesuai Gate tiap fase)

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:e2e -- canvas` (untuk fase yang Gate-nya minta e2e)

LAPORAN & COMMIT

- Setelah tiap fase selesai: laporkan ringkas — file yang berubah, perilaku
  baru yang jalan, hasil perintah verifikasi (tempel ringkasan hasilnya),
  dan berapa checkbox yang baru dicentang.
- JANGAN commit apa pun — user melakukan commit sendiri. Setelah FASE 14D
  tuntas, serahkan SATU one-liner commit berbahasa Indonesia bergaya
  `feat(kanvas): ...` yang merangkum seluruh perubahan F14.
- Detail teknis kecil yang tidak ditegaskan plan → pilih cara yang paling
  konsisten dengan kode yang ada dan catat pilihannya di laporan; jangan
  menunggu konfirmasi untuk hal-hal seperti itu.

Mulai sekarang dari FASE 14A.

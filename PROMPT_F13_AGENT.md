# PROMPT AGEN — IMPLEMENTASI FASE 13 (KERTAS LAYAR PENUH)

Panduan singkat untuk menyuruh AI agent mengerjakan  
`PLAN_F13_CANVAS_FULLSCREEN.md` **fase demi fase, urut**, di  
`C:\Users\yourlilsan\ats-builder`.

**Cara pakai (3 langkah):**

1. Copy **PROMPT AWAL** di bawah → paste ke sesi agent **baru** → jalankan.
2. Agent berhenti di Gate tiap fase dan lapor. Kamu periksa sebentar.
3. Kalau setuju, copy **PROMPT LANJUT** → paste di sesi yang sama. Ulangi sampai Fase 7.

> Satu sesi agent = satu fase. Jangan digabung: bila satu fase gagal, fase  
> berikutnya tidak ikut rusak dan kamu bisa mengoreksi arah lebih awal.

---

## 1. PROMPT AWAL — mulai dari Fase 0

```
Kamu engineer yang mengimplementasikan FASE 13 di proyek ATS resume builder
(React + TypeScript + Vite, Zustand, Tailwind) di C:\Users\yourlilsan\ats-builder.

Tujuan akhir: saat mode pengerjaan "Langsung di CV" dipilih, workspace menjadi
SATU pane penuh — rail kiri dan panel formulir tidak ditampilkan, kertas A4
mengisi layar. Bukan lagi "menu edit di kiri + pratinjau di kanan".

ATURAN KERJA — ikat, jangan dilanggar:

1. Baca dulu SELURUH C:\Users\yourlilsan\ats-builder\PLAN_F13_CANVAS_FULLSCREEN.md
   sebelum menyentuh kode. Dokumen itu sumber kebenaran: keputusan D1–D14,
   matriks breakpoint §4, dan daftar sub-tugas per fase. Nomor baris di plan
   adalah referensi saat plan ditulis — verifikasi ke kode aktual sebelum
   mengedit, dan laporkan bila meleset.
2. Kerjakan SATU fase per kali jalankan, urut Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.
   Setelah fase selesai: BERHENTI dan lapor. Jangan mulai fase berikutnya tanpa
   persetujuanku. Kalau Gate tidak bisa ditutup, berhenti juga dan jelaskan
   penyebabnya — jangan dipaksa hijau.
3. Untuk setiap sub-tugas yang selesai, ubah `- [ ]` jadi `- [x]` langsung di
   PLAN_F13_CANVAS_FULLSCREEN.md. File itu satu-satunya sumber status; jangan
   bikin file progress atau checklist baru.
4. Jangan lompat fase. Jangan tambah fitur di luar plan. Jangan "sekalian
   merapikan" kode yang tidak terkait. Temuan di luar plan cukup dicatat di
   bagian [D] laporan.
5. Perubahan perilaku mode form = regresi. Mode form HARUS tetap identik dengan
   sebelum Fase 13 di semua breakpoint. Pipeline PDF dan paritas ekspor tidak
   boleh tersentuh.
6. Jangan menghapus, melewati (skip), atau melonggarkan tes supaya suite hijau.
   Tes gagal karena perubahanmu → perbaiki kodenya. Kalau tesnya sendiri yang
   keliru, jelaskan dan minta keputusanku.
7. Bukti, bukan klaim. Setiap klaim "selesai" wajib disertai output perintah
   yang sebenarnya (bukan ringkasanku), path file:baris, dan angka terukur.
   "Seharusnya sudah benar" bukan bukti.
8. Konvensi repo: komentar kode dan kamus UI Bahasa Indonesia; logika murni
   dipisah ke modul sendiri supaya teruji tanpa DOM; warna/ukuran lewat token
   desain, bukan nilai hardcode.
9. Jangan commit, push, reset, atau hapus apa pun tanpa kuminta lebih dulu.
10. Lingkungan Windows: path untuk Node wajib `C:/Users/...`, bukan
    `/c/Users/...`. Sebelum `pnpm build` atau `pnpm test:e2e`, pindahkan
    `dist/`, `test-results/`, dan `node_modules/.vite/deps` ke /tmp — alat
    pencegah hapus massal memblokir `rm`, dan `pnpm build` gagal kalau
    `dist/fonts` belum dipindah lebih dulu.

Langkah pertamamu: buka PLAN_F13_CANVAS_FULLSCREEN.md, sebutkan Fase 0 dan
daftar sub-tugasnya, lalu kerjakan sampai semua sub-tugas dan Gate Fase 0
tercentang. Berhenti di Gate itu.

Format laporan penutup — wajib, persis seperti ini:

[A] RINGKASAN PERUBAHAN
- file:baris | apa yang berubah | mengapa

[B] BUKTI
- output nyata `pnpm typecheck`, `pnpm lint`, `pnpm test`
- angka terukur yang diminta Gate (mis. lebar kertas / skala zoom sebelum vs sesudah)
- daftar file tes baru yang ditambahkan

[C] CHECKBOX YANG DICENTANG
- Fase / Tugas / Sub-tugas yang baru saja ditutup

[D] BLOKIR & CATATAN
- yang tidak bisa diselesaikan, keputusan yang kamu ambil sendiri, temuan di luar plan

[E] LANJUTAN
- status Gate: HIJAU atau MERAH, dan apa yang menunggu persetujuanku
```

---

## 2. PROMPT LANJUT — fase berikutnya

```
Lanjut FASE 13 ke fase berikutnya.

Baca status checkbox terbaru di
C:\Users\yourlilsan\ats-builder\PLAN_F13_CANVAS_FULLSCREEN.md, sebutkan fase
yang akan kamu kerjakan beserta daftar sub-tugasnya, kerjakan sampai semua
sub-tugas dan Gate-nya tercentang, lalu BERHENTI dan lapor dengan format
[A]–[E] yang sama. Aturan kerja nomor 1–10 tetap berlaku.
```



---

## 3. PROMPT TERARAH — fase tertentu / ulang fase

```
Kerjakan FASE 13 **Fase <N>** saja di C:\Users\yourlilsan\ats-builder.

Abaikan fase lain. Baca sub-tugas Fase <N> di PLAN_F13_CANVAS_FULLSCREEN.md,
kerjakan sampai semua sub-tugas dan Gate Fase <N> tercentang, lalu BERHENTI dan
lapor dengan format [A]–[E]. Aturan kerja nomor 1–10 tetap berlaku.
```

---

## 4. PROMPT VARIAN — tanpa henti sampai Fase 7

Pakai hanya kalau kamu ingin agent jalan sendiri dan siap memeriksa hasil  
akhirnya. Risiko: satu keputusan keliru terbawa sampai fase akhir.

```
Kerjakan FASE 13 dari fase yang belum centang sampai Fase 7 selesai, urut tanpa
berhenti di tiap Gate. Tetap centang checkbox di PLAN_F13_CANVAS_FULLSCREEN.md
per sub-tugas. Kalau satu Gate tidak bisa ditutup, BERHENTI saat itu juga dan
lapor — jangan lanjut ke fase berikutnya. Laporkan rekap [A]–[E] gabungan di
akhir, plus daftar Gate yang HIJAU dan yang MERAH. Aturan kerja nomor 1–10
tetap berlaku.
```

---

## 5. Yang perlu kamu periksa di tiap Gate

Sebelum bilang "lanjut", cukup cek kolom ini — tidak perlu membaca semua diff.

| Fase  | Satu hal yang wajib kamu lihat dulu                                      | Tanda bahaya                                                        |
| :---- | :----------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **0** | Angka lebar `#pane-preview` sebelum vs sesudah spike T0.3                | Agent tidak pernah benar-benar menjalankan spike, cuma menyimpulkan |
| **1** | Screenshot mode form 1024/1280/1440/1920 — harus identik dengan baseline | Pratinjau malah menyusut ke 56px (jebakan auto-placement grid)      |
| **2** | Angka skala kertas di 1440px saat mode kanvas — harus **> 1.5**          | Mentok 1.5 → "layar penuh" cuma ruang kosong                        |
| **3** | Coba sendiri: sembunyikan rail, lalu urut/hapus/sembunyikan satu bagian  | Tidak ada pengganti rail → mode layar penuh menyandera fitur        |
| **4** | Buka 360×640, pastikan tidak ada celah di bawah kertas                   | Tinggi masih `100dvh-96px` padahal tab bar sudah hilang             |
| **5** | Toggle mode lewat keyboard saja, lalu cek ke mana fokus pergi            | Fokus jatuh ke `<body>` setelah elemen difokus jadi `display:none`  |
| **6** | Jumlah tes yang **dihapus** atau di-`skip` — harus nol                   | Suite hijau karena tesnya yang diubah                               |
| **7** | `pnpm pdf:verify` masih 174/174 dan bundle awal tidak membengkak         | Chunk `HomeSections` ikut masuk bundle awal                         |

---

## 6. Cara menegur agent yang menyimpang

Copy sesuai kebutuhan, tempel sebagai balasan:

```
Kembali ke fase yang sedang berjalan. Jangan kerjakan hal di luar sub-tugas
Fase <N> di PLAN_F13_CANVAS_FULLSCREEN.md.
```

```
Itu klaim, bukan bukti. Tunjukkan output perintah aslinya dan nomor barisnya.
```

```
Kembalikan tes yang kamu ubah. Perbaiki kodenya, bukan tesnya.
```

```
Mode form berubah. Tunjukkan perbandingan screenshot sebelum vs sesudah pada
1024 / 1280 / 1440 / 1920 sebelum lanjut.
```

/**
 * Fixture deskripsi lowongan (T7.5). Dipakai aturan kata kunci dan uji
 * highlighter — teks dipilih menyerupai lowongan nyata (bukan lorem).
 *
 * Kata yang sengaja diulang supaya ambang "≥ 2 kemunculan" pada `extractKeywords`
 * bisa dicapai secara deterministik: `graphql` & `observability` muncul
 * berulang tapi tidak ada di fixture CV, jadi keduanya pasti jatuh ke `missing`.
 */
export const JOB_DESCRIPTION = `Frontend Engineer (React/TypeScript)

Kami mencari Frontend Engineer dengan pengalaman 3 tahun untuk membangun aplikasi web berskala besar, terutama dashboard data dengan data realtime.

Tanggung jawab:
- Merancang dan membangun komponen React reusable bersama tim produk.
- Mengoptimalkan performa frontend dan metrik Core Web Vitals.
- Menjaga kualitas kode lewat code review, testing, dan CI/CD.

Kualifikasi:
- Minimal 3 tahun pengalaman dengan React dan TypeScript.
- Menguasai CSS, desain responsif, dan aksesibilitas.
- Pengalaman dengan GraphQL dan observability wajib.
- Familiar dengan GraphQL schema design dan observability tooling.
- Komunikasi baik dan nyaman bekerja lintas fungsi.`

/** Istilah tunggal yang pasti lolos ambang "≥ 2 kemunculan" DAN ada di fixture CV. */
export const JOB_DESCRIPTION_MATCHED = ['react', 'typescript', 'code review']

/** Istilah yang lolos ambang "≥ 2 kemunculan" tapi tidak ada di fixture CV. */
export const JOB_DESCRIPTION_MISSING = ['graphql', 'observability']

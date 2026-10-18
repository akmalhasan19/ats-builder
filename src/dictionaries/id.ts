/**
 * Kamus Bahasa Indonesia (P7: tidak ada teks UI hardcoded di komponen).
 * Fase 0 hanya berisi kunci yang dipakai halaman internal & spike.
 * Fase 1 (T1.4) melengkapi kamus ini untuk seluruh editor.
 */
export const id = {
  'app.name': 'Resume Studio',
  'app.tagline': 'Pembuat CV berbasis struktur',

  'home.title': 'Fondasi Fase 0 selesai',
  'home.body':
    'Workspace editor tiga panel dibangun di Fase 2. Sementara itu, halaman internal di bawah membuktikan token desain, mesin PDF, dan preview layar sudah berjalan.',
  'home.devHeading': 'Halaman internal',
  'home.devNote': 'Hanya ada di build dev.',

  'dev.badge': 'INTERNAL',
  'dev.backHome': 'Kembali ke beranda',
  'dev.skipToContent': 'Lompat ke isi',
  'dev.nav.tokens': 'Token desain',
  'dev.nav.pdf': 'Spike PDF',
  'dev.nav.preview': 'Spike preview',

  'tokens.title': 'Token desain',
  'tokens.subtitle':
    'Living spec §2.2–§2.3. Nilai di halaman ini dibaca dari CSS yang sedang aktif, bukan ditulis ulang di komponen.',
  'tokens.section.surface': 'Surface — sistem kedalaman 4 level',
  'tokens.section.ink': 'Tinta',
  'tokens.section.accent': 'Aksen',
  'tokens.section.highlighter': 'Stabilo',
  'tokens.section.signal': 'Sinyal semantik',
  'tokens.section.machine': 'Mesin — Parse Tape',
  'tokens.section.typeChrome': 'Skala tipe — chrome aplikasi',
  'tokens.section.typeHome': 'Skala tipe — homepage',
  'tokens.section.families': 'Keluarga font',
  'tokens.section.buttons': 'Tombol',
  'tokens.section.inputs': 'Input',
  'tokens.note.states':
    'Hover, active, dan focus-visible adalah state interaktif — arahkan kursor atau tekan Tab pada contoh di atas.',
  'tokens.note.surface': 'P3: kertas selalu jadi objek paling terang di layar.',
  'tokens.note.highlighter':
    '§2.2 aturan 1: stabilo hanya untuk menandai teks di atas kertas, tidak pernah untuk tombol, ikon chrome, atau latar panel.',
  'tokens.note.machine': '§2.2 aturan 2: satu-satunya surface gelap, hanya untuk Parse Tape.',
  'tokens.note.signal':
    '§2.2 aturan 3: warna sinyal tidak pernah jadi satu-satunya pembawa makna — selalu disertai ikon dan teks.',
  'tokens.note.accent': '§2.2 aturan 4: cyanotype untuk satu aksi primer per layar.',
  'tokens.computed.family': 'family',
  'tokens.computed.size': 'size',
  'tokens.computed.weight': 'weight',
  'tokens.computed.tracking': 'tracking',
  'tokens.computed.lineHeight': 'line-height',
  'tokens.computed.color': 'color',
  'tokens.sample': 'Alex Morgan · Software Engineer',
  'tokens.sample.mono': 'HAL 1 / 2 · 62% · 14.32',
  'tokens.fontStatus.declared': '@font-face terdaftar',
  'tokens.fontStatus.missing': '@font-face tidak ditemukan',
  'tokens.input.label': 'Nama lengkap',
  'tokens.input.placeholder': 'Contoh: Alex Morgan',
  'tokens.input.hint': 'opsional',
  'tokens.input.errorLabel': 'Email',
  'tokens.input.error': 'Email belum benar. Contoh: nama@domain.com',
  'tokens.input.disabledLabel': 'Kolom terkunci',
  'tokens.button.primary': 'Download PDF',
  'tokens.button.secondary': 'Periksa ATS',
  'tokens.button.ghost': 'Batal',
  'tokens.button.destructive': 'Hapus',
  'tokens.button.subtle': 'Simpan',
  'tokens.button.focused': 'Contoh focus-visible',

  'pdf.title': 'Spike PDF',
  'pdf.subtitle':
    'Membuktikan PDF berbasis teks: bisa diseleksi, urutan bacanya benar, dan chunk-nya lazy.',
  'pdf.action.short': 'Unduh PDF uji',
  'pdf.action.long': 'Unduh PDF 60 bullet',
  'pdf.state.generating': 'Membuat PDF…',
  'pdf.state.idle': 'Belum ada PDF yang dibuat.',
  'pdf.readout.duration': 'DURASI RENDER',
  'pdf.readout.size': 'UKURAN FILE',
  'pdf.readout.pages': 'HALAMAN',
  'pdf.readout.header': 'HEADER BERULANG',
  'pdf.unit.ms': 'ms',
  'pdf.unit.kb': 'KB',
  'pdf.value.yes': 'ya',
  'pdf.value.no': 'tidak',
  'pdf.note.lazy':
    'Renderer PDF dimuat lewat dynamic import. Di Network tab, chunk berisi pdf-lib baru diminta saat tombol diklik — tidak ikut bundle awal.',
  'pdf.note.selectable': 'Teks di dalam PDF di bawah bisa diseleksi dan disalin, bukan gambar.',
  'pdf.note.long':
    'Varian 60 bullet menguji wrap, page-break otomatis, dan prop fixed untuk header berulang.',
  'pdf.error.failed': 'PDF gagal dibuat. Coba lagi.',
  'pdf.viewer.label': 'Pratinjau PDF hasil spike',

  'preview.title': 'Spike preview layar',
  'preview.subtitle':
    'Renderer HTML dan renderer PDF membaca satu spikeSpec yang sama, jadi keduanya tidak bisa menyimpang.',
  'preview.action.loadPdf': 'Muat PDF pembanding',
  'preview.action.overlay': 'Tumpuk PDF di atas layar',
  'preview.zoom.label': 'ZOOM',
  'preview.zoom.fit': 'Fit',
  'preview.readout.sheet': 'UKURAN LEMBAR',
  'preview.readout.margin': 'MARGIN',
  'preview.readout.scale': 'SKALA',
  'preview.readout.container': 'TINGGI KONTAINER',
  'preview.check.title': 'Layar vs spikeSpec',
  'preview.check.leftMargin': 'Margin kiri teks nama',
  'preview.check.topMargin': 'Margin atas teks nama',
  'preview.check.nameSize': 'Ukuran font nama',
  'preview.check.lineHeight': 'Tinggi baris body',
  'preview.check.expected': 'harus',
  'preview.check.measured': 'terukur',
  'preview.check.pass': 'dalam toleransi ±1 mm',
  'preview.check.fail': 'di luar toleransi ±1 mm',
  'preview.check.pdfNote':
    'Sisi PDF dari perbandingan ini diverifikasi pnpm pdf:verify: ukuran halaman, margin, dan ukuran font dibaca dari matriks teks PDF.',
  'preview.note.pagination':
    'Pagination layar dikerjakan di Fase 4; lembar ini memotong konten yang melewati batas halaman.',
  'preview.label.screen': 'LAYAR (HTML/CSS)',
  'preview.label.pdf': 'PDF (pdf-lib)',
  'preview.error.pdf': 'PDF pembanding gagal dibuat.',
} as const

export type TranslationKey = keyof typeof id

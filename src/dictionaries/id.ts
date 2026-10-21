/**
 * Kamus Bahasa Indonesia (P7: tidak ada teks UI hardcoded di komponen).
 * Fase 0 hanya berisi kunci yang dipakai halaman internal & spike.
 * Fase 1 (T1.4) melengkapi kamus ini untuk seluruh editor.
 */
export const id = {
  'app.name': 'Vetra',
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
  'dev.nav.persist': 'Uji persistensi',
  'dev.nav.pagination': 'Uji pagination',
  'dev.nav.compare': 'Perbandingan template-PDF',

  'section.profile': 'Profil',
  'section.summary': 'Ringkasan',
  'section.experience': 'Pengalaman',
  'section.education': 'Pendidikan',
  'section.skills': 'Keahlian',
  'section.projects': 'Proyek',
  'section.certifications': 'Sertifikasi',
  'section.languages': 'Bahasa',
  'section.awards': 'Penghargaan',
  'section.volunteering': 'Relawan',

  'doc.untitled': 'CV tanpa judul',

  'status.savedLocal': 'Disimpan di perangkat',
  'status.saving': 'Menyimpan…',
  'status.savedCloud': 'Tersimpan di cloud',
  'status.offline': 'Offline \u00b7 data aman di perangkat',
  'status.error': 'Gagal menyimpan \u00b7 coba lagi',

  'persist.corrupt.restored':
    'Dokumen di perangkat ini rusak dan tidak bisa dibaca. Salinannya disimpan, lalu dokumen contoh dimuat ulang.',
  'persist.banner.memory': 'Perubahan tidak tersimpan di perangkat ini',

  'persist.dev.title': 'Harness persistensi lokal',
  'persist.dev.subtitle':
    'Halaman internal untuk membuktikan Gate Fase 1: tulis ke IndexedDB, muat ulang, data kembali identik. Tidak ada di build produksi.',
  'persist.dev.docTitle': 'Judul dokumen',
  'persist.dev.fullName': 'Nama lengkap',
  'persist.dev.status': 'Status simpan',
  'persist.dev.hint':
    'Ubah isinya, tunggu status berubah jadi “Disimpan di perangkat”, lalu reload halaman — nilainya harus tetap sama.',

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
  'tokens.note.accent':
    '§2.2 aturan 4: accent untuk satu aksi primer per layar. Nilainya mengikuti tema aktif; accent-ink untuk teks, accent-on untuk teks di atas isian.',
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
  'pdf.error.invalid': 'Lengkapi atau perbaiki kolom yang ditandai sebelum membuat PDF.',
  'pdf.error.font': 'PDF gagal dibuat karena font dokumen tidak bisa dimuat. Coba lagi.',
  'pdf.error.content':
    'PDF gagal dibuat. Ruangan dokumen terlalu penuh — kurangi satu bagian, lalu coba lagi.',
  'pdf.error.blob': 'PDF dibuat, tetapi browser tidak bisa memulai unduhan. Coba lagi.',
  'pdf.success.downloaded': 'PDF terunduh',
  'pdf.action.open': 'Buka',
  'pdf.state.slow': 'Menyiapkan file PDF. Proses masih berjalan.',
  'pdf.viewer.label': 'Pratinjau PDF hasil spike',

  'preview.title': 'Spike preview layar',
  'preview.subtitle':
    'Renderer HTML dan renderer PDF membaca satu spikeSpec yang sama, jadi keduanya tidak bisa menyimpang.',
  'preview.action.loadPdf': 'Muat PDF pembanding',
  'preview.action.overlay': 'Tumpuk PDF di atas layar',
  'preview.zoom.label': 'ZOOM',
  'preview.zoom.fit': 'Fit',
  'preview.zoomOut': 'Perkecil',
  'preview.zoomIn': 'Perbesar',
  'preview.ruler': 'Penggaris margin',
  'preview.highlighter': 'Tandai kata kunci',
  'preview.highlighterPending': 'Tempel deskripsi lowongan dulu',
  'pagination.dev.label': 'FIXTURE DOKUMEN',
  'pagination.fixture.pendek': 'Pendek',
  'pagination.fixture.sedang': 'Sedang',
  'pagination.fixture.panjang': 'Panjang',
  'preview.pageCounter': 'HAL {page} / {total}',
  'preview.pageChip': '{count} HAL · idealnya 1–2',
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

  'common.close': 'Tutup',
  'common.cancel': 'Batal',

  'topbar.brandHome': 'Vetra — kembali ke editor',
  'topbar.titleLabel': 'Judul dokumen',
  'topbar.titleEdit': 'Ubah judul CV',
  'topbar.titleEmpty': 'Judul tidak boleh kosong. Judul sebelumnya dipakai lagi.',
  'topbar.saveStatus': 'Status penyimpanan',
  'topbar.retrySave': 'Simpan lagi',
  'topbar.template': 'Template',
  'topbar.templateTitle': 'Pilih template',
  'topbar.templateActive': 'Dipakai',
  'topbar.checkAts': 'Periksa ATS',
  'topbar.checkAtsPending': 'Periksa ATS tersedia setelah Fase 7.',
  'topbar.download': 'Download PDF',
  'topbar.downloadPending': 'Download PDF tersedia setelah Fase 5.',
  'topbar.menu': 'Menu',
  'topbar.menuTitle': 'Dokumen',
  'topbar.menuPending': 'Ukuran kertas, margin, dan bahasa dibuka bersama form editor di Fase 3.',
  'topbar.undo': 'Undo',
  'topbar.redo': 'Redo',

  /* ---- FASE 12 (C1): menu Tampilan & mode pengerjaan ---- */
  'tampilan.open': 'Tampilan',
  'tampilan.modeTitle': 'Mode pengerjaan',
  'tampilan.modeForm': 'Form terpandu',
  'tampilan.modeFormDesc': 'Isi bagian demi bagian lewat formulir.',
  'tampilan.modeCanvas': 'Langsung di CV',
  'tampilan.modeCanvasDesc':
    'Klik teks di kertas untuk mengedit; bagian kosong menampilkan pemandu.',
  'tampilan.previewTitle': 'Pratinjau',
  'tampilan.zoomTitle': 'Zoom',
  /* C5.4 — live region (D11): pergantian mode diumumkan, bukan hanya terlihat. */
  'tampilan.modeAnnounce': 'Mode pengerjaan: {mode}.',
  'canvas.modeHint':
    'Mode langsung aktif: klik teks mana pun di kertas untuk mengeditnya. Kembali ke Form terpandu lewat menu Tampilan.',

  /* ---- FASE 12 (C2): guide placeholder di atas kertas ----
     `canvas.guide.*` = teks pemandu yang tampil di slot kosong. Struktur
     override per template (OQ2) dibaca lewat `canvas.guide.<templateId>.*`;
     key itu sengaja belum ada — fallback ke set netral sampai ada template yang
     benar-benar butuh nada berbeda. */
  'canvas.editField': 'Ubah {field}: {value}',
  'canvas.fillField': 'Isi {field}: {value}',
  'canvas.guide.fullName': 'Nama lengkap',
  'canvas.guide.headline': 'Role yang kamu lamar',
  'canvas.guide.email': 'Email',
  'canvas.guide.phone': 'Nomor telepon',
  'canvas.guide.location': 'Lokasi',
  'canvas.guide.link': 'Tautan profil',
  'canvas.guide.summary': 'Ringkasan profesional',
  'canvas.guide.skillGroupName': 'Nama kelompok skill',
  'canvas.guide.skillGroupItems': 'Skill 1, Skill 2',
  'canvas.guide.role': 'Peran',
  'canvas.guide.company': 'Perusahaan',
  'canvas.guide.degree': 'Gelar',
  'canvas.guide.field': 'Bidang studi',
  'canvas.guide.institution': 'Institusi',
  'canvas.guide.name': 'Nama',
  'canvas.guide.issuer': 'Penerbit',
  'canvas.guide.title': 'Judul',
  'canvas.guide.organization': 'Organisasi',
  'canvas.guide.dates': 'Bulan mulai – selesai',
  'canvas.guide.bullet': 'Satu bullet: aksi + dampak',
  'canvas.field.fullName': 'nama lengkap',
  'canvas.field.headline': 'role',
  'canvas.field.email': 'email',
  'canvas.field.phone': 'nomor telepon',
  'canvas.field.location': 'lokasi',
  'canvas.field.link': 'tautan profil',
  'canvas.field.summary': 'ringkasan',
  'canvas.field.skillGroupName': 'nama kelompok skill',
  'canvas.field.skillGroupItems': 'daftar skill',
  'canvas.field.role': 'peran',
  'canvas.field.company': 'perusahaan',
  'canvas.field.degree': 'gelar',
  'canvas.field.field': 'bidang studi',
  'canvas.field.institution': 'institusi',
  'canvas.field.name': 'nama',
  'canvas.field.issuer': 'penerbit',
  'canvas.field.title': 'judul',
  'canvas.field.organization': 'organisasi',
  'canvas.field.dates': 'rentang tanggal',
  'canvas.field.bullet': 'bullet',

  /* ---- FASE 12 (C3): editor in-place di atas kertas ---- */
  'canvas.emptyRequired': '{field} wajib diisi.',
  'canvas.zoomRaised': 'Zoom dinaikkan ke 75% supaya teksnya mudah dibaca.',

  /* ---- FASE 12 (C4): entri, tanggal, bullet, dan ghost row ---- */
  'canvas.datesRange': 'Rentang tanggal',
  'canvas.ghost.addEntry': '+ Tambahkan entri',
  'canvas.ghost.addBullet': '+ Tambahkan bullet',
  'canvas.ghost.addSection': '+ Tambahkan bagian',

  /* ---- FASE 13 (T3): jalan keluar & kontrol kanvas layar penuh ---- */
  'canvas.fullscreenLabel': 'Kertas layar penuh',
  'canvas.fullscreenExit': 'Keluar dari layar penuh',
  'canvas.sectionsMenu': 'Bagian',

  /* ---- FASE 13 (T5): aksesibilitas & i18n mode kanvas layar penuh ----
     `fullscreenDesc` menjelaskan efek toggle (rail & formulir disembunyikan),
     `fullscreenExitHint` jadi tooltip tombol keluar, dan
     `fullscreenAnnounce` jadi teks live region saat mode kanvas menyala. */
  'canvas.fullscreenDesc':
    'Rail dan formulir disembunyikan; kertas CV mengisi layar. Matikan untuk kembali berpanel.',
  'canvas.fullscreenExitHint': 'Kembali ke tampilan berpanel: rail dan formulir tampil lagi.',
  'canvas.fullscreenAnnounce': 'Mode langsung di CV, kertas layar penuh.',

  'theme.open': 'Tema warna',
  'theme.title': 'Tema warna',
  'theme.description':
    'Hanya tampilan aplikasi yang berubah. Isi CV dan berkas PDF tetap memakai aksen merek.',
  'theme.vetra': 'Vetra',
  'theme.cobalt': 'Cobalt',
  'theme.emerald': 'Emerald',
  'theme.violet': 'Violet',
  'theme.rose': 'Rose',
  'theme.graphite': 'Graphite',

  'template.classic-ats': 'Classic ATS',
  'template.ledger': 'Ledger',
  'template.executive': 'Executive',
  'template.minimal': 'Minimal',
  'template.technician': 'Technician',
  'template.desc.classic-ats': 'Satu kolom, heading tegas, rule tipis.',
  'template.desc.ledger': 'Nama Archivo besar, meta monospace, margin 16 mm.',
  'template.desc.executive': 'Serif formal dengan hirarki ganda.',
  'template.desc.minimal': 'Tanpa rule, ruang napas lebih lebar.',
  'template.desc.technician': 'Dense, monospace untuk peran teknis.',
  'template.appliedToast': 'Template {name} dipakai',

  /* ---- Fase 6: Halaman /templates (T6.4) ---- */
  'templates.eyebrow': 'PILIHAN TEMPLATE',
  'templates.page.title': 'Lima template, satu aturan: satu kolom.',
  'templates.page.subtitle':
    'Semua template membaca satu spec yang sama untuk pratinjau dan PDF, tanpa foto, ikon, skill bar, atau tabel — dan tetap gratis tanpa akun.',
  'templates.backToEditor': 'Kembali ke editor',
  'templates.use': 'Pakai template',
  'templates.useHint': 'Mengganti template tidak mengubah isi CV kamu.',
  'templates.thumbLabel': 'Contoh render template {name}',
  'templates.spec.margin': 'Margin',
  'templates.spec.fontName': 'Font nama',
  'templates.spec.fontHeading': 'Font heading',
  'templates.spec.fontBody': 'Font body',
  'templates.spec.fontMeta': 'Font meta',
  'templates.spec.italic': 'italic',
  'templates.spec.rule': 'Rule heading',
  'templates.rule.none': 'tanpa rule',
  'templates.rule.solid': 'garis penuh',
  'templates.rule.double': 'garis ganda',
  'templates.rule.dotted': 'garis titik',
  'templates.transform.uppercase': 'HURUF BESAR',
  'templates.transform.none': 'normal',
  'templates.transform.smallCaps': 'small-caps',
  'templates.spec.dates': 'Tanggal',
  'templates.dates.right': 'kanan, sebaris judul',
  'templates.dates.nextLine': 'baris berikutnya',
  'templates.spec.bullet': 'Bullet',
  'templates.spec.accent': 'Aksen warna',
  'templates.accentWarning': 'Beberapa parser lama mencetak hitam-putih',

  'doc.stackPrefix': 'Teknologi: ',
  'doc.gpaPrefix': 'IPK ',

  'rail.heading': 'Bagian',
  'rail.visibleOf': 'Bagian terlihat',
  'rail.empty': 'Belum ada bagian di dokumen ini.',

  'workspace.heading': 'Ruang kerja CV',
  'workspace.formEyebrow': 'BAGIAN',
  'workspace.formPending':
    'Formulir bagian ini dibangun di Fase 3. Shell, token, dan navigasi sudah berjalan.',
  'workspace.previewTitle': 'Pratinjau dokumen',
  'workspace.previewCaption': 'HAL',
  'workspace.pageLabel': 'Halaman {page} dari {total}',

  'mobile.tabList': 'Mode tampilan',
  'mobile.tabForm': 'Isi data',
  'mobile.tabPreview': 'Pratinjau',
  /* §5.3 — badge tab Pratinjau saat mode kanvas aktif. Nama aksesibel tab
     tetap memuat label yang terlihat ("Pratinjau") agar aturan "label in
     name" axe lulus; titik badge sendiri aria-hidden. */
  'mobile.tabPreviewCanvas': 'Pratinjau (mode kanvas aktif)',
  'mobile.sections': 'Bagian',
  'mobile.sectionsTitle': 'Pilih bagian',

  'error.title': 'Ada yang tidak beres',
  'error.body':
    'Data CV kamu tetap aman di perangkat ini. Muat ulang halaman, atau kembali ke editor.',
  'error.reload': 'Muat ulang',
  'error.backToEditor': 'Kembali ke editor',

  'error.banner.runtime': 'Terjadi galat tak terduga. Isi CV tetap ada di perangkatmu.',
  'error.banner.quota':
    'Penyimpanan peramban penuh — perubahan belum tersimpan. Hapus CV lama atau kosongkan data peramban, lalu simpan lagi.',

  'limits.entries':
    'Batas {max} entri per bagian tercapai — hapus satu entri untuk menambah yang baru.',
  'limits.bullets': 'Batas {max} bullet per entri tercapai — gabungkan poin yang mirip.',
  'limits.charsAtMax': 'Batas {max} karakter tercapai — teks tambahan diabaikan.',
  'form.urlUnsafe': 'Tautan harus memakai http://, https://, atau mailto:.',

  'route.templates': 'Galeri template',
  'route.dashboard': 'Dashboard CV',
  'route.login': 'Masuk',
  'route.authCallback': 'Menyelesaikan proses masuk',
  'route.privacy': 'Kebijakan privasi',
  'route.terms': 'Ketentuan penggunaan',
  'route.coverLetter': 'Surat lamaran',
  'route.pending':
    'Halaman ini dibangun di fase berikutnya. Editor dan PDF tetap bisa dipakai tanpa akun.',
  'route.notFoundTitle': 'Halaman tidak ditemukan',
  'route.notFoundBody': 'Alamat ini tidak ada. Kembali ke editor untuk melanjutkan CV kamu.',

  'legal.backToEditor': 'Kembali ke editor',
  'legal.updated': 'Terakhir diperbarui: 19 Oktober 2026',
  'legal.privacy.title': 'Kebijakan Privasi',
  'legal.privacy.intro':
    'Vetra menyimpan dokumen CV kamu di perangkat kamu sendiri (IndexedDB), bukan di server kami. Kebijakan ini menjelaskan data apa yang ada dan apa yang tidak kami kumpulkan.',
  'legal.privacy.storedTitle': 'Data yang tersimpan di perangkat kamu',
  'legal.privacy.stored.1':
    'Isi CV: nama, kontak, pengalaman, pendidikan, dan bagian lain yang kamu ketik.',
  'legal.privacy.stored.2': 'Preferensi tampilan: template, zoom, dan mode pratinjau.',
  'legal.privacy.stored.3':
    'Semua data di atas tidak dikirim ke server kami dan ikut terhapus bila kamu menghapus data situs di browser.',
  'legal.privacy.notCollectedTitle': 'Data yang tidak kami kumpulkan',
  'legal.privacy.notCollected.1':
    'Tidak ada akun, pelacakan iklan, atau analitik pihak ketiga pada fitur inti.',
  'legal.privacy.notCollected.2':
    'Teks lowongan yang kamu tempel untuk perbandingan kata kunci tidak dikirim ke mana pun.',
  'legal.privacy.contactTitle': 'Kontak',
  'legal.privacy.contactBody':
    'Bila ada pertanyaan soal privasi, hubungi pemilik repositori ini melalui halaman isu publik proyek.',
  'legal.terms.title': 'Ketentuan Penggunaan',
  'legal.terms.intro':
    'Vetra adalah alat gratis untuk menyusun CV satu kolom dan mengunduhnya sebagai PDF. Dengan memakai aplikasi ini kamu menyetujui ketentuan berikut.',
  'legal.terms.useTitle': 'Penggunaan yang wajar',
  'legal.terms.use.1':
    'Gunakan aplikasi untuk CV milikmu sendiri; jangan memasukkan data orang lain tanpa izin.',
  'legal.terms.use.2':
    'Jangan menyalahgunakan aplikasi untuk menipu perekrut, misal memalsukan pengalaman kerja.',
  'legal.terms.noGuaranteeTitle': 'Tanpa jaminan lolos seleksi',
  'legal.terms.noGuaranteeBody':
    'Indeks Struktur & Keterbacaan hanya memeriksa struktur dan keterbacaan dokumen. Setiap ATS punya parser berbeda, jadi tidak ada jaminan lolos.',
  'legal.terms.liabilityTitle': 'Batasan tanggung jawab',
  'legal.terms.liabilityBody':
    'Aplikasi disediakan apa adanya. Kamu tetap bertanggung jawab atas kebenaran isi CV yang kamu kirim ke perekrut.',

  'tokens.section.panelHeader': 'Panel header & eyebrow',
  'tokens.section.iconButtons': 'Tombol ikon 28 / 32 / 36',
  'tokens.section.chips': 'Chip & badge',
  'tokens.section.toggles': 'Switch & checkbox',
  'tokens.section.fields': 'Field lengkap',
  'tokens.section.emptyState': 'Empty state',
  'tokens.section.dialog': 'Dialog',
  'tokens.section.sheet': 'Sheet kanan & bawah',
  'tokens.section.popover': 'Popover & menu',
  'tokens.section.tooltip': 'Tooltip',
  'tokens.section.tabs': 'Tabs',
  'tokens.section.accordion': 'Accordion',
  'tokens.section.scroll': 'Scroll area & separator',
  'tokens.section.toast': 'Toast',
  'tokens.note.focus':
    'Baris bertanda cincin fokus memakai state fokus yang sama dengan Tab sungguhan.',
  'tokens.demo.eyebrow': 'BAGIAN 03 / 09',
  'tokens.demo.panelTitle': 'Pengalaman',
  'tokens.demo.iconAdd': 'Tambah',
  'tokens.demo.iconCopy': 'Duplikat',
  'tokens.demo.iconTrash': 'Hapus',
  'tokens.demo.iconMore': 'Tindakan lain',
  'tokens.demo.chipLabel': 'TypeScript',
  'tokens.demo.chipRemove': 'Hapus TypeScript',
  'tokens.demo.badgeOk': 'Aktif',
  'tokens.demo.badgeWarn': 'Perlu diperiksa',
  'tokens.demo.badgeBad': 'Wajib',
  'tokens.demo.switchLabel': 'Saya masih bekerja di sini',
  'tokens.demo.switchDetail': 'Tanggal selesai disembunyikan dan diganti chip SEKARANG.',
  'tokens.demo.checkboxLabel': 'Tampilkan bagian ini',
  'tokens.demo.checkboxDisabled': 'Terkunci',
  'tokens.demo.fieldLabel': 'Nama lengkap',
  'tokens.demo.fieldHint': 'opsional',
  'tokens.demo.fieldPlaceholder': 'Contoh: Alex Morgan',
  'tokens.demo.fieldErrorLabel': 'Email',
  'tokens.demo.fieldError': 'Email belum benar. Contoh: nama@domain.com',
  'tokens.demo.fieldDisabled': 'Kolom terkunci',
  'tokens.demo.fieldFocus': 'Contoh state fokus',
  'tokens.demo.textareaLabel': 'Ringkasan',
  'tokens.demo.textareaPlaceholder': 'Tulis 3–4 baris tentang pengalaman paling relevan.',
  'tokens.demo.emptyTitle': 'Belum ada pekerjaan',
  'tokens.demo.emptyBody':
    'Tambahkan posisi paling relevan dulu. Magang dan freelance juga dihitung.',
  'tokens.demo.emptyAction': '+ Tambah pekerjaan',
  'tokens.demo.openDialog': 'Buka dialog',
  'tokens.demo.dialogTitle': 'Hapus bagian?',
  'tokens.demo.dialogBody':
    'Isi bagian ini akan hilang dari CV. Tindakan ini tidak bisa dibatalkan.',
  'tokens.demo.dialogConfirm': 'Hapus',
  'tokens.demo.openSheetRight': 'Sheet kanan',
  'tokens.demo.openSheetBottom': 'Sheet bawah',
  'tokens.demo.sheetBody': 'Sheet dipakai untuk drawer ATS dan menu mobile.',
  'tokens.demo.openPopover': 'Buka popover',
  'tokens.demo.popoverTitle': 'Pilih ukuran kertas',
  'tokens.demo.popoverBody': 'A4 adalah format yang paling sering dibaca parser ATS.',
  'tokens.demo.menu': 'Menu tindakan',
  'tokens.demo.menuRename': 'Ubah nama',
  'tokens.demo.menuDuplicate': 'Duplikat',
  'tokens.demo.menuDelete': 'Hapus',
  'tokens.demo.tooltipTrigger': 'Arahkan kursor ke sini',
  'tokens.demo.tooltip': 'Tooltip memakai surface mesin, sama seperti Parse Tape.',
  'tokens.demo.tabOne': 'Masalah (7)',
  'tokens.demo.tabTwo': 'Parse tape',
  'tokens.demo.tabBody': 'Isi tab mengikuti pilihan di atas.',
  'tokens.demo.accordionTitle': 'Apakah PDF-nya bisa dibaca mesin?',
  'tokens.demo.accordionBody':
    'PDF dibuat dari teks asli, bukan gambar, jadi teksnya bisa diseleksi dan disalin.',
  'tokens.demo.scrollHint': 'Gulir daftar ini untuk menguji ScrollArea.',
  'tokens.demo.separator': 'Separator',
  'tokens.demo.toast': 'Tampilkan toast',
  'tokens.demo.toastMessage': 'Tersimpan di perangkat',
  'tokens.demo.toastError': 'PDF gagal dibuat. Coba lagi.',
  'tokens.demo.disabled': 'Nonaktif',

  /* ---- Fase 3: Deskripsi & petunjuk bagian ---- */
  'section.desc.profile': 'Informasi kontak, profesi, dan tautan profil.',
  'section.desc.summary': 'Ringkasan profil profesional 3–4 baris.',
  'section.desc.experience': 'Riwayat pekerjaan, magang, atau freelance relevan.',
  'section.desc.education': 'Pendidikan formal, gelar, institusi, dan IPK.',
  'section.desc.skills': 'Kelompok keahlian teknis dan non-teknis.',
  'section.desc.projects': 'Proyek pribadi atau kerja sama yang relevan.',
  'section.desc.certifications': 'Sertifikat profesional dan lisensi keahlian.',
  'section.desc.languages': 'Bahasa yang dikuasai beserta tingkat kemahiran.',
  'section.desc.awards': 'Penghargaan, prestasi, atau rekognisi industri.',
  'section.desc.volunteering': 'Pengalaman kerelawanan dan kegiatan sosial.',

  'section.hint.profile': 'Isi kontak aktif agar rekruter mudah menghubungimu.',
  'section.hint.summary': 'Tulis 3–4 baris tentang latar belakang dan pencapaian utamamu.',
  'section.hint.experience':
    'Urutan terbaru dulu. Gunakan bullet untuk pencapaian, bukan daftar tugas.',
  'section.hint.education': 'Cantumkan pendidikan formal terbaru atau paling relevan.',
  'section.hint.skills': 'Kelompokkan keahlian tanpa rating bintang atau progress bar.',
  'section.hint.projects': 'Tampilkan karya atau proyek yang membuktikan kemampuanmu.',
  'section.hint.certifications': 'Sertifikasi kredibel yang relevan dengan posisi sasaran.',
  'section.hint.languages': 'Tingkat kemahiran bahasa berbasis teks standar.',
  'section.hint.awards': 'Prestasi penting yang menunjang kualifikasimu.',
  'section.hint.volunteering': 'Kegiatan organisasi atau sosial yang bernilai tambah.',

  /* ---- Fase 3: Rail Section (T3.1 & T3.2) ---- */
  'rail.completeness': 'KELENGKAPAN CV',
  'rail.completenessTooltip': 'Lengkap: {filled}/{total} field wajib',
  'rail.completenessIncomplete': 'Belum lengkap: {filled}/{total} field wajib',
  'rail.addSection': '+ Tambah bagian',
  'rail.catalogTitle': 'Tambah bagian CV',
  'rail.catalogDesc': 'Pilih bagian yang ingin kamu tambahkan ke dalam dokumen.',
  'rail.catalogEmpty': 'Semua bagian sudah ditambahkan ke dokumen.',
  'rail.add': 'Tambah',
  'rail.toggleVisibility': 'Tampilkan atau sembunyikan bagian',
  'rail.moreActions': 'Tindakan bagian',
  'rail.hide': 'Sembunyikan',
  'rail.show': 'Tampilkan',
  'rail.duplicate': 'Duplikat bagian',
  'rail.delete': 'Hapus bagian',
  'rail.deleteConfirmTitle': 'Hapus bagian {name}?',
  'rail.deleteConfirmBody':
    'Data di bagian ini akan dihapus dari CV. Tindakan ini tidak bisa dibatalkan.',
  'rail.deleteConfirmAction': 'Hapus',
  'rail.moveUp': 'Pindahkan ke atas',
  'rail.moveDown': 'Pindahkan ke bawah',
  'rail.dragHandle': 'Tarik untuk mengubah urutan',
  'rail.reorderAnnounce': '{name} pindah ke posisi {pos} dari {total}',
  'rail.issuesBadge': '{count} isu',

  /* ---- Fase 3: Profile Form ---- */
  'profile.fullName': 'Nama lengkap',
  'profile.fullNamePlaceholder': 'Contoh: Alex Morgan',
  'profile.headline': 'Profesi / Headline',
  'profile.headlinePlaceholder': 'Contoh: Senior Frontend Engineer',
  'profile.email': 'Email',
  'profile.emailPlaceholder': 'nama@domain.com',
  'profile.phone': 'Nomor telepon',
  'profile.phonePlaceholder': '+62 812 3456 7890',
  'profile.location': 'Lokasi / Domisili',
  'profile.locationPlaceholder': 'Contoh: Jakarta, Indonesia',
  'profile.links': 'Tautan profil',
  'profile.addLink': '+ Tambah tautan',
  'profile.linkLabel': 'Label tautan',
  'profile.linkLabelPlaceholder': 'LinkedIn, GitHub, Portfolio',
  'profile.linkUrl': 'URL tautan',
  'profile.linkUrlPlaceholder': 'https://linkedin.com/in/username',
  'profile.removeLink': 'Hapus tautan',

  /* ---- Fase 3: Summary Form ---- */
  'summary.text': 'Ringkasan profesional',
  'summary.textPlaceholder': 'Ringkas pengalaman, spesialisasi, dan dampak terbesarmu...',
  'summary.exampleBtn': 'Pakai contoh',
  'summary.wordCount': '{count} kata',
  'summary.wordCountTarget': '{count} kata (target 40–90 kata)',
  'summary.sampleText':
    'Software engineer berpengalaman 5+ tahun dalam merancang aplikasi web berskala besar, memimpin optimasi performa frontend, dan mengelola arsitektur cloud. Terbiasa memimpin tim lintas fungsi untuk menghadirkan produk dengan reliabilitas tinggi.',

  /* ---- Fase 3: Experience Form ---- */
  'experience.role': 'Jabatan / Posisi',
  'experience.rolePlaceholder': 'Contoh: Software Engineer',
  'experience.company': 'Perusahaan / Organisasi',
  'experience.companyPlaceholder': 'Contoh: Tech Nusantara Corp',
  'experience.location': 'Lokasi',
  'experience.locationPlaceholder': 'Contoh: Jakarta, Indonesia (atau Remote)',
  'experience.startDate': 'Bulan mulai',
  'experience.endDate': 'Bulan selesai',
  'experience.current': 'Saya masih bekerja di sini',
  'experience.presentChip': 'SEKARANG',
  'experience.bulletsLabel': 'Pencapaian & tanggung jawab',
  'experience.stackLabel': 'Teknologi / alat yang dipakai',
  'experience.stackPlaceholder': 'Ketik teknologi lalu tekan Enter (contoh: TypeScript, React)',
  'experience.addEntry': '+ Tambah pekerjaan',
  'experience.emptyTitle': 'Belum ada riwayat pekerjaan',
  'experience.emptyBody':
    'Tambahkan posisi paling relevan dulu. Magang dan freelance juga dihitung.',

  /* ---- Fase 3: Education Form ---- */
  'education.degree': 'Gelar / Jenjang',
  'education.degreePlaceholder': 'Contoh: Sarjana Komputer (S.Kom)',
  'education.field': 'Bidang studi / Jurusan',
  'education.fieldPlaceholder': 'Contoh: Teknik Informatika',
  'education.institution': 'Institusi / Universitas',
  'education.institutionPlaceholder': 'Contoh: Universitas Indonesia',
  'education.location': 'Lokasi',
  'education.locationPlaceholder': 'Contoh: Depok, Indonesia',
  'education.startDate': 'Bulan mulai',
  'education.endDate': 'Bulan selesai / estimasi',
  'education.gpa': 'IPK (skala 4.00)',
  'education.gpaPlaceholder': '3.75',
  'education.gpaHint': 'opsional',
  'education.notesLabel': 'Catatan / aktivitas tambahan',
  'education.addEntry': '+ Tambah pendidikan',
  'education.emptyTitle': 'Belum ada riwayat pendidikan',
  'education.emptyBody': 'Cantumkan pendidikan formal atau akademik terakhirmu.',

  /* ---- Fase 3: Skills Form ---- */
  'skills.groupName': 'Nama kelompok keahlian',
  'skills.groupNamePlaceholder': 'Contoh: Bahasa Pemrograman, Framework, Tools',
  'skills.itemsLabel': 'Daftar keahlian',
  'skills.itemsPlaceholder': 'Ketik keahlian lalu tekan Enter',
  'skills.addGroup': '+ Tambah kelompok keahlian',
  'skills.removeGroup': 'Hapus kelompok',
  'skills.emptyTitle': 'Belum ada keahlian',
  'skills.emptyBody': 'Kelompokkan keahlianmu agar mudah dipindai rekruter dan parser ATS.',

  /* ---- Fase 3: Projects Form ---- */
  'projects.name': 'Nama proyek',
  'projects.namePlaceholder': 'Contoh: Platform E-Commerce Open Source',
  'projects.role': 'Peran dalam proyek',
  'projects.rolePlaceholder': 'Contoh: Lead Frontend Developer',
  'projects.url': 'URL proyek / repository',
  'projects.urlPlaceholder': 'https://github.com/username/project',
  'projects.startDate': 'Bulan mulai',
  'projects.endDate': 'Bulan selesai',
  'projects.bulletsLabel': 'Deskripsi & pencapaian',
  'projects.stackLabel': 'Teknologi yang digunakan',
  'projects.stackPlaceholder': 'Ketik teknologi lalu tekan Enter',
  'projects.addEntry': '+ Tambah proyek',
  'projects.emptyTitle': 'Belum ada proyek',
  'projects.emptyBody': 'Tampilkan proyek pribadi atau kontribusi nyata yang relevan.',

  /* ---- Fase 3: Certifications Form ---- */
  'certifications.name': 'Nama sertifikasi',
  'certifications.namePlaceholder': 'Contoh: AWS Certified Solutions Architect',
  'certifications.issuer': 'Penerbit sertifikasi',
  'certifications.issuerPlaceholder': 'Contoh: Amazon Web Services',
  'certifications.issuedAt': 'Bulan terbit',
  'certifications.credentialId': 'ID kredensial',
  'certifications.credentialIdPlaceholder': 'Contoh: ABC-12345-XYZ',
  'certifications.url': 'URL verifikasi',
  'certifications.urlPlaceholder': 'https://credential.net/verify/123',
  'certifications.addEntry': '+ Tambah sertifikasi',
  'certifications.emptyTitle': 'Belum ada sertifikasi',
  'certifications.emptyBody': 'Tambahkan sertifikasi atau lisensi profesi yang kamu miliki.',

  /* ---- Fase 3: Languages Form ---- */
  'languages.name': 'Bahasa',
  'languages.namePlaceholder': 'Contoh: Bahasa Indonesia, English',
  'languages.proficiency': 'Tingkat kemahiran',
  'languages.prof.Native': 'Penutur Asli (Native)',
  'languages.prof.Fluent': 'Fasih (Fluent)',
  'languages.prof.Professional': 'Profesional (Professional)',
  'languages.prof.Intermediate': 'Menengah (Intermediate)',
  'languages.prof.Basic': 'Dasar (Basic)',
  'languages.addEntry': '+ Tambah bahasa',
  'languages.emptyTitle': 'Belum ada bahasa',
  'languages.emptyBody': 'Cantumkan bahasa yang kamu kuasai untuk pekerjaan.',

  /* ---- Fase 3: Awards Form ---- */
  'awards.title': 'Nama penghargaan',
  'awards.titlePlaceholder': 'Contoh: Juara 1 Hackathon Nasional',
  'awards.issuer': 'Pemberi penghargaan',
  'awards.issuerPlaceholder': 'Contoh: Kementerian Komunikasi dan Informatika',
  'awards.awardedAt': 'Bulan diperoleh',
  'awards.description': 'Deskripsi singkat',
  'awards.descriptionPlaceholder': 'Jelaskan kriteria atau pencapaian penghargaan ini.',
  'awards.addEntry': '+ Tambah penghargaan',
  'awards.emptyTitle': 'Belum ada penghargaan',
  'awards.emptyBody': 'Cantumkan prestasi, rekognisi, atau penghargaan yang pernah diraih.',

  /* ---- Fase 3: Volunteering Form ---- */
  'volunteering.role': 'Peran / Posisi',
  'volunteering.rolePlaceholder': 'Contoh: Relawan Pengajar Pemrograman',
  'volunteering.organization': 'Organisasi / Komunitas',
  'volunteering.organizationPlaceholder': 'Contoh: Komunitas Coding Anak Bangsa',
  'volunteering.startDate': 'Bulan mulai',
  'volunteering.endDate': 'Bulan selesai',
  'volunteering.current': 'Masih aktif di sini',
  'volunteering.bulletsLabel': 'Kontribusi & dampak',
  'volunteering.addEntry': '+ Tambah kerelawanan',
  'volunteering.emptyTitle': 'Belum ada kegiatan kerelawanan',
  'volunteering.emptyBody':
    'Pengalaman kerelawanan memperlihatkan kepedulian sosial dan kepemimpinan.',

  /* ---- Fase 3: EntryCard & EntryList ---- */
  'entry.expand': 'Buka detail entri',
  'entry.collapse': 'Tutup detail entri',
  'entry.duplicate': 'Duplikat entri',
  'entry.delete': 'Hapus entri',
  'entry.moveUp': 'Pindahkan entri ke atas',
  'entry.moveDown': 'Pindahkan entri ke bawah',
  'entry.deleteConfirmTitle': 'Hapus entri ini?',
  'entry.deleteConfirmBody':
    'Data entri akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan.',
  'entry.untitled': 'Entri tanpa judul',
  'entry.untitledCompany': 'Perusahaan belum diisi',
  'entry.issues': '{count} isu',

  /* ---- Fase 3: BulletListEditor (T3.5) ---- */
  'bullet.placeholder': 'Jelaskan aksi dan hasil konkret yang kamu capai...',
  'bullet.add': '+ Tambah bullet',
  'bullet.remove': 'Hapus bullet',
  'bullet.moveUp': 'Pindahkan bullet ke atas',
  'bullet.moveDown': 'Pindahkan bullet ke bawah',
  'bullet.dragHandle': 'Tarik untuk mengubah urutan bullet',
  'bullet.textLabel': 'Isi bullet {n}',
  'bullet.tooShort': 'Terlalu pendek (< 40 karakter)',
  'bullet.tooLong': 'Terlalu panjang (> 200 karakter)',
  'bullet.metricHint': 'Belum ada angka. Tambahkan dampak terukur (misal: 25%, 3x, 100+ pengguna).',
  'bullet.verbHint': 'Mulai dengan kata kerja aksi, misal: Membangun, Meningkatkan, Memimpin.',
  'bullet.charCount': '{count} karakter',
  'chip.remove': 'Hapus {name}',

  /* ---- Fase 3: FirstRunCard (T3.6) ---- */
  'firstRun.eyebrow': 'MULAI DARI MANA?',
  'firstRun.sampleTitle': 'Pakai contoh CV',
  'firstRun.sampleDesc': 'Terisi data Alex Morgan, Software Engineer. Bisa kamu ubah semua.',
  'firstRun.emptyTitle': 'Mulai dari kosong',
  'firstRun.emptyDesc': 'Dokumen bersih, semua bagian kosong.',
  'firstRun.laterTitle': 'Nanti saja',
  'firstRun.laterDesc': 'Menutup kartu ini dan lanjutkan mengedit.',
  'firstRun.continue': 'Lanjut',
  'firstRun.emptyToast': 'Dokumen kosong dibuat',
  'firstRun.sampleToast': 'Dokumen contoh siap diedit',

  /* ---- Fase 3: Reset Document ---- */
  'menu.resetDoc': 'Reset dokumen',
  'menu.resetDocTitle': 'Reset dokumen CV?',
  'menu.resetDocBody':
    'Pilih apakah ingin memuat kembali dokumen contoh Alex Morgan atau memulai dari dokumen kosong.',
  'menu.resetToSample': 'Muat contoh CV',
  'menu.resetToEmpty': 'Kosongkan dokumen',
  'common.save': 'Simpan',
  'common.delete': 'Hapus',
  'common.confirm': 'Lanjutkan',
  'common.optional': 'opsional',

  /* ---- Fase 7: ATS Checker, Parse Tape, Highlighter (T7.1–T7.6) ---- */
  'ats.drawer.title': 'Periksa ATS',
  'ats.drawer.close': 'Tutup panel pemeriksaan',
  'ats.tab.issues': 'Masalah ({count})',
  'ats.tab.tape': 'Parse tape',
  'ats.score.label': 'INDEKS STRUKTUR',
  'ats.disclaimer':
    'Memeriksa struktur & keterbacaan. Setiap ATS punya parser berbeda, jadi tidak ada jaminan apa pun.',
  'ats.meta.checked': 'DIPERIKSA {time}',
  'ats.meta.template': 'TEMPLATE {template}',
  'ats.meta.pages': '{count} HAL',
  'ats.notChecked.title': 'Belum ada yang diperiksa',
  'ats.notChecked.body':
    'Jalankan pemeriksaan untuk melihat struktur dokumen ini sebagaimana dibaca parser.',
  'ats.notChecked.action': 'Periksa sekarang',
  'ats.checking': 'Memeriksa…',
  'ats.noIssues.title': 'Tidak ada masalah struktur yang terdeteksi',
  'ats.noIssues.body':
    'Parse tape di bawah tetap menunjukkan urutan bacaan dokumen — periksa sendiri bila ada baris yang tidak terduga.',
  'ats.group.bad': 'Wajib diperbaiki',
  'ats.group.warn': 'Sebaiknya',
  'ats.group.ok': 'Sudah baik',
  'ats.group.count': '{count}',
  'ats.fix': 'Perbaiki →',
  'ats.aria.score': 'Indeks struktur {score}. {band}',

  'ats.contact.emailMissing.title': 'Email belum diisi',
  'ats.contact.emailMissing.detail':
    'Tanpa email, rekruter tidak punya jalur balasan. Isi email aktif di bagian Profil.',
  'ats.contact.emailInvalid.title': 'Format email tidak dikenali',
  'ats.contact.emailInvalid.detail':
    'Nilai “{value}” tidak berbentuk alamat email. Gunakan pola nama@domain.com.',
  'ats.contact.emailOk.title': 'Email terbaca',
  'ats.contact.emailOk.detail': 'Email ada dan berbentuk alamat yang bisa dipetakan parser.',
  'ats.contact.phoneBad.title': 'Nomor telepon tidak lengkap',
  'ats.contact.phoneBad.detail':
    'Ditemukan {digits} digit, minimal {min}. Tulis nomor yang bisa dihubungi lengkap dengan kode negara.',
  'ats.contact.phoneOk.title': 'Nomor telepon terbaca',
  'ats.contact.phoneOk.detail': '{digits} digit — cukup panjang untuk dipetakan sebagai nomor.',
  'ats.contact.locationWarn.title': 'Lokasi belum diisi',
  'ats.contact.locationWarn.detail':
    'Banyak lowongan menyaring berdasarkan domisili. Tambahkan kota tempat kamu bekerja.',
  'ats.contact.locationOk.title': 'Lokasi terisi',
  'ats.contact.locationOk.detail': 'Kota domisili ikut terbaca di baris kontak.',
  'ats.contact.linksInfo.title': 'Belum ada tautan profil',
  'ats.contact.linksInfo.detail':
    'LinkedIn, GitHub, atau portofolio memperkuat verifikasi pengalaman. Satu tautan sudah cukup.',
  'ats.contact.linksOk.title': 'Tautan profil ada',
  'ats.contact.linksOk.detail': '{count} tautan terbaca di baris kontak.',

  'ats.sections.presentOk.title': 'Bagian {section} ada',
  'ats.sections.presentOk.detail': 'Bagian ini ikut ter-render, jadi terbaca parser.',
  'ats.sections.missingBad.title': 'Bagian {section} tidak ada',
  'ats.sections.missingBad.detail':
    'Tanpa bagian {section}, dokumen kehilangan satu blok yang hampir selalu dicari ATS.',
  'ats.sections.missingWarn.title': 'Bagian {section} tidak ikut terbit',
  'ats.sections.missingWarn.detail':
    'Bagian {section} ada datanya tapi tidak terlihat, jadi ikut tidak terbaca parser.',
  'ats.sections.headingWarn.title': 'Judul “{section}” bukan judul baku',
  'ats.sections.headingWarn.detail':
    'Parser lama mencari bagian lewat judul kanonis seperti “Pengalaman Kerja” atau “Experience”. Judul kreatif membuatnya terlewat.',

  'ats.bullets.tooShortBad.title': 'Bullet terlalu pendek ({length} karakter)',
  'ats.bullets.tooShortBad.detail':
    'Di bawah {min} karakter, kalimat ini tidak memberi cukup konteks. Tulis aksi beserta hasilnya.',
  'ats.bullets.tooShortWarn.title': 'Bullet agak pendek ({length} karakter)',
  'ats.bullets.tooShortWarn.detail':
    'Target {min} karakter. Tambahkan dampak yang terukur supaya barisnya bernilai.',
  'ats.bullets.tooLongBad.title': 'Bullet terlalu panjang ({length} karakter)',
  'ats.bullets.tooLongBad.detail':
    'Di atas {max} karakter, baris ini sulit dipindai. Pecah jadi dua bullet.',
  'ats.bullets.tooLongWarn.title': 'Bullet agak panjang ({length} karakter)',
  'ats.bullets.tooLongWarn.detail':
    'Target maksimal {max} karakter. Satu bullet sebaiknya satu pencapaian.',
  'ats.bullets.passiveWarn.title': 'Bullet diawali kalimat pasif',
  'ats.bullets.passiveWarn.detail':
    'Frasa seperti “Bertugas untuk” tidak memberi tahu apa yang kamu capai. Mulai dengan kata kerja aksi.',
  'ats.bullets.verbWarn.title': 'Bullet tidak diawali kata kerja aksi',
  'ats.bullets.verbWarn.detail':
    'Awali dengan kata kerja seperti Membangun, Meningkatkan, atau Memimpin supaya pencapaianmu terbaca langsung.',
  'ats.bullets.metricInfo.title': 'Bullet tanpa angka',
  'ats.bullets.metricInfo.detail':
    'Angka membuat dampakmu terukur. Tambahkan metrik bila ada: persen, jumlah pengguna, atau durasi.',
  'ats.bullets.summaryOk.title': '{ideal} dari {total} bullet dalam rentang ideal',
  'ats.bullets.summaryOk.detail':
    'Rentang ideal 40–180 karakter. Terlalu pendek {badShort} · terlalu panjang {badLong}.',

  'ats.dates.startBad.title': 'Tanggal mulai belum diisi',
  'ats.dates.startBad.detail':
    'Parser membaca rentang waktu dari tanggal mulai. Isi bulan mulai entri ini.',
  'ats.dates.endBad.title': 'Tanggal selesai belum diisi',
  'ats.dates.endBad.detail':
    'Entri yang tidak ditandai “masih bekerja” butuh tanggal selesai agar rentangnya utuh.',
  'ats.dates.invertedBad.title': 'Rentang tanggal terbalik',
  'ats.dates.invertedBad.detail':
    'Tanggal selesai {end} lebih awal dari tanggal mulai {start}. Perbaiki urutannya.',
  'ats.dates.orderWarn.title': 'Urutan pengalaman bukan yang terbaru dulu',
  'ats.dates.orderWarn.detail':
    'ATS dan rekruter membaca dari yang terbaru. Pindahkan pekerjaan terakhir ke posisi atas.',
  'ats.dates.gapInfo.title': 'Ada celah lebih dari {months} bulan',
  'ats.dates.gapInfo.detail':
    'Celah panjang tidak salah, tapi sebaiknya dijelaskan — misal lewat bagian proyek atau relawan.',
  'ats.dates.currentWarn.title': 'Lebih dari satu entri ditandai berjalan',
  'ats.dates.currentWarn.detail':
    '{count} entri ditandai masih berjalan. Tandai hanya pekerjaan yang benar-benar aktif sekarang.',
  'ats.dates.currentPositionWarn.title': 'Entri berjalan bukan yang teratas',
  'ats.dates.currentPositionWarn.detail':
    'Pekerjaan yang masih berjalan sebaiknya berada di urutan pertama agar terbaca sebagai pengalaman terkinimu.',
  'ats.dates.summaryOk.title': '{total} rentang tanggal terbaca',
  'ats.dates.summaryOk.detail':
    'Semua tanggal terisi dalam format YYYY-MM. Terbalik {reversed} · tidak lengkap {missingStart}.',

  'ats.length.tooManyWarn.title': 'Dokumen {pages} halaman',
  'ats.length.tooManyWarn.detail':
    'Lebih dari {max} halaman hampir selalu dipotong parser. Padatkan bullet atau sembunyikan bagian yang kurang relevan.',
  'ats.length.overLimitWarn.title': 'Dokumen {pages} halaman, idealnya {max}',
  'ats.length.overLimitWarn.detail':
    'Untuk {years} tahun pengalaman, {max} halaman sudah cukup. Potong entri paling lama bila perlu.',
  'ats.length.summaryOk.title': 'Panjang dokumen {pages} dari {max} halaman',
  'ats.length.summaryOk.detail':
    'Sesuai target untuk {years} tahun pengalaman. Tidak ada bagian yang perlu dipangkas.',

  'ats.forbidden.photoBad.title': 'Foto menyala di dokumen',
  'ats.forbidden.photoBad.detail':
    'Foto mengacaukan urutan baca parser dan memicu bias. Matikan foto agar struktur tetap bersih.',
  'ats.forbidden.accentBad.title': 'Aksen warna kurang kontras',
  'ats.forbidden.accentBad.detail':
    'Kontras aksen {ratio}:1 di atas kertas, di bawah ambang {min}:1. Matikan aksen atau pilih warna lebih gelap.',
  'ats.forbidden.templateBad.title': 'Template belum teruji ATS',
  'ats.forbidden.templateBad.detail':
    'Template ini tidak ada dalam daftar yang sudah diuji. Pilih salah satu template satu kolom.',
  'ats.forbidden.skillLevelWarn.title': 'Keahlian memakai level angka',
  'ats.forbidden.skillLevelWarn.detail':
    'Nilai seperti “{sample}” di grup {group} terbaca sebagai rating, bukan keahlian. Tulis tanpa angka.',
  'ats.forbidden.summaryOk.title': 'Tidak ada elemen yang merusak parsing',
  'ats.forbidden.summaryOk.detail':
    'Tanpa foto, tanpa rating angka, dan template satu kolom yang sudah teruji.',

  'ats.consistency.dateFormatWarn.title': 'Format tanggal tidak seragam',
  'ats.consistency.dateFormatWarn.detail':
    '{count} tanggal tidak berbentuk YYYY-MM, misal “{sample}”. Samakan formatnya.',
  'ats.consistency.casingInfo.title': 'Kapitalisasi judul bagian campur',
  'ats.consistency.casingInfo.detail':
    'Ada {count} gaya penulisan judul. Satu pola membuat pemetaan bagian lebih konsisten.',
  'ats.consistency.punctuationInfo.title': 'Akhir bullet tidak seragam',
  'ats.consistency.punctuationInfo.detail':
    '{withPeriod} bullet memakai titik, {withoutPeriod} tanpa titik. Pilih satu pola.',
  'ats.consistency.summaryOk.title': 'Format konsisten',
  'ats.consistency.summaryOk.detail':
    '{dates} tanggal dan {bullets} bullet mengikuti satu pola penulisan.',

  'ats.fix.fillField': 'Isi kolom ini',
  'ats.fix.showSection': 'Tampilkan bagian ini',
  'ats.fix.addSection': 'Tambahkan bagian ini',
  'ats.fix.renameSection': 'Pakai judul baku',
  'ats.fix.rewriteBullet': 'Tulis ulang bullet ini',
  'ats.fix.reorderEntries': 'Urutkan ulang entri',
  'ats.fix.explainGap': 'Jelaskan celah waktu',
  'ats.fix.trimContent': 'Padatkan isi dokumen',
  'ats.fix.removePhoto': 'Matikan foto',
  'ats.fix.disableAccent': 'Matikan aksen warna',
  'ats.fix.pickTemplate': 'Pilih template lain',
  'ats.fix.removeLevel': 'Hapus angka level',
  'ats.fix.uniformHeadings': 'Samakan gaya judul',
  'ats.fix.uniformPunctuation': 'Samakan tanda baca',

  'ats.band.low': 'Perlu perbaikan',
  'ats.band.fair': 'Cukup',
  'ats.band.good': 'Baik',
  'ats.band.excellent': 'Sangat baik',

  'ats.jd.label': 'Deskripsi lowongan',
  'ats.jd.placeholder': 'Tempel teks lowongan di sini untuk membandingkan kata kuncinya…',
  'ats.jd.hint': 'opsional · tidak dikirim ke mana pun',
  'ats.jd.clear': 'Hapus deskripsi',
  'ats.keywords.summary': '{matched} cocok · {missing} belum ada',
  'ats.keywords.missingHint': 'Klik kata yang belum ada untuk langsung ke kolom keahlian.',
  'ats.keywords.empty':
    'Tempel deskripsi lowongan untuk melihat kata kunci mana yang sudah ada di CV kamu.',

  'ats.tape.header': 'URUTAN PARSE TERSIMULASI · {template}',
  'ats.tape.copy': 'Salin teks',
  'ats.tape.copied': 'Teks tersalin',
  'ats.tape.copyFailed': 'Teks gagal disalin. Salin manual dari baris tape.',
  'ats.tape.footer': '{chars} karakter · {words} kata · {pages} halaman',
  'ats.tape.unclaimedHint':
    'Baris bertanda UNCLAIMED memuat karakter yang tidak bisa dipetakan parser.',
  'ats.marksInPdf': 'Sertakan stabilo di PDF',
  'ats.marksInPdfHint': 'Default mati supaya berkas unduhan tetap netral.',

  'home.skipToContent': 'Lompat ke isi beranda',
  'home.anchor.templates': 'Template',
  'home.section.templates.eyebrow': 'GALERI TEMPLATE',
  'home.section.templates.title': 'Lima template, satu aturan: satu kolom.',
  'home.section.templates.body':
    'Setiap template memakai satu kolom dan tipografi yang terbaca parser. Pilih yang paling cocok, pratinjau langsung memakai data CV kamu.',
  'home.section.templates.viewAll': 'Lihat semua template',
  'home.section.templates.useThis': 'Pakai template ini',
  'home.section.guide.eyebrow': 'PANDUAN STRUKTUR',
  'home.section.guide.title': 'Tulis CV yang terbaca mesin.',
  'home.section.guide.body':
    'Delapan aturan struktur yang dipakai pemeriksa bawaan. Terapkan selagi mengetik, bukan setelah selesai.',
  'home.section.steps.eyebrow': 'CARA PAKAI',
  'home.section.steps.title': 'Dari kosong sampai PDF dalam tiga langkah.',
  'home.step.1.title': 'Isi data kamu',
  'home.step.1.body':
    'Mulai dari contoh siap pakai atau dokumen kosong. Semua tersimpan otomatis di perangkat.',
  'home.step.2.title': 'Periksa strukturnya',
  'home.step.2.body':
    'Tekan Periksa ATS untuk melihat Indeks Struktur & Keterbacaan plus daftar perbaikan.',
  'home.step.3.title': 'Unduh PDF-nya',
  'home.step.3.body': 'Unduh PDF berbasis teks yang bisa disalin, tanpa watermark dan tanpa akun.',
  'home.section.faq.eyebrow': 'PERTANYAAN UMUM',
  'home.section.faq.title': 'Yang sering ditanyakan.',
  'home.faq.1.q': 'Apakah Vetra gratis?',
  'home.faq.1.a':
    'Ya. Editor, template, pemeriksaan struktur, dan unduh PDF gratis tanpa akun. Akun hanya opsional untuk sinkronisasi cloud nanti.',
  'home.faq.2.q': 'Apakah data CV saya dikirim ke server?',
  'home.faq.2.a':
    'Tidak. Dokumen tersimpan di IndexedDB perangkat kamu. Fitur inti tetap jalan saat offline; cloud hanya lapisan opsional.',
  'home.faq.3.q': 'Apa itu Indeks Struktur & Keterbacaan?',
  'home.faq.3.a':
    'Ukuran 0–100 seberapa konsisten struktur dan keterbacaan CV kamu. Ini memeriksa struktur, bukan menjamin lolos — setiap ATS punya parser berbeda.',
  'home.faq.4.q': 'Template mana yang paling aman untuk ATS?',
  'home.faq.4.a':
    'Semua template satu kolom dan sudah diuji parse. Pilih yang paling nyaman dibaca manusia, lalu pastikan tidak memakai foto atau rating angka.',
  'home.faq.5.q': 'Bisakah saya memakai di HP?',
  'home.faq.5.a':
    'Bisa. Di bawah 1024px editor memakai tab Isi data dan Pratinjau, dan tombol Unduh PDF selalu ada di bar bawah.',
  'home.faq.6.q': 'Bagaimana cara mengunduh PDF?',
  'home.faq.6.a':
    'Tekan tombol Unduh PDF di bar atas atau bar bawah. Berkas dibuat langsung di perangkat kamu sebagai teks yang bisa disalin, tanpa watermark.',
  'home.faq.7.q': 'Apa itu ATS?',
  'home.faq.7.a':
    'Applicant Tracking System — perangkat lunak yang dipakai perusahaan untuk menampung dan menyaring CV sebelum dibaca manusia. Parser-nya membaca teks berurutan, bukan tampilan dokumen.',
  'home.faq.8.q': 'Apakah PDF-nya bisa dibaca mesin?',
  'home.faq.8.a':
    'Ya. PDF dibuat dari teks asli, bukan gambar, sehingga bisa diseleksi, disalin, dan dibaca parser. Susunan bacanya bisa kamu lihat di Parse Tape saat memeriksa struktur.',
  'home.footer.privacyLine':
    'Semua data CV diproses di browser kamu. Tidak ada yang diunggah, kecuali kamu login dan memilih menyimpan.',
  'home.guide.ruleOneColumn.title': 'Satu kolom, tanpa teks di dalam tabel',
  'home.guide.ruleOneColumn.body':
    'Parser membaca dari kiri ke kanan, baris demi baris. Kolom ganda mengacak urutan baca.',
  'home.guide.ruleFonts.title': 'Font standar, ukuran cukup',
  'home.guide.ruleFonts.body':
    'Pakai font umum 10–12pt untuk isi dan 14–18pt untuk nama. Font dekoratif sulit dipetakan.',
  'home.guide.ruleHeadings.title': 'Judul bagian yang baku',
  'home.guide.ruleHeadings.body':
    'Pakai Pengalaman, Pendidikan, Keahlian — bukan istilah kreatif yang tidak dikenali parser.',
  'home.guide.ruleBullets.title': 'Bullet berisi hasil, bukan tugas',
  'home.guide.ruleBullets.body':
    'Awali dengan kata kerja dan sertakan angka: naik 32% lebih terbaca daripada bertanggung jawab atas.',
  'home.guide.ruleDates.title': 'Tanggal seragam YYYY-MM',
  'home.guide.ruleDates.body':
    'Format seragam memudahkan garis waktu dibaca berurutan tanpa tebakan.',
  'home.guide.ruleContact.title': 'Kontak lengkap dan aktif',
  'home.guide.ruleContact.body':
    'Email, telepon, dan domisili wajib ada. Tautan portofolio bila relevan.',
  'home.guide.ruleNoPhoto.title': 'Tanpa foto, tanpa rating angka',
  'home.guide.ruleNoPhoto.body':
    'Foto mengacaukan urutan parse; rating angka terbaca sebagai data, bukan keahlian.',
  'home.guide.ruleLength.title': 'Padat: 1–2 halaman',
  'home.guide.ruleLength.body':
    'Satu halaman untuk fresh graduate, dua halaman bila pengalaman sudah panjang.',
  'home.guide.doTitle': 'Lakukan',
  'home.guide.dontTitle': 'Hindari',
  'home.guide.do.1': 'Nama di baris pertama, 16pt ke atas',
  'home.guide.do.2': 'Satu kolom dari atas ke bawah',
  'home.guide.do.3': 'Bullet diawali kata kerja + angka',
  'home.guide.dont.1': 'Foto profil di dalam dokumen',
  'home.guide.dont.2': 'Tabel dua kolom untuk pengalaman',
  'home.guide.dont.3': 'Rating bintang atau angka untuk keahlian',
  'home.footer.tagline': 'Pembuat CV satu kolom yang tersimpan di perangkat kamu.',
  'home.footer.product': 'Produk',
  'home.footer.templates': 'Template',
  'home.footer.resources': 'Sumber daya',
  'home.footer.legal': 'Legal',
  'home.footer.guide': 'Panduan ATS',
  'home.footer.howTo': 'Cara pakai',
  'home.footer.faqShort': 'FAQ',
  'home.footer.privacy': 'Privasi',
  'home.footer.terms': 'Ketentuan',
  'home.footer.backToEditor': 'Mulai dari template',
  'home.footer.rights': '© 2026 Vetra. Dokumen kamu milik kamu.',
} as const

export type TranslationKey = keyof typeof id

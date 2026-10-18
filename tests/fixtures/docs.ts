export const v0DocFixture = {
  id: 'doc-v0-fixture',
  title: 'CV Versi Nol',
  templateId: 'ledger',
  settings: { page: { size: 'A4' } },
  theme: { accentHex: null },
  sections: [
    { id: 's-v0-1', kind: 'summary', visible: true, data: { text: 'Isi ringkasan dokumen lama.' } },
  ],
  meta: { updatedAt: 1700000000000 },
}

export const v0DocFullFixture = {
  id: 'doc-v0-lengkap',
  title: 'CV Versi Nol Lengkap',
  templateId: 'minimal',
  settings: {
    page: { size: 'LETTER', marginMm: 20, showPageNumbers: false },
    language: 'en',
  },
  theme: { accentHex: '#123456', fontScale: 0.95 },
  sections: [
    { id: 's-v0-full-1', kind: 'summary', visible: true, data: { text: 'Ringkasan lengkap.' } },
  ],
  jobDescription: 'Deskripsi lowongan lama',
  meta: { createdAt: 1600000000000, updatedAt: 1700000000000, lastCheckedAt: 1650000000000 },
}

export const corruptDocStringFixture = 'ini-bukan-dokumen'

export const corruptDocShapeFixture = {
  id: 'doc-rusak',
  title: 'Dokumen Rusak',
  schemaVersion: 1,
  sections: 'seharusnya-array',
}

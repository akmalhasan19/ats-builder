import { createEmptyDoc, createEmptyEntry, createSampleDoc } from '@/schema/resume'
import type { ResumeDoc, SectionInstance } from '@/types/resume'
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

/**
 * Fixture pagination untuk Gate Fase 4: pendek (1 halaman), sedang (dokumen
 * contoh), panjang (memaksa beberapa halaman). Jumlah halaman & posisi break
 * yang dihasilkan dicatat di Execution Log dan dipakai lagi sebagai acuan
 * uji silang renderer PDF di Fase 5.
 */
export type PaginationFixtureName = 'pendek' | 'sedang' | 'panjang'

const bullet = (index: number): string =>
  `Koordinasi rilis mikrolayanan checkout ke-${index} bersama tim lintas fungsi, memangkas latensi p95 dari 1,8 detik menjadi 420 ms untuk 40 ribu pengguna harian.`

const withExperienceBullets = (doc: ResumeDoc, count: number): ResumeDoc => ({
  ...doc,
  sections: doc.sections.map((section): SectionInstance => {
    if (section.kind !== 'experience') return section
    const [first, ...rest] = section.data.entries
    if (!first) return section
    const bullets = Array.from({ length: count }, (_, index) => bullet(index + 1))
    return { ...section, data: { ...section.data, entries: [{ ...first, bullets }, ...rest] } }
  }),
})

export function paginationDoc(name: PaginationFixtureName): ResumeDoc {
  if (name === 'pendek') {
    const doc = createEmptyDoc()
    const sections = doc.sections.map((section): SectionInstance => {
      if (section.kind === 'profile')
        return {
          ...section,
          data: {
            ...section.data,
            fullName: 'Alex Morgan',
            headline: 'Software Engineer',
            email: 'alex@mail.com',
            phone: '+62 812 3456 7890',
            location: 'Jakarta, Indonesia',
          },
        } as SectionInstance
      if (section.kind === 'summary')
        return {
          ...section,
          data: {
            text: 'Insinyur perangkat lunak dengan enam tahun pengalaman membangun layanan pembayaran dan platform data untuk pengguna dalam jumlah besar.',
          },
        } as SectionInstance
      if (section.kind === 'experience') {
        const entry = {
          ...createEmptyEntry('experience'),
          role: 'Software Engineer',
          company: 'Kirana Digital',
          location: 'Bandung',
          startDate: '2019-08',
          endDate: '2022-03',
          bullets: [bullet(1), bullet(2)],
        }
        return { ...section, data: { entries: [entry] } } as SectionInstance
      }
      return { ...section, visible: false } as SectionInstance
    })
    return { ...doc, templateId: 'ledger', sections }
  }

  if (name === 'sedang') return { ...createSampleDoc(), templateId: 'ledger' }

  return { ...withExperienceBullets(createSampleDoc(), 24), templateId: 'ledger' }
}

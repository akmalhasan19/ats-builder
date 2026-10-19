import type { SectionKind } from '@/schema/resume'
import { stripDiacritics } from '@/lib/text'

/**
 * T7.1 — daftarheading kanonis. Parser ATS lama mencari bagian lewat judul,
 * jadi "Cerita Hidupku" tetap terbaca manusia tapi tidak dikenali mesin.
 * Dua bahasa karena pengguna menulis CV Indonesia maupun Inggris.
 */
const CANONICAL: Record<SectionKind, readonly string[]> = {
  profile: ['profil', 'profile', 'personal details', 'data diri', 'kontak', 'contact'],
  summary: [
    'ringkasan',
    'summary',
    'professional summary',
    'ringkasan profesional',
    'profile summary',
    'tentang saya',
    'about me',
  ],
  experience: [
    'pengalaman',
    'pengalaman kerja',
    'pengalaman profesional',
    'experience',
    'work experience',
    'work history',
    'employment',
    'employment history',
    'riwayat pekerjaan',
    'riwayat kerja',
    'career',
  ],
  education: [
    'pendidikan',
    'pendidikan formal',
    'education',
    'academic background',
    'riwayat pendidikan',
    'academics',
  ],
  skills: [
    'keahlian',
    'keterampilan',
    'kemampuan',
    'skills',
    'technical skills',
    'core competencies',
    'competencies',
    'keahlian teknis',
  ],
  projects: ['proyek', 'projects', 'portfolio', 'portofolio', 'selected projects'],
  certifications: [
    'sertifikasi',
    'sertifikat',
    'certifications',
    'certificates',
    'licenses',
    'lisensi',
  ],
  languages: ['bahasa', 'languages', 'language proficiency', 'kemampuan bahasa'],
  awards: [
    'penghargaan',
    'awards',
    'honors',
    'achievements',
    'prestasi',
    'recognitions',
    'penghargaan & prestasi',
  ],
  volunteering: [
    'relawan',
    'volunteering',
    'volunteer',
    'volunteer experience',
    'kegiatan sosial',
    'organisasi',
    'community involvement',
  ],
}

const normalise = (label: string): string =>
  stripDiacritics(label).toLowerCase().replace(/\s+/g, ' ').trim()

export function isCanonicalHeading(kind: SectionKind, label: string): boolean {
  return CANONICAL[kind].includes(normalise(label))
}

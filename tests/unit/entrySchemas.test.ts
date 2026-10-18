import { describe, expect, it } from 'vitest'
import {
  awardSchema,
  certificationSchema,
  educationSchema,
  experienceSchema,
  languageSchema,
  profileSchema,
  projectSchema,
  volunteeringSchema,
} from '@/schema/resume'

describe('skema entri per bagian (Gate Fase 3)', () => {
  it('profile: menolak email & telepon salah, menerima draft kosong', () => {
    const base = {
      fullName: 'Dewi Rahayu',
      headline: 'Full Stack Developer',
      email: 'dewi@contoh.com',
      phone: '+62 812 3456 7890',
      location: 'Bandung',
      links: [],
      photoEnabled: false as const,
    }
    expect(profileSchema.safeParse(base).success).toBe(true)
    expect(profileSchema.safeParse({ ...base, email: 'salah' }).success).toBe(false)
    expect(profileSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false)
    expect(profileSchema.safeParse({ ...base, email: '', phone: '' }).success).toBe(true)
  })

  it('experience: menolak format bulan yang bukan YYYY-MM', () => {
    const entry = {
      id: 'e1',
      role: 'Software Engineer',
      company: 'PT Solusi Digital',
      location: 'Jakarta',
      startDate: '2021-03',
      endDate: '2024-08',
      current: false,
      bullets: ['Meningkatkan konversi 35%'],
      stack: ['TypeScript'],
    }
    expect(experienceSchema.safeParse(entry).success).toBe(true)
    expect(experienceSchema.safeParse({ ...entry, startDate: 'Maret 2021' }).success).toBe(false)
    expect(experienceSchema.safeParse({ ...entry, id: '' }).success).toBe(false)
  })

  it('education: IPK di luar skala 0–4.00 ditolak dengan pesan yang bisa ditindaklanjuti', () => {
    const entry = {
      id: 'e1',
      degree: 'S.Kom',
      field: 'Informatika',
      institution: 'UI',
      location: 'Depok',
      startDate: '2019-08',
      endDate: '2023-07',
      gpa: '4.50',
      notes: [],
    }
    const result = educationSchema.safeParse(entry)
    expect(result.success).toBe(false)
    expect(!result.success && result.error.issues[0]?.message).toContain('0.00–4.00')
    expect(educationSchema.safeParse({ ...entry, gpa: '3.71' }).success).toBe(true)
    expect(educationSchema.safeParse({ ...entry, gpa: '' }).success).toBe(true)
  })

  it('languages: proficiency di luar lima tingkat ditolak', () => {
    const entry = { id: 'e1', name: 'Bahasa Indonesia', proficiency: 'Native' }
    expect(languageSchema.safeParse(entry).success).toBe(true)
    expect(languageSchema.safeParse({ ...entry, proficiency: 'Expert' }).success).toBe(false)
  })

  it('projects, certifications, awards, volunteering: id wajib & field opsional boleh kosong', () => {
    expect(
      projectSchema.safeParse({
        id: 'p1',
        name: 'Web Store',
        role: '',
        url: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: [],
        stack: [],
      }).success,
    ).toBe(true)
    expect(
      projectSchema.safeParse({
        id: '',
        name: 'X',
        role: '',
        url: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: [],
        stack: [],
      }).success,
    ).toBe(false)

    expect(
      certificationSchema.safeParse({
        id: 'c1',
        name: 'AWS Cloud Practitioner',
        issuer: 'Amazon',
        issuedAt: '2023-04',
        credentialId: '123',
        url: '',
      }).success,
    ).toBe(true)

    expect(
      awardSchema.safeParse({
        id: 'a1',
        title: 'Juara 1',
        issuer: '',
        awardedAt: '2023-10',
        description: '',
      }).success,
    ).toBe(true)

    expect(
      volunteeringSchema.safeParse({
        id: 'v1',
        role: 'Pengajar',
        organization: 'Komunitas Coding',
        startDate: '2022-01',
        endDate: '',
        current: true,
        bullets: [],
      }).success,
    ).toBe(true)
  })
})

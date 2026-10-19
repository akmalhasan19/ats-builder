import { CURRENT_SCHEMA_VERSION } from '@/schema/resume'
import type { ResumeDoc } from '@/types/resume'

/**
 * Fixture ATS dengan identitas tetap (bukan `createSampleDoc()` yang memakai
 * `crypto.randomUUID()`). Wajib: Gate Fase 7 meminta skor deterministik dan Parse
 * Tape yang bisa disilangkan dengan `pdftotext` — keduanya butuh id stabil.
 */

const id = (value: string): string => value

export const SAMPLE_IDS = {
  profile: id('s-profile'),
  summary: id('s-summary'),
  experience: id('s-experience'),
  education: id('s-education'),
  skills: id('s-skills'),
  projects: id('s-projects'),
  certifications: id('s-certifications'),
  languages: id('s-languages'),
  awards: id('s-awards'),
  volunteering: id('s-volunteering'),
} as const

export function sampleResume(): ResumeDoc {
  return {
    id: id('doc-sample-ats'),
    title: 'CV Alex Morgan — Software Engineer',
    templateId: 'classic-ats',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { page: { size: 'A4', marginMm: 18, showPageNumbers: true }, language: 'id' },
    theme: { accentHex: null, fontScale: 1 },
    sections: [
      {
        id: SAMPLE_IDS.profile,
        kind: 'profile',
        visible: true,
        data: {
          fullName: 'Alex Morgan',
          headline: 'Software Engineer',
          email: 'alex.morgan@mail.com',
          phone: '+62 812 3456 7890',
          location: 'Jakarta, Indonesia',
          links: [
            { label: 'LinkedIn', url: 'https://linkedin.com/in/alexmorgan' },
            { label: 'GitHub', url: 'https://github.com/alexmorgan' },
          ],
          photoEnabled: false,
        },
      },
      {
        id: SAMPLE_IDS.summary,
        kind: 'summary',
        visible: true,
        data: {
          text: 'Software engineer with 6 years building high-traffic web services in fintech and marketplace environments, focused on reliability, database performance, and mentoring.',
        },
      },
      {
        id: SAMPLE_IDS.experience,
        kind: 'experience',
        visible: true,
        data: {
          entries: [
            {
              id: id('exp-1'),
              role: 'Senior Software Engineer',
              company: 'Tech Nusantara Corp',
              location: 'Jakarta, Indonesia',
              startDate: '2022-04',
              endDate: '',
              current: true,
              bullets: [
                'Led migration of a monolithic checkout flow to microservices, cutting p95 latency from 1.8s to 420ms for 40k daily users.',
                'Designed PostgreSQL partitioning and index strategy for the orders table, reducing monthly storage growth by 35%.',
                'Mentored 4 junior engineers through structured code review rotations.',
              ],
              stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
            },
            {
              id: id('exp-2'),
              role: 'Software Engineer',
              company: 'Kirana Digital',
              location: 'Bandung, Indonesia',
              startDate: '2019-08',
              endDate: '2022-03',
              current: false,
              bullets: [
                'Built an inventory reconciliation service processing 2M+ SKU updates nightly at 99.9% success rate.',
                'Optimized SQL queries in the reporting module, shortening dashboard load time from 9s to 1.2s.',
              ],
              stack: ['Vue', 'PHP', 'MySQL'],
            },
          ],
        },
      },
      {
        id: SAMPLE_IDS.education,
        kind: 'education',
        visible: true,
        data: {
          entries: [
            {
              id: id('edu-1'),
              degree: 'B.Sc.',
              field: 'Computer Science',
              institution: 'Institut Teknologi Bandung',
              location: 'Bandung, Indonesia',
              startDate: '2015-08',
              endDate: '2019-06',
              gpa: '3.71',
              notes: ['Thesis: course recommender system using collaborative filtering.'],
            },
          ],
        },
      },
      {
        id: SAMPLE_IDS.skills,
        kind: 'skills',
        visible: true,
        data: {
          groups: [
            {
              id: id('skill-1'),
              name: 'Languages & Frameworks',
              items: ['TypeScript', 'JavaScript', 'React', 'Node.js', 'SQL'],
            },
            {
              id: id('skill-2'),
              name: 'Infrastructure & Data',
              items: ['PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS'],
            },
          ],
        },
      },
      {
        id: SAMPLE_IDS.projects,
        kind: 'projects',
        visible: true,
        data: {
          entries: [
            {
              id: id('proj-1'),
              name: 'Open Transit API',
              role: 'Maintainer',
              url: 'https://github.com/alexmorgan/transit-api',
              startDate: '2021-02',
              endDate: '',
              bullets: [
                'Community REST API serving 300k monthly requests for Jakarta bus schedules.',
              ],
              stack: ['TypeScript', 'Fastify'],
            },
          ],
        },
      },
      {
        id: SAMPLE_IDS.certifications,
        kind: 'certifications',
        visible: true,
        data: {
          entries: [
            {
              id: id('cert-1'),
              name: 'AWS Certified Solutions Architect',
              issuer: 'Amazon Web Services',
              issuedAt: '2023-11',
              credentialId: 'AWS-SAA-87213',
              url: 'https://cp.amazonaws.com/badges',
            },
          ],
        },
      },
      {
        id: SAMPLE_IDS.languages,
        kind: 'languages',
        visible: true,
        data: {
          entries: [
            { id: id('lang-1'), name: 'Bahasa Indonesia', proficiency: 'Native' },
            { id: id('lang-2'), name: 'English', proficiency: 'Professional' },
          ],
        },
      },
      { id: SAMPLE_IDS.awards, kind: 'awards', visible: false, data: { entries: [] } },
      { id: SAMPLE_IDS.volunteering, kind: 'volunteering', visible: false, data: { entries: [] } },
    ],
    jobDescription: null,
    meta: { createdAt: 0, updatedAt: 0, lastCheckedAt: null },
  }
}

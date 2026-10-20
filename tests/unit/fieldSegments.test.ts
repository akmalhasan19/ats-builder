import { describe, expect, it } from 'vitest'
import { createSampleDoc } from '@/schema/resume'
import {
  entryContentOf,
  entriesOf,
  profileContact,
  skillGroupLines,
  summaryText,
} from '@/features/templates/contentLines'
import { isEntriesSection } from '@/features/preview/blocks'
import {
  compositeOf,
  displayLineOf,
  entryHeadGroups,
  entryLineGroups,
  headerGroups,
  skillGroupGroups,
  summaryGroups,
  type SegmentGroup,
} from '@/features/templates/fieldSegments'
import { contactLine, resolveSpec } from '@/features/templates/specs'
import { TEMPLATE_IDS } from '@/app/shell/templateList'
import type { ResumeDoc } from '@/types/resume'
import type { SectionInstance } from '@/types/resume'

/**
 * C2.1 — segmentasi layar harus menghasilkan urutan teks + separator yang
 * IDENTIK dengan string komposit `contentLines`. Inilah yang menjaga tinggi
 * terukur dan paritas halaman tetap sama setelah segmentasi diperkenalkan
 * (D4). Uji dijalankan untuk kelima template karena pemisahan judul & tanggal
 * berubah menurut `entryLayout`.
 */

const doc = createSampleDoc()
const lang = doc.settings.language

const find = (groups: SegmentGroup[], slot: SegmentGroup['slot']): SegmentGroup => {
  const group = groups.find((item) => item.slot === slot)
  if (!group) throw new Error(`grup ${slot} tidak ada`)
  return group
}

const profileOf = (target: ResumeDoc): Extract<SectionInstance, { kind: 'profile' }> => {
  const section = target.sections.find((item) => item.kind === 'profile')
  if (!section || section.kind !== 'profile') throw new Error('section profil hilang')
  return section
}

const summarySectionOf = (target: ResumeDoc): Extract<SectionInstance, { kind: 'summary' }> => {
  const section = target.sections.find((item) => item.kind === 'summary')
  if (!section || section.kind !== 'summary') throw new Error('section ringkasan hilang')
  return section
}

describe('fieldSegments — paritas dengan contentLines (C2.1)', () => {
  for (const templateId of TEMPLATE_IDS) {
    const spec = resolveSpec(templateId, doc.theme, doc.settings.page)

    it(`header, ringkasan, dan skill group sama persis di template ${templateId}`, () => {
      const profile = profileOf(doc)
      const header = headerGroups(profile.data, spec)
      expect(compositeOf(find(header, 'name'))).toBe(profile.data.fullName)
      expect(compositeOf(find(header, 'headline'))).toBe(profile.data.headline)
      expect(compositeOf(find(header, 'contact'))).toBe(
        contactLine(profileContact(profile.data), spec),
      )

      const summary = summarySectionOf(doc)
      expect(compositeOf(find(summaryGroups(summaryText(summary)), 'body'))).toBe(
        summaryText(summary),
      )

      const skills = doc.sections.find((item) => item.kind === 'skills')
      if (skills?.kind !== 'skills') throw new Error('section skill hilang')
      for (const group of skills.data.groups) {
        const lines = skillGroupLines(group)
        const groups = skillGroupGroups(group, group.id)
        expect(compositeOf(find(groups, 'title'))).toBe(lines[0] ?? '')
        expect(compositeOf(find(groups, 'body'))).toBe(lines.slice(1).join(', '))
      }
    })

    it(`kepala entri sama persis di template ${templateId}`, () => {
      for (const section of doc.sections) {
        if (!isEntriesSection(section)) continue
        for (const entry of entriesOf(section)) {
          const content = entryContentOf(section.kind, entry, lang)
          const groups = entryHeadGroups(section.kind, entry, spec, lang)
          expect(compositeOf(find(groups, 'title'))).toBe(content.title)
          if (spec.entryLayout.datePosition === 'right') {
            const dates = groups.find((item) => item.slot === 'dates')
            // Pendidikan & bahasa tidak menampilkan tanggal sama sekali.
            expect(dates ? compositeOf(dates) : '').toBe(content.dates)
            expect(compositeOf(find(groups, 'meta'))).toBe(content.metaNoDates)
          } else {
            expect(compositeOf(find(groups, 'meta'))).toBe(content.meta)
          }
        }
      }
    })

    it(`baris entri sama persis di template ${templateId}`, () => {
      for (const section of doc.sections) {
        if (!isEntriesSection(section)) continue
        for (const entry of entriesOf(section)) {
          const content = entryContentOf(section.kind, entry, lang)
          content.bodyLines.forEach((line, lineIndex) => {
            const groups = entryLineGroups(section.kind, entry, lineIndex)
            expect(compositeOf(find(groups, 'body'))).toBe(line.text)
          })
        }
      }
    })
  }
})

describe('fieldSegments — field kosong jadi guide (C2.2)', () => {
  it('segmen kosong menandai guide dan path modelnya benar', () => {
    const spec = resolveSpec('classic-ats', doc.theme, doc.settings.page)
    const profile = profileOf(doc)
    const groups = headerGroups(
      {
        ...profile.data,
        fullName: '',
        headline: '',
        email: '',
        phone: '',
        location: '',
        links: [],
      },
      spec,
    )
    const name = find(groups, 'name')
    expect(name.segments[0]?.fieldPath).toBe('profile.fullName')
    expect(name.segments[0]?.text).toBe('')
    expect(name.segments[0]?.guideId).toBe('fullName')
    const contact = find(groups, 'contact')
    expect(contact.segments.map((segment) => segment.fieldPath)).toEqual([
      'profile.email',
      'profile.phone',
      'profile.location',
    ])
  })

  it('baris tampilan memakai pemisah hanya di antara isi yang tampil', () => {
    const spec = resolveSpec('ledger', doc.theme, doc.settings.page)
    const groups = headerGroups(
      {
        ...profileOf(doc).data,
        email: 'alex@mail.com',
        phone: '',
        location: 'Jakarta',
        links: [],
      },
      spec,
    )
    // Email terisi, telepon kosong (guide), lokasi terisi → dua pemisah.
    expect(displayLineOf(find(groups, 'contact'), 'ledger')).toBe(
      'alex@mail.com · Nomor telepon · Jakarta',
    )
  })

  it('entri maya menghasilkan segmen guide untuk field matriks §4', () => {
    const spec = resolveSpec('classic-ats', doc.theme, doc.settings.page)
    const groups = entryHeadGroups('experience', null, spec, lang)
    expect(find(groups, 'title').segments.map((segment) => segment.guideId)).toEqual([
      'role',
      'company',
    ])
    const dates = groups.find((item) => item.slot === 'dates')
    expect(dates?.segments[0]?.guideId).toBe('dates')
    expect(find(groups, 'meta').segments[0]?.guideId).toBe('location')
  })

  it('bagian yang tidak tampil (IPK kosong) tidak memutus baris', () => {
    const spec = resolveSpec('ledger', doc.theme, doc.settings.page)
    const entry = {
      id: 'e-1',
      degree: 'S.Kom',
      field: 'Teknik Informatika',
      institution: 'Universitas Indonesia',
      location: 'Depok',
      gpa: '',
    }
    const groups = entryHeadGroups('education', entry, spec, lang)
    const meta = find(groups, 'meta')
    // IPK kosong tidak boleh jadi pemisah menggantung di akhir baris.
    expect(displayLineOf(meta, 'ledger')).toBe('Universitas Indonesia · Depok')
    expect(compositeOf(meta)).toBe('Universitas Indonesia · Depok')
  })
})

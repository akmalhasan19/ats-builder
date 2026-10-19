import { act, cleanup, render, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECTION_ORDER, sectionSchema } from '@/schema/resume'
import { t } from '@/lib/i18n'
import { id as idDict } from '@/dictionaries/id'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { getSpec, headingLabel, resolveSpec } from '@/features/templates/specs'
import {
  entryContentOf,
  isBlankEntry,
  profileContact,
  sectionLabel,
  skillGroupLines,
  summaryText,
  type EntriesSectionKind,
} from '@/features/templates/contentLines'
import {
  calculateTotalCompleteness,
  countSectionIssues,
  getSectionCompleteness,
  sectionRegistry,
} from '@/features/sections/registry'
import { MarkedText } from '@/features/templates/screen/MarkedText'
import { BlockView } from '@/features/templates/screen/BlockView'
import { TemplateRenderer } from '@/features/templates/screen/TemplateRenderer'
import { TemplateThumbSheet } from '@/features/templates/screen/TemplateThumbSheet'
import { SpikeSheet } from '@/features/templates/screen/SpikeSheet'
import { spikeContent } from '@/features/templates/spikeContent'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import type {
  AwardEntry,
  EducationEntry,
  ExperienceEntry,
  ProfileData,
  ResumeDoc,
  SectionInstance,
  SkillGroup,
  VolunteeringEntry,
} from '@/types/resume'
import type { TemplateId } from '@/types/resume'

// useMeasuredHeight asli menulis tinggi blok ke store global lewat rAF; di sini
// kita rekam kunci pengukurannya saja supaya (a) tidak ada efek samping waktu
// dan (b) bisa dibuktikan thumbnail memakai namespace `thumb-<template>:`.
const { measuredKeys } = vi.hoisted(() => ({ measuredKeys: [] as string[] }))
vi.mock('@/features/preview/useMeasuredHeight', () => ({
  useMeasuredHeight: (key: string) => {
    measuredKeys.push(key)
    return { current: null }
  },
}))

const TEMPLATE_IDS: TemplateId[] = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']

/** fullDoc: sampleResume + awards/volunteering hidup + variasi cabang. */
function fullDoc(): ResumeDoc {
  const doc: ResumeDoc = structuredClone(sampleResume())
  const byKind = <K extends SectionInstance['kind']>(kind: K) =>
    doc.sections.find((section) => section.kind === kind) as Extract<SectionInstance, { kind: K }>

  const awards = byKind('awards')
  awards.visible = true
  const awardEntry: AwardEntry = {
    id: 'award-1',
    title: 'Best Open Source Project',
    issuer: 'DevFest Nasional',
    awardedAt: '2023-05',
    description: 'Dipilih oleh komunitas developer Indonesia.',
  }
  awards.data = { entries: [awardEntry] }

  const volunteering = byKind('volunteering')
  volunteering.visible = true
  const volEntry: VolunteeringEntry = {
    id: 'vol-1',
    role: 'Mentor',
    organization: 'Kode Baik',
    startDate: '2021-01',
    endDate: '',
    current: true,
    bullets: ['Melatih 30 murid workshop web dasar.'],
  }
  volunteering.data = { entries: [volEntry] }

  const experience = byKind('experience')
  const noBullet: ExperienceEntry = {
    id: 'exp-nobullet',
    role: 'Intern',
    company: 'Riset Bandung',
    location: 'Bandung, Indonesia',
    startDate: '2018-06',
    endDate: '2018-09',
    current: false,
    bullets: [],
    stack: [],
  }
  const blank: ExperienceEntry = {
    id: 'exp-blank',
    role: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    bullets: [],
    stack: [],
  }
  experience.data = { entries: [...experience.data.entries, noBullet, blank] }

  const education = byKind('education')
  const eduNoGpa: EducationEntry = {
    id: 'edu-2',
    degree: 'SMA',
    field: '',
    institution: 'SMAN 3 Bandung',
    location: 'Bandung, Indonesia',
    startDate: '2012-07',
    endDate: '2015-06',
    gpa: '',
    notes: [],
  }
  education.data = { entries: [...education.data.entries, eduNoGpa] }

  const skills = byKind('skills')
  const emptyGroup: SkillGroup = { id: 'skill-3', name: 'Belum terisi', items: [] }
  skills.data = { groups: [...skills.data.groups, emptyGroup] }

  const profile = byKind('profile')
  const links: ProfileData['links'] = [...profile.data.links, { label: 'Portfolio', url: '' }]
  profile.data = { ...profile.data, links }

  return doc
}

const specFor = (templateId: TemplateId, doc: ResumeDoc) =>
  resolveSpec(templateId, doc.theme, doc.settings.page)

const renderDoc = (
  templateId: TemplateId,
  doc: ResumeDoc,
  marked?: { keywords: string[]; showMarks: boolean },
) => {
  const spec = specFor(templateId, doc)
  const plan = createPagePlan(doc, spec)
  return render(
    <TemplateRenderer
      plan={plan}
      spec={spec}
      keywords={marked?.keywords ?? []}
      showMarks={marked?.showMarks ?? false}
    />,
  )
}

const previewBlocks = (kind?: string): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>('[data-probe="preview-block"]')].filter(
    (node) => !kind || node.getAttribute('data-block-kind') === kind,
  )

const blockWithText = (kind: string, needle: string): HTMLElement => {
  const block = previewBlocks(kind).find((node) => node.textContent?.includes(needle))
  if (!block) throw new Error(`blok ${kind} dengan teks "${needle}" tidak ada`)
  return block
}

beforeEach(() => {
  act(() => {
    useUiStore.getState().setShowMarginGuides(false)
    useUiStore.getState().setFitMode(false)
    useUiStore.getState().setZoom(1)
  })
  measuredKeys.length = 0
})

beforeAll(() => {
  // semua test berkas ini memakai dokumen fixture yang sama di store
  act(() => {
    useDocStore.getState().loadDoc(fullDoc())
  })
})

afterEach(() => {
  cleanup()
})

describe('MarkedText (T9.x — stabilo kata kunci)', () => {
  const drawMarked = (text: string, keywords: string[], showMarks = true) =>
    render(<MarkedText text={text} keywords={keywords} showMarks={showMarks} />).container

  it('tanpa keywords → tidak ada <mark> dan teks utuh', () => {
    const container = drawMarked('Led migration to microservices', [])
    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container.textContent).toBe('Led migration to microservices')
  })

  it('showMarks=false → tidak ada <mark> meski keywords terisi', () => {
    const container = drawMarked('Led migration to microservices', ['microservices'], false)
    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container.textContent).toBe('Led migration to microservices')
  })

  it('stabilo kasus-insensitif + kata dengan tanda baca tepi (TypeScript,) tetap cocok', () => {
    const container = drawMarked('Experienced TypeScript, React, and Node.js engineers', [
      'typescript',
      'NODE.js',
    ])
    const marks = [...container.querySelectorAll('mark')].map((mark) => mark.textContent)
    expect(marks).toEqual(['TypeScript', 'Node.js'])
    expect(container.textContent).toBe('Experienced TypeScript, React, and Node.js engineers')
    // kata tak cocok (React) tidak distabilo tetapi tetap ada di teks
    expect(container.textContent).toContain('React')
  })

  it('frasa multi-kata ("code review") distabilo apa adanya', () => {
    const container = drawMarked('Mentored juniors through structured code review rotations.', [
      'code review',
    ])
    const marks = [...container.querySelectorAll('mark')].map((mark) => mark.textContent)
    expect(marks).toEqual(['code review'])
    expect(container.textContent).toBe('Mentored juniors through structured code review rotations.')
  })

  it('hanya keyword kosong / teks kosong → tanpa <mark>, tanpa lemparan', () => {
    expect(drawMarked('teks biasa', ['']).querySelectorAll('mark')).toHaveLength(0)
    expect(drawMarked('', ['react']).querySelectorAll('mark')).toHaveLength(0)
  })
})

describe('contentLines — model baris dokumen (branch nyata)', () => {
  const lang = 'id' as const
  const doc = fullDoc()
  const entryOf = <K extends EntriesSectionKind>(kind: K, itemId: string) => {
    const section = doc.sections.find((item) => item.kind === kind)
    if (
      !section ||
      section.kind === 'profile' ||
      section.kind === 'summary' ||
      section.kind === 'skills'
    ) {
      throw new Error(`bagian ${kind} hilang`)
    }
    const data = section.data as { entries: Record<string, unknown>[] }
    const entry = data.entries.find((item) => item.id === itemId)
    if (!entry) throw new Error(`entri ${itemId} hilang`)
    return entryContentOf(section.kind as EntriesSectionKind, entry, lang)
  }

  it('experience current:true → SEKARANG di tanggal; meta utuh; stack = baris teks biasa terakhir', () => {
    const content = entryOf('experience', 'exp-1')
    expect(content.title).toBe('Senior Software Engineer — Tech Nusantara Corp')
    expect(content.dates.endsWith(t('experience.presentChip'))).toBe(true)
    expect(content.meta).toBe(`Jakarta, Indonesia · ${content.dates}`)
    expect(content.metaNoDates).toBe('Jakarta, Indonesia')
    expect(content.bodyLines.slice(0, 3).every((line) => line.bullet)).toBe(true)
    const lastLine = content.bodyLines[content.bodyLines.length - 1]!
    expect(lastLine.bullet).toBe(false)
    expect(lastLine.text).toBe(`${t('doc.stackPrefix')}TypeScript, React, Node.js, PostgreSQL`)
  })

  it('experience tanpa tanggal selesai & tanpa current → tanggal hanya sisi awal', () => {
    const content = entryContentOf(
      'experience',
      {
        id: 'x',
        role: 'A',
        company: 'B',
        location: '',
        startDate: '2020-01',
        endDate: '',
        current: false,
        bullets: ['   ', 'isi'],
        stack: [],
      },
      lang,
    )
    expect(content.dates).not.toContain('–')
    expect(content.bodyLines).toHaveLength(1) // bullet whitespace '   ' disaring
  })

  it('education: dates selalu kosong; gpa memakai IPK prefix; entry kedua tanpa gpa/notes', () => {
    const withGpa = entryOf('education', 'edu-1')
    expect(withGpa.dates).toBe('')
    expect(withGpa.metaNoDates).toContain(`${t('doc.gpaPrefix')}3.71`)
    expect(withGpa.bodyLines.every((line) => line.bullet)).toBe(true)
    const noGpa = entryOf('education', 'edu-2')
    expect(noGpa.metaNoDates).not.toContain(t('doc.gpaPrefix'))
    expect(noGpa.bodyLines).toHaveLength(0)
  })

  it('certifications: url jadi baris teks biasa; languages: tanpa bodyLines', () => {
    const cert = entryOf('certifications', 'cert-1')
    expect(cert.bodyLines).toEqual([{ text: 'https://cp.amazonaws.com/badges', bullet: false }])
    expect(cert.dates).not.toBe('')
    const langEntry = entryOf('languages', 'lang-1')
    expect(langEntry.bodyLines).toHaveLength(0)
    expect(langEntry.meta).toBe('Native')
  })

  it('awards/volunteering/projects: deskripsi plain, volunteering meta=dates, projects tanpa tanggal kosong', () => {
    const award = entryOf('awards', 'award-1')
    expect(award.metaNoDates).toBe('DevFest Nasional')
    expect(award.bodyLines).toEqual([
      { text: 'Dipilih oleh komunitas developer Indonesia.', bullet: false },
    ])
    const vol = entryOf('volunteering', 'vol-1')
    expect(vol.meta).toBe(vol.dates)
    expect(vol.metaNoDates).toBe('')
    expect(vol.dates.endsWith(t('experience.presentChip'))).toBe(true)
    const project = entryOf('projects', 'proj-1')
    expect(project.metaNoDates).toBe('https://github.com/alexmorgan/transit-api')
    expect(project.dates).not.toContain(t('experience.presentChip'))
  })

  it('isBlankEntry hanya true untuk entri kosong total; profileContact fallback ke label link', () => {
    expect(
      isBlankEntry(entryContentOf('languages', { id: 'x', name: '  ', proficiency: '' }, lang)),
    ).toBe(true)
    const contact = profileContact(
      doc.sections.find((section) => section.kind === 'profile')!.data as ProfileData,
    )
    expect(contact).toContain('alex.morgan@mail.com')
    expect(contact).toContain('https://github.com/alexmorgan')
    expect(contact).toContain('Portfolio')
  })

  it('skillGroupLines menyaring baris kosong; summaryText hanya untuk kind summary', () => {
    expect(skillGroupLines({ id: 'g', name: 'Frontend', items: [] })).toEqual(['Frontend'])
    expect(skillGroupLines({ id: 'g', name: '  ', items: [] })).toEqual([])
    expect(skillGroupLines({ id: 'g', name: 'G', items: ['a', 'b'] })).toEqual(['G', 'a, b'])
    const summary = doc.sections.find((section) => section.kind === 'summary')!
    expect(summaryText(summary)).toBe(summary.kind === 'summary' ? summary.data.text : '')
    expect(summaryText(doc.sections.find((section) => section.kind === 'skills')!)).toBe('')
  })

  it('sectionLabel setiap kind = nilai kamus labelId registry (bukan kunci mentah)', () => {
    for (const kind of SECTION_ORDER) {
      const label = sectionLabel(kind)
      expect(label).toBe(idDict[sectionRegistry[kind].labelId])
      expect(label).not.toBe(sectionRegistry[kind].labelId)
    }
  })
})

describe('BlockView + TemplateRenderer — tiap kind section tergambar nyata', () => {
  it('classic-ats: semua kind section memroduksi blok preview dengan probes yang benar', () => {
    const doc = fullDoc()
    renderDoc('classic-ats', doc)
    const kinds = new Set(previewBlocks().map((node) => node.getAttribute('data-block-kind')))
    for (const expected of [
      'header',
      'section-heading',
      'summary',
      'skill-group',
      'entry-head',
      'entry-line',
    ]) {
      expect(kinds.has(expected), expected).toBe(true)
    }
    // tiap section visible punya minimal satu blok milik sectionId-nya
    for (const section of doc.sections) {
      if (!section.visible) continue
      expect(
        previewBlocks().some((node) => node.getAttribute('data-block-key')?.includes(section.id)),
        `section ${section.kind}`,
      ).toBe(true)
    }
    expect(blockWithText('entry-line', 'Led migration').textContent).toContain('Led migration')
  })

  it('tanggal KANAN (classic-ats) vs BARIS BERIKUTNYA (minimal) untuk entri experience yang sama', () => {
    const doc = fullDoc()
    renderDoc('classic-ats', doc)
    const rightHead = blockWithText('entry-head', 'Tech Nusantara Corp')
    const datesSpan = rightHead.querySelector('span[style*="text-align: right"]')
    expect(datesSpan).not.toBeNull()
    expect(datesSpan!.textContent).toContain(t('experience.presentChip'))
    expect(rightHead.textContent).toContain('Senior Software Engineer')
    cleanup()

    renderDoc('minimal', doc)
    const nextHead = blockWithText('entry-head', 'Tech Nusantara Corp')
    expect(nextHead.querySelector('span[style*="text-align: right"]')).toBeNull()
    expect(nextHead.textContent).toContain('Jakarta, Indonesia')
    expect(nextHead.textContent).toContain(t('experience.presentChip'))
  })

  it('heading rule none/solid/double/dotted tergambar sesuai spec tiap template', () => {
    const doc = fullDoc()
    renderDoc('minimal', doc)
    expect(previewBlocks('section-heading').every((block) => block.childElementCount === 1)).toBe(
      true,
    )
    cleanup()

    renderDoc('classic-ats', doc)
    expect(
      previewBlocks('section-heading').every(
        (block) => block.childElementCount === 2 && block.querySelector('div[style*="background"]'),
      ),
    ).toBe(true)
    cleanup()

    renderDoc('executive', doc)
    expect(
      previewBlocks('section-heading').every((block) =>
        block.querySelector('div')?.getAttribute('style')?.includes('linear-gradient'),
      ),
    ).toBe(true)
    cleanup()

    renderDoc('technician', doc)
    expect(
      previewBlocks('section-heading').every((block) =>
        block.querySelector('div')?.getAttribute('style')?.includes('dotted'),
      ),
    ).toBe(true)
    cleanup()

    // label heading yang digambar = headingLabel(sectionLabel) — uppercase classic
    renderDoc('classic-ats', doc)
    expect(
      previewBlocks('section-heading').some((block) =>
        block.textContent?.includes(headingLabel(sectionLabel('summary'), getSpec('classic-ats'))),
      ),
    ).toBe(true)
  })

  it('nameAlign executive:center vs classic-ats:left pada blok header', () => {
    const doc = fullDoc()
    renderDoc('executive', doc)
    const execName = blockWithText('header', 'Alex Morgan').querySelector('div')
    expect(execName?.getAttribute('style')).toContain('text-align: center')
    cleanup()
    renderDoc('classic-ats', doc)
    const classicName = blockWithText('header', 'Alex Morgan').querySelector('div')
    expect(classicName?.getAttribute('style')).toContain('text-align: left')
    // kontak satu baris dengan separator · dan fallback label 'Portfolio'
    expect(blockWithText('header', 'Portfolio').textContent).toContain(' · ')
  })

  it('stack dirender teks biasa tanpa glyph bullet; bullet biasa memakai glyph spec', () => {
    const doc = fullDoc()
    renderDoc('classic-ats', doc)
    const stackBlock = blockWithText('entry-line', `${t('doc.stackPrefix')}TypeScript`)
    expect(stackBlock.querySelector('span[aria-hidden="true"]')).toBeNull()
    const bulletBlock = blockWithText('entry-line', 'Led migration')
    const glyph = bulletBlock.querySelector('span[aria-hidden="true"]')
    expect(glyph?.textContent).toBe(getSpec('classic-ats').bulletGlyph)
  })

  it('entri kosong total tidak dipager; entri tanpa bullet hanya punya entry-head; summary kosong tanpa blok', () => {
    const doc = fullDoc()
    renderDoc('ledger', doc)
    expect(
      previewBlocks().some((node) => node.getAttribute('data-block-key')?.includes('exp-blank')),
    ).toBe(false)
    expect(
      previewBlocks('entry-head').some((node) =>
        node.getAttribute('data-block-key')?.includes('exp-nobullet'),
      ),
    ).toBe(true)
    expect(
      previewBlocks('entry-line').some((node) =>
        node.getAttribute('data-block-key')?.includes('exp-nobullet'),
      ),
    ).toBe(false)
    cleanup()

    const emptySummaryDoc: ResumeDoc = structuredClone(doc)
    const summarySection = emptySummaryDoc.sections.find((section) => section.kind === 'summary')!
    summarySection.data = { text: '' }
    renderDoc('ledger', emptySummaryDoc)
    expect(
      previewBlocks().some((node) =>
        node.getAttribute('data-block-key')?.includes(SAMPLE_IDS.summary),
      ),
    ).toBe(false)
  })

  it('lineIndex di luar rentang → BlockView me-render wrapper kosong tanpa node teks', () => {
    const doc = fullDoc()
    const spec = specFor('ledger', doc)
    render(
      <BlockView
        blockKey="probe:empty"
        kind="entry-line"
        sectionKind="experience"
        sectionId={SAMPLE_IDS.experience}
        itemId="exp-1"
        lineIndex={99}
        padAfterMm={0}
        spec={spec}
        keywords={[]}
        showMarks={false}
      />,
    )
    const block = blockWithTextOrEmpty()
    expect(block.childElementCount).toBe(0)
  })

  it('field kosong menghasilkan cabang null: header tanpa headline, entry-head tanpa judul (tanggal saja)', () => {
    const doc: ResumeDoc = structuredClone(fullDoc())
    const profile = doc.sections.find((section) => section.kind === 'profile')!
    profile.data = {
      ...(profile.data as ProfileData),
      headline: '',
    }
    const experience = doc.sections.find((section) => section.kind === 'experience')!
    ;(experience.data as { entries: Record<string, unknown>[] }).entries = [
      {
        id: 'exp-dates-only',
        role: '',
        company: '',
        location: '',
        startDate: '2020-01',
        endDate: '2020-02',
        current: false,
        bullets: [],
        stack: [],
      },
    ]
    // BlockView berlangganan isinya ke store (bukan prop) → muat dulu variannya.
    act(() => {
      useDocStore.getState().loadDoc(doc)
    })
    try {
      renderDoc('classic-ats', doc)
      const header = blockWithText('header', 'Alex Morgan')
      // cabang name:true / headline:false / contact:true — hanya nama + kontak
      expect(header.textContent).not.toContain('Software Engineer')
      expect(header.querySelector('header > div')).not.toBeNull()
      const head = previewBlocks('entry-head').find((node) =>
        node.getAttribute('data-block-key')?.includes('exp-dates-only'),
      )
      if (!head) throw new Error('entri hanya-tanggal tidak memroduksi entry-head')
      // tanggal saja: baris kanan tetap digambar walau judul kosong
      expect(head.querySelector('span[style*="text-align: right"]')).not.toBeNull()
      // metaNoDates kosong → cabang meta null
      expect(head.childElementCount).toBe(1)
    } finally {
      act(() => {
        useDocStore.getState().loadDoc(fullDoc())
      })
    }
  })

  it('keywords menembus renderer: mark muncul saat showMarks, lenyap saat off', () => {
    const doc = fullDoc()
    renderDoc('classic-ats', doc, { keywords: ['TypeScript', 'microservices'], showMarks: true })
    const marks = [...document.querySelectorAll('mark')].map((node) => node.textContent)
    expect(marks).toContain('microservices')
    expect(marks).toContain('TypeScript')
    cleanup()
    renderDoc('classic-ats', doc, { keywords: ['TypeScript', 'microservices'], showMarks: false })
    expect(document.querySelectorAll('mark')).toHaveLength(0)
  })

  it('probe heading/bullet/contact ada di SpikeSheet (jalur spike dev)', () => {
    const { container } = render(<SpikeSheet content={spikeContent} scale={0.5} />)
    expect(container.querySelector('[data-probe="heading"]')).not.toBeNull()
    expect(container.querySelector('[data-probe="bullet"]')).not.toBeNull()
    expect(container.querySelector('[data-probe="contact"]')).not.toBeNull()
  })
})

/** helper utk blok kosong (textContent-nya ''), bukan blockWithText */
function blockWithTextOrEmpty(): HTMLElement {
  const block = document.querySelector<HTMLElement>('[data-block-key="probe:empty"]')
  if (!block) throw new Error('BlockView probe:empty tidak dirender')
  return block
}

describe('TemplateThumbSheet — render nyata tanpa mencemari store pratinjau', () => {
  it('kelima template merender mini-sheet (role=img + label kamus) tanpa melempar', () => {
    for (const templateId of TEMPLATE_IDS) {
      const view = render(
        <TemplateThumbSheet
          templateId={templateId}
          scale={0.24}
          className={templateId === 'ledger' ? 'thumb-test' : undefined}
        />,
      )
      if (templateId === 'ledger')
        expect(view.container.querySelector('.thumb-test')).not.toBeNull()
      const img = within(view.container).getByRole('img', {
        name: t('templates.thumbLabel', { name: t(`template.${templateId}`) }),
      })
      expect(
        view.container.querySelectorAll('[data-probe="preview-block"]').length,
      ).toBeGreaterThan(0)
      // transform scale hidup di div dalam (kertas A4 penuh), bukan role=img luar
      expect(img.firstElementChild?.getAttribute('style')).toContain('scale(0.24)')
      view.unmount()
    }
  })

  it('tinggi thumb hanya ditulis ke namespace thumb-<id> — snapshot usePreviewStore tidak berubah', () => {
    const snapshot = JSON.stringify(usePreviewStore.getState().heights)
    measuredKeys.length = 0
    for (const templateId of TEMPLATE_IDS) {
      const view = render(<TemplateThumbSheet templateId={templateId} scale={0.6} />)
      view.unmount()
    }
    expect(measuredKeys.length).toBeGreaterThan(0)
    for (const templateId of TEMPLATE_IDS) {
      expect(
        measuredKeys.some((key) => key.startsWith(`thumb-${templateId}:`)),
        templateId,
      ).toBe(true)
    }
    expect(measuredKeys.every((key) => key.startsWith('thumb-'))).toBe(true)
    expect(JSON.stringify(usePreviewStore.getState().heights)).toBe(snapshot)
  })
})

describe('Registry section — branch kelengkapan (awards/volunteering termasuk)', () => {
  const asData = (value: unknown) => value as never

  it('computeDots: 0 / 1 / 2 (rasio <0.5 dan >=0.5) / 3 (lengkap) untuk profile', () => {
    const base = {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      links: [],
      photoEnabled: false,
    }
    expect(sectionRegistry.profile.getCompleteness(asData(base)).dots).toBe(0)
    expect(sectionRegistry.profile.getCompleteness(asData({ ...base, fullName: 'A' })).dots).toBe(1)
    expect(
      sectionRegistry.profile.getCompleteness(asData({ ...base, fullName: 'A', email: 'b' })).dots,
    ).toBe(2)
    expect(
      sectionRegistry.profile.getCompleteness(
        asData({ ...base, fullName: 'A', email: 'b', phone: 'c', headline: 'd' }),
      ).dots,
    ).toBe(3)
  })

  it('entri kosong tiap kind: dots 0 dengan total default (experience 5, education 3, skills 2, awards 1, volunteering 3)', () => {
    expect(sectionRegistry.experience.getCompleteness(asData({ entries: [] })).total).toBe(5)
    expect(sectionRegistry.education.getCompleteness(asData({ entries: [] })).total).toBe(3)
    expect(sectionRegistry.skills.getCompleteness(asData({ groups: [] })).total).toBe(2)
    expect(sectionRegistry.awards.getCompleteness(asData({ entries: [] })).total).toBe(1)
    expect(sectionRegistry.volunteering.getCompleteness(asData({ entries: [] })).total).toBe(3)
    for (const kind of ['experience', 'education', 'skills', 'awards', 'volunteering'] as const) {
      expect(sectionRegistry[kind].getCompleteness(asData({ entries: [], groups: [] })).dots).toBe(
        0,
      )
    }
  })

  it('awards: loop per entri (baris 283-289) — 0/1 kosong, 1/1 lengkap', () => {
    const empty = { entries: [{ id: 'a', title: '', issuer: '', awardedAt: '', description: '' }] }
    expect(sectionRegistry.awards.getCompleteness(asData(empty))).toEqual({
      dots: 0,
      filled: 0,
      total: 1,
      isComplete: false,
    })
    const filled = {
      entries: [{ id: 'a', title: 'Juara', issuer: '', awardedAt: '', description: '' }],
    }
    expect(sectionRegistry.awards.getCompleteness(asData(filled))).toEqual({
      dots: 3,
      filled: 1,
      total: 1,
      isComplete: true,
    })
  })

  it('volunteering: loop per entri (baris 310-318) — 2/3 dots 2, 1/3 dots 1, 0/3 dots 0', () => {
    const two = {
      entries: [
        { id: 'v', role: 'A', organization: 'B', startDate: '', current: false, bullets: [] },
      ],
    }
    expect(sectionRegistry.volunteering.getCompleteness(asData(two)).dots).toBe(2)
    const one = {
      entries: [
        { id: 'v', role: 'A', organization: '', startDate: '', current: false, bullets: [] },
      ],
    }
    expect(sectionRegistry.volunteering.getCompleteness(asData(one)).dots).toBe(1)
    const zero = {
      entries: [
        { id: 'v', role: '', organization: '', startDate: '', current: false, bullets: [] },
      ],
    }
    expect(sectionRegistry.volunteering.getCompleteness(asData(zero)).dots).toBe(0)
  })

  it('tiap entri registry: kind benar, labelId lolos t(), icon komponen, defaultData lolos zod sectionSchema', () => {
    for (const kind of SECTION_ORDER) {
      const entry = sectionRegistry[kind]
      expect(entry.kind).toBe(kind)
      expect(t(entry.labelId)).toBe(idDict[entry.labelId])
      expect(['function', 'object']).toContain(typeof entry.icon) // lucide: forwardRef object
      expect(entry.icon).toBeTruthy()
      const parse = sectionSchema.safeParse({
        id: `s-${kind}`,
        kind,
        visible: true,
        data: entry.defaultData(),
      })
      expect(parse.success, kind).toBe(true)
    }
  })

  it('getCompleteness untuk kelima kind lainnya: kosong vs penuh vs sebagian menaikkan dots', () => {
    expect(sectionRegistry.summary.getCompleteness(asData({ text: '' }))).toMatchObject({
      dots: 0,
      filled: 0,
      total: 1,
    })
    expect(sectionRegistry.summary.getCompleteness(asData({ text: 'isi' }))).toMatchObject({
      dots: 3,
      filled: 1,
      isComplete: true,
    })
    const edu = (over: Partial<EducationEntry>) => ({
      entries: [
        {
          id: 'e',
          degree: '',
          field: '',
          institution: '',
          location: '',
          startDate: '',
          endDate: '',
          gpa: '',
          notes: [],
          ...over,
        },
      ],
    })
    expect(sectionRegistry.education.getCompleteness(asData(edu({})))).toMatchObject({
      dots: 0,
      total: 3,
    })
    expect(sectionRegistry.education.getCompleteness(asData(edu({ degree: 'S1' })))).toMatchObject({
      dots: 1,
    })
    expect(
      sectionRegistry.education.getCompleteness(asData(edu({ degree: 'S1', institution: 'UI' }))),
    ).toMatchObject({ dots: 2 })
    expect(
      sectionRegistry.education.getCompleteness(
        asData(edu({ degree: 'S1', institution: 'UI', startDate: '2019-08' })),
      ),
    ).toMatchObject({ dots: 3, isComplete: true })
    expect(
      sectionRegistry.skills.getCompleteness(
        asData({ groups: [{ id: 'g', name: 'N', items: [] }] }),
      ),
    ).toMatchObject({ dots: 2, filled: 1 })
    expect(
      sectionRegistry.skills.getCompleteness(
        asData({ groups: [{ id: 'g', name: '', items: ['a'] }] }),
      ),
    ).toMatchObject({ dots: 2, filled: 1 })
    expect(
      sectionRegistry.skills.getCompleteness(
        asData({ groups: [{ id: 'g', name: 'N', items: ['a'] }] }),
      ),
    ).toMatchObject({ dots: 3 })
    expect(
      sectionRegistry.projects.getCompleteness(
        asData({
          entries: [
            {
              id: 'p',
              name: 'X',
              role: '',
              url: '',
              startDate: '',
              endDate: '',
              bullets: [],
              stack: [],
            },
          ],
        }),
      ),
    ).toMatchObject({ dots: 2, filled: 1 })
    expect(
      sectionRegistry.projects.getCompleteness(
        asData({
          entries: [
            {
              id: 'p',
              name: 'X',
              role: '',
              url: '',
              startDate: '2023-01',
              endDate: '',
              bullets: [],
              stack: [],
            },
          ],
        }),
      ),
    ).toMatchObject({ dots: 3 })
    const cert = (over: Partial<{ name: string; issuer: string; issuedAt: string }>) => ({
      entries: [
        { id: 'c', name: '', issuer: '', issuedAt: '', credentialId: '', url: '', ...over },
      ],
    })
    expect(sectionRegistry.certifications.getCompleteness(asData(cert({})))).toMatchObject({
      dots: 0,
      total: 3,
    })
    expect(
      sectionRegistry.certifications.getCompleteness(asData(cert({ name: 'AWS' }))),
    ).toMatchObject({ dots: 1 })
    expect(
      sectionRegistry.certifications.getCompleteness(
        asData(cert({ name: 'AWS', issuer: 'Amazon', issuedAt: '2023-01' })),
      ),
    ).toMatchObject({ dots: 3 })
    const langEntry = (over: Partial<{ name: string; proficiency: string }>) => ({
      entries: [{ id: 'l', name: '', proficiency: 'Native', ...over }],
    })
    expect(sectionRegistry.languages.getCompleteness(asData(langEntry({})))).toMatchObject({
      dots: 2,
      filled: 1,
    })
    expect(
      sectionRegistry.languages.getCompleteness(asData(langEntry({ name: 'Indonesia' }))),
    ).toMatchObject({ dots: 3 })
    expect(
      sectionRegistry.experience.getCompleteness(
        asData({
          entries: [
            {
              id: 'x',
              role: 'r',
              company: '',
              location: '',
              startDate: '',
              endDate: '',
              current: false,
              bullets: [],
              stack: [],
            },
          ],
        }),
      ),
    ).toMatchObject({ dots: 1 })
    expect(
      sectionRegistry.experience.getCompleteness(
        asData({
          entries: [
            {
              id: 'x',
              role: '',
              company: '',
              location: '',
              startDate: '',
              endDate: '',
              current: true,
              bullets: ['isi'],
              stack: [],
            },
          ],
        }),
      ),
    ).toMatchObject({ filled: 2 }) // current:true memenuhi slot endDate
  })

  it('getSectionCompleteness delegasi ke registry; calculateTotalCompleteness: 0 bila tak ada yang visible, 100 untuk sampleResume', () => {
    const doc = sampleResume()
    const profile = doc.sections.find((section) => section.kind === 'profile')!
    expect(getSectionCompleteness(profile).dots).toBe(3)
    expect(calculateTotalCompleteness([])).toBe(0)
    expect(calculateTotalCompleteness(doc.sections.filter((section) => section.visible))).toBe(100)
  })

  it('countSectionIssues: 0 untuk section valid, >0 untuk bentuk data salah', () => {
    expect(
      countSectionIssues({ id: 's1', kind: 'summary', visible: true, data: { text: 'ok' } }),
    ).toBe(0)
    expect(
      countSectionIssues({ id: 's1', kind: 'summary', visible: true, data: {} }),
    ).toBeGreaterThan(0)
  })
})

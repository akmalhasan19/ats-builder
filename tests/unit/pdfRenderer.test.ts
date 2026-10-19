/**
 * T9.x — renderer PDF (`ResumePdfLib`) + inventaris font (`fonts.ts`).
 *
 * Tujuannya menaikkan cabang/fungsi yang belum tersentuh tanpa jadi tes snapshot
 * rapuh: yang dibandingkan selalu nilai terukur (jumlah halaman, jumlah operasi
 * gambar, warna isi hasil ekstraksi pdfjs, panjang berkas) — bukan isi berkas.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { beforeAll, describe, expect, it } from 'vitest'
import { fontFileFor, FONT_SOURCES } from '@/features/pdf/fonts'
import { contentBoxOf, type DocBlock, type PagePlan } from '@/features/preview/pagination'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { resolveSpec, type TemplateSpec } from '@/features/templates/specs'
import {
  buildResumePdf,
  PDF_FONT_FAMILY,
  PdfExportError,
  wrapPdfLines,
  type BuildPdfOptions,
  type PdfFontLoader,
  type ResumePdfResult,
} from '@/features/templates/pdf/ResumePdfLib'
import { paginationDoc } from '../fixtures/docs'
import { sampleResume } from '../fixtures/sampleResume'
import type {
  ExperienceEntry,
  ProfileData,
  ResumeDoc,
  SectionInstance,
  SkillGroup,
} from '@/types/resume'
import type { PDFFont } from 'pdf-lib'

const fontFile: PdfFontLoader = (file) =>
  Promise.resolve(new Uint8Array(readFileSync(path.resolve('public/fonts', file))))

const failingFontLoader =
  (message: string): PdfFontLoader =>
  () =>
    Promise.reject(new Error(message))

let font: PDFFont

beforeAll(async () => {
  const { PDFDocument } = await import('pdf-lib')
  const fontkit = (await import('@pdf-lib/fontkit')).default
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  font = await pdf.embedFont(await fontFile(fontFileFor('plex-sans', 400)))
})

/* ---------------------------------------------------------------- helpers */

type Rendered = { result: ResumePdfResult; spec: TemplateSpec; plan: PagePlan }

async function renderDoc(
  doc: ResumeDoc,
  tuneSpec?: (spec: TemplateSpec) => TemplateSpec,
  options: BuildPdfOptions = {},
  loader: PdfFontLoader = fontFile,
): Promise<Rendered> {
  const base = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
  const spec = tuneSpec ? tuneSpec(base) : base
  const plan = createPagePlan(doc, spec)
  const result = await buildResumePdf(doc, spec, plan, loader, options)
  return { result, spec, plan }
}

type Probe = {
  text: string
  items: string[]
  pages: string[]
  fillColors: string[]
  rects: number
  ops: number
}

/** Bongkar PDF dengan pdfjs: teks per halaman + operasi gambar halaman tertentu. */
async function probe(result: ResumePdfResult, page = 1): Promise<Probe> {
  const task = getDocument({ data: new Uint8Array(result.bytes), verbosity: 0 })
  const pdf = await task.promise
  const pages: string[] = []
  const items: string[] = []
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const content = await (await pdf.getPage(index)).getTextContent()
    let text = ''
    for (const item of content.items) {
      if ('str' in item) {
        text += `${item.str} `
        items.push(item.str)
      }
    }
    pages.push(text)
  }
  const list = await (await pdf.getPage(Math.min(page, pdf.numPages))).getOperatorList()
  const fillColors: string[] = []
  let rects = 0
  list.fnArray.forEach((fn, index) => {
    const args = list.argsArray[index]
    if (fn === OPS.constructPath) rects += 1
    if (fn === OPS.setFillRGBColor && Array.isArray(args)) {
      const first = args[0]
      if (typeof first === 'string') fillColors.push(first)
    }
  })
  await task.destroy()
  return { text: pages.join(' '), items, pages, fillColors, rects, ops: list.fnArray.length }
}

async function infoOf(result: ResumePdfResult): Promise<{ title: string; author: string }> {
  const task = getDocument({ data: new Uint8Array(result.bytes), verbosity: 0 })
  const pdf = await task.promise
  const { info } = await pdf.getMetadata()
  await task.destroy()
  const meta = info as { Title?: unknown; Author?: unknown }
  const title = typeof meta.Title === 'string' ? meta.Title : ''
  const author = typeof meta.Author === 'string' ? meta.Author : ''
  return { title, author }
}

const visibleKinds = new Set(['profile', 'summary', 'experience', 'skills'])

/** Dokumen pendek: profil + ringkasan + 1 entri + 1 grup keahlian → 1 halaman. */
function shortDoc(overrides: Partial<ResumeDoc> = {}): ResumeDoc {
  const doc = sampleResume()
  const experience = doc.sections.find((section) => section.kind === 'experience')
  if (experience?.kind !== 'experience') throw new Error('fixture pengalaman hilang')
  const entry = experience.data.entries[0]
  if (!entry) throw new Error('entri pengalaman kosong')
  const skills = doc.sections.find((section) => section.kind === 'skills')
  if (skills?.kind !== 'skills') throw new Error('fixture keahlian hilang')
  return {
    ...doc,
    ...overrides,
    sections: doc.sections.map((section): SectionInstance => {
      if (!visibleKinds.has(section.kind)) return { ...section, visible: false }
      if (section.kind === 'experience')
        return { ...section, data: { entries: [{ ...entry, bullets: entry.bullets.slice(0, 1) }] } }
      if (section.kind === 'skills')
        return { ...section, data: { groups: [skills.data.groups[0]!] } }
      return section
    }),
  }
}

function withExperienceEntries(doc: ResumeDoc, entries: ExperienceEntry[]): ResumeDoc {
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance =>
      section.kind === 'experience' ? { ...section, data: { entries } } : section,
    ),
  }
}

function withProfile(doc: ResumeDoc, patch: Partial<ProfileData>): ResumeDoc {
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance =>
      section.kind === 'profile' ? { ...section, data: { ...section.data, ...patch } } : section,
    ),
  }
}

function withSkills(doc: ResumeDoc, groups: SkillGroup[]): ResumeDoc {
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance =>
      section.kind === 'skills' ? { ...section, data: { groups } } : section,
    ),
  }
}

const experienceEntry = (patch: Partial<ExperienceEntry> = {}): ExperienceEntry => {
  const source = sampleResume().sections.find((section) => section.kind === 'experience')
  if (source?.kind !== 'experience') throw new Error('fixture pengalaman hilang')
  const entry = source.data.entries[0]
  if (!entry) throw new Error('entri pengalaman kosong')
  return { ...entry, ...patch }
}

const block = (patch: Partial<DocBlock> & Pick<DocBlock, 'key' | 'kind'>): DocBlock => ({
  sectionId: 's-summary',
  sectionKind: 'summary',
  padAfterMm: 0,
  estimatePx: 10,
  minWithNext: 0,
  ...patch,
})

/* ------------------------------------------------------------------ fonts */

describe('inventaris font PDF', () => {
  it('setiap berkas yang terdaftar benar-benar ada di public/fonts', () => {
    const files = Object.values(FONT_SOURCES)
      .flat()
      .map((face) => face.file)
    expect(files.length).toBeGreaterThan(8)
    for (const file of files) {
      expect(readFileSync(path.resolve('public/fonts', file)).byteLength).toBeGreaterThan(1000)
    }
  })

  it('fontFileFor memilih wajah persis (bobot & gaya)', () => {
    expect(fontFileFor('plex-sans', 400)).toBe('pdf/IBMPlexSans-Regular.ttf')
    expect(fontFileFor('plex-sans', 300)).toBe('pdf/IBMPlexSans-Light.ttf')
    expect(fontFileFor('plex-mono', 600)).toBe('pdf/IBMPlexMono-SemiBold.ttf')
    expect(fontFileFor('archivo', 600)).toBe('pdf/Archivo-SemiBold.ttf')
    expect(fontFileFor('source-serif', 400, 'italic')).toBe('pdf/SourceSerif4-Italic.ttf')
  })

  it('melempar saat wajah tidak terdaftar — bobot salah atau gaya salah', () => {
    expect(() => fontFileFor('plex-sans', 700)).toThrow(/belum terdaftar/u)
    expect(() => fontFileFor('archivo', 600, 'italic')).toThrow(/belum terdaftar/u)
  })

  it('memetakan keluarga spec ke keluarga TTF yang di-embed', () => {
    expect(PDF_FONT_FAMILY).toEqual({
      archivo: 'archivo',
      plexSans: 'plex-sans',
      plexMono: 'plex-mono',
      sourceSerif: 'source-serif',
    })
  })
})

describe('wrapPdfLines — cabang pembungkus', () => {
  it('teks kosong atau hanya spasi menghasilkan satu baris kosong', () => {
    expect(wrapPdfLines('', font, 10, 200)).toEqual([''])
    expect(wrapPdfLines('   \t  ', font, 10, 200)).toEqual([''])
  })

  it('menghormati pengukur lebar khusus (jalur small-caps)', () => {
    // Pengukur "1 satuan per karakter" → maksimal 20 karakter per baris.
    const lines = wrapPdfLines('aaaa bbbb cccc dddd eeee ffff', font, 10, 20, (text) => text.length)
    expect(lines).toEqual(['aaaa bbbb cccc dddd', 'eeee ffff'])
  })

  it('kata 13 karakter dipecah dengan hyphen, kata 12 karakter tidak', () => {
    const wide = wrapPdfLines('Mengoordinasikan', font, 10, 40)
    expect(wide.length).toBeGreaterThan(1)
    expect(wide.every((line) => line.length > 0)).toBe(true)
    expect(wrapPdfLines('ABCDEFGHIJKL', font, 10, 12)).toEqual(['ABCDEFGHIJKL'])
  })

  it('membungkus banyak kata tanpa kehilangan kata', () => {
    const lines = wrapPdfLines('satu dua tiga empat lima enam tujuh delapan', font, 10, 60)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ').split(/\s+/u).filter(Boolean).length).toBe(8)
  })
})

/* --------------------------------------------------------------- renderer */

describe('buildResumePdf — jumlah halaman', () => {
  it('dokumen pendek jadi satu halaman, berkas PDF nyata', async () => {
    const { result, plan } = await renderDoc(shortDoc())
    expect(plan.pageCount).toBe(1)
    expect(result.pageCount).toBe(1)
    expect(result.bytes.length).toBeGreaterThan(1000)
    const page = probe(result)
    expect((await page).text).toContain('Alex Morgan')
  }, 20000)

  it('dokumen panjang dibuat lewat batas halaman: jumlah halaman == rencana halaman', async () => {
    const long = paginationDoc('panjang')
    const { result, plan } = await renderDoc(long)
    expect(plan.pageCount).toBeGreaterThan(2)
    expect(result.pageCount).toBe(plan.pageCount)
    const paged = await probe(result)
    expect(paged.pages.every((text) => text.trim().length > 0)).toBe(true)
    // 24 bullet yang sama di fixture: tiap bullet digambar tepat satu kali.
    const occurrences = paged.text.split('Koordinasi rilis').length - 1
    expect(occurrences).toBe(24)
  }, 30000)

  it('fontScale 1.1 tidak menghasilkan halaman lebih sedikit daripada 0.9', async () => {
    const base = shortDoc({ theme: { accentHex: null, fontScale: 0.9 } })
    const small = await renderDoc(base)
    const large = await renderDoc({ ...base, theme: { accentHex: null, fontScale: 1.1 } })
    expect(small.result.bytes.length).toBeGreaterThan(0)
    expect(large.result.bytes.length).toBeGreaterThan(0)
    expect(large.plan.pageCount).toBeGreaterThanOrEqual(small.plan.pageCount)
    expect(large.result.pageCount).toBe(large.plan.pageCount)
    expect(large.spec.typeScale.body.sizePt).toBeGreaterThan(small.spec.typeScale.body.sizePt)
  }, 30000)
})

describe('buildResumePdf — isi teks', () => {
  it('current: true memakai label SEKARANG, current: false memakai bulan akhir', async () => {
    const ongoing = await renderDoc(
      withExperienceEntries(shortDoc(), [experienceEntry({ current: true, endDate: '' })]),
    )
    const closed = await renderDoc(
      withExperienceEntries(shortDoc(), [experienceEntry({ current: false, endDate: '2024-06' })]),
    )
    const ongoingText = (await probe(ongoing.result)).text
    const closedText = (await probe(closed.result)).text
    expect(ongoingText).toContain('SEKARANG')
    expect(closedText).not.toContain('SEKARANG')
    expect(closedText).toContain('Jun 2024')
  }, 30000)

  it('entri tanpa bullet dan tanpa stack tetap ter-render (hanya kepala entri)', async () => {
    const bare = await renderDoc(
      withExperienceEntries(shortDoc(), [
        experienceEntry({ bullets: [], stack: [], id: 'exp-bare' }),
      ]),
    )
    expect(bare.result.bytes.length).toBeGreaterThan(1000)
    expect(bare.result.pageCount).toBe(bare.plan.pageCount)
    const text = (await probe(bare.result)).text
    expect(text).toContain('Senior Software Engineer')
    // baris "Teknologi:" hilang karena stack kosong
    expect(text).not.toContain('Teknologi:')
  }, 30000)

  it('grup keahlian tanpa item hanya menulis nama grup', async () => {
    const nameless = await renderDoc(
      withSkills(shortDoc(), [{ id: 'g1', name: 'Bahasa', items: [] }]),
    )
    const text = (await probe(nameless.result)).text
    expect(text).toContain('Bahasa')
    // tanpa item, tidak ada baris kedua "nama, daftar" dari grup itu
    expect(text).not.toContain('TypeScript, JavaScript')
    expect(nameless.result.pageCount).toBe(nameless.plan.pageCount)
  }, 30000)

  it('grup keahlian tanpa nama dan tanpa item tidak menghasilkan blok', async () => {
    const withGroup = await renderDoc(shortDoc())
    const empty = await renderDoc(withSkills(shortDoc(), [{ id: 'g0', name: '', items: [] }]))
    expect(empty.result.pageCount).toBeLessThanOrEqual(withGroup.result.pageCount)
    expect(empty.result.bytes.length).toBeGreaterThan(1000)
  }, 30000)

  it('heading small-caps (executive) tidak kehilangan glyph', async () => {
    const exec = shortDoc({ templateId: 'executive' })
    const { result } = await renderDoc(exec)
    const text = (await probe(result)).text
    // Sintesis small-caps memecah run kapital/kecil, jadi pemisah spasi ikut
    // terbaca; yang diuji di sini tidak ada huruf yang hilang.
    expect(text.replace(/\s+/gu, '')).toContain('PENGALAMAN')
    expect(text).toContain('Alex Morgan')
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  }, 30000)
})

describe('buildResumePdf — gaya spec', () => {
  it('accentHex aktif mewarnai rule ledger; null kembali ke hitam', async () => {
    const plain = await renderDoc(shortDoc({ templateId: 'ledger' }))
    const accented = await renderDoc(
      shortDoc({ templateId: 'ledger', theme: { accentHex: '#0F5A78', fontScale: 1 } }),
    )
    expect(plain.spec.headingStyle.rule.color).toBe('ink')
    expect(accented.spec.headingStyle.rule.color).toBe('accent')
    const plainProbe = await probe(plain.result)
    const accentProbe = await probe(accented.result)
    expect(accentProbe.fillColors).toContain('#0f5a78')
    expect(plainProbe.fillColors).not.toContain('#0f5a78')
    expect(plainProbe.fillColors).toContain('#10161f')
    expect(accented.result.pageCount).toBe(plain.result.pageCount)
  }, 30000)

  it('aksen template yang tidak mengizinkannya tetap hitam-putih', async () => {
    const { spec } = await renderDoc(
      shortDoc({ templateId: 'classic-ats', theme: { accentHex: '#FF0000', fontScale: 1 } }),
    )
    expect(spec.accentHex).toBeNull()
    expect(spec.headingStyle.rule.color).toBe('ink')
  }, 20000)

  it('headingStyle.rule.kind: none < solid < double < dotted (jumlah rect terukur)', async () => {
    const doc = shortDoc({ templateId: 'minimal' })
    const rule =
      (kind: TemplateSpec['headingStyle']['rule']['kind'], widthPt: number) =>
      (spec: TemplateSpec): TemplateSpec => ({
        ...spec,
        headingStyle: { ...spec.headingStyle, rule: { kind, widthPt, color: 'ink' } },
      })
    const counts: number[] = []
    for (const variant of [
      rule('none', 0),
      rule('solid', 0.75),
      rule('double', 0.75),
      rule('dotted', 0.75),
    ] as const) {
      const { result } = await renderDoc(doc, variant)
      counts.push((await probe(result)).rects)
    }
    const [none, solid, double, dotted] = counts
    expect(none).toBeDefined()
    expect(solid).toBeGreaterThan(none!)
    expect(double).toBeGreaterThan(solid!)
    expect(dotted).toBeGreaterThan(double!)
  }, 60000)

  it('tanggal kanan vs tanggal baris berikutnya menghasilkan baris meta berbeda', async () => {
    const doc = shortDoc()
    const right = await renderDoc(doc, (spec) => ({
      ...spec,
      entryLayout: { datePosition: 'right' },
    }))
    const nextLine = await renderDoc(doc, (spec) => ({
      ...spec,
      entryLayout: { datePosition: 'next-line' },
    }))
    const rightItems = (await probe(right.result)).items
    const nextItems = (await probe(nextLine.result)).items
    // next-line: satu baris meta berisi lokasi DAN tanggal
    expect(nextItems.some((item) => item.includes('Jakarta, Indonesia · '))).toBe(true)
    // right: lokasi berdiri sendiri, tanggal di ujung baris judul
    expect(rightItems).toContain('Jakarta, Indonesia')
    expect(rightItems.some((item) => item.includes('SEKARANG'))).toBe(true)
    expect(rightItems.some((item) => item.includes(' · SEKARANG'))).toBe(false)
  }, 40000)

  it('kepala entri yang terlalu lebar turun jadi dua paragraf, teks tetap utuh', async () => {
    const wide = experienceEntry({
      role: 'Principal Platform Reliability Engineer For Payments And Marketplace Systems',
      company: 'Tek Nusantara Corporation Persada Mandiri Sejahtera Internasional',
      id: 'exp-wide',
    })
    const { result } = await renderDoc(
      withExperienceEntries(shortDoc({ templateId: 'classic-ats' }), [wide]),
    )
    const items = (await probe(result)).items
    expect(items.some((item) => item.includes('Principal Platform Reliability Engineer'))).toBe(
      true,
    )
    expect(items.some((item) => item.includes('SEKARANG'))).toBe(true)
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  }, 30000)

  it('kepala entri tanpa judul di layout tanggal-kanan: hanya tanggal yang digambar', async () => {
    const titleless = experienceEntry({ role: '', company: '', id: 'exp-titleless' })
    const { result } = await renderDoc(
      withExperienceEntries(shortDoc({ templateId: 'classic-ats' }), [titleless]),
    )
    const items = (await probe(result)).items
    expect(items.some((item) => item.includes('SEKARANG'))).toBe(true)
    expect(items).not.toContain(' — ')
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  }, 30000)

  it('bulletGlyph dari spec yang dipakai apa adanya di teks PDF', async () => {
    const dot = await renderDoc(shortDoc())
    const dash = await renderDoc(shortDoc(), (spec) => ({ ...spec, bulletGlyph: '–' }))
    expect((await probe(dot.result)).text).toContain('•')
    expect((await probe(dash.result)).text).toContain('–')
    expect((await probe(dash.result)).text).not.toContain('•')
  }, 30000)

  it('showPageNumbers tidak dibaca renderer: dua-duanya identik & tanpa nomor halaman', async () => {
    const on = await renderDoc(shortDoc())
    const off = await renderDoc(
      shortDoc({
        settings: {
          page: { size: 'A4', marginMm: 18, showPageNumbers: false },
          language: 'id',
        },
      }),
    )
    expect(off.result.pageCount).toBe(on.result.pageCount)
    // Yang dibandingkan adalah OUTPUT teks, bukan panjang byte: pdf-lib menulis
    // document ID / CreationDate acak per build, jadi byte bisa berbeda 1 karakter
    // walau dokumennya identik (assertion byte-length ini flake di suite penuh).
    const onItems = (await probe(on.result)).items.map((item) => item.trim())
    const offItems = (await probe(off.result)).items.map((item) => item.trim())
    expect(offItems).toEqual(onItems)
    const items = (await probe(off.result)).items
    expect(items.some((item) => /^\d+\s*\/\s*\d+$/u.test(item.trim()))).toBe(false)
  }, 40000)

  it('margin dokumen menggantikan margin spec, dan margin 0 jatuh ke nilai template', async () => {
    const tight = resolveSpec('ledger', { fontScale: 1 }, { marginMm: 8 })
    const fallback = resolveSpec('ledger', { fontScale: 1, accentHex: null }, { marginMm: 0 })
    expect(tight.marginMm).toBe(8)
    expect(fallback.marginMm).toBe(16)
    const { result } = await renderDoc(
      shortDoc({
        templateId: 'ledger',
        settings: { page: { size: 'A4', marginMm: 8, showPageNumbers: true }, language: 'id' },
      }),
    )
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  })
})

describe('buildResumePdf — stabilo kata kunci', () => {
  it('kata yang cocok menambah kotak stabilo tanpa mengubah text layer', async () => {
    const doc = shortDoc()
    const plain = await renderDoc(doc)
    const marked = await renderDoc(doc, undefined, { keywords: ['migration', 'PostgreSQL'] })
    const plainProbe = await probe(plain.result)
    const markedProbe = await probe(marked.result)
    expect(markedProbe.rects).toBeGreaterThan(plainProbe.rects)
    expect(markedProbe.text).toBe(plainProbe.text)
  }, 40000)

  it('kata yang tidak cocok, kosong, atau multi-kata tidak menggambar apa pun', async () => {
    const doc = shortDoc()
    const plain = await renderDoc(doc)
    const baseline = (await probe(plain.result)).rects
    for (const keywords of [['BukanKataKunci'], [''], ['monolithic checkout'], []]) {
      const { result } = await renderDoc(doc, undefined, { keywords })
      expect((await probe(result)).rects).toBe(baseline)
    }
  }, 60000)

  it('stabilo juga jatuh di baris kepala entri (tanggal kanan) dan nama', async () => {
    const doc = shortDoc({ templateId: 'classic-ats' })
    const plain = await renderDoc(doc)
    const marked = await renderDoc(doc, undefined, { keywords: ['Senior', 'Morgan', 'Corp'] })
    expect((await probe(marked.result)).rects).toBeGreaterThan((await probe(plain.result)).rects)
    expect((await probe(marked.result)).text).toBe((await probe(plain.result)).text)
  }, 40000)
})

describe('metadata & jalur gagal renderer', () => {
  it('judul PDF memakai nama + headline, lalu jatuh ke nama saja', async () => {
    const full = await renderDoc(shortDoc())
    expect(await infoOf(full.result)).toEqual({
      title: 'Alex Morgan — Software Engineer',
      author: 'Alex Morgan',
    })
    const noHeadline = await renderDoc(withProfile(shortDoc(), { headline: '' }))
    expect((await infoOf(noHeadline.result)).title).toBe('Alex Morgan')
  }, 40000)

  it('nama profil kosong jatuh ke judul dokumen untuk metadata', async () => {
    const doc = shortDoc()
    const { result } = await renderDoc(withProfile(doc, { fullName: '' }))
    const info = await infoOf(result)
    // fullName kosong → `doc.title` dipakai untuk Title dan Author.
    expect(info.author).toBe(doc.title)
    expect(info.title.startsWith(doc.title)).toBe(true)
  }, 30000)

  it('font gagal dimuat → PdfExportError code font', async () => {
    await expect(
      renderDoc(shortDoc(), undefined, {}, failingFontLoader('font hilang')),
    ).rejects.toMatchObject({ code: 'font', message: 'font hilang', name: 'PdfExportError' })
  }, 20000)

  it('satu halaman dimuati blok melebihi tinggi halaman → PdfExportError code content', async () => {
    const doc = paginationDoc('panjang')
    const base = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const plan = createPagePlan(doc, base)
    const packed: PagePlan = {
      pages: [plan.blocks],
      blocks: plan.blocks,
      pageCount: 1,
      ...contentBoxOf(base),
    }
    const error = await buildResumePdf(doc, base, packed, fontFile).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfExportError)
    expect((error as PdfExportError).code).toBe('content')
    expect((error as PdfExportError).message).toMatch(/melewati batas halaman/u)
  }, 30000)

  it('blok yatim (section/item tidak ada, profil tak terlihat) dilewati tanpa error', async () => {
    const doc = shortDoc()
    const base = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const blocks: DocBlock[] = [
      block({ key: 'lost:header', kind: 'header', sectionId: 'tidak-ada' }),
      block({
        key: 'lost:heading',
        kind: 'section-heading',
        sectionId: 'tidak-ada-juga',
        sectionKind: 'experience',
      }),
      block({
        key: 'lost:skill',
        kind: 'skill-group',
        sectionId: 's-skills',
        sectionKind: 'skills',
        itemId: 'grup-tiada',
      }),
      block({
        key: 'lost:head',
        kind: 'entry-head',
        sectionId: 's-experience',
        sectionKind: 'experience',
        itemId: 'entri-tiada',
      }),
      block({
        key: 'lost:line',
        kind: 'entry-line',
        sectionId: 's-experience',
        sectionKind: 'experience',
        itemId: 'entri-tiada',
        lineIndex: 0,
      }),
      block({
        key: 'lost:line-index',
        kind: 'entry-line',
        sectionId: 's-experience',
        sectionKind: 'experience',
        itemId: 'exp-1',
        lineIndex: 9,
      }),
    ]
    const plan: PagePlan = {
      pages: [blocks],
      blocks,
      pageCount: 1,
      ...contentBoxOf(base),
    }
    const result = await buildResumePdf(doc, base, plan, fontFile)
    expect(result.pageCount).toBe(1)
    expect((await probe(result)).text.trim()).toBe('')
  }, 30000)

  it('header dilewati saat profil disembunyikan', async () => {
    const doc = shortDoc()
    const hidden: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section): SectionInstance =>
        section.kind === 'profile' ? { ...section, visible: false } : section,
      ),
    }
    const base = resolveSpec(hidden.templateId, hidden.theme, hidden.settings.page)
    const plan = createPagePlan(hidden, base)
    const header = plan.blocks.find((item) => item.kind === 'header')
    expect(header).toBeUndefined()
    const result = await buildResumePdf(hidden, base, plan, fontFile)
    expect((await probe(result)).text).not.toContain('Alex Morgan')
  }, 30000)

  it('PdfExportError membawa kode untuk pemetaan pesan', () => {
    const error = new PdfExportError('blob', 'gagal')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PdfExportError')
    expect(error.code).toBe('blob')
    expect(error.message).toBe('gagal')
  })
})

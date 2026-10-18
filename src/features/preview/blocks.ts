import { mmToPx, ptToPx } from '@/lib/units'
import type { ResumeDoc, SectionInstance } from '@/types/resume'
import type { SectionKind } from '@/schema/resume'
import {
  entriesOf,
  entryContentOf,
  isBlankEntry,
  profileContact,
  sectionLabel,
  skillGroupLines,
  summaryText,
  type EntriesSection,
} from '@/features/templates/contentLines'
import {
  contactLine,
  headingLabel,
  ruleAdvancePt,
  type TemplateSpec,
  type TypeRole,
} from '@/features/templates/specs'
import { contentBoxOf, type DocBlock } from './pagination'

/**
 * Struktur blok dokumen (T4.2). Satu blok = satu unit yang bisa dipindah utuh
 * antar halaman, dan satu unit pengukuran `ResizeObserver`.
 */

// Faktor lebar karakter ini hanya untuk PERKIRAAN tinggi saat blok belum terukur
// DOM (paint pertama, jsdom). Posisi break final selalu memakai tinggi terukur.
const AVERAGE_CHAR_FACTOR = 0.5

export const linesFor = (text: string, sizePt: number, widthPx: number, indentPx = 0): number => {
  if (text.trim() === '') return 0
  const charPx = ptToPx(sizePt) * AVERAGE_CHAR_FACTOR
  const perLine = Math.max(1, Math.floor((widthPx - indentPx) / charPx))
  return Math.max(1, Math.ceil(text.length / perLine))
}

const linePx = (role: TypeRole, lines: number): number =>
  ptToPx(role.sizePt) * role.lineHeight * lines

export const isEntriesSection = (section: SectionInstance): section is EntriesSection =>
  section.kind !== 'profile' && section.kind !== 'summary' && section.kind !== 'skills'

const itemIdOf = (entry: Record<string, unknown>, index: number): string =>
  typeof entry.id === 'string' ? entry.id : `e${index}`

const gapAfterMm = (block: DocBlock, next: DocBlock | undefined, spec: TemplateSpec): number => {
  if (block.kind === 'header') return spec.gapMm.contactToSection
  if (block.kind === 'section-heading') return spec.gapMm.ruleToBody
  if (!next) return 0
  if (next.sectionId !== block.sectionId) return spec.gapMm.sectionToSection
  if (block.kind === 'entry-head')
    return next.itemId === block.itemId ? spec.gapMm.metaToBody : spec.gapMm.entryToEntry
  if (block.kind === 'entry-line')
    return next.itemId === block.itemId ? spec.gapMm.betweenBullets : spec.gapMm.entryToEntry
  if (block.kind === 'skill-group') return spec.gapMm.betweenBullets
  return spec.gapMm.entryToEntry
}

const headingEstimatePx = (spec: TemplateSpec, label: string, contentWidthPx: number): number => {
  const role = spec.typeScale.heading
  const lines = linesFor(headingLabel(label, spec), role.sizePt, contentWidthPx)
  return (
    linePx(role, lines) +
    mmToPx(spec.gapMm.headingToRule) +
    ptToPx(ruleAdvancePt(spec.headingStyle.rule))
  )
}

export function buildBlocks(doc: ResumeDoc, spec: TemplateSpec): DocBlock[] {
  const { contentWidthPx } = contentBoxOf(spec)
  const lang = doc.settings.language
  const indentPx = mmToPx(spec.gapMm.bulletIndent)
  const blocks: DocBlock[] = []

  const profile = doc.sections.find(
    (section): section is Extract<SectionInstance, { kind: 'profile' }> =>
      section.kind === 'profile' && section.visible,
  )
  if (profile) {
    const data = profile.data
    let height = 0
    const nameLines = linesFor(data.fullName, spec.typeScale.name.sizePt, contentWidthPx)
    if (nameLines > 0)
      height += linePx(spec.typeScale.name, nameLines) + mmToPx(spec.gapMm.nameToHeadline)
    const headlineLines = linesFor(data.headline, spec.typeScale.headline.sizePt, contentWidthPx)
    if (headlineLines > 0)
      height +=
        linePx(spec.typeScale.headline, headlineLines) + mmToPx(spec.gapMm.headlineToContact)
    const contact = contactLine(profileContact(data), spec)
    const contactLines = linesFor(contact, spec.typeScale.contact.sizePt, contentWidthPx)
    if (contactLines > 0) height += linePx(spec.typeScale.contact, contactLines)
    if (height > 0) {
      blocks.push({
        key: `${profile.id}:header`,
        kind: 'header',
        sectionKind: 'profile',
        sectionId: profile.id,
        estimatePx: height,
        padAfterMm: 0,
        minWithNext: 0,
      })
    }
  }

  for (const section of doc.sections) {
    if (!section.visible || section.kind === 'profile') continue
    const body: DocBlock[] = []
    const base = { sectionId: section.id, sectionKind: section.kind as SectionKind }

    if (section.kind === 'summary') {
      const lines = linesFor(summaryText(section), spec.typeScale.body.sizePt, contentWidthPx)
      if (lines > 0)
        body.push({
          ...base,
          key: `${section.id}:summary`,
          kind: 'summary',
          estimatePx: linePx(spec.typeScale.body, lines),
          padAfterMm: 0,
          minWithNext: 0,
        })
    } else if (section.kind === 'skills') {
      for (const group of section.data.groups) {
        const lines = skillGroupLines(group)
        if (lines.length === 0) continue
        let height = 0
        lines.forEach((line, index) => {
          const role = index === 0 ? spec.typeScale.title : spec.typeScale.body
          height += linePx(role, linesFor(line, role.sizePt, contentWidthPx))
          if (index === 0 && lines.length > 1) height += mmToPx(spec.gapMm.titleToMeta)
        })
        body.push({
          ...base,
          key: `${section.id}:${group.id}`,
          kind: 'skill-group',
          itemId: group.id,
          estimatePx: height,
          padAfterMm: 0,
          minWithNext: 0,
        })
      }
    } else if (isEntriesSection(section)) {
      entriesOf(section).forEach((entry, index) => {
        const content = entryContentOf(section.kind, entry, lang)
        if (isBlankEntry(content)) return
        const itemId = itemIdOf(entry, index)
        const rightDates = spec.entryLayout.datePosition === 'right'
        const titleLines = linesFor(content.title, spec.typeScale.title.sizePt, contentWidthPx)
        // Tanggal-kanan (T6.2): tanggal berbagi baris dengan judul, meta baris
        // berikutnya hanya memuat sisa meta (lokasi, dsb).
        const headLineCount = rightDates
          ? Math.max(
              titleLines,
              linesFor(content.dates, spec.typeScale.meta.sizePt, contentWidthPx),
            )
          : titleLines
        const metaLines = linesFor(
          rightDates ? content.metaNoDates : content.meta,
          spec.typeScale.meta.sizePt,
          contentWidthPx,
        )
        let headHeight = linePx(spec.typeScale.title, headLineCount)
        if (metaLines > 0)
          headHeight += mmToPx(spec.gapMm.titleToMeta) + linePx(spec.typeScale.meta, metaLines)
        body.push({
          ...base,
          key: `${section.id}:${itemId}:head`,
          kind: 'entry-head',
          itemId,
          entryLineCount: content.bodyLines.length,
          estimatePx: headHeight,
          padAfterMm: 0,
          minWithNext: Math.min(2, content.bodyLines.length),
        })
        content.bodyLines.forEach((line, lineIndex) => {
          const role = spec.typeScale.body
          const count = linesFor(line.text, role.sizePt, contentWidthPx, line.bullet ? indentPx : 0)
          body.push({
            ...base,
            key: `${section.id}:${itemId}:l${lineIndex}`,
            kind: 'entry-line',
            itemId,
            lineIndex,
            entryLineCount: content.bodyLines.length,
            estimatePx: linePx(role, count),
            padAfterMm: 0,
            minWithNext: 0,
          })
        })
      })
    }

    if (body.length === 0) continue
    blocks.push({
      ...base,
      key: `${section.id}:heading`,
      kind: 'section-heading',
      estimatePx: headingEstimatePx(spec, sectionLabel(section.kind), contentWidthPx),
      padAfterMm: 0,
      minWithNext: 2,
    })
    blocks.push(...body)
  }

  // Estimasi harus memuat ruang setelah blok, sama seperti tinggi terukur yang
  // mencakup padding wrapper — kalau tidak, halaman pertama salah pecah sebelum
  // ResizeObserver sempat melaporkan angka nyata.
  return blocks.map((block, index) => {
    const padAfterMm = gapAfterMm(block, blocks[index + 1], spec)
    return { ...block, padAfterMm, estimatePx: block.estimatePx + mmToPx(padAfterMm) }
  })
}

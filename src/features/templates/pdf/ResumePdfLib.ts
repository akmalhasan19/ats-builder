import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  showText,
  type Color,
  type PDFFont,
  type PDFName,
  type PDFPage,
} from 'pdf-lib'
import {
  entriesOf,
  entryContentOf,
  profileContact,
  sectionLabel,
  skillGroupLines,
  summaryText,
} from '@/features/templates/contentLines'
import {
  contactLine,
  headingLabel,
  type SpecColorKey,
  type TemplateFontKey,
  type TemplateSpec,
  type TypeRole,
} from '@/features/templates/specs'
import { fontFileFor, type PdfFontFamily } from '@/features/pdf/fonts'
import type { PagePlan, DocBlock } from '@/features/preview/pagination'
import type { ResumeDoc, SectionInstance } from '@/types/resume'
import { A4_PT, mmToPt } from '@/lib/units'

export type PdfFontLoader = (file: string) => Promise<Uint8Array>

export type ResumePdfResult = {
  bytes: Uint8Array
  pageCount: number
}

export class PdfExportError extends Error {
  readonly code: 'font' | 'content' | 'blob'

  constructor(code: 'font' | 'content' | 'blob', message: string) {
    super(message)
    this.name = 'PdfExportError'
    this.code = code
  }
}

export const PDF_FONT_FAMILY: Record<TemplateFontKey, PdfFontFamily> = {
  archivo: 'archivo',
  plexSans: 'plex-sans',
  plexMono: 'plex-mono',
}

// Renderer PDF tidak membaca CSS; padanan token §2.2 ini hanya hidup di jalur
// template PDF dan dipilih lewat TemplateSpec, bukan komponen UI.
const PDF_COLORS: Record<SpecColorKey, string> = {
  ink: '#10161F',
  secondary: '#46505E',
  tertiary: '#5F6A77',
  rule: '#D3D9E0',
  accent: '#0F5A78',
  paper: '#FFFFFF',
}

const colorOf = (key: SpecColorKey): Color => {
  const value = PDF_COLORS[key].slice(1)
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  )
}

type TextStyle = {
  role: TypeRole
  color: Color
}

type FontFace = { family: TemplateFontKey; weight: number }

const fontKey = ({ family, weight }: FontFace): string => `${family}|${weight}`

const baselineOffset = (font: PDFFont, sizePt: number, lineHeightPt: number): number =>
  (lineHeightPt - font.heightAtSize(sizePt)) / 2 + font.heightAtSize(sizePt, { descender: false })

const hyphenatedPieces = (word: string, font: PDFFont, sizePt: number, width: number): string[] => {
  if (word.length <= 12 || font.widthOfTextAtSize(word, sizePt) <= width) return [word]

  const pieces: string[] = []
  let rest = word
  while (rest.length > 0) {
    let end = rest.length
    while (end > 1) {
      const suffix = end < rest.length ? '-' : ''
      if (font.widthOfTextAtSize(`${rest.slice(0, end)}${suffix}`, sizePt) <= width) break
      end -= 1
    }
    if (end === rest.length) {
      pieces.push(rest)
      break
    }
    pieces.push(`${rest.slice(0, end)}-`)
    rest = rest.slice(end)
  }
  return pieces
}

/** Membungkus di spasi; kata >12 karakter diberi hyphen bila harus dipecah. */
export function wrapPdfLines(
  text: string,
  font: PDFFont,
  sizePt: number,
  maxWidthPt: number,
): string[] {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const pieces = hyphenatedPieces(word, font, sizePt, maxWidthPt)
    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece
      if (current && font.widthOfTextAtSize(candidate, sizePt) > maxWidthPt) {
        lines.push(current)
        current = piece
      } else {
        current = candidate
      }
    }
  }
  if (current) lines.push(current)
  return lines
}

class PageWriter {
  private readonly contentWidthPt: number
  private cursorY: number
  private readonly page: PDFPage
  private readonly fonts: Map<string, PDFFont>
  private readonly spec: TemplateSpec
  private readonly trackedKeys = new Map<PDFFont, PDFName>()

  constructor(page: PDFPage, fonts: Map<string, PDFFont>, spec: TemplateSpec) {
    this.page = page
    this.fonts = fonts
    this.spec = spec
    const marginPt = mmToPt(spec.marginMm)
    this.contentWidthPt = A4_PT.w - marginPt * 2
    this.cursorY = A4_PT.h - marginPt
  }

  private get marginPt(): number {
    return mmToPt(this.spec.marginMm)
  }

  private font(role: TypeRole): PDFFont {
    const font = this.fonts.get(fontKey({ family: role.font, weight: role.weight }))
    if (!font)
      throw new PdfExportError('font', `Font PDF belum di-embed: ${role.font} ${role.weight}`)
    return font
  }

  /**
   * Tracking digambar sebagai character spacing PDF (`Tc`), bukan per karakter:
   * teksnya tetap satu string utuh sehingga parser membaca "PENGALAMAN", bukan
   * huruf demi huruf. Kunci resource diambil sekali per font per halaman.
   */
  private fontResourceKey(font: PDFFont): PDFName {
    const cached = this.trackedKeys.get(font)
    if (cached) return cached
    const key = this.page.node.newFontDictionary(font.name, font.ref)
    this.trackedKeys.set(font, key)
    return key
  }

  private drawTracked(text: string, x: number, y: number, style: TextStyle, font: PDFFont): void {
    if (style.role.trackingEm === 0) {
      this.page.drawText(text, { x, y, size: style.role.sizePt, font, color: style.color })
      return
    }
    this.page.pushOperators(
      pushGraphicsState(),
      setFillingColor(style.color),
      beginText(),
      setFontAndSize(this.fontResourceKey(font), style.role.sizePt),
      setTextMatrix(1, 0, 0, 1, x, y),
      setCharacterSpacing(style.role.trackingEm * style.role.sizePt),
      showText(font.encodeText(text)),
      endText(),
      popGraphicsState(),
    )
  }

  paragraph(
    text: string,
    style: TextStyle,
    options: { indentPt?: number; align?: 'left' | 'center' } = {},
  ): void {
    if (text.trim() === '') return
    const indentPt = options.indentPt ?? 0
    const align = options.align ?? 'left'
    const font = this.font(style.role)
    const maxWidth = this.contentWidthPt - indentPt
    const lineHeight = style.role.sizePt * style.role.lineHeight

    for (const line of wrapPdfLines(text, font, style.role.sizePt, maxWidth)) {
      const width = font.widthOfTextAtSize(line, style.role.sizePt)
      const x =
        this.marginPt + indentPt + (align === 'center' ? Math.max(0, (maxWidth - width) / 2) : 0)
      const baseline = this.cursorY - baselineOffset(font, style.role.sizePt, lineHeight)
      this.drawTracked(line, x, baseline, style, font)
      this.cursorY -= lineHeight
    }
  }

  bullet(text: string, style: TextStyle): void {
    if (text.trim() === '') return
    const font = this.font(style.role)
    const indentPt = mmToPt(this.spec.gapMm.bulletIndent)
    const lineHeight = style.role.sizePt * style.role.lineHeight
    const lines = wrapPdfLines(text, font, style.role.sizePt, this.contentWidthPt - indentPt)

    lines.forEach((line, index) => {
      const baseline = this.cursorY - baselineOffset(font, style.role.sizePt, lineHeight)
      if (index === 0) {
        this.page.drawText(this.spec.bulletGlyph, {
          x: this.marginPt,
          y: baseline,
          size: style.role.sizePt,
          font,
          color: style.color,
        })
      }
      this.page.drawText(line, {
        x: this.marginPt + indentPt,
        y: baseline,
        size: style.role.sizePt,
        font,
        color: style.color,
      })
      this.cursorY -= lineHeight
    })
  }

  gap(mm: number): void {
    this.cursorY -= mmToPt(mm)
  }

  rule(): void {
    const rule = this.spec.headingStyle.rule
    if (rule.kind === 'none') return
    const color = colorOf(rule.color)
    const height = rule.widthPt
    const y = this.cursorY - height
    if (rule.kind === 'solid') {
      this.page.drawRectangle({ x: this.marginPt, y, width: this.contentWidthPt, height, color })
    } else if (rule.kind === 'double') {
      this.page.drawRectangle({ x: this.marginPt, y, width: this.contentWidthPt, height, color })
      this.page.drawRectangle({
        x: this.marginPt,
        y: y - height * 2,
        width: this.contentWidthPt,
        height,
        color,
      })
      this.cursorY -= height * 2
    } else {
      const dotWidth = Math.max(height, 0.5)
      const gap = dotWidth * 2
      for (let x = this.marginPt; x < this.marginPt + this.contentWidthPt; x += dotWidth + gap) {
        this.page.drawRectangle({
          x,
          y,
          width: Math.min(dotWidth, this.marginPt + this.contentWidthPt - x),
          height,
          color,
        })
      }
    }
    this.cursorY -= height
  }

  assertWithinPage(block: DocBlock): void {
    if (this.cursorY < this.marginPt - 0.5) {
      throw new PdfExportError('content', `Konten blok ${block.key} melewati batas halaman.`)
    }
  }
}

const sectionFor = (doc: ResumeDoc, sectionId: string): SectionInstance | undefined =>
  doc.sections.find((section) => section.id === sectionId)

const profileFor = (doc: ResumeDoc): Extract<SectionInstance, { kind: 'profile' }> | undefined =>
  doc.sections.find(
    (section): section is Extract<SectionInstance, { kind: 'profile' }> =>
      section.kind === 'profile' && section.visible,
  )

function drawBlock(writer: PageWriter, doc: ResumeDoc, block: DocBlock, spec: TemplateSpec): void {
  const style = (role: TypeRole, color: SpecColorKey): TextStyle => ({
    role,
    color: colorOf(color),
  })
  const section = sectionFor(doc, block.sectionId)
  if (!section) return

  if (block.kind === 'header') {
    const profile = profileFor(doc)
    if (!profile) return
    writer.paragraph(profile.data.fullName, style(spec.typeScale.name, spec.colors.name), {
      align: spec.nameAlign,
    })
    writer.gap(spec.gapMm.nameToHeadline)
    writer.paragraph(profile.data.headline, style(spec.typeScale.headline, spec.colors.headline), {
      align: spec.nameAlign,
    })
    writer.gap(spec.gapMm.headlineToContact)
    writer.paragraph(
      contactLine(profileContact(profile.data), spec),
      style(spec.typeScale.contact, spec.colors.contact),
      {
        align: spec.contactStyle.align,
      },
    )
  } else if (block.kind === 'section-heading') {
    writer.paragraph(
      headingLabel(sectionLabel(section.kind), spec),
      style(spec.typeScale.heading, spec.colors.heading),
    )
    writer.gap(spec.gapMm.headingToRule)
    writer.rule()
  } else if (block.kind === 'summary') {
    writer.paragraph(summaryText(section), style(spec.typeScale.body, spec.colors.body))
  } else if (block.kind === 'skill-group' && section.kind === 'skills') {
    const group = section.data.groups.find((item) => item.id === block.itemId)
    const lines = group ? skillGroupLines(group) : []
    const [name, ...items] = lines
    if (name) writer.paragraph(name, style(spec.typeScale.title, spec.colors.entryTitle))
    if (items.length > 0) {
      writer.gap(spec.gapMm.titleToMeta)
      writer.paragraph(items.join(', '), style(spec.typeScale.body, spec.colors.body))
    }
  } else if (
    section.kind !== 'profile' &&
    section.kind !== 'summary' &&
    section.kind !== 'skills'
  ) {
    const entry = entriesOf(section).find((item) => item.id === block.itemId)
    if (!entry) return
    const content = entryContentOf(section.kind, entry, doc.settings.language)
    if (block.kind === 'entry-head') {
      writer.paragraph(content.title, style(spec.typeScale.title, spec.colors.entryTitle))
      if (content.meta) {
        writer.gap(spec.gapMm.titleToMeta)
        writer.paragraph(content.meta, style(spec.typeScale.meta, spec.colors.entryMeta))
      }
    } else if (block.kind === 'entry-line') {
      const line = content.bodyLines[block.lineIndex ?? 0]
      if (!line) return
      if (line.bullet) writer.bullet(line.text, style(spec.typeScale.body, spec.colors.body))
      else
        writer.paragraph(line.text, style(spec.typeScale.body, spec.colors.body), {
          indentPt: mmToPt(spec.gapMm.bulletIndent),
        })
    }
  }

  writer.gap(block.padAfterMm)
  writer.assertWithinPage(block)
}

async function embedFonts(
  doc: PDFDocument,
  spec: TemplateSpec,
  loadFontFile: PdfFontLoader,
): Promise<Map<string, PDFFont>> {
  const faces = new Map<string, FontFace>()
  for (const role of Object.values(spec.typeScale)) {
    const face = { family: role.font, weight: role.weight }
    faces.set(fontKey(face), face)
  }

  const fonts = new Map<string, PDFFont>()
  for (const [key, face] of faces) {
    let bytes: Uint8Array
    try {
      bytes = await loadFontFile(fontFileFor(PDF_FONT_FAMILY[face.family], face.weight))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new PdfExportError('font', message)
    }
    fonts.set(key, await doc.embedFont(bytes))
  }
  return fonts
}

export async function buildResumePdf(
  doc: ResumeDoc,
  spec: TemplateSpec,
  plan: PagePlan,
  loadFontFile: PdfFontLoader,
): Promise<ResumePdfResult> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const profile = profileFor(doc)?.data
  const fullName = profile?.fullName.trim() || doc.title
  const headline = profile?.headline.trim() || ''
  pdf.setTitle(headline ? `${fullName} — ${headline}` : fullName)
  pdf.setAuthor(fullName)
  pdf.setSubject('Resume')
  pdf.setCreator('Resume Studio')

  const fonts = await embedFonts(pdf, spec, loadFontFile)
  for (const pageBlocks of plan.pages) {
    const page = pdf.addPage([A4_PT.w, A4_PT.h])
    const writer = new PageWriter(page, fonts, spec)
    for (const block of pageBlocks) drawBlock(writer, doc, block, spec)
  }

  return { bytes: await pdf.save(), pageCount: pdf.getPageCount() }
}

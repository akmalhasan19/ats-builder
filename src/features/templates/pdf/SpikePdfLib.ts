import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib'
import { fontFileFor, type PdfFontFamily, type PdfFontStyle } from '@/features/pdf/fonts'
import { A4_PT, mmToPt } from '@/lib/units'
import type { SpikeContent, SpikeRenderOptions } from '../spikeContent'
import { formatContactLine, headingLabel, spikeSpec, type SpikeFontKey } from '../spikeSpec'

const spec = spikeSpec

/** pdf-lib hanya menerima byte mentah; browser dan Node punya cara ambilnya sendiri. */
export type PdfFontLoader = (file: string) => Promise<Uint8Array>

export type SpikePdfResult = {
  bytes: Uint8Array
  pageCount: number
}

const PDF_FAMILY: Record<SpikeFontKey, PdfFontFamily> = {
  archivo: 'archivo',
  plexSans: 'plex-sans',
  plexMono: 'plex-mono',
}

const toColor = (hex: string): Color => {
  const value = hex.replace('#', '')
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  )
}

/**
 * Pemecahan baris milik kita sendiri — konsekuensi §10(c). Hanya pecah di spasi,
 * dan kata yang lebih lebar dari kolom dibiarkan utuh, supaya tidak ada teks yang
 * hilang (cacat yang membuat @react-pdf/renderer ditinggalkan).
 */
export function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ').filter((word) => word.length > 0)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)

  return lines.length > 0 ? lines : ['']
}

/**
 * Jarak tepi atas kotak baris ke baseline, memakai model half-leading CSS:
 * (lineHeight - contentArea) / 2 + ascent. `heightAtSize` pdf-lib memberi
 * contentArea = (ascent + descent) × size.
 */
const baselineOffset = (font: PDFFont, size: number, lineHeight: number): number =>
  (lineHeight - font.heightAtSize(size)) / 2 + font.heightAtSize(size, { descender: false })

type TextStyle = {
  family: SpikeFontKey
  weight: number
  style?: PdfFontStyle
  sizePt: number
  lineHeight: number
  color: Color
  trackingEm?: number
}

export class SheetWriter {
  private readonly marginPt = mmToPt(spec.marginMm)
  private readonly contentWidthPt = A4_PT.w - mmToPt(spec.marginMm) * 2
  private readonly doc: PDFDocument
  private readonly fonts: Map<string, PDFFont>
  private readonly repeatHeader: boolean
  private readonly drawHeader: (writer: SheetWriter) => void
  private page: PDFPage
  private boxTop: number

  constructor(
    doc: PDFDocument,
    fonts: Map<string, PDFFont>,
    repeatHeader: boolean,
    drawHeader: (writer: SheetWriter) => void,
  ) {
    this.doc = doc
    this.fonts = fonts
    this.repeatHeader = repeatHeader
    this.drawHeader = drawHeader
    this.boxTop = A4_PT.h - this.marginPt
    this.page = this.doc.addPage([A4_PT.w, A4_PT.h])
  }

  private startPage(): void {
    this.page = this.doc.addPage([A4_PT.w, A4_PT.h])
    this.boxTop = A4_PT.h - this.marginPt
    if (this.repeatHeader) this.drawHeader(this)
  }

  private font(style: TextStyle): PDFFont {
    const key = `${style.family}|${style.weight}|${style.style ?? 'normal'}`
    const font = this.fonts.get(key)
    if (!font) throw new Error(`font belum di-embed: ${key}`)
    return font
  }

  private line(text: string, style: TextStyle, indentPt: number): void {
    const font = this.font(style)
    const lineHeight = style.sizePt * style.lineHeight
    if (this.boxTop - lineHeight < this.marginPt) this.startPage()

    const baseline = this.boxTop - baselineOffset(font, style.sizePt, lineHeight)
    const x = this.marginPt + indentPt

    if (style.trackingEm) {
      // pdf-lib tidak punya letter-spacing; tracking CSS ditiru karakter per karakter.
      let cursor = x
      for (const char of text) {
        this.page.drawText(char, {
          x: cursor,
          y: baseline,
          size: style.sizePt,
          font,
          color: style.color,
        })
        cursor += font.widthOfTextAtSize(char, style.sizePt) + style.trackingEm * style.sizePt
      }
    } else {
      this.page.drawText(text, {
        x,
        y: baseline,
        size: style.sizePt,
        font,
        color: style.color,
      })
    }

    this.boxTop -= lineHeight
  }

  paragraph(text: string, style: TextStyle, indentPt = 0): void {
    const font = this.font(style)
    for (const line of wrapLines(text, font, style.sizePt, this.contentWidthPt - indentPt)) {
      this.line(line, style, indentPt)
    }
  }

  /** Bullet dengan hanging indent: glyph di tepi kiri, teks bergeser ke kanan. */
  bullet(text: string, style: TextStyle): void {
    const font = this.font(style)
    const indentPt = mmToPt(spec.bulletIndentMm)
    const lines = wrapLines(text, font, style.sizePt, this.contentWidthPt - indentPt)
    const lineHeight = style.sizePt * style.lineHeight

    lines.forEach((line, index) => {
      if (this.boxTop - lineHeight < this.marginPt) this.startPage()
      const baseline = this.boxTop - baselineOffset(font, style.sizePt, lineHeight)
      if (index === 0) {
        this.page.drawText(spec.bulletGlyph, {
          x: this.marginPt,
          y: baseline,
          size: style.sizePt,
          font,
          color: toColor(spec.colors.ink),
        })
      }
      this.page.drawText(line, {
        x: this.marginPt + indentPt,
        y: baseline,
        size: style.sizePt,
        font,
        color: style.color,
      })
      this.boxTop -= lineHeight
    })
  }

  rule(heightPt: number, color: Color): void {
    if (this.boxTop - heightPt < this.marginPt) this.startPage()
    this.page.drawRectangle({
      x: this.marginPt,
      y: this.boxTop - heightPt,
      width: this.contentWidthPt,
      height: heightPt,
      color,
    })
    this.boxTop -= heightPt
  }

  gap(pt: number): void {
    this.boxTop -= pt
  }
}

type FaceKey = { family: SpikeFontKey; weight: number; style?: PdfFontStyle }

const fontKeyOf = (face: FaceKey): string =>
  `${face.family}|${face.weight}|${face.style ?? 'normal'}`

async function embedFonts(
  doc: PDFDocument,
  loadFontFile: PdfFontLoader,
): Promise<Map<string, PDFFont>> {
  const wanted: FaceKey[] = [
    { family: spec.fonts.name, weight: spec.type.nameWeight },
    { family: spec.fonts.heading, weight: spec.type.headingWeight },
    { family: spec.fonts.body, weight: spec.type.headlineWeight },
    { family: spec.fonts.body, weight: spec.type.titleWeight },
    { family: spec.fonts.body, weight: spec.type.bodyWeight },
    { family: spec.fonts.meta, weight: 400 },
  ]

  const fonts = new Map<string, PDFFont>()
  for (const face of wanted) {
    const key = fontKeyOf(face)
    if (fonts.has(key)) continue
    const bytes = await loadFontFile(fontFileFor(PDF_FAMILY[face.family], face.weight, face.style))
    fonts.set(key, await doc.embedFont(bytes))
  }
  return fonts
}

export async function buildSpikePdf(
  content: SpikeContent,
  options: SpikeRenderOptions,
  loadFontFile: PdfFontLoader,
): Promise<SpikePdfResult> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await embedFonts(doc, loadFontFile)

  const ink = toColor(spec.colors.ink)
  const secondary = toColor(spec.colors.secondary)
  const tertiary = toColor(spec.colors.tertiary)

  const nameStyle: TextStyle = {
    family: spec.fonts.name,
    weight: spec.type.nameWeight,
    sizePt: spec.type.namePt,
    lineHeight: spec.lineHeight.name,
    color: ink,
  }
  const headlineStyle: TextStyle = {
    family: spec.fonts.body,
    weight: spec.type.headlineWeight,
    sizePt: spec.type.headlinePt,
    lineHeight: spec.lineHeight.headline,
    color: secondary,
  }
  const contactStyle: TextStyle = {
    family: spec.fonts.body,
    weight: spec.type.bodyWeight,
    sizePt: spec.type.contactPt,
    lineHeight: spec.lineHeight.body,
    color: secondary,
  }

  const drawHeader = (writer: SheetWriter): void => {
    writer.paragraph(content.name, nameStyle)
    writer.gap(mmToPt(spec.gapMm.nameToHeadline))
    writer.paragraph(content.headline, headlineStyle)
    writer.gap(mmToPt(spec.gapMm.headlineToContact))
    writer.paragraph(formatContactLine(content.contact, spec), contactStyle)
  }

  const writer = new SheetWriter(doc, fonts, options.repeatHeader, drawHeader)
  drawHeader(writer)
  writer.gap(mmToPt(spec.gapMm.contactToFirstSection))

  content.sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) writer.gap(mmToPt(spec.gapMm.betweenSections))

    writer.paragraph(headingLabel(section.heading, spec), {
      family: spec.fonts.heading,
      weight: spec.type.headingWeight,
      sizePt: spec.type.headingPt,
      lineHeight: spec.lineHeight.body,
      color: ink,
      trackingEm: spec.type.headingTrackingEm,
    })
    writer.gap(mmToPt(spec.gapMm.headingToRule))
    writer.rule(spec.type.headingRulePt, ink)
    writer.gap(mmToPt(spec.gapMm.ruleToBody))

    for (const entry of section.entries) {
      writer.paragraph(entry.title, {
        family: spec.fonts.body,
        weight: spec.type.titleWeight,
        sizePt: spec.type.bodyPt,
        lineHeight: spec.lineHeight.body,
        color: ink,
      })
      writer.paragraph(`${entry.org} · ${entry.location}`, {
        family: spec.fonts.meta,
        weight: 400,
        sizePt: spec.type.metaPt,
        lineHeight: spec.lineHeight.body,
        color: secondary,
      })
      writer.paragraph(entry.dateLabel, {
        family: spec.fonts.meta,
        weight: 400,
        sizePt: spec.type.metaPt,
        lineHeight: spec.lineHeight.body,
        color: tertiary,
      })
      writer.gap(mmToPt(spec.gapMm.metaToBullets))

      for (const bullet of entry.bullets) {
        writer.bullet(bullet, {
          family: spec.fonts.body,
          weight: spec.type.bodyWeight,
          sizePt: spec.type.bodyPt,
          lineHeight: spec.lineHeight.body,
          color: secondary,
        })
      }
    }
  })

  const bytes = await doc.save()
  return { bytes, pageCount: doc.getPageCount() }
}

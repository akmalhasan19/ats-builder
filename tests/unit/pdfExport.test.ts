/**
 * Fase 5 — kontrak ekspor PDF.
 *
 * Yang bisa dan perlu diperiksa unit adalah janji-janji murni jalur ini: nama
 * berkas, pemetaan error ke pesan manusiawi, dan aturan pembungkusan baris yang
 * tidak boleh membuang karakter apa pun (pembungkus baris milik kita sendiri
 * sejak engine pindah ke pdf-lib).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFFont } from 'pdf-lib'
import { beforeAll, describe, expect, it } from 'vitest'
import { pdfErrorKey, pdfFilename } from '@/features/pdf/exportPdf'
import { fontFileFor } from '@/features/pdf/fonts'
import { wrapPdfLines } from '@/features/templates/pdf/ResumePdfLib'
import { tokenize } from '@/lib/text'
import { createEmptyDoc, createSampleDoc } from '@/schema/resume'
import type { ResumeDoc } from '@/types/resume'

let font: PDFFont

beforeAll(async () => {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const bytes = readFileSync(path.resolve('public/fonts', fontFileFor('plex-sans', 400)))
  font = await pdf.embedFont(new Uint8Array(bytes))
})

const widthOf = (text: string, size = 10) => font.widthOfTextAtSize(text, size)

describe('pdfFilename', () => {
  it('memakai nama lengkap + template, diciutkan jadi slug', () => {
    expect(pdfFilename(createSampleDoc())).toBe('alex-morgan-classic-ats.pdf')
  })

  it('jatuh ke judul dokumen bila nama masih kosong', () => {
    const doc = createEmptyDoc()
    doc.title = 'CV Ku'
    doc.templateId = 'ledger'
    expect(pdfFilename(doc)).toBe('cv-ku-ledger.pdf')
  })

  it('tetap menghasilkan nama berkas walau dokumen benar-benar kosong', () => {
    const doc: ResumeDoc = { ...createEmptyDoc(), templateId: 'technician' }
    expect(pdfFilename(doc)).toBe('resume-technician.pdf')
  })
})

describe('pdfErrorKey', () => {
  it('memetakan kode error renderer ke pesan dictionary, bukan stack trace', () => {
    expect(pdfErrorKey(Object.assign(new Error('x'), { code: 'font' }))).toBe('pdf.error.font')
    expect(pdfErrorKey(Object.assign(new Error('x'), { code: 'content' }))).toBe(
      'pdf.error.content',
    )
    expect(pdfErrorKey(Object.assign(new Error('x'), { code: 'blob' }))).toBe('pdf.error.blob')
    expect(pdfErrorKey(new Error('x'))).toBe('pdf.error.failed')
    expect(pdfErrorKey('bukan error')).toBe('pdf.error.failed')
  })
})

describe('wrapPdfLines', () => {
  it('membungkus di spasi tanpa mengubah kata', () => {
    const text = 'Memimpin migrasi layanan pembayaran lintas tim dan zona waktu.'
    const lines = wrapPdfLines(text, font, 10, 120)
    expect(lines.length).toBeGreaterThan(1)
    expect(tokenize(lines.join(' '))).toEqual(tokenize(text))
  })

  it('menyisipkan hyphen hanya untuk kata panjang yang tidak muat', () => {
    const word = 'Mengoordinasikan'
    const lines = wrapPdfLines(word, font, 10, 40)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[0]!.endsWith('-')).toBe(true)
    expect(lines.join('').replace(/-/gu, '')).toBe(word)
  })

  it('tidak memecah kata 12 karakter atau kurang walau sempit', () => {
    const word = 'ABCDEFGHIJKL'
    expect(word).toHaveLength(12)
    expect(widthOf(word)).toBeGreaterThan(30)
    expect(wrapPdfLines(word, font, 10, 30)).toEqual([word])
  })

  it('tidak kehilangan karakter pada teks diakritik yang panjang', () => {
    const text =
      'Mengoordinasikan migrasi résumés untuk Zürich, São Paulo, dan Łódź tanpa kehilangan glyph.'
    const lines = wrapPdfLines(text, font, 10, 90)
    expect(lines.join('').replace(/-/gu, '').replace(/\s+/gu, '')).toBe(text.replace(/\s+/gu, ''))
  })
})

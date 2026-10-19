/**
 * T7.5 — stabilo kata kunci di PDF.
 *
 * Default mati: tanpa `keywords`, PDF harus identik (tidak ada kotak tambahan).
 * Ketika dinyalakan, kotak stabilo ditambahkan TAPI teksnya tidak boleh rusak —
 * text layer tetap terbaca berurutan. Karena itu tes ini mengekstrak teks dengan
 * pdfjs, bukan sekadar membandingkan ukuran berkas.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { buildResumePdf } from '@/features/templates/pdf/ResumePdfLib'
import { resolveSpec } from '@/features/templates/specs'
import { sampleResume } from '../fixtures/sampleResume'
import type { ResumeDoc } from '@/types/resume'

const fontFile = (file: string) =>
  Promise.resolve(new Uint8Array(readFileSync(path.resolve('public/fonts', file))))

const render = async (doc: ResumeDoc, keywords: readonly string[]) => {
  const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
  const plan = createPagePlan(doc, spec)
  return buildResumePdf(doc, spec, plan, fontFile, { keywords })
}

const textOf = async (bytes: Uint8Array): Promise<string> => {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
  const pdf = await task.promise
  let text = ''
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const content = await (await pdf.getPage(index)).getTextContent()
    for (const item of content.items) {
      if ('str' in item) text += `${item.str} `
    }
  }
  await task.destroy()
  return text
}

/** Jumlah operasi gambar di halaman 1 — kotak stabilo menambah operasi. */
const opsCount = async (bytes: Uint8Array): Promise<number> => {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
  const pdf = await task.promise
  const page = await pdf.getPage(1)
  const ops = await page.getOperatorList()
  await task.destroy()
  return ops.fnArray.length
}

let plain: Uint8Array
let marked: Uint8Array

beforeAll(async () => {
  const doc = sampleResume()
  plain = (await render(doc, [])).bytes
  marked = (await render(doc, ['TypeScript', 'React', 'Kubernetes'])).bytes
})

describe('stabilo PDF — default netral', () => {
  it('tanpa kata kunci, PDF memakai jumlah operasi gambar yang sama seperti acuan', async () => {
    const again = await render(sampleResume(), [])
    expect(await opsCount(again.bytes)).toBe(await opsCount(plain))
  })

  it('teks tetap utuh & berurutan walau tanpa stabilo', async () => {
    const text = await textOf(plain)
    expect(text).toContain('Alex Morgan')
    expect(text).toContain('PENGALAMAN')
    expect(text).toContain('Led migration of a monolithic checkout flow')
  })
})

describe('stabilo PDF — saat dinyalakan', () => {
  it('kotak stabilo ikut tergambar', async () => {
    const markedOps = await opsCount(marked)
    const plainOps = await opsCount(plain)
    expect(markedOps).toBeGreaterThan(plainOps)
  })

  it('text layer tidak rusak oleh stabilo', async () => {
    const text = await textOf(marked)
    expect(text).toContain('Alex Morgan')
    expect(text).toContain('Led migration of a monolithic checkout flow')
    expect(text).toContain('TypeScript')
  })

  it('tidak ada kata yang hilang stabilo vs netral (hanya jumlah kotak berbeda)', async () => {
    const plainText = (await textOf(plain)).trim().split(/\s+/)
    const markedText = (await textOf(marked)).trim().split(/\s+/)
    expect(markedText.length).toBe(plainText.length)
  })
})

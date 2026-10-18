/**
 * `pnpm pdf:verify` — bukti Gate Fase 0 untuk spike PDF.
 *
 * Merender dokumen spike di Node, mengekstrak teksnya dengan pdfjs, lalu
 * membuktikan: PDF berbasis teks (bukan raster), urutan baca benar, ukuran
 * halaman A4 tepat, margin kiri & ukuran font sesuai spikeSpec (±1 mm),
 * page-break otomatis jalan, dan prop `fixed` mengulang header.
 *
 * Artefak ditulis ke `artifacts/` (di-gitignore) sebagai lampiran bukti.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { registerPdfFonts } from '@/features/pdf/fonts'
import { SpikeDocument } from '@/features/templates/pdf/SpikeDocument'
import {
  makeLongSpikeContent,
  spikeContent,
  type SpikeContent,
  type SpikeRenderOptions,
} from '@/features/templates/spikeContent'
import { formatContactLine, headingLabel, spikeSpec } from '@/features/templates/spikeSpec'
import { A4_PT, TOLERANCE_PT, mmToPt } from '@/lib/units'

const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts')
const LONG_BULLET_COUNT = 60

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

const check = (name: string, pass: boolean, detail: string): void => {
  checks.push({ name, pass, detail })
}

const closeTo = (actual: number, expected: number, tolerance: number): boolean =>
  Math.abs(actual - expected) <= tolerance

/** Buang semua non-alfanumerik supaya perbedaan spasi/pungtuasi tidak menggagalkan uji. */
const norm = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

type PdfLine = { baselineY: number; text: string; maxSizePt: number; minX: number }

type ExtractedItem = { str: string; transform: number[] }

async function extractLines(pageNumber: number, data: Uint8Array): Promise<PdfLine[]> {
  // pdfjs melepas (detach) buffer data, jadi selalu kirim salinan.
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    verbosity: 0,
  })
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(pageNumber)
  const content = await page.getTextContent()
  await page.cleanup()
  await loadingTask.destroy()

  const buckets = new Map<number, ExtractedItem[]>()
  for (const item of content.items) {
    if (!('str' in item)) continue
    const textItem = item as ExtractedItem
    if (!textItem.str.trim()) continue
    const bucketKey = Math.round(textItem.transform[5]! * 2) / 2
    const bucket = buckets.get(bucketKey)
    if (bucket) bucket.push(textItem)
    else buckets.set(bucketKey, [textItem])
  }

  return [...buckets.values()]
    .map((items) => {
      const ordered = [...items].sort((a, b) => a.transform[4]! - b.transform[4]!)
      // Rata-rata baseline asli, bukan kunci bucket yang dibulatkan ke 0.5 pt,
      // supaya jarak antar-baris terukur tanpa noise pembulatan.
      const baselineY = ordered.reduce((sum, item) => sum + item.transform[5]!, 0) / ordered.length
      return {
        baselineY,
        text: ordered.map((item) => item.str).join(' '),
        maxSizePt: Math.max(...ordered.map((item) => Math.abs(item.transform[3]!))),
        minX: Math.min(...ordered.map((item) => item.transform[4]!)),
      }
    })
    .sort((a, b) => b.baselineY - a.baselineY)
}

async function pageSizes(data: Uint8Array): Promise<{ width: number; height: number }[]> {
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    verbosity: 0,
  })
  const pdfDoc = await loadingTask.promise
  const sizes: { width: number; height: number }[] = []
  for (let index = 1; index <= pdfDoc.numPages; index += 1) {
    const page = await pdfDoc.getPage(index)
    const viewport = page.getViewport({ scale: 1 })
    sizes.push({ width: viewport.width, height: viewport.height })
    await page.cleanup()
  }
  await loadingTask.destroy()
  return sizes
}

function expectedReadingOrder(content: SpikeContent): string[] {
  return [
    content.name,
    content.headline,
    formatContactLine(content.contact, spikeSpec),
    ...content.sections.flatMap((section) => [
      headingLabel(section.heading, spikeSpec),
      ...section.entries.flatMap((entry) => [
        entry.title,
        `${entry.org} · ${entry.location}`,
        entry.dateLabel,
        ...entry.bullets,
      ]),
    ]),
  ]
}

async function renderSpike(
  content: SpikeContent,
  options: SpikeRenderOptions,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<SpikeDocument content={content} options={options} />)
  return new Uint8Array(buffer)
}

async function main(): Promise<void> {
  await mkdir(ARTIFACT_DIR, { recursive: true })
  registerPdfFonts((file) => path.resolve(process.cwd(), 'public/fonts', file))

  const spec = spikeSpec
  const marginPt = mmToPt(spec.marginMm)
  const bodyLineHeightPt = spec.type.bodyPt * spec.lineHeight.body

  // ---- 1. dokumen pendek: 1 halaman -------------------------------------
  const shortStartedAt = performance.now()
  const shortData = await renderSpike(spikeContent, { repeatHeader: false })
  const shortMs = Math.round(performance.now() - shortStartedAt)
  const shortPdfPath = path.join(ARTIFACT_DIR, 'spike-a4.pdf')
  await writeFile(shortPdfPath, shortData)

  check(
    'magic bytes %PDF',
    String.fromCharCode(shortData[0]!, shortData[1]!, shortData[2]!, shortData[3]!) === '%PDF',
    `${shortData[0]!} ${shortData[1]!} ${shortData[2]!} ${shortData[3]!}`,
  )

  const shortSizes = await pageSizes(shortData)
  check('jumlah halaman dokumen pendek', shortSizes.length === 1, `${shortSizes.length} halaman`)

  const firstSize = shortSizes[0]!
  check(
    'ukuran halaman A4 (pt)',
    closeTo(firstSize.width, A4_PT.w, 0.5) && closeTo(firstSize.height, A4_PT.h, 0.5),
    `${firstSize.width.toFixed(2)} × ${firstSize.height.toFixed(2)} pt, harap ${A4_PT.w} × ${A4_PT.h}`,
  )

  const shortLines = await extractLines(1, shortData)
  const shortText = shortLines.map((line) => line.text).join(' ')
  await writeFile(
    path.join(ARTIFACT_DIR, 'spike-a4-text.txt'),
    shortLines.map((l) => l.text).join('\n'),
  )

  check(
    'teks bisa diekstrak (bukan raster)',
    shortText.trim().length > 0,
    `${shortText.length} karakter`,
  )
  check(
    'tidak ada glyph pecah (U+FFFD)',
    !shortText.includes('\uFFFD'),
    shortText.includes('\uFFFD') ? 'ditemukan replacement character' : 'bersih',
  )

  const leftMarginPt = Math.min(...shortLines.map((line) => line.minX))
  check(
    `margin kiri teks = ${spec.marginMm} mm (±1 mm)`,
    closeTo(leftMarginPt, marginPt, TOLERANCE_PT),
    `${leftMarginPt.toFixed(2)} pt, harap ${marginPt.toFixed(2)} pt`,
  )

  const topLine = shortLines[0]!
  check(
    'baris pertama adalah nama',
    norm(topLine.text) === norm(spikeContent.name),
    `"${topLine.text}"`,
  )
  check(
    `ukuran font nama = ${spec.type.namePt} pt`,
    closeTo(topLine.maxSizePt, spec.type.namePt, 0.2),
    `${topLine.maxSizePt.toFixed(2)} pt`,
  )

  const headingLine = shortLines.find(
    (line) => norm(line.text) === norm(headingLabel(spikeContent.sections[0]!.heading, spec)),
  )
  check(
    `ukuran font heading = ${spec.type.headingPt} pt`,
    headingLine !== undefined && closeTo(headingLine.maxSizePt, spec.type.headingPt, 0.2),
    headingLine ? `${headingLine.maxSizePt.toFixed(2)} pt` : 'heading tidak ditemukan',
  )

  const bulletSizes = shortLines
    .filter((line) => line.text.startsWith(spec.bulletGlyph))
    .map((line) => line.maxSizePt)
  check(
    `ukuran font body/bullet = ${spec.type.bodyPt} pt`,
    bulletSizes.length > 0 && bulletSizes.every((size) => closeTo(size, spec.type.bodyPt, 0.2)),
    bulletSizes.length > 0
      ? bulletSizes.map((s) => s.toFixed(2)).join(', ') + ' pt'
      : 'tidak ada bullet',
  )

  // line-height: jarak baseline antar baris dalam satu bullet yang wrap.
  // Bebas dari pengaruh ascender font, jadi sah dibandingkan dengan CSS line-height.
  const baselines = shortLines.map((line) => line.baselineY)
  const deltas = baselines
    .slice(1)
    .map((baseline, index) => Math.abs(baseline - baselines[index]!))
    .filter((delta) => delta > 0.5)
  const smallestDelta = deltas.length > 0 ? Math.min(...deltas) : Number.NaN
  check(
    `line-height body = ${spec.lineHeight.body} × ${spec.type.bodyPt} pt`,
    Number.isFinite(smallestDelta) && closeTo(smallestDelta, bodyLineHeightPt, 0.25),
    `${smallestDelta.toFixed(2)} pt, harap ${bodyLineHeightPt.toFixed(2)} pt`,
  )

  // ---- 2. urutan baca ----------------------------------------------------
  const haystack = norm(shortText)
  let cursor = 0
  const orderDetail: string[] = []
  let orderOk = true
  for (const expected of expectedReadingOrder(spikeContent)) {
    const needle = norm(expected)
    const found = haystack.indexOf(needle, cursor)
    if (found === -1) {
      orderOk = false
      orderDetail.push(`HILANG: "${expected.slice(0, 48)}"`)
      continue
    }
    orderDetail.push(`${orderDetail.length + 1}. "${expected.slice(0, 48)}" @${found}`)
    cursor = found + needle.length
  }
  check('urutan baca name → contact → heading → entry → bullet', orderOk, orderDetail.join(' | '))

  // ---- 3. dokumen panjang: wrap, page-break, prop fixed -------------------
  const longContent = makeLongSpikeContent(LONG_BULLET_COUNT)
  const longStartedAt = performance.now()
  const longData = await renderSpike(longContent, { repeatHeader: true })
  const longMs = Math.round(performance.now() - longStartedAt)
  await writeFile(path.join(ARTIFACT_DIR, 'spike-a4-60-bullet.pdf'), longData)

  const longSizes = await pageSizes(longData)
  check(
    `${LONG_BULLET_COUNT} bullet memicu page-break otomatis`,
    longSizes.length >= 2,
    `${longSizes.length} halaman`,
  )

  const longPage2Lines = longSizes.length >= 2 ? await extractLines(2, longData) : []
  const longPage2First = longPage2Lines[0]
  check(
    'prop fixed mengulang header di halaman 2',
    longPage2First !== undefined && norm(longPage2First.text) === norm(longContent.name),
    longPage2First ? `"${longPage2First.text}"` : 'halaman 2 kosong',
  )

  const longAllText: string[] = []
  for (let page = 1; page <= longSizes.length; page += 1) {
    const lines = await extractLines(page, longData)
    longAllText.push(...lines.map((line) => line.text))
  }
  await writeFile(path.join(ARTIFACT_DIR, 'spike-a4-60-bullet-text.txt'), longAllText.join('\n'))

  const longHaystack = norm(longAllText.join(' '))
  const missingBullets = longContent.sections[0]!.entries[0]!.bullets.filter(
    (bullet) => !longHaystack.includes(norm(bullet)),
  )
  check(
    `semua ${LONG_BULLET_COUNT} bullet utuh (tidak terpotong batas halaman)`,
    missingBullets.length === 0,
    missingBullets.length === 0
      ? 'lengkap'
      : `hilang ${missingBullets.length}: ${missingBullets[0]!.slice(0, 60)}`,
  )

  // ---- laporan -----------------------------------------------------------
  const failed = checks.filter((item) => !item.pass)
  console.log('')
  console.log('pdf:verify — spike PDF Fase 0')
  console.log('='.repeat(78))
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}`)
    console.log(`        ${item.detail}`)
  }
  console.log('-'.repeat(78))
  console.log(`durasi render: 1 halaman ${shortMs} ms · ${LONG_BULLET_COUNT} bullet ${longMs} ms`)
  console.log(
    `ukuran file : 1 halaman ${(shortData.byteLength / 1024).toFixed(1)} KB · ${LONG_BULLET_COUNT} bullet ${(longData.byteLength / 1024).toFixed(1)} KB`,
  )
  console.log(`artefak     : ${path.relative(process.cwd(), ARTIFACT_DIR)}/`)
  console.log('='.repeat(78))
  console.log('')
  console.log('Teks hasil ekstraksi halaman 1 (bukti teks bisa diseleksi & di-copy):')
  console.log('-'.repeat(78))
  for (const line of shortLines.map((l) => l.text)) console.log(line)
  console.log('-'.repeat(78))

  if (failed.length > 0) {
    console.error(`\n${failed.length} pemeriksaan gagal.`)
    process.exitCode = 1
  } else {
    console.log(`\nSemua ${checks.length} pemeriksaan lolos.`)
  }
}

await main()

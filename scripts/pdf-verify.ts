/**
 * `pnpm pdf:verify` — bukti Gate Fase 5 untuk ekspor PDF pdf-lib.
 *
 * Memeriksa lima ID template, teks asli (bukan raster), metadata, urutan baca,
 * diakritik, font subset, serta kesamaan jumlah halaman dengan PagePlan preview.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fontkit from '@pdf-lib/fontkit'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { buildResumePdf, PDF_FONT_FAMILY } from '@/features/templates/pdf/ResumePdfLib'
import { FONT_SOURCES, fontFileFor } from '@/features/pdf/fonts'
import { simulateParseOrder, tapeText } from '@/features/ats/parseTape'
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
  resolveSpec,
  type TemplateSpec,
} from '@/features/templates/specs'
import { tokenize } from '@/lib/text'
import { createSampleDoc } from '@/schema/resume'
import type { ResumeDoc, SectionInstance, TemplateId } from '@/types/resume'
import { paginationDoc, type PaginationFixtureName } from '../tests/fixtures/docs'
import { sampleResume } from '../tests/fixtures/sampleResume'

const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts', 'fase5')
const TEMPLATE_IDS: readonly TemplateId[] = [
  'classic-ats',
  'ledger',
  'executive',
  'minimal',
  'technician',
]
const FIXTURES: readonly PaginationFixtureName[] = ['pendek', 'sedang', 'panjang']

type Check = { name: string; pass: boolean; detail: string }
type ExtractedItem = { str: string; transform: number[] }
type PdfLine = { text: string; baselineY: number }

const checks: Check[] = []

const check = (name: string, pass: boolean, detail: string): void => {
  checks.push({ name, pass, detail })
}

const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * Heading template ber-tracking (§2.3) menyisipkan jarak antar huruf, dan pdfjs
 * membaca jarak itu sebagai spasi: "R I N G K A S A N". Extractor lain (poppler /
 * xpdf) membacanya sebagai satu kata — lihat `pdftotext` silang di bawah. Untuk
 * mengukur jumlah kata secara jujur, token satu-huruf berurutan digabung lagi.
 */
const collapseLetterSpacing = (text: string): string =>
  text.replace(/(?<![\p{L}\p{N}])\p{L}(?:\s+\p{L})+(?![\p{L}\p{N}])/gu, (run) =>
    run.replace(/\s+/gu, ''),
  )

const loadTask = (data: Uint8Array) => getDocument({ data: new Uint8Array(data), verbosity: 0 })

async function extractPageLines(pageNumber: number, data: Uint8Array): Promise<PdfLine[]> {
  const task = loadTask(data)
  const pdf = await task.promise
  const page = await pdf.getPage(pageNumber)
  const content = await page.getTextContent()
  await page.cleanup()
  await task.destroy()

  const buckets = new Map<number, ExtractedItem[]>()
  for (const item of content.items) {
    if (!('str' in item)) continue
    const text = item as ExtractedItem
    if (text.str.length === 0) continue
    const key = Math.round(text.transform[5]! * 2) / 2
    const bucket = buckets.get(key)
    if (bucket) bucket.push(text)
    else buckets.set(key, [text])
  }

  return [...buckets.values()]
    .map((items) => {
      const ordered = [...items].sort((a, b) => a.transform[4]! - b.transform[4]!)
      return {
        text: ordered.map((item) => item.str).join(''),
        baselineY: ordered.reduce((sum, item) => sum + item.transform[5]!, 0) / ordered.length,
      }
    })
    .sort((a, b) => b.baselineY - a.baselineY)
}

async function extractPdf(
  data: Uint8Array,
): Promise<{ pages: PdfLine[][]; metadata: Record<string, unknown> }> {
  const task = loadTask(data)
  const pdf = await task.promise
  const metadata = (await pdf.getMetadata()).info as Record<string, unknown>
  const pageCount = pdf.numPages
  await task.destroy()

  const pages: PdfLine[][] = []
  for (let index = 1; index <= pageCount; index += 1)
    pages.push(await extractPageLines(index, data))
  return { pages, metadata }
}

/**
 * Gate Fase 5 menamai `pdftotext -layout` sebagai pembaca acuan. pdfjs dan
 * pdftotext berbeda menafsirkan jarak antar huruf pada heading ber-tracking, jadi
 * keduanya dijalankan: pdfjs untuk halaman/metadata/glyph, pdftotext untuk
 * urutan baca versi poppler/xpdf.
 */
const PDFTOTEXT_CANDIDATES = [
  process.env.PDFTOTEXT,
  'pdftotext',
  'C:/Program Files/Git/mingw64/bin/pdftotext.exe',
]

function findPdftotext(): string | null {
  for (const candidate of PDFTOTEXT_CANDIDATES) {
    if (!candidate) continue
    // `-v` keluar dengan kode non-nol pada sebagian build, jadi keberadaan
    // binernya dinilai dari `error` (ENOENT), bukan exit code.
    const probe = spawnSync(candidate, ['-v'], { stdio: 'ignore' })
    if (!probe.error) return candidate
  }
  return null
}

const pdftotext = findPdftotext()

function extractWithPdftotext(pdfPath: string): string | null {
  if (!pdftotext) return null
  return execFileSync(pdftotext, ['-layout', '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8' })
}

const sectionFor = (doc: ResumeDoc, sectionId: string): SectionInstance | undefined =>
  doc.sections.find((section) => section.id === sectionId)

function expectedPieces(doc: ResumeDoc, spec: TemplateSpec): string[] {
  const plan = createPagePlan(doc, spec)
  const profile = doc.sections.find(
    (section): section is Extract<SectionInstance, { kind: 'profile' }> =>
      section.kind === 'profile' && section.visible,
  )
  const pieces: string[] = []

  for (const block of plan.blocks) {
    const section = sectionFor(doc, block.sectionId)
    if (!section) continue
    if (block.kind === 'header' && profile) {
      pieces.push(
        profile.data.fullName,
        profile.data.headline,
        contactLine(profileContact(profile.data), spec),
      )
      continue
    }
    if (block.kind === 'section-heading') {
      // small-caps diekstrak sebagai glyph kapital (sintesis per-run), jadi
      // ekspektasinya di-uppercase agar bisa dicocokkan.
      const label = headingLabel(sectionLabel(section.kind), spec)
      pieces.push(spec.headingStyle.transform === 'small-caps' ? label.toUpperCase() : label)
      continue
    }
    if (block.kind === 'summary') {
      pieces.push(summaryText(section))
      continue
    }
    if (block.kind === 'skill-group' && section.kind === 'skills') {
      const group = section.data.groups.find((item) => item.id === block.itemId)
      if (group) pieces.push(...skillGroupLines(group))
      continue
    }
    if (section.kind === 'profile' || section.kind === 'summary' || section.kind === 'skills') {
      continue
    }
    const entry = entriesOf(section).find((item) => item.id === block.itemId)
    if (!entry) continue
    const content = entryContentOf(section.kind, entry, doc.settings.language)
    if (block.kind === 'entry-head') {
      // Tanggal-kanan (T6.2) menggambar judul, tanggal, lalu sisa meta —
      // urutan yang sama yang harus dibaca ekstraktor.
      if (spec.entryLayout.datePosition === 'right') {
        pieces.push(content.title, content.dates, content.metaNoDates)
      } else {
        pieces.push(content.title, content.meta)
      }
    }
    if (block.kind === 'entry-line') {
      const line = content.bodyLines[block.lineIndex ?? 0]
      if (line) pieces.push(line.text)
    }
  }
  return pieces.filter((piece) => piece.trim() !== '')
}

async function render(doc: ResumeDoc, templateId: TemplateId) {
  const fixture = { ...doc, templateId }
  const spec = resolveSpec(templateId, fixture.theme, fixture.settings.page)
  const plan = createPagePlan(fixture, spec)
  const startedAt = performance.now()
  const result = await buildResumePdf(fixture, spec, plan, (file) =>
    Promise.resolve(
      new Uint8Array(readFileSync(path.resolve(process.cwd(), 'public/fonts', file))),
    ),
  )
  return {
    ...result,
    doc: fixture,
    spec,
    plan,
    durationMs: Math.round(performance.now() - startedAt),
  }
}

function qualityDoc(): ResumeDoc {
  const doc = createSampleDoc()
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance => {
      if (section.kind === 'profile') {
        return {
          ...section,
          data: {
            ...section.data,
            fullName: 'Désirée Núñez-Łukasz van Ångström dengan Nama Sangat Panjang',
            headline: 'Principal Software Engineer — Platform Reliability',
          },
        }
      }
      if (section.kind === 'experience') {
        const [first, ...rest] = section.data.entries
        if (!first) return section
        return {
          ...section,
          data: {
            entries: [
              {
                ...first,
                bullets: [
                  ...first.bullets,
                  'Mengoordinasikan migrasi résumés untuk Zürich, São Paulo, dan Łódź sambil menjaga reliabilitas layanan 99,95% pada 40 ribu pengguna harian.',
                ],
              },
              ...rest,
            ],
          },
        }
      }
      return section
    }),
  }
}

function assertTextQuality(label: string, extracted: string, expected: readonly string[]): void {
  const sourceTokens = tokenize(expected.join(' '))
  const extractedTokens = tokenize(collapseLetterSpacing(extracted))
  const difference =
    Math.abs(sourceTokens.length - extractedTokens.length) / Math.max(1, sourceTokens.length)
  const remaining = [...extractedTokens]
  const absent: string[] = []
  for (const token of sourceTokens) {
    const at = remaining.indexOf(token)
    if (at === -1) absent.push(token)
    else remaining.splice(at, 1)
  }
  check(
    `${label}: selisih jumlah kata ≤ 2%`,
    difference <= 0.02,
    `sumber ${sourceTokens.length} kata · PDF ${extractedTokens.length} kata · ${(difference * 100).toFixed(2)}%` +
      ` · hilang ${absent.length}${absent.length > 0 ? `: ${absent.slice(0, 12).join(' ')}` : ''}` +
      ` · berlebih ${remaining.length}${remaining.length > 0 ? `: ${remaining.slice(0, 12).join(' ')}` : ''}`,
  )

  const text = normalise(extracted)
  let cursor = 0
  // Awal jendela transposisi: posisi sebelum bagian yang baru dicocokkan.
  let windowStart = 0
  const missing: string[] = []
  for (const piece of expected) {
    const needle = normalise(piece)
    let found = text.indexOf(needle, cursor)
    if (found === -1) {
      // poppler -layout mencetak teks kolom kanan (tanggal-kanan T6.2) pada
      // baris kisi di ATAS judulnya bila celah kolomnya lebar, padahal baseline
      // PDF-nya sama (pdfjs membaca urutan benar). Terima kecocokan yang jatuh
      // di celah antara bagian sebelumnya dan posisi kursor sekarang.
      const early = text.indexOf(needle, windowStart)
      if (early !== -1 && early + needle.length <= cursor) found = early
    }
    if (found === -1) {
      missing.push(piece.slice(0, 64))
      continue
    }
    windowStart = cursor
    cursor = found + needle.length
  }
  check(
    `${label}: urutan baca & field lengkap`,
    missing.length === 0,
    missing.length === 0 ? `${expected.length} bagian berurutan` : `hilang: ${missing.join(' | ')}`,
  )
  check(
    `${label}: tanpa glyph pecah`,
    !extracted.includes('\uFFFD'),
    extracted.includes('\uFFFD') ? 'ditemukan replacement character' : 'bersih',
  )
}

function verifyTapeAgainstPdf(
  label: string,
  doc: ResumeDoc,
  spec: TemplateSpec,
  plan: ReturnType<typeof createPagePlan>,
  layout: string,
): void {
  const { lines } = simulateParseOrder(doc, spec, plan)
  const tapeTokens = tokenize(tapeText(lines))
  const pdfTokens = tokenize(collapseLetterSpacing(layout))
  if (tapeTokens.length === 0) return

  // Urutan, bukan nilai: setiap kata tape harus muncul di PDF sesudah kata
  // sebelumnya. PDF boleh punya token tambahan (halaman, glif) dan berlebih
  // ditoleransi — yang tidak boleh adalah tape yang keluar dari barisan.
  let cursor = 0
  const outOfOrder: string[] = []
  for (const token of tapeTokens) {
    const at = pdfTokens.indexOf(token, cursor)
    if (at === -1) {
      outOfOrder.push(token)
      continue
    }
    cursor = at + 1
  }
  const missing = outOfOrder.length
  const coverage = Math.round(((tapeTokens.length - missing) / tapeTokens.length) * 1000) / 10

  check(
    `${label}: urutan Parse Tape == urutan pdftotext`,
    missing === 0,
    missing === 0
      ? `${tapeTokens.length} token tape semuanya berurutan di ${pdfTokens.length} token PDF`
      : `${missing}/${tapeTokens.length} token di luar barisan (${coverage}% berurutan): ${outOfOrder.slice(0, 8).join(' ')}`,
  )
}

async function verifyTemplate(templateId: TemplateId): Promise<void> {
  const rendered = await render(qualityDoc(), templateId)
  const name = `${templateId}-quality`
  const pdfPath = path.join(ARTIFACT_DIR, `${name}.pdf`)
  await writeFile(pdfPath, rendered.bytes)
  const { pages, metadata } = await extractPdf(rendered.bytes)
  const extracted = pages
    .flat()
    .map((line) => line.text)
    .join('\n')
  await writeFile(path.join(ARTIFACT_DIR, `${name}.pdfjs-layout.txt`), extracted)

  check(
    `${templateId}: magic bytes %PDF`,
    String.fromCharCode(...rendered.bytes.slice(0, 4)) === '%PDF',
    String.fromCharCode(...rendered.bytes.slice(0, 4)),
  )
  check(
    `${templateId}: pageCount PDF = preview`,
    pages.length === rendered.plan.pageCount,
    `PDF ${pages.length} · preview ${rendered.plan.pageCount}`,
  )
  check(
    `${templateId}: metadata`,
    metadata.Title ===
      'Désirée Núñez-Łukasz van Ångström dengan Nama Sangat Panjang — Principal Software Engineer — Platform Reliability' &&
      metadata.Author === 'Désirée Núñez-Łukasz van Ångström dengan Nama Sangat Panjang' &&
      metadata.Subject === 'Resume' &&
      metadata.Creator === 'Resume Studio',
    `${String(metadata.Title)} | ${String(metadata.Author)} | ${String(metadata.Subject)} | ${String(metadata.Creator)}`,
  )
  const pieces = expectedPieces(rendered.doc, rendered.spec)
  assertTextQuality(templateId, extracted, pieces)
  verifyGlyphCoverage(
    `${templateId} [glyph]`,
    rendered.spec,
    `${pieces.join(' ')} ${rendered.spec.bulletGlyph} ${rendered.spec.contactStyle.separator}`,
  )

  const layout = extractWithPdftotext(pdfPath)
  if (layout !== null) {
    await writeFile(path.join(ARTIFACT_DIR, `${name}.pdftotext-layout.txt`), layout)
    assertTextQuality(`${templateId} [pdftotext -layout]`, layout, pieces)
    // Gate Fase 7: Parse Tape untuk sampleResume + ledger harus cocok dengan
    // urutan `pdftotext` PDF-nya. Fixture `sedang` memang memakai sampleResume.
    if (templateId === 'ledger') {
      // Gate Fase 7 meminta Parse Tape untuk `sampleResume` + `ledger`; fixture
      // `sedang` memakai `createSampleDoc()` (id acak), jadi salinan deterministik
      // dibuat di sini agar tape bisa diuji silang.
      const doc = sampleResume()
      const spec = resolveSpec('ledger', doc.theme, doc.settings.page)
      const plan = createPagePlan(doc, spec)
      const bytes = await buildResumePdf(doc, spec, plan, (file) =>
        Promise.resolve(
          new Uint8Array(readFileSync(path.resolve(process.cwd(), 'public/fonts', file))),
        ),
      )
      const samplePath = path.join(ARTIFACT_DIR, 'ledger-sample-resume.pdf')
      await writeFile(samplePath, bytes.bytes)
      const layout = extractWithPdftotext(samplePath)
      if (layout !== null) verifyTapeAgainstPdf('sampleResume × ledger', doc, spec, plan, layout)
    }
  }
}

async function verifyPaginationFixtures(): Promise<void> {
  // Gate Fase 6: setiap template harus menghasilkan PDF valid untuk ketiga
  // fixture — 5 × 3 kombinasi, bukan hanya ledger.
  for (const templateId of TEMPLATE_IDS) {
    for (const fixtureName of FIXTURES) {
      const rendered = await render(paginationDoc(fixtureName), templateId)
      const name = `${templateId}-${fixtureName}`
      await writeFile(path.join(ARTIFACT_DIR, `${name}.pdf`), rendered.bytes)
      const { pages } = await extractPdf(rendered.bytes)
      const extracted = pages
        .flat()
        .map((line) => line.text)
        .join('\n')
      await writeFile(path.join(ARTIFACT_DIR, `${name}.pdfjs-layout.txt`), extracted)
      check(
        `fixture ${fixtureName} × ${templateId}: pageCount PDF = preview`,
        pages.length === rendered.plan.pageCount,
        `PDF ${pages.length} · preview ${rendered.plan.pageCount}`,
      )
      assertTextQuality(
        `fixture ${fixtureName} × ${templateId}`,
        extracted,
        expectedPieces(rendered.doc, rendered.spec),
      )

      const pdfPath = path.join(ARTIFACT_DIR, `${name}.pdf`)
      const layout = extractWithPdftotext(pdfPath)
      if (layout !== null) {
        await writeFile(path.join(ARTIFACT_DIR, `${name}.pdftotext-layout.txt`), layout)
        assertTextQuality(
          `fixture ${fixtureName} × ${templateId} [pdftotext -layout]`,
          layout,
          expectedPieces(rendered.doc, rendered.spec),
        )
      }
    }
  }
}

/**
 * Gate "tidak ada glyph hilang" diperiksa di level font, bukan hanya di teks yang
 * terekstrak: pdf-lib mengganti karakter tanpa glyph dengan `.notdef` secara
 * senyap (bug Fase 0 menemukan ini pada `Ł`), jadi setiap karakter yang benar-benar
 * digambar dicocokkan ke cmap subset yang dipakai role tipografi itu.
 */
const cmapCache = new Map<string, ReturnType<typeof fontkit.create>>()

function verifyGlyphCoverage(label: string, spec: TemplateSpec, text: string): void {
  const absent: string[] = []
  for (const role of Object.values(spec.typeScale)) {
    const file = fontFileFor(
      PDF_FONT_FAMILY[role.font],
      role.weight,
      role.italic ? 'italic' : 'normal',
    )
    let font = cmapCache.get(file)
    if (!font) {
      font = fontkit.create(
        new Uint8Array(readFileSync(path.resolve(process.cwd(), 'public/fonts', file))),
      )
      cmapCache.set(file, font)
    }
    for (const character of text) {
      if (/\s/u.test(character)) continue
      if (font.glyphForCodePoint(character.codePointAt(0)!).id === 0) {
        absent.push(`${role.font}/${character}`)
      }
    }
  }
  check(
    `${label}: semua karakter punya glyph di font PDF`,
    absent.length === 0,
    absent.length === 0
      ? `${text.length} karakter diperiksa di ${Object.keys(spec.typeScale).length} role`
      : `tanpa glyph: ${[...new Set(absent)].join(' ')}`,
  )
}

function verifySubsetSize(): void {
  const files = new Set(
    Object.values(FONT_SOURCES)
      .flat()
      .map((source) => source.file),
  )
  const total = [...files].reduce(
    (sum, file) => sum + statSync(path.resolve(process.cwd(), 'public/fonts', file)).size,
    0,
  )
  // Fase 6 menambah keluarga ketiga (Source Serif 4 §2.3) — budget §10 naik
  // 400 → 600 KB; ekspor tetap memuat hanya face yang dipakai spec aktif.
  check(
    'total font PDF subset < 600 KB',
    total < 600 * 1024,
    `${(total / 1024).toFixed(1)} KB untuk ${files.size} berkas`,
  )
}

async function verifyPerformance(): Promise<void> {
  const single = await render(paginationDoc('pendek'), 'ledger')
  const long = await render(paginationDoc('panjang'), 'ledger')
  check('export 1 halaman < 1,5 detik', single.durationMs < 1500, `${single.durationMs} ms`)
  check('export 3 halaman < 4 detik', long.durationMs < 4000, `${long.durationMs} ms`)
}

async function main(): Promise<void> {
  await mkdir(ARTIFACT_DIR, { recursive: true })
  for (const templateId of TEMPLATE_IDS) await verifyTemplate(templateId)
  await verifyPaginationFixtures()
  verifySubsetSize()
  await verifyPerformance()

  const failed = checks.filter((item) => !item.pass)
  console.log('')
  console.log('pdf:verify — Fase 5 (pdf-lib, TemplateSpec + PagePlan tunggal)')
  console.log('='.repeat(78))
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}`)
    console.log(`        ${item.detail}`)
  }
  console.log('-'.repeat(78))
  console.log(`artefak: ${path.relative(process.cwd(), ARTIFACT_DIR)}/`)
  console.log(`pdftotext silang: ${pdftotext ?? 'tidak ditemukan (dilewati)'}`)
  console.log(`hasil : ${checks.length - failed.length}/${checks.length} pemeriksaan lolos`)
  console.log('='.repeat(78))
  if (failed.length > 0) process.exitCode = 1
}

await main()

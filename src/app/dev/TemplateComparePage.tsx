import { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import { DevPageShell } from './DevPageShell'
import { A4_PT, A4_PX, mmToPx } from '@/lib/units'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { createPagePlan } from '@/features/preview/createPagePlan'
import type { PagePlan } from '@/features/preview/pagination'
import { fontFileFor } from '@/features/pdf/fonts'
import { buildResumePdf, PDF_FONT_FAMILY } from '@/features/templates/pdf/ResumePdfLib'
import { resolveSpec, TEMPLATE_FONT_LABELS } from '@/features/templates/specs'
import { TemplateRenderer } from '@/features/templates/screen/TemplateRenderer'
import { TEMPLATE_IDS } from '@/app/shell/templateList'
import type { TemplateId } from '@/types/resume'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker()

const PDF_TO_PX = 96 / 72
const RENDER_SCALE = A4_PX.w / A4_PT.w

type RawMeasure = {
  pdfLeftMm: number
  pdfBaselineMm: number
  domLeftMm: number
  domNameTopPx: number
  domNameLeftPx: number
  sizePx: number
  linePx: number
  weight: number
  family: string
  pdfFontFile: string
}

/**
 * Bukti Gate Fase 6 «preview == PDF»: untuk tiap template, lembar kiri digambar
 * renderer layar; kanan adalah halaman 1 PDF yang dirender pdfjs dari bytes
 * `buildResumePdf` yang sama. Keduanya memakai SATU `createPagePlan` jalur
 * estimasi (tanpa tinggi DOM) — persis jalur headless `pdf:verify` — jadi yang
 * dibandingkan benar-benar satu rencana halaman (P4). Angka mentah posisi blok
 * nama dilaporkan lewat `window.__atsTemplateCompare`; skrip bukti menghitung
 * Δ baseline kedua sisi dari metrik hhea TTF (fontkit) — ambang Gate ±1 mm.
 */
function CompareRow({ templateId, name }: { templateId: TemplateId; name: string }) {
  const doc = useDocStore((state) => state.doc)
  const spec = useMemo(
    () => resolveSpec(templateId, doc.theme, doc.settings.page),
    [templateId, doc.theme, doc.settings.page],
  )
  const plan = useMemo(() => createPagePlan(doc, spec), [doc, spec])
  const sheetRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  type Outcome = { plan: PagePlan; error?: string }
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Hasil hanya ditampilkan untuk plan yang sedang dirender — plan baru
  // otomatis menganggapnya basi tanpa setState reset di effect.
  const current = outcome && outcome.plan === plan ? outcome : null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // buildResumePdf langsung dengan spec BARIS (bukan renderResumePdfToBlob
      // yang men-resolve spec dari doc.templateId) supaya PDF pembanding
      // benar-benar memakai template yang dibandingkan.
      const { bytes } = await buildResumePdf(doc, spec, plan, async (file) => {
        const response = await fetch(`/fonts/${file}`)
        if (!response.ok) throw new Error(`Font PDF gagal dimuat: ${file}`)
        return new Uint8Array(await response.arrayBuffer())
      })
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const rawBytes = new Uint8Array(await blob.arrayBuffer())
      const pdf = await pdfjsLib.getDocument({ data: rawBytes.slice() }).promise
      try {
        const page = await pdf.getPage(1)
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = Math.floor(A4_PX.w)
        canvas.height = Math.floor(A4_PX.h)
        await page.render({
          canvas,
          canvasContext: canvas.getContext('2d')!,
          viewport: page.getViewport({ scale: RENDER_SCALE }),
        }).promise
        const content = await page.getTextContent()
        await page.cleanup()

        const profile = doc.sections.find((section) => section.kind === 'profile')
        const fullName = profile?.kind === 'profile' ? profile.data.fullName : ''
        const sheet = sheetRef.current
        const nameBlock = sheet?.querySelector('[data-block-kind="header"]')?.querySelector('div')
        // pdfjs memecah teks ber-tracking per kata ("Alex", " ", "Morgan") —
        // cocokkan prefiks ternormalisasi, bukan string utuh.
        const normaliseForMatch = (text: string): string =>
          text
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^\p{L}\p{N}]+/gu, '')
        const nameKey = normaliseForMatch(fullName)
        const firstItem = content.items.find(
          (item) =>
            'str' in item &&
            item.str.trim() !== '' &&
            nameKey.startsWith(normaliseForMatch(item.str)),
        ) as { str: string; transform: number[] } | undefined
        if (!sheet || !nameBlock || !fullName || !firstItem) {
          throw new Error(
            `pengukuran gagal: sheet=${Boolean(sheet)} nameBlock=${Boolean(nameBlock)} fullName="${fullName}" firstItem=${firstItem ? 'ada' : 'tidak ada'}`,
          )
        }
        const sheetBox = sheet.getBoundingClientRect()
        const nameBox = nameBlock.getBoundingClientRect()
        // Untuk nama rata-tengah (executive), tepi blok ≠ awal glyph — ukur
        // rentang isi teksnya supaya kedua sisi membandingkan posisi glyph.
        const range = document.createRange()
        range.selectNodeContents(nameBlock)
        const textRect = range.getBoundingClientRect()
        const nameStyle = getComputedStyle(nameBlock)
        // Angka mentah dilaporkan apa adanya; skrip bukti menghitung baseline
        // kedua sisi dari SUMBER METRIK YANG SAMA (hhea TTF, fontkit) supaya
        // perbandingan tidak dipengaruhi perbedaan tabel metrik platform.
        const raw = {
          pdfLeftMm: ((firstItem.transform[4] ?? 0) * PDF_TO_PX) / mmToPx(1),
          pdfBaselineMm: ((A4_PT.h - (firstItem.transform[5] ?? 0)) * PDF_TO_PX) / mmToPx(1),
          domLeftMm: (textRect.left - sheetBox.left) / mmToPx(1),
          domNameTopPx: nameBox.top - sheetBox.top,
          domNameLeftPx: textRect.left - sheetBox.left,
          sizePx: Number.parseFloat(nameStyle.fontSize),
          linePx: Number.parseFloat(nameStyle.lineHeight),
          weight: Number.parseInt(nameStyle.fontWeight, 10),
          family: nameStyle.fontFamily,
          pdfFontFile: fontFileFor(
            PDF_FONT_FAMILY[spec.typeScale.name.font],
            spec.typeScale.name.weight,
          ),
        }
        if (cancelled) return
        setOutcome({ plan })
        const host = window as unknown as {
          __atsTemplateCompare?: Record<string, RawMeasure>
        }
        host.__atsTemplateCompare = { ...(host.__atsTemplateCompare ?? {}), [templateId]: raw }
      } finally {
        await pdf.cleanup()
      }
    })().catch((err) => {
      if (!cancelled) setOutcome({ plan, error: err instanceof Error ? err.message : String(err) })
    })
    return () => {
      cancelled = true
    }
  }, [doc, plan, spec, templateId])

  return (
    <section data-probe="compare-row" data-template={templateId} className="mt-10">
      <h2 className="text-panel-title text-ink">
        {name}{' '}
        <span className="text-data text-ink-tertiary font-normal">
          {TEMPLATE_FONT_LABELS[spec.typeScale.name.font]}
        </span>
      </h2>
      <div className="mt-2 flex flex-wrap items-start gap-8">
        <div>
          <p className="text-eyebrow mb-1">{t('preview.label.screen')}</p>
          <div ref={sheetRef} className="relative w-[794px]">
            <TemplateRenderer plan={plan} spec={spec} scope={`compare-${templateId}`} />
          </div>
        </div>
        <div>
          <p className="text-eyebrow mb-1">{t('preview.label.pdf')}</p>
          {current?.error ? (
            <p className="text-body text-signal-bad">{current.error}</p>
          ) : (
            <canvas
              ref={canvasRef}
              data-probe="compare-canvas"
              className="shadow-paper rounded-[1px]"
              style={{ width: A4_PX.w, height: A4_PX.h }}
            />
          )}
        </div>
        <p className="text-data text-ink-secondary" data-probe="compare-delta">
          {current && !current.error ? t('preview.check.measured') : '—'}
        </p>
      </div>
    </section>
  )
}

export function TemplateComparePage() {
  return (
    <DevPageShell titleKey="dev.nav.compare" subtitleKey="preview.check.pdfNote">
      {TEMPLATE_IDS.map((id) => (
        <CompareRow key={id} templateId={id} name={t(`template.${id}`)} />
      ))}
    </DevPageShell>
  )
}

export default TemplateComparePage

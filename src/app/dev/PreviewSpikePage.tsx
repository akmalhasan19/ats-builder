import { useEffect, useRef, useState } from 'react'
import { DevPageShell } from '@/app/dev/DevPageShell'
import { Readout } from '@/app/dev/Readout'
import { Button } from '@/components/ui/button'
import { spikeContent } from '@/features/templates/spikeContent'
import { spikeSpec } from '@/features/templates/spikeSpec'
import { SpikeSheet } from '@/features/templates/screen/SpikeSheet'
import { t, type TranslationKey } from '@/lib/i18n'
import { A4_PX, TOLERANCE_PX, mmToPx, ptToPx, pxToMm, round2 } from '@/lib/units'

const ZOOM_PRESETS = [0.5, 0.75, 1]
const WELL_PADDING_PX = 48
const MIN_SCALE = 0.3
const MAX_SCALE = 1.5

type Measurement = {
  labelKey: TranslationKey
  expectedPx: number
  measuredPx: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function PreviewSpikePage() {
  const wellRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const pdfObjectUrlRef = useRef<string | null>(null)

  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [fitScale, setFitScale] = useState(1)
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [overlay, setOverlay] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const scale = zoom === 'fit' ? fitScale : zoom

  useEffect(() => {
    const well = wellRef.current
    if (!well) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const available = entry.contentRect.width - WELL_PADDING_PX
      setFitScale(clamp(available / A4_PX.w, MIN_SCALE, MAX_SCALE))
    })
    observer.observe(well)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    void document.fonts.ready.then(() => {
      if (!active) return
      const sheet = sheetRef.current
      if (!sheet) return
      const name = sheet.querySelector<HTMLElement>('[data-probe="name"]')
      if (!name) return

      const sheetBox = sheet.getBoundingClientRect()
      const nameBox = name.getBoundingClientRect()
      const nameStyle = getComputedStyle(name)
      const sheetStyle = getComputedStyle(sheet)

      // Skala dibaca dari DOM, bukan dari closure efek: callback fonts.ready bisa
      // berjalan setelah render berikutnya, dan closure itu tertinggal satu frame.
      const applied = sheetBox.width / A4_PX.w

      setMeasurements([
        {
          labelKey: 'preview.check.leftMargin',
          expectedPx: mmToPx(spikeSpec.marginMm),
          measuredPx: (nameBox.left - sheetBox.left) / applied,
        },
        {
          labelKey: 'preview.check.topMargin',
          expectedPx: mmToPx(spikeSpec.marginMm),
          measuredPx: (nameBox.top - sheetBox.top) / applied,
        },
        {
          labelKey: 'preview.check.nameSize',
          expectedPx: ptToPx(spikeSpec.type.namePt),
          measuredPx: Number.parseFloat(nameStyle.fontSize),
        },
        {
          labelKey: 'preview.check.lineHeight',
          expectedPx: ptToPx(spikeSpec.type.bodyPt) * spikeSpec.lineHeight.body,
          measuredPx: Number.parseFloat(sheetStyle.lineHeight),
        },
      ])
    })
    return () => {
      active = false
    }
  }, [scale])

  useEffect(
    () => () => {
      if (pdfObjectUrlRef.current) URL.revokeObjectURL(pdfObjectUrlRef.current)
    },
    [],
  )

  async function loadComparisonPdf() {
    setBusy(true)
    setPdfFailed(false)
    try {
      const { renderSpikePdfToBlob } = await import('@/features/pdf/spikePdf')
      const { blob } = await renderSpikePdfToBlob(spikeContent, { repeatHeader: false })
      const url = URL.createObjectURL(blob)
      if (pdfObjectUrlRef.current) URL.revokeObjectURL(pdfObjectUrlRef.current)
      pdfObjectUrlRef.current = url
      setPdfUrl(url)
    } catch {
      setPdfFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const sheetWidth = A4_PX.w * scale
  const sheetHeight = A4_PX.h * scale

  return (
    <DevPageShell titleKey="preview.title" subtitleKey="preview.subtitle">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-eyebrow">{t('preview.zoom.label')}</span>
          {ZOOM_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={zoom === preset ? 'secondary' : 'ghost'}
              onClick={() => setZoom(preset)}
            >
              {Math.round(preset * 100)}%
            </Button>
          ))}
          <Button
            size="sm"
            variant={zoom === 'fit' ? 'secondary' : 'ghost'}
            onClick={() => setZoom('fit')}
          >
            {t('preview.zoom.fit')}
          </Button>
          <span className="text-data text-ink-secondary">{Math.round(scale * 100)}%</span>

          <Button
            className="ml-auto"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void loadComparisonPdf()}
          >
            {t('preview.action.loadPdf')}
          </Button>
          {pdfUrl ? (
            <Button size="sm" variant="ghost" onClick={() => setOverlay((v) => !v)}>
              {t('preview.action.overlay')}
            </Button>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Readout labelKey="preview.readout.sheet">{`${A4_PX.w} × ${A4_PX.h} px`}</Readout>
          <Readout labelKey="preview.readout.margin">{`${spikeSpec.marginMm} mm`}</Readout>
          <Readout labelKey="preview.readout.scale">{`${round2(scale)}×`}</Readout>
          <Readout labelKey="preview.readout.container">{`${Math.round(sheetHeight)} px`}</Readout>
        </dl>

        <section className="rounded-lg border border-rule bg-raised p-4">
          <h2 className="text-panel-title">{t('preview.check.title')}</h2>
          {measurements ? (
            <ul className="mt-3 flex flex-col gap-2">
              {measurements.map((row) => {
                const deltaPx = row.measuredPx - row.expectedPx
                const pass = Math.abs(deltaPx) <= TOLERANCE_PX
                return (
                  <li
                    key={row.labelKey}
                    data-probe="check-row"
                    data-pass={pass}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule pt-2"
                  >
                    <span className="text-label min-w-[200px]">{t(row.labelKey)}</span>
                    <span className="text-data text-ink-secondary">
                      {t('preview.check.expected')} {round2(row.expectedPx)} px
                    </span>
                    <span className="text-data text-ink">
                      {t('preview.check.measured')} {round2(row.measuredPx)} px
                    </span>
                    <span className="text-data text-ink-tertiary">
                      Δ {round2(pxToMm(deltaPx))} mm
                    </span>
                    <span
                      className={`text-data ${pass ? 'text-signal-ok' : 'text-signal-bad'}`}
                      data-pass={pass}
                    >
                      {pass ? t('preview.check.pass') : t('preview.check.fail')}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <p className="text-body mt-3 max-w-[95ch]">{t('preview.check.pdfNote')}</p>
        </section>

        <div ref={wellRef} className="overflow-auto rounded-lg bg-workbench p-6 shadow-well">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
            <figure className="flex flex-col items-center gap-2">
              <figcaption className="text-eyebrow">{t('preview.label.screen')}</figcaption>
              <div className="relative" style={{ width: sheetWidth, height: sheetHeight }}>
                <SpikeSheet content={spikeContent} scale={scale} sheetRef={sheetRef} />
                {pdfUrl && overlay ? (
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                    title={t('preview.label.pdf')}
                    className="pointer-events-none absolute inset-0 border-0"
                    style={{ width: sheetWidth, height: sheetHeight, opacity: overlayOpacity }}
                  />
                ) : null}
              </div>
            </figure>

            {pdfUrl && !overlay ? (
              <figure className="flex flex-col items-center gap-2">
                <figcaption className="text-eyebrow">{t('preview.label.pdf')}</figcaption>
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                  title={t('preview.label.pdf')}
                  className="rounded-paper border-0 bg-raised"
                  style={{ width: sheetWidth, height: sheetHeight }}
                />
              </figure>
            ) : null}
          </div>
        </div>

        {overlay ? (
          <label className="flex items-center gap-3">
            <span className="text-label">{t('preview.action.overlay')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlayOpacity}
              onChange={(event) => setOverlayOpacity(Number(event.target.value))}
              className="w-48 accent-cyanotype"
            />
            <span className="text-data text-ink-secondary">
              {Math.round(overlayOpacity * 100)}%
            </span>
          </label>
        ) : null}

        {pdfFailed ? (
          <p role="alert" className="text-body text-signal-bad">
            {t('preview.error.pdf')}
          </p>
        ) : null}

        <p className="text-body max-w-[95ch]">{t('preview.note.pagination')}</p>
      </div>
    </DevPageShell>
  )
}

import { useEffect, useRef, useState } from 'react'
import { DevPageShell } from '@/app/dev/DevPageShell'
import { Readout } from '@/app/dev/Readout'
import { Button } from '@/components/ui/button'
import {
  makeLongSpikeContent,
  spikeContent,
  type SpikeRenderOptions,
} from '@/features/templates/spikeContent'
import { t } from '@/lib/i18n'

type SpikeResult = {
  url: string
  bytes: number
  durationMs: number
  repeatHeader: boolean
}

const LONG_BULLET_COUNT = 60

function downloadObjectUrl(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export default function PdfSpikePage() {
  const [result, setResult] = useState<SpikeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  async function generate(filename: string, options: SpikeRenderOptions, bulletCount?: number) {
    setBusy(true)
    setFailed(false)
    try {
      const { renderSpikePdfToBlob } = await import('@/features/pdf/spikePdf')
      const content = bulletCount ? makeLongSpikeContent(bulletCount) : spikeContent
      const { blob, bytes, durationMs } = await renderSpikePdfToBlob(content, options)

      const url = URL.createObjectURL(blob)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url

      setResult({ url, bytes, durationMs, repeatHeader: options.repeatHeader })
      downloadObjectUrl(url, filename)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DevPageShell titleKey="pdf.title" subtitleKey="pdf.subtitle" maxWidthClass="max-w-[1000px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy}
            onClick={() => void generate('spike-a4.pdf', { repeatHeader: false })}
          >
            {busy ? t('pdf.state.generating') : t('pdf.action.short')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void generate('spike-a4-60-bullet.pdf', { repeatHeader: true }, LONG_BULLET_COUNT)
            }
          >
            {t('pdf.action.long')}
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Readout labelKey="pdf.readout.duration">
            {result ? `${result.durationMs} ${t('pdf.unit.ms')}` : '—'}
          </Readout>
          <Readout labelKey="pdf.readout.size">
            {result ? `${Math.round(result.bytes / 1024)} ${t('pdf.unit.kb')}` : '—'}
          </Readout>
          <Readout labelKey="pdf.readout.header">
            {result ? (result.repeatHeader ? t('pdf.value.yes') : t('pdf.value.no')) : '—'}
          </Readout>
        </dl>

        <ul className="text-body flex list-disc flex-col gap-1 pl-5">
          <li>{t('pdf.note.lazy')}</li>
          <li>{t('pdf.note.selectable')}</li>
          <li>{t('pdf.note.long')}</li>
        </ul>

        {failed ? (
          <p role="alert" className="text-body text-signal-bad">
            {t('pdf.error.failed')}
          </p>
        ) : null}

        {result ? (
          <iframe
            src={`${result.url}#toolbar=1&navpanes=0&view=FitH`}
            title={t('pdf.viewer.label')}
            className="h-[840px] w-full rounded-lg border border-rule bg-raised"
          />
        ) : (
          <p className="text-body">{t('pdf.state.idle')}</p>
        )}
      </div>
    </DevPageShell>
  )
}

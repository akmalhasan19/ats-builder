import { memo } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { t } from '@/lib/i18n'
import type { TapeLine, TapeStats } from '../parseTape'

/**
 * §5.6 — readout mesin: baris teks persis dalam urutan yang dibaca parser.
 * Dijujurkan sebagai "urutan parse tersimulasi dari template ini", bukan hasil
 * vendor ATS tertentu.
 */

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const splitByKeywords = (text: string, keywords: readonly string[]): string[] => {
  const usable = keywords.filter((keyword) => keyword.trim() !== '')
  if (usable.length === 0) return [text]
  const pattern = new RegExp(`(${usable.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(pattern) as string[]
}

const TapeText = memo(function TapeText({
  text,
  keywords,
  showMarks,
}: {
  text: string
  keywords: readonly string[]
  showMarks: boolean
}) {
  if (!showMarks || keywords.length === 0) return <>{text}</>
  const lowered = new Set(keywords.map((keyword) => keyword.toLowerCase()))
  return (
    <>
      {splitByKeywords(text, keywords).map((part, index) => {
        const hit = lowered.has(part.toLowerCase())
        return hit ? (
          <mark key={index} className="text-tape-mark rounded-mark px-px">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      })}
    </>
  )
})

export type ParseTapeViewProps = {
  lines: readonly TapeLine[]
  stats: TapeStats
  keywords: readonly string[]
  showMarks: boolean
  templateLabel: string
}

export function ParseTapeView({
  lines,
  stats,
  keywords,
  showMarks,
  templateLabel,
}: ParseTapeViewProps) {
  const copy = () => {
    const text = lines.map((line) => line.text).join('\n')
    void navigator.clipboard
      .writeText(text)
      .then(() => toast(t('ats.tape.copied')))
      .catch(() => toast(t('ats.tape.copyFailed')))
  }

  return (
    <div data-probe="ats-tape" className="bg-machine px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-eyebrow text-machine-dim">
          {t('ats.tape.header', { template: templateLabel.toUpperCase() })}
        </span>
        <button
          type="button"
          data-probe="ats-tape-copy"
          onClick={copy}
          className="text-hint text-machine-text hover:bg-hover inline-flex items-center gap-1 rounded px-1.5 py-1"
        >
          <Copy aria-hidden="true" className="size-3" />
          {t('ats.tape.copy')}
        </button>
      </div>

      <div className="text-tape max-h-[60dvh] overflow-auto">
        {lines.map((line, index) => (
          <div key={`${line.tag}-${index}`} className="flex gap-2">
            <span
              className={cn(
                'text-tape-tag w-[74px] shrink-0',
                line.tag === 'UNCLAIMED' && 'text-signal-warn',
              )}
            >
              {line.tag}
            </span>
            <span className="min-w-0 flex-1">
              <TapeText text={line.text} keywords={keywords} showMarks={showMarks} />
            </span>
          </div>
        ))}
      </div>

      <p className="text-hint text-machine-dim mt-2">
        {t('ats.tape.footer', {
          chars: stats.chars,
          words: stats.words,
          pages: stats.pages,
        })}
      </p>
      {lines.some((line) => line.tag === 'UNCLAIMED') ? (
        <p className="text-hint text-machine-dim mt-1">{t('ats.tape.unclaimedHint')}</p>
      ) : null}
    </div>
  )
}

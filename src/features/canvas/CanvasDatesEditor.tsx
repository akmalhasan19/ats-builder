import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { DateRangeField } from '@/features/editor/DateRangeField'
import { MonthPicker } from '@/features/editor/MonthPicker'
import { fieldLabelOf } from '@/features/templates/fieldSegments'
import { t } from '@/lib/i18n'
import { useCanvasStore } from '@/store/canvasStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { CANVAS_BUTTON_RESET } from './canvasButtonStyle'
import { validateCanvasDates, writeCanvasDates } from './canvasCommit'
import {
  datesShapeOf,
  entryRecordOf,
  type CanvasDatesPatch,
  type CanvasFieldTarget,
} from './canvasFields'

/**
 * C4.2 — editor tanggal on-canvas (D8).
 *
 * Kontrolnya dipakai ulang dari form: `DateRangeField` + `MonthPicker`. Draft
 * hidup di state lokal (D6: sesi tidak menulis store sampai commit), jadi
 * Escape membatalkan seluruh perubahan dan satu commit = satu langkah undo
 * (D9).
 *
 * Bentuk popover mengikuti bentuk tanggal yang digambar dokumen
 * (`datesShapeOf`): range untuk pengalaman & kerelawanan (dengan sakelar
 * "masih di sini"), range tanpa sakelar untuk proyek, satu tanggal untuk
 * sertifikasi & penghargaan.
 *
 * C5.1 — di mobile (<1024px, panel mode `tabs`) popover melayang berganti
 * `Sheet` bawah (pola sticky action bar, §5.3): isi & probe sama persis
 * (`canvas-dates`, `canvas-dates-save`) supaya spec desktop dan spec kanvas
 * mobile menjalankan alur identik; Escape/klik-luar/tutup tetap batal (D3).
 */

type EntryDatesTarget = Extract<CanvasFieldTarget, { kind: 'entry-dates' }>

export type CanvasDatesEditorProps = {
  target: EntryDatesTarget
  /** Tanggal yang tersimpan sekarang — tampil pada pemicu selama draft dibuka. */
  valueText: string
  /** Guide bila dokumen belum menampilkan tanggal apa pun (D5). */
  guideText: string
  /** Peran tipografi segmen tanggal di template aktif. */
  style?: CSSProperties
}

type DatesDraft = {
  startDate: string
  endDate: string
  current: boolean
  issuedAt: string
  awardedAt: string
}

const stringOf = (entry: Record<string, unknown> | null, key: string): string => {
  const value = entry?.[key]
  return typeof value === 'string' ? value : ''
}

const draftOf = (entry: Record<string, unknown> | null): DatesDraft => ({
  startDate: stringOf(entry, 'startDate'),
  endDate: stringOf(entry, 'endDate'),
  current: entry?.current === true,
  issuedAt: stringOf(entry, 'issuedAt'),
  awardedAt: stringOf(entry, 'awardedAt'),
})

/** Draft → patch bertipe sesuai bentuk tanggal jenis entri ini. */

export function CanvasDatesEditor({ target, valueText, guideText, style }: CanvasDatesEditorProps) {
  const closeSession = useCanvasStore((state) => state.closeSession)
  const panelMode = useUiStore((state) => state.panelMode)
  const entry = useDocStore((state) => entryRecordOf(state.doc, target.sectionId, target.entryId))
  const [draft, setDraft] = useState<DatesDraft>(() => draftOf(entry))
  const [error, setError] = useState<string | null>(null)
  const shape = datesShapeOf(target.entryKind)

  if (!shape) return null

  const patch = (): CanvasDatesPatch =>
    shape.mode === 'single'
      ? shape.field === 'issuedAt'
        ? { issuedAt: draft.issuedAt }
        : { awardedAt: draft.awardedAt }
      : {
          startDate: draft.startDate,
          endDate: draft.current ? '' : draft.endDate,
          current: shape.current ? draft.current : false,
        }

  const commit = () => {
    const message = validateCanvasDates(target, patch())
    if (message) {
      setError(message)
      return
    }
    writeCanvasDates(target, patch())
    closeSession()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    // Tombol punya aksi sendiri (Batal / Simpan); Enter di dalamnya jangan
    // memicu commit ganda.
    if ((event.target as HTMLElement).tagName === 'BUTTON') return
    event.preventDefault()
    commit()
  }

  const datesLabel =
    shape.mode === 'single'
      ? t(shape.field === 'issuedAt' ? 'certifications.issuedAt' : 'awards.awardedAt')
      : t('canvas.datesRange')

  const trigger = (
    <button
      type="button"
      data-field={`entries.${target.entryKind}.${target.entryId}.dates`}
      data-canvas-field="true"
      data-canvas-dates="true"
      aria-label={t('canvas.editField', {
        field: fieldLabelOf('dates'),
        value: valueText === '' ? guideText : valueText,
      })}
      className="canvas-field"
      style={{ ...CANVAS_BUTTON_RESET, ...style }}
    >
      {valueText === '' ? guideText : valueText}
    </button>
  )

  const body = (
    <>
      {shape.mode === 'range' ? (
        <>
          <p className="text-eyebrow text-ink-tertiary">{t('canvas.datesRange')}</p>
          <DateRangeField
            idPrefix={`canvas-dates-${target.entryId}`}
            startDate={draft.startDate}
            endDate={draft.endDate}
            current={shape.current ? draft.current : false}
            showCurrent={shape.current}
            onStartDateChange={(value) => {
              setDraft((prev) => ({ ...prev, startDate: value }))
              setError(null)
            }}
            onEndDateChange={(value) => {
              setDraft((prev) => ({ ...prev, endDate: value }))
              setError(null)
            }}
            onCurrentChange={(value) => {
              setDraft((prev) => ({ ...prev, current: value, endDate: value ? '' : prev.endDate }))
              setError(null)
            }}
            error={error ?? undefined}
          />
        </>
      ) : (
        <Field
          id={`canvas-dates-${target.entryId}-single`}
          label={t(shape.field === 'issuedAt' ? 'certifications.issuedAt' : 'awards.awardedAt')}
          error={error ?? undefined}
        >
          <MonthPicker
            id={`canvas-dates-${target.entryId}-single`}
            value={shape.field === 'issuedAt' ? draft.issuedAt : draft.awardedAt}
            onChange={(value) => {
              setDraft((prev) =>
                shape.field === 'issuedAt'
                  ? { ...prev, issuedAt: value }
                  : { ...prev, awardedAt: value },
              )
              setError(null)
            }}
          />
        </Field>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => closeSession()}>
          {t('common.cancel')}
        </Button>
        <Button type="button" size="sm" data-probe="canvas-dates-save" onClick={commit}>
          {t('common.save')}
        </Button>
      </div>
    </>
  )

  // §5.3 — panel mode `tabs` (<1024px): Sheet bawah, bukan popover melayang.
  if (panelMode === 'tabs') {
    return (
      <Sheet
        open
        onOpenChange={(next) => {
          if (!next) closeSession()
        }}
      >
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          aria-label={datesLabel}
          onKeyDown={handleKeyDown}
          data-probe="canvas-dates"
          className="space-y-3 px-4"
        >
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover
      open
      modal={false}
      onOpenChange={(next) => {
        if (!next) closeSession()
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] space-y-3"
        aria-label={datesLabel}
        onKeyDown={handleKeyDown}
        data-probe="canvas-dates"
      >
        {body}
      </PopoverContent>
    </Popover>
  )
}

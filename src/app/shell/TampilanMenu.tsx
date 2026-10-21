import { useId } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { t } from '@/lib/i18n'
import { useAtsStore } from '@/store/atsStore'
import { useCanvasStore } from '@/store/canvasStore'
import { useUiStore, type EditMode } from '@/store/uiStore'
import { zoomPresetsFor } from '@/features/preview/previewZoom'
import { useCanvasFull, useCanvasFullscreen } from '../useCanvasFull'

const MODES: {
  id: EditMode
  labelKey: 'tampilan.modeForm' | 'tampilan.modeCanvas'
  descKey: 'tampilan.modeFormDesc' | 'tampilan.modeCanvasDesc'
}[] = [
  { id: 'form', labelKey: 'tampilan.modeForm', descKey: 'tampilan.modeFormDesc' },
  { id: 'canvas', labelKey: 'tampilan.modeCanvas', descKey: 'tampilan.modeCanvasDesc' },
]

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  /** Keterangan singkat di bawah label (FASE 13 T5.3). */
  description?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  // FASE 13 (T5.2) — switch memakai `aria-label` supaya nama aksesibelnya
  // tetap persis labelnya, dan keterangan tambahan dibaca lewat
  // `aria-describedby` (bukan digabung ke nama — nama yang memanjang
  // "Kertas layar penuh Rail dan formulir…" tidak enak didengar).
  const descriptionId = useId()
  return (
    <label
      className={cn(
        'text-button text-ink flex items-center justify-between gap-3 py-1.5',
        disabled && 'text-ink-tertiary',
      )}
    >
      <span className="min-w-0 flex-1">
        {label}
        {description ? (
          <span
            id={descriptionId}
            className="text-caption text-ink-secondary mt-0.5 block font-normal"
          >
            {description}
          </span>
        ) : null}
      </span>
      <Switch
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </label>
  )
}

/**
 * C1.3 — isi menu Tampilan (D2): pilihan mode pengerjaan + toggle pratinjau +
 * preset zoom. Dipakai popover toolbar desktop dan sheet mobile supaya satu
 * sumber perilaku.
 */
export function TampilanMenuContent() {
  const editMode = useUiStore((state) => state.editMode)
  const setEditMode = useUiStore((state) => state.setEditMode)
  const canvasFullscreen = useCanvasFullscreen()
  const setCanvasFullscreen = useUiStore((state) => state.setCanvasFullscreen)
  const showMarginGuides = useUiStore((state) => state.showMarginGuides)
  const setShowMarginGuides = useUiStore((state) => state.setShowMarginGuides)
  const showKeywordMarks = useUiStore((state) => state.showKeywordMarks)
  const setShowKeywordMarks = useUiStore((state) => state.setShowKeywordMarks)
  const includeMarksInPdf = useUiStore((state) => state.includeMarksInPdf)
  const setIncludeMarksInPdf = useUiStore((state) => state.setIncludeMarksInPdf)
  const zoom = useUiStore((state) => state.zoom)
  const fitMode = useUiStore((state) => state.fitMode)
  const setZoom = useUiStore((state) => state.setZoom)
  const setFitMode = useUiStore((state) => state.setFitMode)
  const hasKeywords = useAtsStore((state) => state.keywords.length > 0)
  const modeHintSeen = useCanvasStore((state) => state.modeHintSeen)
  const markModeHintSeen = useCanvasStore((state) => state.markModeHintSeen)
  // T2.5 — di mode kanvas layar penuh tersedia preset zoom tambahan (125% &
  // 150%); mode form tetap tiga preset seperti sebelumnya.
  const canvasFull = useCanvasFull()
  const zoomPresets = zoomPresetsFor(canvasFull)

  const chooseMode = (mode: EditMode) => {
    if (mode === editMode) return
    setEditMode(mode)
    if (mode === 'canvas' && !modeHintSeen) {
      markModeHintSeen()
      toast(t('canvas.modeHint'))
    }
  }

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-eyebrow text-ink-tertiary mb-1.5">{t('tampilan.modeTitle')}</p>
        <div
          role="radiogroup"
          aria-label={t('tampilan.modeTitle')}
          data-probe="edit-mode"
          className="grid grid-cols-2 gap-2"
        >
          {MODES.map((mode) => {
            const active = mode.id === editMode
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-probe={`edit-mode-${mode.id}`}
                onClick={() => chooseMode(mode.id)}
                className={cn(
                  'border-rule bg-raised text-button text-ink flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left',
                  active && 'border-accent-ink bg-accent-wash text-accent-ink',
                )}
              >
                <span className="flex w-full items-center justify-between gap-1">
                  {t(mode.labelKey)}
                  {active ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                </span>
                <span className="text-caption text-ink-tertiary font-normal">
                  {t(mode.descKey)}
                </span>
              </button>
            )
          })}
        </div>
        {/* T3.2 (D2) — jalan keluar layar penuh tanpa perlu keluar mode kanvas.
            Dimatikan di mode form: preferensinya hanya berlaku di kertas, jadi
            switch yang bisa digeser di sana cuma membingungkan.
            FASE 13 (T5.3) — `canvas.fullscreenDesc` menjelaskan efeknya: rail
            & formulir disembunyikan, kertas CV mengisi layar. */}
        <div className="mt-1.5">
          <ToggleRow
            label={t('canvas.fullscreenLabel')}
            description={t('canvas.fullscreenDesc')}
            checked={canvasFullscreen}
            disabled={editMode === 'form'}
            onCheckedChange={setCanvasFullscreen}
          />
        </div>
      </div>

      <div>
        <p className="text-eyebrow text-ink-tertiary mb-1">{t('tampilan.previewTitle')}</p>
        <ToggleRow
          label={t('preview.ruler')}
          checked={showMarginGuides}
          onCheckedChange={setShowMarginGuides}
        />
        <ToggleRow
          label={t('preview.highlighter')}
          checked={showKeywordMarks}
          disabled={!hasKeywords}
          onCheckedChange={setShowKeywordMarks}
        />
        <ToggleRow
          label={t('ats.marksInPdf')}
          checked={includeMarksInPdf}
          disabled={!hasKeywords}
          onCheckedChange={setIncludeMarksInPdf}
        />
      </div>

      <div>
        <p className="text-eyebrow text-ink-tertiary mb-1.5">{t('tampilan.zoomTitle')}</p>
        <div
          role="radiogroup"
          aria-label={t('tampilan.zoomTitle')}
          className="grid grid-cols-4 gap-1.5"
        >
          {zoomPresets.map((preset) => {
            const active = !fitMode && zoomPercent === Math.round(preset * 100)
            return (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setFitMode(false)
                  setZoom(preset)
                }}
                className={cn(
                  'border-rule bg-raised text-button text-ink-tertiary h-8 rounded-md border',
                  active && 'border-accent-ink bg-accent-wash text-accent-ink',
                )}
              >
                {Math.round(preset * 100)}%
              </button>
            )
          })}
          <button
            type="button"
            role="radio"
            aria-checked={fitMode}
            onClick={() => setFitMode(true)}
            className={cn(
              'border-rule bg-raised text-button text-ink-tertiary h-8 rounded-md border',
              fitMode && 'border-accent-ink bg-accent-wash text-accent-ink',
            )}
          >
            {t('preview.zoom.fit')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Menu Tampilan di toolbar pratinjau (D2).
 *
 * `iconOnlyBelowSm` dipakai **hanya** di mode kanvas layar penuh: di bawah
 * 640px isi toolbar penuh tidak muat di kotak konten well, sehingga pemicunya
 * jadi ikon saja. Mode form tidak memakai prop ini — layoutnya wajib tetap
 * persis seperti sebelum Fase 13.
 */
export function TampilanMenu({ iconOnlyBelowSm = false }: { iconOnlyBelowSm?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-probe="tampilan-menu"
          aria-label={iconOnlyBelowSm ? t('tampilan.open') : undefined}
          className="gap-1.5 px-2"
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          <span className={cn(iconOnlyBelowSm && 'max-sm:hidden')}>{t('tampilan.open')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[288px] p-3">
        <TampilanMenuContent />
      </PopoverContent>
    </Popover>
  )
}

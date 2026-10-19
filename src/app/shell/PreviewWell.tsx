import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Highlighter, Minus, Plus, Ruler } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { A4_PX } from '@/lib/units'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { useAtsStore } from '@/store/atsStore'
import { resolveSpec } from '@/features/templates/specs'
import { TemplateRenderer } from '@/features/templates/screen/TemplateRenderer'
import { useAtsAutoCheck } from '@/features/ats/useAtsCheck'
import { usePagination } from '@/features/preview/usePagination'
import { usePreviewPrefs } from '@/features/preview/usePreviewPrefs'
import { withRenderProbe } from '@/features/preview/renderProbe'
import { ScanSweep } from '@/features/preview/ScanSweep'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1
const PRESET_ZOOMS = [0.5, 0.75, 1] as const
// §5.5 — lembar selalu berjarak 48px dari tepi well saat mode Fit.
const FIT_PAD_PX = 48
const FIT_RECALC_DEBOUNCE_MS = 100

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function PreviewWell({ className }: { className?: string }) {
  usePreviewPrefs()
  const doc = useDocStore((state) => state.doc)
  const templateId = doc.templateId
  const zoomPref = useUiStore((state) => state.zoom)
  const fitMode = useUiStore((state) => state.fitMode)
  const setZoom = useUiStore((state) => state.setZoom)
  const setFitMode = useUiStore((state) => state.setFitMode)
  const showMarginGuides = useUiStore((state) => state.showMarginGuides)
  const showKeywordMarks = useUiStore((state) => state.showKeywordMarks)
  const setShowMarginGuides = useUiStore((state) => state.setShowMarginGuides)
  const setShowKeywordMarks = useUiStore((state) => state.setShowKeywordMarks)

  const keywords = useAtsStore((state) => state.keywords)
  const isChecking = useAtsStore((state) => state.isChecking)

  const plan = usePagination(doc, templateId)
  // T7.6 — pemeriksaan ulang otomatis dipasang di sini karena hanya komponen
  // ini yang punya `PagePlan` terukur: aturan panjang dokumen butuh jumlah
  // halaman nyata, bukan perkiraan.
  useAtsAutoCheck(plan.pageCount)
  const spec = useMemo(
    () => resolveSpec(templateId, doc.theme, doc.settings.page),
    [templateId, doc.theme, doc.settings.page],
  )

  const wellRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [contentHeight, setContentHeight] = useState<number>(A4_PX.h)
  const [visiblePage, setVisiblePage] = useState(1)
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false)

  const zoom = fitMode ? fitScale : clamp(zoomPref, MIN_ZOOM, MAX_ZOOM)
  const zoomPercent = Math.round(zoom * 100)
  const currentPage = Math.min(visiblePage, plan.pageCount)

  useEffect(() => {
    const well = wellRef.current
    if (!well) return undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const recompute = () => {
      if (!fitMode) return
      setFitScale(clamp((well.clientWidth - FIT_PAD_PX) / A4_PX.w, MIN_ZOOM, MAX_ZOOM))
    }
    recompute()
    const observer = new ResizeObserver(() => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(recompute, FIT_RECALC_DEBOUNCE_MS)
    })
    observer.observe(well)
    return () => {
      if (timer !== null) clearTimeout(timer)
      observer.disconnect()
    }
  }, [fitMode])

  // Tinggi kolom lembar dibaca dari layout asli (transform scale tidak mengubah
  // kotak layout), lalu kontainer luar diberi tinggi hasil kali skala supaya
  // scrollbar well benar — §5.5.
  useEffect(() => {
    const content = contentRef.current
    if (!content) return undefined
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const box = entry.borderBoxSize?.[0]
      setContentHeight(box ? box.blockSize : content.offsetHeight)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const well = wellRef.current
    if (!well) return undefined
    const sheets = well.querySelectorAll<HTMLElement>('[data-probe="page-sheet"]')
    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries.find((entry) => entry.isIntersecting)
        const page = shown?.target.getAttribute('data-page-number')
        if (page) setVisiblePage(Number(page))
      },
      { root: well, rootMargin: '-45% 0px -45% 0px' },
    )
    sheets.forEach((sheet) => observer.observe(sheet))
    return () => observer.disconnect()
  }, [plan.pageCount])

  const applyZoom = useCallback(
    (value: number) => {
      setFitMode(false)
      setZoom(clamp(value, MIN_ZOOM, MAX_ZOOM))
      setZoomMenuOpen(false)
    },
    [setFitMode, setZoom],
  )

  const toggleFit = useCallback(() => {
    const well = wellRef.current
    const next = !fitMode
    setFitMode(next)
    if (next && well)
      setFitScale(clamp((well.clientWidth - FIT_PAD_PX) / A4_PX.w, MIN_ZOOM, MAX_ZOOM))
    setZoomMenuOpen(false)
  }, [fitMode, setFitMode])

  return (
    <section
      id="pane-preview"
      ref={wellRef}
      aria-label={t('workspace.previewTitle')}
      className={cn(
        'bg-workbench min-h-0 overflow-auto shadow-[var(--shadow-well)] p-6 [touch-action:pan-x_pan-y_pinch-zoom]',
        className,
      )}
    >
      <div className="sticky top-0 z-10 -mt-6 mb-4 flex justify-center">
        <div className="border-rule bg-toolbar-glass flex h-10 items-center gap-1.5 rounded-lg border px-2.5 backdrop-blur-[6px]">
          <IconButton
            size="sm"
            label={t('preview.zoomOut')}
            className="rounded"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </IconButton>
          <Popover open={zoomMenuOpen} onOpenChange={setZoomMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-probe="zoom-value"
                className="text-data hover:bg-hover rounded hover:text-ink px-1.5 py-1"
              >
                {fitMode ? t('preview.zoom.fit') : `${zoomPercent}%`}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-40 p-1">
              {PRESET_ZOOMS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-between',
                    !fitMode &&
                      zoomPercent === Math.round(preset * 100) &&
                      'bg-accent-wash text-accent-ink',
                  )}
                  onClick={() => applyZoom(preset)}
                >
                  {Math.round(preset * 100)}%
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-between',
                  fitMode && 'bg-accent-wash text-accent-ink',
                )}
                onClick={toggleFit}
              >
                {t('preview.zoom.fit')}
              </Button>
            </PopoverContent>
          </Popover>
          <IconButton
            size="sm"
            label={t('preview.zoomIn')}
            className="rounded"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </IconButton>

          <Separator orientation="vertical" className="h-5" />

          <span data-probe="page-counter" className="text-data text-ink-secondary px-1">
            {t('preview.pageCounter', { page: currentPage, total: plan.pageCount })}
          </span>
          {plan.pageCount > 2 ? (
            <span data-probe="page-chip" className="text-data text-signal-warn px-1">
              {t('preview.pageChip', { count: plan.pageCount })}
            </span>
          ) : null}

          <Separator orientation="vertical" className="h-5" />

          <IconButton
            size="sm"
            label={t('preview.ruler')}
            aria-pressed={showMarginGuides}
            className={cn('rounded', showMarginGuides && 'bg-accent-wash text-accent-ink')}
            onClick={() => setShowMarginGuides(!showMarginGuides)}
          >
            <Ruler className="size-3.5" aria-hidden="true" />
          </IconButton>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <IconButton
                  size="sm"
                  label={t('preview.highlighter')}
                  aria-pressed={showKeywordMarks}
                  data-probe="preview-highlighter"
                  disabled={keywords.length === 0}
                  className={cn('rounded', showKeywordMarks && 'bg-accent-wash text-accent-ink')}
                  onClick={() => setShowKeywordMarks(!showKeywordMarks)}
                >
                  <Highlighter className="size-3.5" aria-hidden="true" />
                </IconButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('preview.highlighterPending')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        className="relative mx-auto"
        style={{ width: A4_PX.w * zoom, height: contentHeight * zoom }}
      >
        <div
          ref={contentRef}
          data-probe="preview-content"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: A4_PX.w }}
        >
          {withRenderProbe(
            <TemplateRenderer
              plan={plan}
              spec={spec}
              keywords={keywords}
              showMarks={showKeywordMarks}
            />,
            'preview-tree',
          )}
        </div>
        {/* §5.5 — satu sapuan garis scan saat Check ATS berjalan; hormati
            reduced-motion (durasi 0,01ms di media query tokens.css). */}
        {isChecking ? <ScanSweep /> : null}
      </div>
    </section>
  )
}

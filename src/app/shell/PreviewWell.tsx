import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { usePreviewPlans } from '@/features/preview/usePagination'
import { usePreviewPrefs } from '@/features/preview/usePreviewPrefs'
import { withRenderProbe } from '@/features/preview/renderProbe'
import { ScanSweep } from '@/features/preview/ScanSweep'
import {
  FIT_PAD_PX,
  FIT_RECALC_DEBOUNCE_MS,
  MIN_ZOOM,
  ZOOM_STEP,
  clamp,
  fitScaleFor,
  maxZoomFor,
  zoomPresetsFor,
} from '@/features/preview/previewZoom'
import { useCanvasFull } from '../useCanvasFull'
import { CanvasExitButton } from './CanvasExitButton'
import { CanvasSectionMenu } from './CanvasSectionMenu'
import { TampilanMenu } from './TampilanMenu'

// Konstanta & rumus zoom dipindah ke `@/features/preview/previewZoom` (FASE 13
// T0.1) supaya batas-batasnya bisa diuji tanpa DOM. Konstanta lama diekspor
// ulang di sini supaya impor lama tidak putus; rumus (`fitScaleFor`,
// `maxZoomFor`) diambil dari modulnya masing-masing.
export {
  FIT_PAD_PX,
  FIT_PAD_PX_CANVAS,
  FIT_RECALC_DEBOUNCE_MS,
  MAX_ZOOM,
  MAX_ZOOM_CANVAS,
  MIN_ZOOM,
  ZOOM_PRESETS_CANVAS,
  ZOOM_PRESETS_FORM,
  ZOOM_STEP,
} from '@/features/preview/previewZoom'

/**
 * Jarak aman (padding horizontal) well yang sebenarnya.
 *
 * Skala Fit memakai `well.clientWidth` — angka itu **sudah termasuk**
 * padding. Supaya lembar persis pas di kotak konten, padding well harus ikut
 * dikurangi. Padding bisa berbeda per mode (`p-6` di mode form, `lg:p-10` di
 * mode kanvas layar penuh, T2.3), jadi nilainya dibaca dari DOM.
 *
 * `0` berarti stylesheet belum termuat (mis. unit test jsdom) — pakai
 * `FIT_PAD_PX` sebagai cadangan.
 */
const wellPadPx = (well: HTMLElement): number => {
  const style = window.getComputedStyle(well)
  const left = Number.parseFloat(style.paddingLeft)
  const right = Number.parseFloat(style.paddingRight)
  const total = left + right
  return Number.isFinite(total) && total > 0 ? total : FIT_PAD_PX
}

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
  const editMode = useUiStore((state) => state.editMode)

  // T2.1/D10 — plafon zoom mengikuti mode: mode kanvas layar penuh boleh
  // sampai 200% (kertas A4 → 1588×2246 px), mode form tetap 150% supaya
  // pratinjau di samping formulir tidak berubah satu piksel pun.
  const canvasFull = useCanvasFull()
  const maxZoom = maxZoomFor(canvasFull)
  const zoomPresets = zoomPresetsFor(canvasFull)

  /**
   * T4.1/T4.2 — toolbar mode kanvas dirampingkan di bawah 640px.
   *
   * Isi toolbar penuh (495px terukur di 360px) tidak muat di kotak konten well
   * (360 − 48 = 312px): ujungnya terpotong, sehingga pemicu "Tampilan" dan
   * tombol "Keluar" — dua jalan keluar dari mode kanvas — tak terjangkau, dan
   * well ikut bergulir mendatar sehingga kertas ikut bergeser.
   *
   * Di bawah `sm` (640px) toolbar jadi ramping: pemicu "Tampilan" ikon saja,
   * chip halaman + separator disembunyikan, dan penggaris + stabilo pindah ke
   * sheet "Tampilan" di TopBar (`TampilanMenuContent` sudah memuat keduanya,
   * dan TopBar selalu tampil di <1024px) — jadi tidak ada fungsi yang hilang.
   *
   * Mode form **tidak** memakai compaction ini: layoutnya wajib tetap persis
   * seperti sebelum Fase 13 di semua breakpoint.
   */
  const compact = canvasFull

  // C2 — mode kanvas memakai rencana berisi blok guide; rencana isi dokumen
  // tetap dihitung terpisah supaya pemeriksa ATS menilai dokumen, bukan
  // kerangka pemandu.
  const { content, canvas } = usePreviewPlans(doc, templateId, editMode === 'canvas')
  const plan = canvas ?? content
  // T7.6 — pemeriksaan ulang otomatis dipasang di sini karena hanya komponen
  // ini yang punya `PagePlan` terukur: aturan panjang dokumen butuh jumlah
  // halaman nyata, bukan perkiraan.
  useAtsAutoCheck(content.pageCount)
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

  const zoom = fitMode ? fitScale : clamp(zoomPref, MIN_ZOOM, maxZoom)
  const zoomPercent = Math.round(zoom * 100)
  const currentPage = Math.min(visiblePage, plan.pageCount)

  // T2.2 — hitung ulang skala Fit **sebelum** browser menggambar ulang
  // (`useLayoutEffect`), supaya pergantian ke mode kanvas tidak sempat
  // menampilkan "kertas kecil lalu membesar". Debounce 100 ms hanya dipakai
  // untuk perubahan lebar well dari `ResizeObserver`.
  useLayoutEffect(() => {
    const well = wellRef.current
    if (!well) return undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const recompute = () => {
      if (!fitMode) return
      setFitScale(fitScaleFor(well.clientWidth, maxZoom, wellPadPx(well)))
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
  }, [fitMode, maxZoom])

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

  // T2.1 — plafon zoom ikut mode. Tanpa `useCallback` manual: React Compiler
  // sudah memoisasi sendiri, dan aturan `react-hooks/preserve-manual-memoization`
  // menolak dependensi yang bisa berubah (plafon ikut mode).
  const applyZoom = (value: number) => {
    setFitMode(false)
    setZoom(clamp(value, MIN_ZOOM, maxZoom))
    setZoomMenuOpen(false)
  }

  const toggleFit = () => {
    const well = wellRef.current
    const next = !fitMode
    setFitMode(next)
    if (next && well) setFitScale(fitScaleFor(well.clientWidth, maxZoom, wellPadPx(well)))
    setZoomMenuOpen(false)
  }

  return (
    <section
      id="pane-preview"
      ref={wellRef}
      // D13 — `#pane-preview` jadi tujuan fokus saat masuk mode kanvas
      // (kertas = satu-satunya area kerja). `tabIndex={-1}` membuatnya bisa
      // difokuskan tanpa masuk ke urutan Tab.
      tabIndex={-1}
      aria-label={t('workspace.previewTitle')}
      className={cn(
        'bg-workbench min-h-0 overflow-auto shadow-[var(--shadow-well)] p-6 [touch-action:pan-x_pan-y_pinch-zoom]',
        // T2.3 — di layar penuh kertas diberi ruang lebih lega; padding
        // `p-6` di mobile tetap. Padding well dibaca `wellPadPx` untuk
        // perhitungan skala Fit, jadi lembar tetap pas di kotak konten.
        canvasFull && 'lg:p-10',
        className,
      )}
    >
      <div
        className={cn(
          'sticky top-0 z-10 -mt-6 mb-4 flex justify-center',
          // Seiring padding `lg:p-10`, toolbar harus menyetor naik 40px agar
          // tetap menempel di tepi atas well.
          canvasFull && 'lg:-mt-10',
        )}
      >
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
              {zoomPresets.map((preset) => (
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
            disabled={zoom >= maxZoom}
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </IconButton>

          <Separator orientation="vertical" className={cn('h-5', compact && 'max-sm:hidden')} />

          <span data-probe="page-counter" className="text-data text-ink-secondary px-1">
            {t('preview.pageCounter', { page: currentPage, total: plan.pageCount })}
          </span>
          {plan.pageCount > 2 ? (
            <span
              data-probe="page-chip"
              className={cn('text-data text-signal-warn px-1', compact && 'max-sm:hidden')}
            >
              {t('preview.pageChip', { count: plan.pageCount })}
            </span>
          ) : null}

          <Separator orientation="vertical" className={cn('h-5', compact && 'max-sm:hidden')} />

          <IconButton
            size="sm"
            label={t('preview.ruler')}
            aria-pressed={showMarginGuides}
            className={cn(
              'rounded',
              showMarginGuides && 'bg-accent-wash text-accent-ink',
              compact && 'max-sm:hidden',
            )}
            onClick={() => setShowMarginGuides(!showMarginGuides)}
          >
            <Ruler className="size-3.5" aria-hidden="true" />
          </IconButton>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(compact && 'max-sm:hidden')}>
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

          <Separator orientation="vertical" className={cn('h-5', compact && 'max-sm:hidden')} />
          {/* T3.4 (D12) — kontrol struktural pengganti rail yang disembunyikan
              layar penuh; hanya dirender saat `canvasFull`. */}
          <CanvasSectionMenu />
          <TampilanMenu iconOnlyBelowSm={compact} />
          <CanvasExitButton />
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

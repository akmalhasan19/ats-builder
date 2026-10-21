import { Suspense, lazy } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { AtsDockSlot, AtsOverlay } from '@/features/ats/components/AtsDrawer'
import { useAtsDocked } from '@/features/ats/useAtsDock'
import { SkipToContent } from './SkipToContent'
import { useCanvasFull, useCanvasFullscreen } from './useCanvasFull'
import { useCanvasFocus } from './useCanvasFocus'
import { usePanelMode } from './usePanelMode'
import { useUndoRedoShortcuts } from './useUndoRedoShortcuts'
import { workspaceLayoutFor } from './useWorkspaceLayout'
import { FormPane } from './shell/FormPane'
import { ErrorBanner } from './shell/ErrorBanner'
import { MobileTabBar } from './shell/MobileTabBar'
import { PreviewWell } from './shell/PreviewWell'
import { Rail } from './shell/Rail'
import { StickyActionBar } from './shell/StickyActionBar'
import { TopBar } from './shell/TopBar'

// T8.1 — section 2–6 di bawah workspace dimuat sebagai chunk terpisah:
// kode & render-nya tidak boleh menahan paint pertama viewport kerja
// (LCP = lembar A4). Prerender statis untuk crawler disediakan
// scripts/prerender-home.mjs.
const HomeSections = lazy(() =>
  import('@/features/home/HomeSections').then((m) => ({ default: m.HomeSections })),
)

/**
 * §2.4 — satu grid, empat breakpoint. Lebar rail & label diatur CSS (bukan JS)
 * supaya paint pertama sudah final dan CLS tetap 0; `panelMode` dari
 * matchMedia dipakai untuk perilaku (tooltip rail, posisi toast).
 *
 * Drawer ATS ikut grid sebagai kolom ke-4 hanya ≥1600px; di bawah itu ia
 * overlay lewat sheet supaya lembar A4 tidak menyusut.
 *
 * T8.1 — konten homepage (section 2–6) mengalir di bawah workspace dalam satu
 * halaman scroll. Workspace dibatasi tingginya sendiri supaya alur isi →
 * preview → unduh tidak ikut tergulung beranda.
 *
 * Tinggi workspace = `100dvh` dikurangi chrome di atasnya pada tiap breakpoint
 * (TopBar 52/56 + tab mobile 44), bukan hanya di `lg`: `min-height` yang lebih
 * besar dari sisa viewport membuat panel kelengkapan & anchor bawah terpotong
 * di jendela yang pendek, jadi tingginya dipatok presisi dan ruangnya di-scroll
 * internal lewat `overflow-hidden`.
 */
export function AppShell() {
  usePanelMode()
  useUndoRedoShortcuts()
  const panelMode = useUiStore((state) => state.panelMode)
  const activeTab = useUiStore((state) => state.activeTab)
  const editMode = useUiStore((state) => state.editMode)
  const atsDocked = useAtsDocked()
  // D2 — preferensi "kertas layar penuh" (default true) menentukan apakah mode
  // kanvas mengambil satu pane penuh atau tetap berpanel di samping rail.
  const canvasFullscreen = useCanvasFullscreen()
  const layout = workspaceLayoutFor({
    editMode,
    panelMode,
    activeTab,
    atsDocked,
    canvasFullscreen,
  })
  const canvasFull = useCanvasFull()
  // D13 — fokus tidak boleh tersesat saat rail & formulir disembunyikan.
  useCanvasFocus()

  return (
    <TooltipProvider>
      <div
        data-panel-mode={panelMode}
        data-edit-mode={editMode}
        className="bg-surface flex min-h-dvh flex-col"
      >
        <SkipToContent />
        <TopBar />
        {/* §4 — di mode kanvas layar penuh tidak ada tab bar: kertas saja. */}
        {layout.showTabs ? <MobileTabBar /> : null}
        <ErrorBanner />

        {/* C5.4 (D11) — live region: pergantian mode pengerjaan diumumkan ke
            pembaca layar. Commit yang gagal sudah punya `role="alert"` sendiri
            di editor; ini menutup sisi yang tadinya hanya terlihat.
            FASE 13 (T5.2) — di mode kanvas layar penuh pengumanannya menyebut
            "kertas layar penuh", karena itu perubahan tata letak yang besar:
            rail & formulir hilang, kertas jadi satu pane. */}
        <p aria-live="polite" className="sr-only" data-probe="edit-mode-announce">
          {canvasFull
            ? t('canvas.fullscreenAnnounce')
            : t('tampilan.modeAnnounce', {
                mode: t(editMode === 'canvas' ? 'tampilan.modeCanvas' : 'tampilan.modeForm'),
              })}
        </p>

        <main
          id="workspace-main"
          aria-label={t('workspace.heading')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            className={cn(
              'relative grid min-h-0 overflow-hidden pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0',
              layout.gridClass,
              layout.heightClass,
            )}
            style={layout.gridStyle}
          >
            <Rail className={layout.railClass} />
            <FormPane className={layout.formClass} />
            <PreviewWell className={layout.previewClass} />
            {/* D9 — di mode kanvas drawer ATS jadi lapisan di atas kertas, bukan
                kolom grid; jadi slot dock tidak dirender di sana. */}
            {layout.atsMode === 'dock' ? <AtsDockSlot /> : null}
            {/* T8.1 — anchor nav minimal: satu ajakan turun ke galeri template.
                D8 — disembunyikan di mode kanvas: targetnya tidak dirender. */}
            {layout.showHomeAnchor ? (
              <a
                href="#home-templates"
                aria-label={t('home.anchor.templates')}
                data-probe="home-anchor"
                className="bg-raised/90 border-rule text-ink-secondary hover:text-accent-ink hover:border-accent-ink absolute right-3 bottom-20 z-10 flex size-9 items-center justify-center rounded-full border shadow-[var(--shadow-raised)] backdrop-blur-sm transition-colors md:right-6 md:bottom-6"
              >
                <ChevronDown aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>
        </main>

        {/* Section 2–6 di LUAR <main> workspace: landmark footer & nav beranda
            hanya bermakna contentinfo/navigation bila bukan keturunan main.
            D7 — di mode kanvas section ini di-unmount (bukan `hidden`): chunk-nya
            tidak pernah dilihat, dan halaman kerja tidak ikut tergulung. */}
        {!canvasFull ? (
          <Suspense fallback={null}>
            <HomeSections />
          </Suspense>
        ) : null}

        <StickyActionBar />
        <AtsOverlay />
      </div>
    </TooltipProvider>
  )
}

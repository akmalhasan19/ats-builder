import { cn } from 'cn'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { AtsDockSlot, AtsOverlay } from '@/features/ats/components/AtsDrawer'
import { useAtsDocked } from '@/features/ats/useAtsDock'
import { SkipToContent } from './SkipToContent'
import { usePanelMode } from './usePanelMode'
import { FormPane } from './shell/FormPane'
import { MobileTabBar } from './shell/MobileTabBar'
import { PreviewWell } from './shell/PreviewWell'
import { Rail } from './shell/Rail'
import { StickyActionBar } from './shell/StickyActionBar'
import { TopBar } from './shell/TopBar'

/**
 * §2.4 — satu grid, empat breakpoint. Lebar rail & label diatur CSS (bukan JS)
 * supaya paint pertama sudah final dan CLS tetap 0; `panelMode` dari
 * matchMedia dipakai untuk perilaku (tooltip rail, posisi toast).
 *
 * Drawer ATS ikut grid sebagai kolom ke-4 hanya ≥1600px; di bawah itu ia
 * overlay lewat sheet supaya lembar A4 tidak menyusut.
 */
export function AppShell() {
  usePanelMode()
  const panelMode = useUiStore((state) => state.panelMode)
  const activeTab = useUiStore((state) => state.activeTab)
  const atsDocked = useAtsDocked()

  return (
    <TooltipProvider>
      <div
        data-panel-mode={panelMode}
        className="bg-surface flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden"
      >
        <SkipToContent />
        <TopBar />
        <MobileTabBar />

        <main
          id="workspace-main"
          aria-label={t('workspace.heading')}
          className={cn(
            'grid min-h-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 lg:grid-cols-[56px_minmax(360px,1fr)_1fr]',
            !atsDocked && 'xl:grid-cols-[248px_minmax(380px,520px)_1fr]',
          )}
          // Kolom ke-4 hanya ada saat drawer di-dock (≥1600px). Ditulis sebagai
          // inline style, bukan utility `min-[1600px]:…`, karena dua utility
          // grid-cols yang hidup berdampingan bergantung pada urutan CSS —
          // inline style membuat lebar kolom tidak bisa kalah oleh `xl:`.
          style={
            atsDocked ? { gridTemplateColumns: '248px minmax(380px, 520px) 1fr 400px' } : undefined
          }
        >
          <Rail />
          <FormPane className={cn(activeTab === 'form' ? 'block' : 'hidden', 'lg:block')} />
          <PreviewWell className={cn(activeTab === 'preview' ? 'block' : 'hidden', 'lg:block')} />
          <AtsDockSlot />
        </main>

        <StickyActionBar />
        <AtsOverlay />
      </div>
    </TooltipProvider>
  )
}

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { useAtsDockEligible } from '../useAtsDock'
import { AtsPanel } from './AtsPanel'

/**
 * T7.4 — dua bentuk, satu isi: overlay < 1600px (sheet kanan, atau bawah pada
 * mode tab) dan kolom ke-4 yang di-dock ≥ 1600px. `AtsPanel` yang sama dipakai
 * keduanya supaya tidak ada cabang logika yang bisa menyimpang.
 *
 * FASE 13 (D9) — "dock" dibaca lewat `useAtsDockEligible()`: di mode kanvas
 * layar penuh drawer selalu kembali menjadi lapisan, walau ≥1600px.
 */

export function AtsOverlay() {
  const open = useUiStore((state) => state.atsDrawerOpen)
  const setOpen = useUiStore((state) => state.setAtsDrawerOpen)
  const panelMode = useUiStore((state) => state.panelMode)
  const docked = useAtsDockEligible()

  if (docked) return null

  return (
    // Di mode 3 kolom (≥1280px) drawer TIDAK modal: focus harus bisa keluar ke
    // field form saat tombol `Perbaiki →` dipakai (Gate Fase 7). Di bawah itu
    // ia tetap modal — dan ditutup lebih dulu oleh `focusTarget`.
    <Sheet open={open} onOpenChange={setOpen} modal={panelMode !== '3col'}>
      <SheetContent
        side={panelMode === 'tabs' ? 'bottom' : 'right'}
        data-probe="ats-drawer"
        className="p-0 sm:w-[400px]"
        // Non-modal (drawer kiri) supaya fokus bisa keluar ke field form saat
        // `Perbaiki →` dipakai — tapi drawer sendiri tidak ikut tertutup.
        onFocusOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t('ats.drawer.title')}</SheetTitle>
        </SheetHeader>
        <AtsPanel onClose={() => setOpen(false)} showClose />
      </SheetContent>
    </Sheet>
  )
}

export function AtsDockSlot() {
  const open = useUiStore((state) => state.atsDrawerOpen)
  const setOpen = useUiStore((state) => state.setAtsDrawerOpen)
  const docked = useAtsDockEligible()

  if (!docked || !open) return null

  return (
    <aside
      data-probe="ats-drawer"
      aria-labelledby="ats-drawer-title"
      className="border-rule bg-surface min-h-0 w-[400px] overflow-hidden border-l"
    >
      <AtsPanel onClose={() => setOpen(false)} showClose />
    </aside>
  )
}

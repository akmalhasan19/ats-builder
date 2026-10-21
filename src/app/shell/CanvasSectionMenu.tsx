import { useState } from 'react'
import { List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { t } from '@/lib/i18n'
import { useUiStore } from '@/store/uiStore'
import { useCanvasFull } from '../useCanvasFull'
import { SectionAddButton, SectionListNav } from './SectionListNav'

/**
 * FASE 13 — T3.4 (D12) — pengganti rail di mode kertas layar penuh.
 *
 * Rail memuat satu-satunya jalur menuju kontrol struktural di desktop: pilih
 * bagian, sembunyikan/tampilkan, ubah urutan, hapus. Menyembunyikan rail tanpa
 * penggantinya menyandera kemampuan itu (D12). Menambah **konten** tidak perlu
 * menu ini — sudah ditutup `CanvasGhostRow` di atas kertas (C4).
 *
 * Bentuknya ikut panel mode: popover di ≥1024px, sheet bawah di <1024px
 * (preseden `StickyActionBar`). "+ Tambah bagian" membuka dialog katalog yang
 * sudah ada lewat `uiStore.sectionCatalogOpen` (C4.4), bukan duplikasinya.
 */
export function CanvasSectionMenu() {
  const [open, setOpen] = useState(false)
  const canvasFull = useCanvasFull()
  const panelMode = useUiStore((state) => state.panelMode)
  const setCatalogOpen = useUiStore((state) => state.setSectionCatalogOpen)

  if (!canvasFull) return null

  const asSheet = panelMode === 'tabs'
  const requestAdd = () => {
    setOpen(false)
    setCatalogOpen(true)
  }

  if (asSheet) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <IconButton
            size="sm"
            variant="ghost"
            label={t('canvas.sectionsMenu')}
            data-probe="canvas-sections-menu"
            className="rounded"
          >
            <List className="size-3.5" aria-hidden="true" />
          </IconButton>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex h-[80dvh] flex-col p-0">
          <SheetHeader className="border-rule border-b p-4">
            <SheetTitle>{t('mobile.sectionsTitle')}</SheetTitle>
            <SheetDescription>{t('rail.visibleOf')}</SheetDescription>
          </SheetHeader>
          <SectionListNav
            allowDelete
            onSelected={() => setOpen(false)}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          />
          <div className="border-rule border-t p-3">
            <SectionAddButton onClick={requestAdd} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-probe="canvas-sections-menu"
          // FASE 13 (T5.2) — nama aksesibel berasal dari kamus, bukan string
          // yang ditulis di komponen. Teks yang terlihat sama persis, jadi
          // aturan "label in name" tetap berlaku.
          aria-label={t('canvas.sectionsMenu')}
          className="gap-1.5 px-2"
        >
          <List aria-hidden="true" className="size-3.5" />
          {t('canvas.sectionsMenu')}
        </Button>
      </PopoverTrigger>
      {/* Lebih lebar dari popover Tampilan (288px): baris bagian membawa
          kotak visibilitas, ikon, nama, titik kelengkapan, dan tiga tombol
          aksi — pada 288px namanya terpotong jadi "Pendid…". */}
      <PopoverContent
        align="end"
        className="flex max-h-[min(70dvh,480px)] w-[336px] flex-col gap-2 p-3"
      >
        <SectionListNav
          allowDelete
          onSelected={() => setOpen(false)}
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        />
        <SectionAddButton onClick={requestAdd} className="h-9" />
      </PopoverContent>
    </Popover>
  )
}

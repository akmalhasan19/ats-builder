import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { t } from '@/lib/i18n'
import { useUiStore } from '@/store/uiStore'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

/* ------------------------------ DropdownMenu ------------------------------ */

function MenuDemo({ onPick }: { onPick: (value: string) => void }) {
  const [checked, setChecked] = useState(true)
  const [size, setSize] = useState('md')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button">Buka aksi</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel inset>Pilihan</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem data-testid="item-salin" onSelect={() => onPick('salin')}>
            Salin
            <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuItem variant="destructive" onSelect={() => onPick('hapus')}>
          Hapus
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem
          checked={checked}
          onCheckedChange={setChecked}
          onSelect={(event) => event.preventDefault()}
        >
          Tandai margin
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup value={size} onValueChange={setSize}>
          <DropdownMenuRadioItem value="sm" onSelect={(event) => event.preventDefault()}>
            Kecil
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="md" onSelect={(event) => event.preventDefault()}>
            Sedang
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Ekspor</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => onPick('pdf')}>PDF</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('DropdownMenu primitif', () => {
  it('buka via klik, item terpanggil, lalu menu menutup', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<MenuDemo onPick={onPick} />)
    expect(screen.queryByRole('menuitem', { name: /^Salin/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Buka aksi' }))
    await user.click(await screen.findByRole('menuitem', { name: /^Salin/ }))
    expect(onPick).toHaveBeenCalledWith('salin')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('buka via Enter dan tutup via Escape', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<MenuDemo onPick={onPick} />)
    screen.getByRole('button', { name: 'Buka aksi' }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(onPick).not.toHaveBeenCalled()
  })

  it('DropdownMenuPortal eksplisit dapat membungkus content dan item tetap terpanggil', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Buka via portal</button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onPick('portal')}>Aksi portal</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>,
    )
    await user.click(screen.getByRole('button', { name: 'Buka via portal' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Aksi portal' }))
    expect(onPick).toHaveBeenCalledWith('portal')
  })

  it('item destruktif, checkbox, radio, label inset, shortcut, dan sub ter-struktur benar', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<MenuDemo onPick={onPick} />)
    await user.click(screen.getByRole('button', { name: 'Buka aksi' }))

    const hapus = await screen.findByRole('menuitem', { name: 'Hapus' })
    expect(hapus).toHaveAttribute('data-variant', 'destructive')

    const margin = screen.getByRole('menuitemcheckbox', { name: 'Tandai margin' })
    expect(margin).toHaveAttribute('aria-checked', 'true')
    await user.click(margin)
    expect(margin).toHaveAttribute('aria-checked', 'false')

    const sedang = screen.getByRole('menuitemradio', { name: 'Sedang' })
    expect(sedang).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('menuitemradio', { name: 'Kecil' }))
    expect(screen.getByRole('menuitemradio', { name: 'Kecil' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    expect(screen.getByRole('menuitem', { name: /Ctrl\+C/ })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Ekspor' }))
    const pdf = await screen.findByRole('menuitem', { name: 'PDF' })
    // sub-content terbuka lewat klik; aktifkan item via keyboard supaya fokus
    // sudah berada di dalam submenu saat Enter diproses Radix.
    pdf.focus()
    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('pdf')
  })
})

/* ---------------------------------- Sheet ---------------------------------- */

function SheetDemo({ side }: { side: 'bottom' | 'right' }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button">Buka {side}</button>
      </SheetTrigger>
      <SheetContent
        side={side}
        aria-label={t('home.footer.privacyLine')}
        showCloseButton={side === 'right'}
      >
        <SheetHeader>
          <SheetTitle>{t(`home.step.1.title` as never)}</SheetTitle>
          <SheetDescription>{t(`home.step.1.body` as never)}</SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button variant="secondary">{t('common.close')}</Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet primitif', () => {
  it('variant bawah: buka-tutup, aria-label, overlay, dan fokus kembali ke trigger', async () => {
    const user = userEvent.setup()
    render(<SheetDemo side="bottom" />)
    const trigger = screen.getByRole('button', { name: 'Buka bottom' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: t('home.step.1.title' as never) })
    // Radix memakai aria-labelledby (SheetTitle) sebagai nama; aria-label tetap
    // ada di DOM sebagai fallback — diverifikasi lewat atribut mentah.
    expect(dialog.getAttribute('aria-label')).toBe(t('home.footer.privacyLine'))
    expect(dialog).toHaveAttribute('data-side', 'bottom')
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull()
    expect(within(dialog).getByText(t('home.step.1.title' as never))).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: t('common.close') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(trigger)
  })

  it('variant kanan: tombol close default (sr-only "Tutup") dan Escape menutup', async () => {
    const user = userEvent.setup()
    render(<SheetDemo side="right" />)
    const trigger = screen.getByRole('button', { name: 'Buka right' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-side', 'right')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(trigger)
  })

  it('side top/left + showCloseButton=false + SheetFooter ter-render terstruktur', async () => {
    const user = userEvent.setup()
    render(
      <Sheet defaultOpen>
        <SheetContent side="top" aria-label="panel atas" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>Panel atas</SheetTitle>
          </SheetHeader>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">{t('common.close')}</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    )
    const top = await screen.findByRole('dialog', { name: 'Panel atas' })
    expect(top.getAttribute('aria-label')).toBe('panel atas')
    expect(top).toHaveAttribute('data-side', 'top')
    // showCloseButton=false → hanya satu tombol (footer), tanpa X default
    expect(within(top).getAllByRole('button')).toHaveLength(1)
    expect(within(top).getByRole('button', { name: t('common.close') })).toBeInTheDocument()
    await user.click(within(top).getByRole('button', { name: t('common.close') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    render(
      <Sheet defaultOpen>
        <SheetContent side="left" aria-label="panel kiri">
          <SheetTitle>Panel kiri</SheetTitle>
        </SheetContent>
      </Sheet>,
    )
    const left = await screen.findByRole('dialog', { name: 'Panel kiri' })
    expect(left).toHaveAttribute('data-side', 'left')
  })
})

/* ---------------------------------- Dialog --------------------------------- */

function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button">Hapus dokumen</button>
      </DialogTrigger>
      <DialogContent aria-labelledby="dlg-title" aria-describedby="dlg-desc">
        <DialogHeader>
          <DialogTitle id="dlg-title">Yakin hapus dokumen?</DialogTitle>
          <DialogDescription id="dlg-desc">{t('home.footer.privacyLine')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive">Hapus permanen</Button>
          <DialogClose asChild>
            <Button variant="ghost">Batal</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog primitif', () => {
  it('role=dialog + modal (scroll-lock), Esc menutup, dan fokus awal masuk ke konten', async () => {
    const user = userEvent.setup()
    render(<DialogDemo />)
    const trigger = screen.getByRole('button', { name: 'Hapus dokumen' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Yakin hapus dokumen?' })
    // Catatan: @radix-ui/react-dialog 1.3.x tidak lagi menulis aria-modal di
    // Content (perubahan upstream) — modalitas dibuktikan lewat scroll-lock.
    expect(document.body).toHaveAttribute('data-scroll-locked', '1')
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content')
    // fokus pindah ke dalam dialog (konten/element pertama)
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(trigger)
  })

  it('Tab berputar di dalam dialog (focus trap): fokus tak pernah keluar dari konten', async () => {
    const user = userEvent.setup()
    render(<DialogDemo />)
    const trigger = screen.getByRole('button', { name: 'Hapus dokumen' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const visited: string[] = []
    for (let i = 0; i < 6; i += 1) {
      await user.tab()
      const active = document.activeElement as HTMLElement
      expect(dialog.contains(active), `tab #${i}`).toBe(true)
      visited.push(active.textContent ?? '')
    }
    // setelah melewati elemen terakhir, fokus wrap ke salah satu tombol dalam dialog
    expect(visited.filter((text) => text.includes('Hapus permanen')).length).toBeGreaterThanOrEqual(
      1,
    )
    expect(document.activeElement).not.toBe(trigger)
  })

  it('tombol destruktif memakai varian benar dan DialogClose menutup', async () => {
    const user = userEvent.setup()
    render(<DialogDemo />)
    await user.click(screen.getByRole('button', { name: 'Hapus dokumen' }))
    const dialog = await screen.findByRole('dialog')
    const danger = within(dialog).getByRole('button', { name: 'Hapus permanen' })
    expect(danger).toHaveAttribute('data-variant', 'destructive')
    expect(danger.className).toContain('bg-signal-bad')
    await user.click(within(dialog).getByRole('button', { name: 'Batal' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('showCloseButton=false meniadakan X default; DialogFooter variant secondary tetap ada', async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent aria-labelledby="dlg2" aria-describedby="dlg2d" showCloseButton={false}>
          <DialogTitle id="dlg2">Tanpa tombol X</DialogTitle>
          <DialogDescription id="dlg2d">hanya konten</DialogDescription>
          <DialogFooter showCloseButton>{t('common.close')}</DialogFooter>
        </DialogContent>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: t('common.close') })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button')).toHaveLength(1)
  })
})

/* -------------------------------- Accordion -------------------------------- */

describe('Accordion primitif', () => {
  it('item membuka dan menutup dengan aria-expanded yang benar', async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="satu">
          <AccordionTrigger>Pertanyaan satu</AccordionTrigger>
          <AccordionContent>Jawaban satu</AccordionContent>
        </AccordionItem>
        <AccordionItem value="dua">
          <AccordionTrigger>Pertanyaan dua</AccordionTrigger>
          <AccordionContent>Jawaban dua</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const first = screen.getByRole('button', { name: 'Pertanyaan satu' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Jawaban satu')).not.toBeInTheDocument()
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Jawaban satu')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pertanyaan dua' }))
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Pertanyaan dua' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Pertanyaan dua' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

/* --------------------------------- Sonner ---------------------------------- */

describe('Toaster sonner (provider asli)', () => {
  it('me-render tanpa melempar dan toast menampilkan teks aslinya', async () => {
    const view = render(<Toaster />)
    // wilayah a11y sonner selalu ada meskipun belum ada toast
    expect(view.baseElement.querySelector('[aria-label="Notifications alt+T"]')).not.toBeNull()
    act(() => {
      toast('Perubahan disimpan di perangkat')
    })
    const item = await screen.findByText('Perubahan disimpan di perangkat', {}, { timeout: 3000 })
    expect(item.closest('[data-sonner-toast]')).not.toBeNull()
    act(() => {
      toast.dismiss()
    })
  })

  it('posisi toaster ikut panelMode: bottom-right default, top-center saat tabs', async () => {
    const view = render(<Toaster />)
    act(() => {
      useUiStore.setState({ panelMode: '3col' })
      toast('probe posisi')
    })
    await screen.findByText('probe posisi', {}, { timeout: 3000 })
    const toaster = () => view.baseElement.querySelector('[data-sonner-toaster]')
    await waitFor(() => expect(toaster()?.getAttribute('data-x-position')).toBe('right'))
    expect(toaster()?.getAttribute('data-y-position')).toBe('bottom')
    act(() => {
      useUiStore.setState({ panelMode: 'tabs' })
    })
    await waitFor(() => expect(toaster()?.getAttribute('data-y-position')).toBe('top'))
    expect(toaster()?.getAttribute('data-x-position')).toBe('center')
    act(() => {
      toast.dismiss()
      useUiStore.setState({ panelMode: '3col' })
    })
  })
})

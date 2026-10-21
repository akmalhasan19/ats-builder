import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getSectionCompleteness, sectionRegistry } from '@/features/sections/registry'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import type { SectionInstance } from '@/types/resume'
import { t } from '@/lib/i18n'
import { useCanvasFull } from '../useCanvasFull'

function CompletenessDots({ dots }: { dots: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((step) => {
        const filled = dots >= step
        const isOk = dots === 3
        return (
          <span
            key={step}
            className={cn(
              'size-1 rounded-full transition-colors',
              isOk
                ? 'bg-signal-ok'
                : filled
                  ? 'bg-accent'
                  : 'border-rule-strong border bg-transparent',
            )}
          />
        )
      })}
    </div>
  )
}

/**
 * FASE 13 — T3.4 (D12) — daftar bagian yang dipakai ulang oleh dua host:
 * sheet "Bagian" di bar bawah mobile (`StickyActionBar`) dan menu "Bagian"
 * di toolbar kanvas, satu-satunya jalan menuju kontrol struktural setelah rail
 * disembunyikan. Satu implementasi supaya keduanya tidak bisa menyimpang.
 *
 * `allowDelete` hanya dinyalakan dari menu kanvas: bar bawah mobile tidak
 * pernah punya tombol hapus, dan mode form harus tetap seperti sebelumnya.
 */
export function SectionListNav({
  onSelected,
  allowDelete = false,
  className,
}: {
  /** Host menutup dirinya (sheet/popover) begitu bagian dipilih. */
  onSelected?: () => void
  allowDelete?: boolean
  className?: string
}) {
  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)
  const setActiveSection = useDocStore((state) => state.setActiveSection)
  const toggleSectionVisible = useDocStore((state) => state.toggleSectionVisible)
  const reorderSection = useDocStore((state) => state.reorderSection)
  const removeSection = useDocStore((state) => state.removeSection)
  const setActiveTab = useUiStore((state) => state.setActiveTab)
  // Di layar penuh tidak ada tab dan `#pane-form` disembunyikan, jadi memindahkan
  // tab ke formulir hanya membuat pilihan bagian tampak mati.
  const canvasFull = useCanvasFull()
  const [deleteTarget, setDeleteTarget] = useState<SectionInstance | null>(null)

  const requestDelete = (section: SectionInstance): void => {
    // Sama seperti rail: bagian yang sudah terisi minta konfirmasi dulu.
    if (getSectionCompleteness(section).filled > 0) setDeleteTarget(section)
    else removeSection(section.id)
  }

  return (
    <>
      <nav className={cn('flex flex-col gap-2', className)}>
        {sections.map((section, index) => {
          const entry = sectionRegistry[section.kind]
          const Icon = entry.icon
          const active = section.id === activeSectionId
          const label = t(entry.labelId)
          const completeness = getSectionCompleteness(section)

          return (
            <div
              key={section.id}
              className={cn(
                'border-rule bg-raised flex h-12 items-center gap-2 rounded-md border px-3',
                active && 'border-accent-ink bg-accent-wash',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={section.visible}
                aria-label={`${t('rail.toggleVisibility')}: ${label}`}
                onClick={() => toggleSectionVisible(section.id)}
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                  section.visible
                    ? 'border-accent-ink bg-accent text-accent-on'
                    : 'border-rule-strong bg-raised text-transparent',
                )}
              >
                <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  setActiveSection(section.id)
                  if (!canvasFull) setActiveTab('form')
                  onSelected?.()
                }}
                className="flex min-w-0 flex-1 items-center gap-2 truncate py-2 text-left"
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0',
                    active ? 'text-accent-ink' : 'text-ink-tertiary',
                  )}
                />
                <span
                  className={cn(
                    'text-rail-label truncate',
                    !section.visible && 'text-ink-tertiary opacity-55',
                  )}
                >
                  {label}
                </span>
              </button>

              <CompletenessDots dots={completeness.dots} />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${t('rail.moveUp')}: ${label}`}
                  onClick={() => reorderSection(index, index - 1)}
                  className="text-ink-tertiary hover:text-ink active:bg-hover flex size-8 items-center justify-center rounded disabled:opacity-20"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={index === sections.length - 1}
                  aria-label={`${t('rail.moveDown')}: ${label}`}
                  onClick={() => reorderSection(index, index + 1)}
                  className="text-ink-tertiary hover:text-ink active:bg-hover flex size-8 items-center justify-center rounded disabled:opacity-20"
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                {allowDelete ? (
                  <button
                    type="button"
                    aria-label={`${t('rail.delete')}: ${label}`}
                    onClick={() => requestDelete(section)}
                    className="text-ink-tertiary hover:text-signal-bad active:bg-bad-wash flex size-8 items-center justify-center rounded"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </nav>

      {allowDelete ? (
        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {deleteTarget
                  ? t('rail.deleteConfirmTitle', {
                      name: t(sectionRegistry[deleteTarget.kind].labelId),
                    })
                  : ''}
              </DialogTitle>
              <DialogDescription>{t('rail.deleteConfirmBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteTarget) removeSection(deleteTarget.id)
                  setDeleteTarget(null)
                }}
              >
                {t('rail.deleteConfirmAction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

/** Tombol "+ Tambah bagian" — host menentukan dialog katalog yang dipakai. */
export function SectionAddButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-rule-strong text-button text-ink-secondary hover:border-accent-ink hover:text-accent-ink hover:bg-accent-wash flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed transition-colors',
        className,
      )}
    >
      <Plus className="size-4" aria-hidden="true" />
      <span>{t('rail.addSection')}</span>
    </button>
  )
}

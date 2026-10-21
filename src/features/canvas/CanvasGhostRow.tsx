import { memo, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DOC_LIMITS } from '@/schema/resume'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { addCanvasBullet, addCanvasEntry } from './canvasCommit'
import {
  blockKeyForField,
  bulletListKeyOf,
  entryRecordOf,
  firstEntryFieldPath,
} from './canvasFields'
import { startCanvasEdit } from './canvasEditZoom'
import type { CanvasGhost } from './canvasGhosts'
import type { ResumeDoc } from '@/types/resume'

/**
 * C4.4 — ghost row struktural di atas kertas (D10): satu baris dashed penuh
 * lebar konten yang menambah entri, bullet, atau bagian, lalu langsung membuka
 * sesi edit field pertama hasil tambahannya.
 *
 * Ghost hanya ada di mode kanvas dan tidak pernah ikut terukur sebagai isi
 * dokumen (`§5.2`): ia dirender sebagai tetangga blok, bukan di dalam wrapper
 * blok yang diukur `ResizeObserver`. Batas `DOC_LIMITS` mematikan tombolnya
 * dengan tooltip berisi alasan, sama seperti tombol tambah di form (T9.6).
 */

const GHOST_CLASS = cn(
  'border-rule-strong text-button text-ink-secondary hover:border-accent-ink hover:text-accent-ink hover:bg-accent-wash',
  'flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-1.5',
  'transition-colors duration-[var(--dur-fast)] disabled:text-ink-tertiary disabled:hover:border-rule-strong disabled:hover:bg-transparent',
)

const atLimitFor = (doc: ResumeDoc, ghost: CanvasGhost): boolean => {
  if (ghost.kind === 'bullet') {
    const list = bulletListKeyOf(ghost.entryKind)
    if (!list) return false
    const entry = entryRecordOf(doc, ghost.sectionId, ghost.entryId)
    const raw = entry?.[list]
    const count = Array.isArray(raw) ? raw.length : 0
    return count >= DOC_LIMITS.bulletsPerEntry
  }
  if (ghost.kind === 'entry') {
    const section = doc.sections.find((item) => item.id === ghost.sectionId)
    if (!section || !('entries' in section.data)) return false
    return (section.data.entries as unknown[]).length >= DOC_LIMITS.entriesPerSection
  }
  return false
}

export const CanvasGhostRow = memo(function CanvasGhostRow({ ghost }: { ghost: CanvasGhost }) {
  const setSectionCatalogOpen = useUiStore((state) => state.setSectionCatalogOpen)
  const atLimit = useDocStore((state) => atLimitFor(state.doc, ghost))

  const label =
    ghost.kind === 'entry'
      ? t('canvas.ghost.addEntry')
      : ghost.kind === 'bullet'
        ? t('canvas.ghost.addBullet')
        : t('canvas.ghost.addSection')

  const limitReason =
    ghost.kind === 'entry'
      ? t('limits.entries', { max: DOC_LIMITS.entriesPerSection })
      : ghost.kind === 'bullet'
        ? t('limits.bullets', { max: DOC_LIMITS.bulletsPerEntry })
        : null

  const run = (event: MouseEvent<HTMLButtonElement>) => {
    if (ghost.kind === 'section') {
      // Dialog katalog bagian dipakai ulang dari rail (D10) — tidak ada dialog kedua.
      setSectionCatalogOpen(true)
      return
    }
    // D7 + addendum layar sempit — editor yang akan dibuka harus terbaca,
    // dan field yang diedit dipusatkan horizontal.
    if (ghost.kind === 'entry') {
      const entryId = addCanvasEntry(ghost.sectionId)
      if (!entryId) return
      const fieldPath = firstEntryFieldPath(ghost.entryKind, entryId)
      startCanvasEdit(event.currentTarget, {
        blockKey: blockKeyForField(ghost.sectionId, fieldPath),
        sectionId: ghost.sectionId,
        entryId,
        fieldPath,
        kind: 'input',
      })
      return
    }

    const index = addCanvasBullet(ghost.sectionId, ghost.entryId, ghost.entryKind)
    if (index === null) return
    const list = bulletListKeyOf(ghost.entryKind)
    if (!list) return
    const fieldPath = `entries.${ghost.entryKind}.${ghost.entryId}.${list}[${index}]`
    startCanvasEdit(event.currentTarget, {
      blockKey: `${ghost.sectionId}:${ghost.entryId}:l${index}`,
      sectionId: ghost.sectionId,
      entryId: ghost.entryId,
      fieldPath,
      kind: 'textarea',
    })
  }

  const button = (
    <button
      type="button"
      data-canvas-ghost={ghost.kind}
      data-probe={`canvas-ghost-${ghost.kind}`}
      className={GHOST_CLASS}
      disabled={atLimit}
      onClick={run}
    >
      <Plus aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  )

  if (!limitReason) return <div className="canvas-ghost-row">{button}</div>

  return (
    <div className="canvas-ghost-row">
      <Tooltip>
        <TooltipTrigger asChild>
          {/* disabled button tidak mengirim event hover; pemicu tooltip dibungkus span,
              pola yang sama dengan toggle stabilo di toolbar pratinjau. */}
          <span className="block">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{limitReason}</TooltipContent>
      </Tooltip>
    </div>
  )
})

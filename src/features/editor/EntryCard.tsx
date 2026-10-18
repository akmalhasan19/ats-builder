import { useState, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ChevronRight, Copy, GripVertical, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

export type EntryCardProps = {
  id: string
  title: string
  subtitle?: string
  expanded: boolean
  onToggleExpand: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  hasError?: boolean
  errorCount?: number
  hasData?: boolean
  children: ReactNode
}

export function EntryCard({
  id,
  title,
  subtitle,
  expanded,
  onToggleExpand,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  hasError,
  errorCount,
  hasData,
  children,
}: EntryCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleDeleteClick = () => {
    if (hasData) {
      setConfirmOpen(true)
    } else {
      onDelete()
    }
  }

  const handleConfirmDelete = () => {
    setConfirmOpen(false)
    onDelete()
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        data-entry-id={id}
        className={cn(
          'group border-rule bg-raised relative mb-2.5 overflow-hidden rounded-lg border transition-all duration-[var(--dur-fast)]',
          isDragging && 'opacity-30',
          hasError && 'shadow-[inset_2px_0_0_var(--color-signal-bad)]',
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleExpand}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onToggleExpand()
            }
          }}
          aria-expanded={expanded}
          aria-label={expanded ? t('entry.collapse') : t('entry.expand')}
          className="hover:bg-hover flex h-12 cursor-pointer items-center gap-2 px-3 transition-colors select-none"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'text-ink-tertiary size-3.5 shrink-0 transition-transform duration-[var(--dur-fast)]',
              expanded && 'rotate-90',
            )}
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-rail-label text-ink truncate font-semibold">
              {title || t('entry.untitled')}
            </h2>
            {subtitle ? (
              <p className="text-data text-ink-secondary truncate font-mono">{subtitle}</p>
            ) : null}
          </div>

          {hasError && errorCount && errorCount > 0 ? (
            <span className="text-hint bg-bad-wash text-signal-bad rounded px-1.5 py-0.5 font-mono font-medium">
              {t('entry.issues', { count: errorCount })}
            </span>
          ) : null}

          <div className="flex shrink-0 items-center gap-1">
            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center transition-opacity">
              <button
                type="button"
                disabled={!canMoveUp}
                aria-label={t('entry.moveUp')}
                onClick={(event) => {
                  event.stopPropagation()
                  onMoveUp()
                }}
                className="text-ink-tertiary hover:text-ink flex size-7 items-center justify-center rounded disabled:opacity-20"
              >
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                aria-label={t('entry.moveDown')}
                onClick={(event) => {
                  event.stopPropagation()
                  onMoveDown()
                }}
                className="text-ink-tertiary hover:text-ink flex size-7 items-center justify-center rounded disabled:opacity-20"
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              aria-label={t('rail.dragHandle')}
              onClick={(event) => event.stopPropagation()}
              className="text-ink-tertiary hover:text-cyanotype opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex size-6 cursor-grab items-center justify-center transition-opacity active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={t('entry.duplicate')}
              onClick={(event) => {
                event.stopPropagation()
                onDuplicate()
              }}
              className="text-ink-tertiary hover:text-cyanotype opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex size-7 items-center justify-center rounded transition-opacity"
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={t('entry.delete')}
              onClick={(event) => {
                event.stopPropagation()
                handleDeleteClick()
              }}
              className="text-ink-tertiary hover:text-signal-bad opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex size-7 items-center justify-center rounded transition-opacity"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {expanded ? <div className="border-rule border-t p-3.5">{children}</div> : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('entry.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('entry.deleteConfirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DOC_LIMITS } from '@/schema/resume'
import { t } from '@/lib/i18n'
import type { LucideIcon } from 'lucide-react'

export type EntryListProps<T extends { id: string }> = {
  entries: T[]
  onReorder: (from: number, to: number) => void
  onAdd: () => void
  addLabel: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyBody: string
  renderEntry: (
    entry: T,
    index: number,
    isExpanded: boolean,
    toggleExpanded: () => void,
    canMoveUp: boolean,
    canMoveDown: boolean,
  ) => ReactNode
}

export function EntryList<T extends { id: string }>({
  entries,
  onReorder,
  onAdd,
  addLabel,
  emptyIcon,
  emptyTitle,
  emptyBody,
  renderEntry,
}: EntryListProps<T>) {
  // Simpan ID entri yang saat ini terbuka. Default ke entri pertama bila ada.
  const [expandedId, setExpandedId] = useState<string | null>(entries[0]?.id ?? null)

  // T3.3 — entri yang baru ditambahkan langsung terbuka dan ter-scroll ke
  // pandangan; ref menyimpan id ronde render sebelumnya untuk mendeteksinya.
  const prevIdsRef = useRef<string[] | null>(null)

  useEffect(() => {
    const ids = entries.map((entry) => entry.id)
    const prev = prevIdsRef.current
    prevIdsRef.current = ids

    if (!prev || ids.length <= prev.length) return
    const addedId = ids.find((id) => !prev.includes(id))
    if (!addedId) return

    setExpandedId(addedId)
    requestAnimationFrame(() => {
      document.querySelector(`[data-entry-id="${addedId}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  }, [entries])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = entries.findIndex((entry) => entry.id === active.id)
      const newIndex = entries.findIndex((entry) => entry.id === over.id)
      if (oldIndex >= 0 && newIndex >= 0) {
        onReorder(oldIndex, newIndex)
      }
    }
  }

  const handleAdd = () => {
    onAdd()
  }

  const max = DOC_LIMITS.entriesPerSection
  const atLimit = entries.length >= max

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          body={emptyBody}
          action={
            <Button onClick={handleAdd}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {addLabel}
            </Button>
          }
        />
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={entries.map((entry) => entry.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {entries.map((entry, index) => {
                  const isExpanded = expandedId === entry.id
                  const toggleExpanded = () =>
                    setExpandedId((current) => (current === entry.id ? null : entry.id))

                  return renderEntry(
                    entry,
                    index,
                    isExpanded,
                    toggleExpanded,
                    index > 0,
                    index < entries.length - 1,
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>

          <div>
            <Button variant="secondary" onClick={handleAdd} className="w-full" disabled={atLimit}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {addLabel}
            </Button>
            {atLimit ? (
              <p className="text-hint mt-1.5 font-mono">{t('limits.entries', { max })}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

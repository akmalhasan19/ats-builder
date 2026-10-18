import { useEffect, useRef, type ClipboardEvent } from 'react'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { startsWithActionVerb, containsMetric } from '@/lib/text'
import { t } from '@/lib/i18n'

export type BulletListEditorProps = {
  idPrefix: string
  bullets: string[]
  onChange: (bullets: string[]) => void
  label?: string
}

function BulletItem({
  id,
  bulletId,
  index,
  total,
  text,
  onTextChange,
  onPasteMulti,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  id: string
  bulletId: string
  index: number
  total: number
  text: string
  onTextChange: (newText: string) => void
  onPasteMulti: (pastedLines: string[]) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bulletId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.max(38, el.scrollHeight)}px`
    }
  }, [text])

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const paste = event.clipboardData.getData('text')
    if (paste && (paste.includes('\n') || paste.includes('\r'))) {
      const rawLines = paste.split(/\r?\n/)
      const cleaned = rawLines
        .map((line) => line.replace(/^[\s•*›\-–—]+\s*/, '').trim())
        .filter((line) => line.length > 0)

      if (cleaned.length > 1) {
        event.preventDefault()
        onPasteMulti(cleaned)
      }
    }
  }

  const length = text.length
  const tooShort = length > 0 && length < 40
  const tooLong = length > 200
  // T3.5 — dua deteksi non-blocking; kata kerja didahulukan agar satu hint
  // per bullet, bukan dua baris yang bersaing.
  const missingVerb = length > 25 && !startsWithActionVerb(text)
  const missingMetric = !missingVerb && length > 25 && !containsMetric(text)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border-rule bg-raised relative flex flex-col gap-1 rounded-md border p-2 transition-colors duration-[var(--dur-fast)]',
        isDragging && 'opacity-30',
      )}
    >
      <div className="flex items-start gap-2">
        <label htmlFor={id} className="sr-only">
          {t('bullet.textLabel', { n: index + 1 })}
        </label>
        <span aria-hidden="true" className="text-data text-ink-tertiary select-none pt-2 font-mono">
          ›
        </span>

        <textarea
          ref={textareaRef}
          id={id}
          rows={1}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onPaste={handlePaste}
          placeholder={t('bullet.placeholder')}
          className="text-input text-ink placeholder:text-ink-tertiary min-h-[38px] flex-1 resize-none bg-transparent py-1.5 leading-[1.55] outline-none"
        />

        <div className="flex shrink-0 items-center gap-0.5 pt-1">
          <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center transition-opacity">
            <button
              type="button"
              disabled={index === 0}
              aria-label={t('bullet.moveUp')}
              onClick={onMoveUp}
              className="text-ink-tertiary hover:text-ink flex size-7 items-center justify-center rounded disabled:opacity-20"
            >
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              aria-label={t('bullet.moveDown')}
              onClick={onMoveDown}
              className="text-ink-tertiary hover:text-ink flex size-7 items-center justify-center rounded disabled:opacity-20"
            >
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            aria-label={t('bullet.dragHandle')}
            className="text-ink-tertiary hover:text-ink opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex size-6 cursor-grab items-center justify-center transition-opacity active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={t('bullet.remove')}
            onClick={onRemove}
            className="text-ink-tertiary hover:text-signal-bad opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex size-7 items-center justify-center rounded transition-opacity"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-1 text-[10px]">
        {missingVerb ? (
          <span className="text-hint text-signal-warn font-mono">{t('bullet.verbHint')}</span>
        ) : missingMetric ? (
          <span className="text-hint text-signal-warn font-mono">{t('bullet.metricHint')}</span>
        ) : (
          <span />
        )}

        {length > 0 ? (
          <span className={cn('text-hint ml-auto font-mono', tooBad(tooLong, tooShort))}>
            {length}{' '}
            {tooShort ? `(${t('bullet.tooShort')})` : tooLong ? `(${t('bullet.tooLong')})` : ''}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function tooBad(tooLong: boolean, tooShort: boolean): string {
  if (tooLong) return 'text-signal-bad font-semibold'
  if (tooShort) return 'text-signal-warn'
  return 'text-ink-tertiary'
}

export function BulletListEditor({ idPrefix, bullets, onChange, label }: BulletListEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = Number(String(active.id).replace('b-', ''))
      const newIndex = Number(String(over.id).replace('b-', ''))
      if (!Number.isNaN(oldIndex) && !Number.isNaN(newIndex)) {
        const next = [...bullets]
        const moved = next.splice(oldIndex, 1)[0]
        if (moved !== undefined) {
          next.splice(newIndex, 0, moved)
          onChange(next)
        }
      }
    }
  }

  const handleUpdate = (index: number, newText: string) => {
    const next = [...bullets]
    next[index] = newText
    onChange(next)
  }

  const handlePasteMulti = (index: number, pastedLines: string[]) => {
    const next = [...bullets]
    next.splice(index, 1, ...pastedLines)
    onChange(next)
  }

  const handleMove = (from: number, to: number) => {
    if (from < 0 || from >= bullets.length || to < 0 || to >= bullets.length) return
    const next = [...bullets]
    const moved = next.splice(from, 1)[0]
    if (moved !== undefined) {
      next.splice(to, 0, moved)
      onChange(next)
    }
  }

  const handleRemove = (index: number) => {
    onChange(bullets.filter((_, idx) => idx !== index))
  }

  const handleAdd = () => {
    onChange([...bullets, ''])
  }

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-label text-ink-secondary">{label}</span> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={bullets.map((_, idx) => `b-${idx}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {bullets.map((bullet, idx) => (
              <BulletItem
                key={`b-${idx}`}
                id={`${idPrefix}-bullet-${idx}`}
                bulletId={`b-${idx}`}
                index={idx}
                total={bullets.length}
                text={bullet}
                onTextChange={(newText) => handleUpdate(idx, newText)}
                onPasteMulti={(pastedLines) => handlePasteMulti(idx, pastedLines)}
                onMoveUp={() => handleMove(idx, idx - 1)}
                onMoveDown={() => handleMove(idx, idx + 1)}
                onRemove={() => handleRemove(idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div>
        <button
          type="button"
          onClick={handleAdd}
          className="text-button text-cyanotype hover:bg-cyanotype-wash inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 transition-colors"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span>{t('bullet.add')}</span>
        </button>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from 'cn'

export type ChipProps = {
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
  className?: string
}

/** §5.4 — tanpa level/rating; chip hanya nama keahlian atau stack. */
function Chip({ children, onRemove, removeLabel, className }: ChipProps) {
  return (
    <span
      className={cn(
        'text-chip-label inline-flex h-6 items-center gap-1 rounded bg-accent-wash px-2 text-accent-ink',
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="hover:bg-accent/10 inline-flex size-4 items-center justify-center rounded-sm"
        >
          <X aria-hidden="true" className="size-[11px]" />
        </button>
      ) : null}
    </span>
  )
}

export { Chip }

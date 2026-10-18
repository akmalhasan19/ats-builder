import type { ReactNode } from 'react'
import { cn } from 'cn'

export type PanelHeaderProps = {
  title: string
  meta?: ReactNode
  className?: string
}

/** §5.3 — eyebrow kiri, counter mono kanan. */
function PanelHeader({ title, meta, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <p className="text-eyebrow">{title}</p>
      {meta ? <span className="text-hint text-ink-tertiary tracking-[0.04em]">{meta}</span> : null}
    </div>
  )
}

export { PanelHeader }

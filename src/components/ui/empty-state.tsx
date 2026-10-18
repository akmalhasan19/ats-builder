import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'

export type EmptyStateProps = {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
  className?: string
}

/** §5.4 — empty state adalah undangan bertindak, bukan layar kosong. */
function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-8 text-center', className)}>
      <span className="bg-surface text-ink-tertiary flex size-12 items-center justify-center rounded-full">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <p className="text-panel-title">{title}</p>
      <p className="text-caption text-ink-secondary max-w-[320px]">{body}</p>
      {action}
    </div>
  )
}

export { EmptyState }

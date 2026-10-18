import type { ReactNode } from 'react'
import { cn } from 'cn'

const badgeVariants = {
  neutral: 'bg-cyanotype-wash text-cyanotype border-transparent',
  ok: 'bg-ok-wash text-signal-ok border-transparent',
  warn: 'bg-warn-wash text-signal-warn border-transparent',
  bad: 'bg-bad-wash text-signal-bad border-transparent',
  outline: 'bg-raised text-ink-secondary border-rule',
} as const

export type BadgeProps = {
  children: ReactNode
  variant?: keyof typeof badgeVariants
  className?: string
}

/** Mono uppercase 10px — dipakai untuk status data, bukan label manusia. */
function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-hint inline-flex h-5 items-center gap-1 rounded border px-1.5 font-medium uppercase',
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export { Badge }

import type { ReactNode } from 'react'
import { cn } from 'cn'

export type EyebrowProps = {
  children: ReactNode
  as?: 'p' | 'span' | 'h2'
  className?: string
}

function Eyebrow({ children, as: Tag = 'p', className }: EyebrowProps) {
  return <Tag className={cn('text-eyebrow', className)}>{children}</Tag>
}

export { Eyebrow }

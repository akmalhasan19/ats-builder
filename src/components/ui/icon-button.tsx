import * as React from 'react'
import { cn } from 'cn'
import { Button } from './button'

const iconSizes = {
  sm: 'size-7',
  md: 'size-8',
  lg: 'size-9',
} as const

export type IconButtonProps = Omit<React.ComponentProps<'button'>, 'aria-label'> & {
  label: string
  size?: keyof typeof iconSizes
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle' | 'destructive'
}

/** §5.5 — kontrol 28/32/36 px; `label` wajib supaya tidak ada tombol tanpa nama. */
function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      variant={variant}
      className={cn('px-0', iconSizes[size], className)}
      {...props}
    />
  )
}

export { IconButton }

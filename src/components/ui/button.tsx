import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Slot } from 'radix-ui'
import { demoFocusRing } from './focus-demo'

/**
 * §5.2 — satu aksi primer per layar. State hover/active/disabled mengikuti
 * tabel top bar, jadi nilai apa pun di sini harus punya padanan di dokumen.
 */
const buttonVariants = cva(
  `${demoFocusRing} inline-flex shrink-0 items-center justify-center gap-2 rounded-md whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--dur-fast)] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-rule disabled:bg-rule disabled:text-ink-tertiary disabled:shadow-none disabled:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]`,
  {
    variants: {
      variant: {
        primary:
          'text-button-primary bg-accent hover:bg-accent-active hover:-translate-y-px active:translate-y-0',
        secondary:
          'text-button-strong border border-accent-ink text-accent-ink hover:bg-accent-wash',
        ghost: 'text-button text-ink-secondary hover:bg-hover hover:text-ink',
        subtle:
          'text-button border border-rule bg-surface text-ink hover:border-rule-strong hover:bg-sunken',
        destructive:
          'text-button-strong bg-signal-bad text-raised hover:brightness-110 active:translate-y-0',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-3',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

function Button({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

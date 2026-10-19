import * as React from 'react'
import { cn } from 'cn'

/** §5.4 — focus memakai border accent + ring 3px, bukan outline ganda. */
export const fieldFocusClasses =
  'focus-visible:border-accent-ink focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none data-[demo-focus=true]:border-accent-ink data-[demo-focus=true]:shadow-[var(--shadow-focus)]'

export const fieldInvalidClasses =
  'aria-invalid:border-signal-bad aria-invalid:shadow-[var(--shadow-focus-bad)]'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'text-input h-[38px] w-full min-w-0 rounded-md border border-rule bg-raised px-[11px] transition-[border-color,box-shadow] duration-[var(--dur-fast)] outline-none placeholder:text-ink-tertiary hover:border-rule-strong disabled:cursor-not-allowed disabled:border-rule disabled:bg-sunken disabled:text-ink-tertiary',
        fieldFocusClasses,
        fieldInvalidClasses,
        className,
      )}
      {...props}
    />
  )
}

export { Input }

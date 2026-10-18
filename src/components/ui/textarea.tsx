import * as React from 'react'
import { cn } from 'cn'
import { fieldFocusClasses, fieldInvalidClasses } from './input'

/** `field-sizing-content` membuat textarea tumbuh sendiri; tanpa JS. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'text-input field-sizing-content min-h-[84px] w-full resize-none rounded-md border border-rule bg-raised px-[11px] py-2.5 leading-[1.55] transition-[border-color,box-shadow] duration-[var(--dur-fast)] outline-none placeholder:text-ink-tertiary hover:border-rule-strong disabled:cursor-not-allowed disabled:border-rule disabled:bg-sunken disabled:text-ink-tertiary',
        fieldFocusClasses,
        fieldInvalidClasses,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

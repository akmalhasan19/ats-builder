import * as React from 'react'
import { cn } from 'cn'
import { CheckIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { demoFocusRing } from './focus-demo'

/** §5.3 — kotak 16px, checked = cyanotype; ini toggle visibilitas, bukan seleksi. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        `peer size-4 shrink-0 rounded-[4px] border border-rule-strong bg-raised transition-colors duration-[var(--dur-fast)] outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-cyanotype data-[state=checked]:bg-cyanotype data-[state=checked]:text-raised ${demoFocusRing}`,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <CheckIcon aria-hidden="true" className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

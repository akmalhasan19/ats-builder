import type { ChangeEvent } from 'react'
import { cn } from 'cn'

export type MonthPickerProps = {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function MonthPicker({
  id,
  value,
  onChange,
  disabled,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: MonthPickerProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  return (
    <input
      type="month"
      id={id}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className={cn(
        'border-rule bg-raised text-input text-ink focus:border-accent-ink focus:shadow-[var(--shadow-focus)] h-[38px] w-full rounded-md border px-3 outline-none transition-colors duration-[var(--dur-fast)] disabled:cursor-not-allowed disabled:opacity-50',
        ariaInvalid &&
          'border-signal-bad focus:border-signal-bad focus:shadow-[var(--shadow-focus-bad)]',
        className,
      )}
    />
  )
}

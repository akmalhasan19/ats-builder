import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from 'cn'
import { Label } from '@/components/ui/label'
import { t } from '@/lib/i18n'

export type ChipsInputProps = {
  id: string
  label?: string
  hint?: string
  chips: string[]
  onChange: (chips: string[]) => void
  placeholder?: string
  error?: string
  className?: string
}

export function ChipsInput({
  id,
  label,
  hint,
  chips,
  onChange,
  placeholder,
  error,
  className,
}: ChipsInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addChip = (rawText: string) => {
    const trimmed = rawText.trim()
    if (!trimmed) return
    if (!chips.includes(trimmed)) {
      onChange([...chips, trimmed])
    }
    setInputValue('')
  }

  const removeChip = (indexToRemove: number) => {
    onChange(chips.filter((_, idx) => idx !== indexToRemove))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addChip(inputValue)
    } else if (event.key === 'Backspace' && !inputValue && chips.length > 0) {
      event.preventDefault()
      removeChip(chips.length - 1)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          {hint ? <span className="text-hint text-ink-tertiary">{hint}</span> : null}
        </div>
      ) : null}

      <div
        className={cn(
          'border-rule bg-raised focus-within:border-accent-ink focus-within:shadow-[var(--shadow-focus)] flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors duration-[var(--dur-fast)]',
          error &&
            'border-signal-bad focus-within:border-signal-bad focus-within:shadow-[var(--shadow-focus-bad)]',
        )}
      >
        {chips.map((chip, idx) => (
          <span
            key={`${chip}-${idx}`}
            className="bg-accent-wash text-accent-ink text-chip-label inline-flex h-6 items-center gap-1 rounded px-2 font-medium"
          >
            <span>{chip}</span>
            <button
              type="button"
              aria-label={t('chip.remove', { name: chip })}
              onClick={() => removeChip(idx)}
              className="hover:opacity-75"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addChip(inputValue)}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="text-input text-ink placeholder:text-ink-tertiary min-w-[120px] flex-1 bg-transparent outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="text-caption text-signal-bad">
          {error}
        </p>
      ) : null}
    </div>
  )
}

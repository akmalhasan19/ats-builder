import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from 'cn'
import { Label } from './label'

type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export type FieldProps = {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

/**
 * §5.4 — label, hint mono, dan pesan error selalu terhubung ke kontrol lewat
 * id yang sama. Kontrol (Input/Textarea) menerima id & aria-describedby dari
 * sini supaya tidak ada field yang lupa dihubungkan.
 */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div data-field-shell className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden="true" className="text-signal-bad">
              *
            </span>
          ) : null}
        </Label>
        {hint ? (
          <span id={hintId} className="text-hint text-ink-tertiary">
            {hint}
          </span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-caption flex items-start gap-1 text-signal-bad"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-[13px] shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

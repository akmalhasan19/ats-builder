import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { t } from '@/lib/i18n'
import { DOC_LIMITS } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'

/**
 * T7.5 — deskripsi lowongan disimpan ke `doc.jobDescription`, jadi ikut
 * tersimpan di perangkat bersama CV (P2). Tidak ada unggahan ke server.
 */
export function JobDescriptionField() {
  const jobDescription = useDocStore((state) => state.doc.jobDescription)
  const setJobDescription = useDocStore((state) => state.setJobDescription)
  const [open, setOpen] = useState(false)
  const value = jobDescription ?? ''

  return (
    <div className="border-rule border-b px-4 py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="hover:bg-hover flex w-full items-center gap-1.5 text-left"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'text-ink-tertiary size-3.5 transition-transform duration-[var(--dur-fast)]',
            open && 'rotate-90',
          )}
        />
        <span className="text-label text-ink-secondary">{t('ats.jd.label')}</span>
      </button>

      {open ? (
        <div className="mt-2">
          <Field id="ats-job-description" label={t('ats.jd.label')} hint={t('ats.jd.hint')}>
            <Textarea
              data-probe="ats-jd-input"
              rows={5}
              value={value}
              placeholder={t('ats.jd.placeholder')}
              onChange={(event) =>
                setJobDescription(event.target.value.slice(0, DOC_LIMITS.jobDescriptionChars))
              }
            />
          </Field>
          {value.length >= DOC_LIMITS.jobDescriptionChars ? (
            <p className="text-hint mt-1.5 font-mono">
              {t('limits.charsAtMax', { max: DOC_LIMITS.jobDescriptionChars })}
            </p>
          ) : null}
          {value !== '' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setJobDescription(null)}
            >
              {t('ats.jd.clear')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

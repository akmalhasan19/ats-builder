import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { wordCount } from '@/lib/text'
import { useDocStore } from '@/store/docStore'
import { t } from '@/lib/i18n'

export function SummaryEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const updateSection = useDocStore((state) => state.updateSection)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const text = (section?.data as { text?: string })?.text ?? ''
  const words = wordCount(text)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.max(100, el.scrollHeight)}px`
    }
  }, [text])

  const handleChange = (newText: string) => {
    updateSection(sectionId, () => ({ text: newText }))
  }

  const handleApplySample = () => {
    handleChange(t('summary.sampleText'))
  }

  return (
    <div className="space-y-3">
      <Field
        id="summary-text"
        label={t('summary.text')}
        hint={t('summary.wordCountTarget', { count: words })}
      >
        <textarea
          ref={textareaRef}
          rows={4}
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={t('summary.textPlaceholder')}
          className="border-rule bg-raised text-input text-ink placeholder:text-ink-tertiary focus:border-cyanotype focus:shadow-[var(--shadow-focus)] min-h-[100px] w-full resize-none rounded-md border p-3 leading-[1.55] outline-none transition-colors duration-[var(--dur-fast)]"
        />
      </Field>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleApplySample}
          className="gap-1.5"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t('summary.exampleBtn')}
        </Button>
      </div>
    </div>
  )
}

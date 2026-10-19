import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/eyebrow'
import { FIRST_RUN_KEY, writeValue } from '@/features/persistence/idb'
import { createEmptyDoc } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'

type FirstRunOption = 'sample' | 'empty' | 'dismiss'

export function FirstRunCard() {
  const [selected, setSelected] = useState<FirstRunOption>('sample')
  const resetDoc = useDocStore((state) => state.resetDoc)
  const setFirstRunSeen = useUiStore((state) => state.setFirstRunSeen)

  const handleContinue = async () => {
    if (selected === 'empty') {
      resetDoc(createEmptyDoc())
      toast(t('firstRun.emptyToast'))
    } else if (selected === 'sample') {
      toast(t('firstRun.sampleToast'))
    }

    setFirstRunSeen(true)
    try {
      await writeValue(FIRST_RUN_KEY, true)
    } catch {
      // non-fatal in memory mode
    }
  }

  const options: { id: FirstRunOption; title: string; desc: string }[] = [
    {
      id: 'sample',
      title: t('firstRun.sampleTitle'),
      desc: t('firstRun.sampleDesc'),
    },
    {
      id: 'empty',
      title: t('firstRun.emptyTitle'),
      desc: t('firstRun.emptyDesc'),
    },
    {
      id: 'dismiss',
      title: t('firstRun.laterTitle'),
      desc: t('firstRun.laterDesc'),
    },
  ]

  return (
    <div className="border-rule bg-raised mb-4 rounded-lg border p-3.5">
      <Eyebrow>{t('firstRun.eyebrow')}</Eyebrow>

      <div className="mt-2.5 space-y-2" role="radiogroup" aria-label={t('firstRun.eyebrow')}>
        {options.map((opt) => {
          const isSelected = selected === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(opt.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-all duration-[var(--dur-fast)]',
                isSelected
                  ? 'border-accent-ink bg-accent-wash border-2'
                  : 'border-rule bg-raised hover:bg-hover',
              )}
            >
              {isSelected ? (
                <CheckCircle2 className="text-accent-ink size-5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="text-ink-tertiary size-5 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-rail-label text-ink font-semibold">{opt.title}</p>
                <p className="text-caption text-ink-secondary mt-0.5">{opt.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3.5 flex justify-end">
        <Button onClick={handleContinue}>{t('firstRun.continue')}</Button>
      </div>
    </div>
  )
}

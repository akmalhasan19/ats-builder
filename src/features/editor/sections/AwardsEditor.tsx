import { Trophy } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { MonthPicker } from '../MonthPicker'
import { awardSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { AwardEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

export function AwardsEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'awards') return null

  const entries = (section.data as { entries: AwardEntry[] }).entries

  const handleUpdate = (entryId: string, mutator: (entry: AwardEntry) => AwardEntry) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as AwardEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('awards.addEntry')}
      emptyIcon={Trophy}
      emptyTitle={t('awards.emptyTitle')}
      emptyBody={t('awards.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = awardSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const subtitle = [entry.issuer, entry.awardedAt].filter(Boolean).join(' · ')
        const hasData = Boolean(entry.title || entry.issuer || entry.description)

        return (
          <EntryCard
            key={entry.id}
            id={entry.id}
            title={entry.title}
            subtitle={subtitle}
            expanded={isExpanded}
            onToggleExpand={toggleExpanded}
            onDuplicate={() => duplicateEntry(sectionId, entry.id)}
            onDelete={() => removeEntry(sectionId, entry.id)}
            onMoveUp={() => reorderEntry(sectionId, index, index - 1)}
            onMoveDown={() => reorderEntry(sectionId, index, index + 1)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasError={!validation.success}
            errorCount={errorCount}
            hasData={hasData}
          >
            <div className="space-y-4">
              <Field
                id={`award-${entry.id}-title`}
                label={t('awards.title')}
                required
                error={errors?.title?._errors[0]}
              >
                <Input
                  placeholder={t('awards.titlePlaceholder')}
                  value={entry.title}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id={`award-${entry.id}-issuer`}
                  label={t('awards.issuer')}
                  hint={t('common.optional')}
                >
                  <Input
                    placeholder={t('awards.issuerPlaceholder')}
                    value={entry.issuer}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        issuer: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id={`award-${entry.id}-awardedAt`}
                  label={t('awards.awardedAt')}
                  error={errors?.awardedAt?._errors[0]}
                >
                  <MonthPicker
                    id={`award-${entry.id}-awardedAt`}
                    value={entry.awardedAt}
                    onChange={(val) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        awardedAt: val,
                      }))
                    }
                  />
                </Field>
              </div>

              <Field
                id={`award-${entry.id}-description`}
                label={t('awards.description')}
                hint={t('common.optional')}
              >
                <Input
                  placeholder={t('awards.descriptionPlaceholder')}
                  value={entry.description}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

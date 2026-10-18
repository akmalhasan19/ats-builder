import { HeartHandshake } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BulletListEditor } from '../BulletListEditor'
import { DateRangeField } from '../DateRangeField'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { volunteeringSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { VolunteeringEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

export function VolunteeringEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'volunteering') return null

  const entries = (section.data as { entries: VolunteeringEntry[] }).entries

  const handleUpdate = (
    entryId: string,
    mutator: (entry: VolunteeringEntry) => VolunteeringEntry,
  ) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as VolunteeringEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('volunteering.addEntry')}
      emptyIcon={HeartHandshake}
      emptyTitle={t('volunteering.emptyTitle')}
      emptyBody={t('volunteering.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = volunteeringSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const datesText = entry.startDate
          ? `${entry.startDate} – ${entry.current ? t('experience.presentChip') : entry.endDate || ''}`
          : ''
        const subtitle = [entry.organization, datesText].filter(Boolean).join(' · ')
        const hasData = Boolean(entry.role || entry.organization || entry.bullets.length > 0)

        return (
          <EntryCard
            key={entry.id}
            id={entry.id}
            title={entry.role}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id={`vol-${entry.id}-role`}
                  label={t('volunteering.role')}
                  required
                  error={errors?.role?._errors[0]}
                >
                  <Input
                    placeholder={t('volunteering.rolePlaceholder')}
                    value={entry.role}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        role: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id={`vol-${entry.id}-org`}
                  label={t('volunteering.organization')}
                  required
                  error={errors?.organization?._errors[0]}
                >
                  <Input
                    placeholder={t('volunteering.organizationPlaceholder')}
                    value={entry.organization}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        organization: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <DateRangeField
                idPrefix={`vol-${entry.id}-dates`}
                startDate={entry.startDate}
                endDate={entry.endDate}
                current={entry.current}
                onStartDateChange={(val) =>
                  handleUpdate(entry.id, (prev) => ({ ...prev, startDate: val }))
                }
                onEndDateChange={(val) =>
                  handleUpdate(entry.id, (prev) => ({ ...prev, endDate: val }))
                }
                onCurrentChange={(val) =>
                  handleUpdate(entry.id, (prev) => ({
                    ...prev,
                    current: val,
                    endDate: val ? '' : prev.endDate,
                  }))
                }
                error={errors?.startDate?._errors[0] || errors?.endDate?._errors[0]}
              />

              <BulletListEditor
                idPrefix={`vol-${entry.id}`}
                bullets={entry.bullets}
                onChange={(bullets) => handleUpdate(entry.id, (prev) => ({ ...prev, bullets }))}
                label={t('volunteering.bulletsLabel')}
              />
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

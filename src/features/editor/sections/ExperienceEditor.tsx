import { Briefcase } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BulletListEditor } from '../BulletListEditor'
import { ChipsInput } from '../ChipsInput'
import { DateRangeField } from '../DateRangeField'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { experienceSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { ExperienceEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

export function ExperienceEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'experience') return null

  const entries = (section.data as { entries: ExperienceEntry[] }).entries

  const handleUpdate = (entryId: string, mutator: (entry: ExperienceEntry) => ExperienceEntry) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as ExperienceEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('experience.addEntry')}
      emptyIcon={Briefcase}
      emptyTitle={t('experience.emptyTitle')}
      emptyBody={t('experience.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = experienceSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const datesSubtitle = entry.startDate
          ? `${entry.startDate} – ${entry.current ? t('experience.presentChip') : entry.endDate || ''}`
          : ''
        const subtitle = [entry.company, datesSubtitle].filter(Boolean).join(' · ')
        const hasData = Boolean(
          entry.role || entry.company || entry.bullets.length > 0 || entry.stack.length > 0,
        )

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
                  id={`exp-${entry.id}-role`}
                  label={t('experience.role')}
                  required
                  error={errors?.role?._errors[0]}
                >
                  <Input
                    placeholder={t('experience.rolePlaceholder')}
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
                  id={`exp-${entry.id}-company`}
                  label={t('experience.company')}
                  required
                  error={errors?.company?._errors[0]}
                >
                  <Input
                    placeholder={t('experience.companyPlaceholder')}
                    value={entry.company}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        company: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <Field
                id={`exp-${entry.id}-location`}
                label={t('experience.location')}
                hint={t('common.optional')}
              >
                <Input
                  placeholder={t('experience.locationPlaceholder')}
                  value={entry.location}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      location: event.target.value,
                    }))
                  }
                />
              </Field>

              <DateRangeField
                idPrefix={`exp-${entry.id}-dates`}
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
                idPrefix={`exp-${entry.id}`}
                bullets={entry.bullets}
                onChange={(bullets) => handleUpdate(entry.id, (prev) => ({ ...prev, bullets }))}
                label={t('experience.bulletsLabel')}
              />

              <ChipsInput
                id={`exp-${entry.id}-stack`}
                label={t('experience.stackLabel')}
                hint={t('common.optional')}
                chips={entry.stack}
                onChange={(stack) => handleUpdate(entry.id, (prev) => ({ ...prev, stack }))}
                placeholder={t('experience.stackPlaceholder')}
              />
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

import { GraduationCap } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BulletListEditor } from '../BulletListEditor'
import { DateRangeField } from '../DateRangeField'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { educationSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { EducationEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

export function EducationEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'education') return null

  const entries = (section.data as { entries: EducationEntry[] }).entries

  const handleUpdate = (entryId: string, mutator: (entry: EducationEntry) => EducationEntry) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as EducationEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('education.addEntry')}
      emptyIcon={GraduationCap}
      emptyTitle={t('education.emptyTitle')}
      emptyBody={t('education.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = educationSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const degreeText = [entry.degree, entry.field].filter(Boolean).join(' - ')
        const datesText = entry.startDate ? `${entry.startDate} – ${entry.endDate || ''}` : ''
        const subtitle = [entry.institution, datesText].filter(Boolean).join(' · ')
        const hasData = Boolean(
          entry.degree || entry.field || entry.institution || entry.gpa || entry.notes.length > 0,
        )

        return (
          <EntryCard
            key={entry.id}
            id={entry.id}
            title={degreeText || entry.institution}
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
                  id={`edu-${entry.id}-degree`}
                  label={t('education.degree')}
                  required
                  error={errors?.degree?._errors[0]}
                >
                  <Input
                    placeholder={t('education.degreePlaceholder')}
                    value={entry.degree}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        degree: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id={`edu-${entry.id}-field`}
                  label={t('education.field')}
                  hint={t('common.optional')}
                >
                  <Input
                    placeholder={t('education.fieldPlaceholder')}
                    value={entry.field}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        field: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id={`edu-${entry.id}-institution`}
                  label={t('education.institution')}
                  required
                  error={errors?.institution?._errors[0]}
                >
                  <Input
                    placeholder={t('education.institutionPlaceholder')}
                    value={entry.institution}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        institution: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id={`edu-${entry.id}-location`}
                  label={t('education.location')}
                  hint={t('common.optional')}
                >
                  <Input
                    placeholder={t('education.locationPlaceholder')}
                    value={entry.location}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        location: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <DateRangeField
                idPrefix={`edu-${entry.id}-dates`}
                startDate={entry.startDate}
                endDate={entry.endDate}
                current={false}
                onStartDateChange={(val) =>
                  handleUpdate(entry.id, (prev) => ({ ...prev, startDate: val }))
                }
                onEndDateChange={(val) =>
                  handleUpdate(entry.id, (prev) => ({ ...prev, endDate: val }))
                }
                onCurrentChange={() => {}}
                error={errors?.startDate?._errors[0] || errors?.endDate?._errors[0]}
              />

              <Field
                id={`edu-${entry.id}-gpa`}
                label={t('education.gpa')}
                hint={t('education.gpaHint')}
                error={errors?.gpa?._errors[0]}
              >
                <Input
                  placeholder={t('education.gpaPlaceholder')}
                  value={entry.gpa}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      gpa: event.target.value,
                    }))
                  }
                  className="max-w-[160px]"
                />
              </Field>

              <BulletListEditor
                idPrefix={`edu-${entry.id}`}
                bullets={entry.notes}
                onChange={(notes) => handleUpdate(entry.id, (prev) => ({ ...prev, notes }))}
                label={t('education.notesLabel')}
              />
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

import { FolderGit2 } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BulletListEditor } from '../BulletListEditor'
import { ChipsInput } from '../ChipsInput'
import { DateRangeField } from '../DateRangeField'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { isAllowedUrl, normalizeUrlInput } from '@/lib/text'
import { projectSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { ProjectEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

export function ProjectsEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'projects') return null

  const entries = (section.data as { entries: ProjectEntry[] }).entries

  const handleUpdate = (entryId: string, mutator: (entry: ProjectEntry) => ProjectEntry) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as ProjectEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('projects.addEntry')}
      emptyIcon={FolderGit2}
      emptyTitle={t('projects.emptyTitle')}
      emptyBody={t('projects.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = projectSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const datesText = entry.startDate ? `${entry.startDate} – ${entry.endDate || ''}` : ''
        const subtitle = [entry.role, datesText].filter(Boolean).join(' · ')
        const hasData = Boolean(
          entry.name ||
          entry.role ||
          entry.url ||
          entry.bullets.length > 0 ||
          entry.stack.length > 0,
        )

        return (
          <EntryCard
            key={entry.id}
            id={entry.id}
            title={entry.name}
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
                  id={`proj-${entry.id}-name`}
                  label={t('projects.name')}
                  required
                  error={errors?.name?._errors[0]}
                >
                  <Input
                    placeholder={t('projects.namePlaceholder')}
                    value={entry.name}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id={`proj-${entry.id}-role`}
                  label={t('projects.role')}
                  hint={t('common.optional')}
                >
                  <Input
                    placeholder={t('projects.rolePlaceholder')}
                    value={entry.role}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        role: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <Field
                id={`proj-${entry.id}-url`}
                label={t('projects.url')}
                hint={t('common.optional')}
                error={isAllowedUrl(entry.url) ? undefined : t('form.urlUnsafe')}
              >
                <Input
                  placeholder={t('projects.urlPlaceholder')}
                  value={entry.url}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                  onBlur={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      url: normalizeUrlInput(event.target.value),
                    }))
                  }
                />
              </Field>

              <DateRangeField
                idPrefix={`proj-${entry.id}-dates`}
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

              <BulletListEditor
                idPrefix={`proj-${entry.id}`}
                bullets={entry.bullets}
                onChange={(bullets) => handleUpdate(entry.id, (prev) => ({ ...prev, bullets }))}
                label={t('projects.bulletsLabel')}
              />

              <ChipsInput
                id={`proj-${entry.id}-stack`}
                label={t('projects.stackLabel')}
                hint={t('common.optional')}
                chips={entry.stack}
                onChange={(stack) => handleUpdate(entry.id, (prev) => ({ ...prev, stack }))}
                placeholder={t('projects.stackPlaceholder')}
              />
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

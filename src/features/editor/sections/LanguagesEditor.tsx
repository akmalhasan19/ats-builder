import { Languages as LanguagesIcon } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { languageSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { LanguageEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

const PROFICIENCY_OPTIONS: LanguageEntry['proficiency'][] = [
  'Native',
  'Fluent',
  'Professional',
  'Intermediate',
  'Basic',
]

export function LanguagesEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'languages') return null

  const entries = (section.data as { entries: LanguageEntry[] }).entries

  const handleUpdate = (entryId: string, mutator: (entry: LanguageEntry) => LanguageEntry) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as LanguageEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('languages.addEntry')}
      emptyIcon={LanguagesIcon}
      emptyTitle={t('languages.emptyTitle')}
      emptyBody={t('languages.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = languageSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const profLabel = t(`languages.prof.${entry.proficiency}`)
        const subtitle = profLabel
        const hasData = Boolean(entry.name)

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id={`lang-${entry.id}-name`}
                label={t('languages.name')}
                required
                error={errors?.name?._errors[0]}
              >
                <Input
                  placeholder={t('languages.namePlaceholder')}
                  value={entry.name}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field id={`lang-${entry.id}-prof`} label={t('languages.proficiency')} required>
                <select
                  id={`lang-${entry.id}-prof`}
                  value={entry.proficiency}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      proficiency: event.target.value as LanguageEntry['proficiency'],
                    }))
                  }
                  className="border-rule bg-raised text-input text-ink focus:border-cyanotype focus:shadow-[var(--shadow-focus)] h-[38px] w-full rounded-md border px-3 outline-none transition-colors duration-[var(--dur-fast)]"
                >
                  {PROFICIENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {t(`languages.prof.${opt}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

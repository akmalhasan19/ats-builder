import { BadgeCheck } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EntryCard } from '../EntryCard'
import { EntryList } from '../EntryList'
import { MonthPicker } from '../MonthPicker'
import { isAllowedUrl, normalizeUrlInput } from '@/lib/text'
import { certificationSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { CertificationEntry } from '@/types/resume'
import { t } from '@/lib/i18n'

export function CertificationsEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const addEntry = useDocStore((state) => state.addEntry)
  const updateEntry = useDocStore((state) => state.updateEntry)
  const removeEntry = useDocStore((state) => state.removeEntry)
  const duplicateEntry = useDocStore((state) => state.duplicateEntry)
  const reorderEntry = useDocStore((state) => state.reorderEntry)

  if (!section || section.kind !== 'certifications') return null

  const entries = (section.data as { entries: CertificationEntry[] }).entries

  const handleUpdate = (
    entryId: string,
    mutator: (entry: CertificationEntry) => CertificationEntry,
  ) => {
    updateEntry(sectionId, entryId, (entry) => mutator(entry as CertificationEntry))
  }

  return (
    <EntryList
      entries={entries}
      onReorder={(from, to) => reorderEntry(sectionId, from, to)}
      onAdd={() => addEntry(sectionId)}
      addLabel={t('certifications.addEntry')}
      emptyIcon={BadgeCheck}
      emptyTitle={t('certifications.emptyTitle')}
      emptyBody={t('certifications.emptyBody')}
      renderEntry={(entry, index, isExpanded, toggleExpanded, canMoveUp, canMoveDown) => {
        const validation = certificationSchema.safeParse(entry)
        const errors = !validation.success ? validation.error.format() : null
        const errorCount = !validation.success ? Object.keys(errors ?? {}).length : 0

        const subtitle = [entry.issuer, entry.issuedAt].filter(Boolean).join(' · ')
        const hasData = Boolean(entry.name || entry.issuer || entry.credentialId || entry.url)

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
              <Field
                id={`cert-${entry.id}-name`}
                label={t('certifications.name')}
                required
                error={errors?.name?._errors[0]}
              >
                <Input
                  placeholder={t('certifications.namePlaceholder')}
                  value={entry.name}
                  onChange={(event) =>
                    handleUpdate(entry.id, (prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id={`cert-${entry.id}-issuer`}
                  label={t('certifications.issuer')}
                  required
                  error={errors?.issuer?._errors[0]}
                >
                  <Input
                    placeholder={t('certifications.issuerPlaceholder')}
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
                  id={`cert-${entry.id}-issuedAt`}
                  label={t('certifications.issuedAt')}
                  error={errors?.issuedAt?._errors[0]}
                >
                  <MonthPicker
                    id={`cert-${entry.id}-issuedAt`}
                    value={entry.issuedAt}
                    onChange={(val) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        issuedAt: val,
                      }))
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id={`cert-${entry.id}-credentialId`}
                  label={t('certifications.credentialId')}
                  hint={t('common.optional')}
                >
                  <Input
                    placeholder={t('certifications.credentialIdPlaceholder')}
                    value={entry.credentialId}
                    onChange={(event) =>
                      handleUpdate(entry.id, (prev) => ({
                        ...prev,
                        credentialId: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id={`cert-${entry.id}-url`}
                  label={t('certifications.url')}
                  hint={t('common.optional')}
                  error={isAllowedUrl(entry.url) ? undefined : t('form.urlUnsafe')}
                >
                  <Input
                    placeholder={t('certifications.urlPlaceholder')}
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
              </div>
            </div>
          </EntryCard>
        )
      }}
    />
  )
}

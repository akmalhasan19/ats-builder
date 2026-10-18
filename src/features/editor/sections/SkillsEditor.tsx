import { Plus, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ChipsInput } from '../ChipsInput'
import { useDocStore } from '@/store/docStore'
import type { SkillGroup } from '@/types/resume'
import { t } from '@/lib/i18n'

export function SkillsEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const updateSection = useDocStore((state) => state.updateSection)

  if (!section || section.kind !== 'skills') return null

  const groups = (section.data as { groups: SkillGroup[] }).groups

  const handleAddGroup = () => {
    const newGroup: SkillGroup = {
      id: crypto.randomUUID(),
      name: '',
      items: [],
    }
    updateSection(sectionId, (prev) => ({
      ...prev,
      groups: [...(prev as { groups: SkillGroup[] }).groups, newGroup],
    }))
  }

  const handleUpdateGroup = (groupId: string, field: 'name' | 'items', value: unknown) => {
    updateSection(sectionId, (prev) => ({
      ...prev,
      groups: (prev as { groups: SkillGroup[] }).groups.map((group) =>
        group.id === groupId ? { ...group, [field]: value } : group,
      ),
    }))
  }

  const handleRemoveGroup = (groupId: string) => {
    updateSection(sectionId, (prev) => ({
      ...prev,
      groups: (prev as { groups: SkillGroup[] }).groups.filter((group) => group.id !== groupId),
    }))
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t('skills.emptyTitle')}
          body={t('skills.emptyBody')}
          action={
            <Button onClick={handleAddGroup}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {t('skills.addGroup')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="border-rule bg-raised space-y-3 rounded-lg border p-3.5">
              <div className="flex items-start justify-between gap-2">
                <Field
                  id={`skill-group-${group.id}-name`}
                  label={t('skills.groupName')}
                  className="flex-1"
                >
                  <Input
                    placeholder={t('skills.groupNamePlaceholder')}
                    value={group.name}
                    onChange={(event) => handleUpdateGroup(group.id, 'name', event.target.value)}
                  />
                </Field>

                <button
                  type="button"
                  aria-label={t('skills.removeGroup')}
                  onClick={() => handleRemoveGroup(group.id)}
                  className="text-ink-tertiary hover:text-signal-bad mt-6 flex size-8 items-center justify-center rounded"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>

              <ChipsInput
                id={`skill-group-${group.id}-items`}
                label={t('skills.itemsLabel')}
                chips={group.items}
                onChange={(items) => handleUpdateGroup(group.id, 'items', items)}
                placeholder={t('skills.itemsPlaceholder')}
              />
            </div>
          ))}

          <div>
            <Button variant="secondary" onClick={handleAddGroup} className="w-full">
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {t('skills.addGroup')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { profileSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { ProfileData } from '@/types/resume'
import { t } from '@/lib/i18n'

export function ProfileEditor({ sectionId }: { sectionId: string }) {
  const section = useDocStore((state) => state.doc.sections.find((s) => s.id === sectionId))
  const updateSection = useDocStore((state) => state.updateSection)

  if (!section || section.kind !== 'profile') return null

  const data = section.data as ProfileData

  const validation = profileSchema.safeParse(data)
  const errors = !validation.success ? validation.error.format() : null

  const updateField = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    updateSection(sectionId, (prev) => ({
      ...(prev as ProfileData),
      [key]: value,
    }))
  }

  const handleAddLink = () => {
    updateField('links', [...data.links, { label: '', url: '' }])
  }

  const handleUpdateLink = (index: number, field: 'label' | 'url', value: string) => {
    const nextLinks = [...data.links]
    const target = nextLinks[index]
    if (target) {
      nextLinks[index] = { ...target, [field]: value }
      updateField('links', nextLinks)
    }
  }

  const handleLinkBlur = (index: number, url: string) => {
    const trimmed = url.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      handleUpdateLink(index, 'url', `https://${trimmed}`)
    }
  }

  const handleRemoveLink = (index: number) => {
    updateField(
      'links',
      data.links.filter((_, idx) => idx !== index),
    )
  }

  return (
    <div className="space-y-4">
      <Field
        id="profile-fullName"
        label={t('profile.fullName')}
        required
        error={errors?.fullName?._errors[0]}
      >
        <Input
          placeholder={t('profile.fullNamePlaceholder')}
          value={data.fullName}
          onChange={(event) => updateField('fullName', event.target.value)}
        />
      </Field>

      <Field
        id="profile-headline"
        label={t('profile.headline')}
        required
        error={errors?.headline?._errors[0]}
      >
        <Input
          placeholder={t('profile.headlinePlaceholder')}
          value={data.headline}
          onChange={(event) => updateField('headline', event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="profile-email"
          label={t('profile.email')}
          required
          error={errors?.email?._errors[0]}
        >
          <Input
            type="email"
            placeholder={t('profile.emailPlaceholder')}
            value={data.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </Field>

        <Field
          id="profile-phone"
          label={t('profile.phone')}
          required
          error={errors?.phone?._errors[0]}
        >
          <Input
            type="tel"
            placeholder={t('profile.phonePlaceholder')}
            value={data.phone}
            onChange={(event) => updateField('phone', event.target.value)}
          />
        </Field>
      </div>

      <Field id="profile-location" label={t('profile.location')} hint={t('common.optional')}>
        <Input
          placeholder={t('profile.locationPlaceholder')}
          value={data.location}
          onChange={(event) => updateField('location', event.target.value)}
        />
      </Field>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-ink-secondary">{t('profile.links')}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddLink}
            className="text-cyanotype hover:bg-cyanotype-wash h-8 gap-1"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('profile.addLink')}
          </Button>
        </div>

        {data.links.map((link, idx) => (
          <div key={`link-${idx}`} className="flex items-center gap-2">
            <label htmlFor={`profile-link-label-${idx}`} className="sr-only">
              {t('profile.linkLabel')}
            </label>
            <Input
              id={`profile-link-label-${idx}`}
              placeholder={t('profile.linkLabelPlaceholder')}
              value={link.label}
              onChange={(event) => handleUpdateLink(idx, 'label', event.target.value)}
              className="w-1/3"
            />
            <label htmlFor={`profile-link-url-${idx}`} className="sr-only">
              {t('profile.linkUrl')}
            </label>
            <Input
              id={`profile-link-url-${idx}`}
              placeholder={t('profile.linkUrlPlaceholder')}
              value={link.url}
              onChange={(event) => handleUpdateLink(idx, 'url', event.target.value)}
              onBlur={(event) => handleLinkBlur(idx, event.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              aria-label={t('profile.removeLink')}
              onClick={() => handleRemoveLink(idx)}
              className="text-ink-tertiary hover:text-signal-bad flex size-8 items-center justify-center rounded"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

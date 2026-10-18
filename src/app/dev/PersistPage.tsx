import { t, type TranslationKey } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useSyncStore, type SaveStatus } from '@/store/syncStore'
import type { ProfileData, SectionInstance } from '@/types/resume'
import { DevPageShell } from './DevPageShell'

const STATUS_LABELS: Record<SaveStatus, TranslationKey> = {
  'saved-local': 'status.savedLocal',
  saving: 'status.saving',
  'saved-cloud': 'status.savedCloud',
  offline: 'status.offline',
  error: 'status.error',
}

const INPUT_CLASS =
  'text-input h-10 w-full rounded-md border border-rule bg-raised px-3 hover:border-rule-strong focus:border-cyanotype focus-visible:outline-2 focus-visible:outline-cyanotype'

type ProfileSection = Extract<SectionInstance, { kind: 'profile' }>

export default function PersistPage() {
  const title = useDocStore((state) => state.doc.title)
  const setTitle = useDocStore((state) => state.setTitle)
  const updateSection = useDocStore((state) => state.updateSection)
  const profile = useDocStore((state) =>
    state.doc.sections.find((section): section is ProfileSection => section.kind === 'profile'),
  )
  const status = useSyncStore((state) => state.status)
  const storageMode = useSyncStore((state) => state.storageMode)

  return (
    <DevPageShell
      titleKey="persist.dev.title"
      subtitleKey="persist.dev.subtitle"
      maxWidthClass="max-w-[720px]"
    >
      <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dev-doc-title" className="text-label">
            {t('persist.dev.docTitle')}
          </label>
          <input
            id="dev-doc-title"
            type="text"
            className={INPUT_CLASS}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="dev-full-name" className="text-label">
            {t('persist.dev.fullName')}
          </label>
          <input
            id="dev-full-name"
            type="text"
            className={INPUT_CLASS}
            value={profile?.data.fullName ?? ''}
            onChange={(event) => {
              const fullName = event.target.value
              if (profile) {
                updateSection(profile.id, (data) => ({ ...(data as ProfileData), fullName }))
              }
            }}
          />
        </div>
      </form>

      <p
        role="status"
        aria-live="polite"
        className="text-data mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1 text-ink-secondary"
      >
        {t(STATUS_LABELS[status])}
      </p>

      {storageMode === 'memory' ? (
        <p className="text-body mt-4 text-signal-warn">{t('persist.banner.memory')}</p>
      ) : null}

      <p className="text-body mt-4 max-w-[60ch]">{t('persist.dev.hint')}</p>
    </DevPageShell>
  )
}

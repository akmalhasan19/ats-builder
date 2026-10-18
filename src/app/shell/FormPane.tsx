import { cn } from 'cn'
import { Eyebrow } from '@/components/ui/eyebrow'
import { EmptyState } from '@/components/ui/empty-state'
import { LayoutList } from 'lucide-react'
import { FirstRunCard } from '@/features/editor/FirstRunCard'
import { AwardsEditor } from '@/features/editor/sections/AwardsEditor'
import { CertificationsEditor } from '@/features/editor/sections/CertificationsEditor'
import { EducationEditor } from '@/features/editor/sections/EducationEditor'
import { ExperienceEditor } from '@/features/editor/sections/ExperienceEditor'
import { LanguagesEditor } from '@/features/editor/sections/LanguagesEditor'
import { ProfileEditor } from '@/features/editor/sections/ProfileEditor'
import { ProjectsEditor } from '@/features/editor/sections/ProjectsEditor'
import { SkillsEditor } from '@/features/editor/sections/SkillsEditor'
import { SummaryEditor } from '@/features/editor/sections/SummaryEditor'
import { VolunteeringEditor } from '@/features/editor/sections/VolunteeringEditor'
import { sectionRegistry } from '@/features/sections/registry'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'

const pad2 = (value: number) => String(value).padStart(2, '0')

export function FormPane({ className }: { className?: string }) {
  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)
  const firstRunSeen = useUiStore((state) => state.firstRunSeen)

  const index = sections.findIndex((section) => section.id === activeSectionId)
  const active = index >= 0 ? sections[index] : undefined
  const entry = active ? sectionRegistry[active.kind] : undefined

  return (
    <section
      id="pane-form"
      aria-label={t('rail.heading')}
      className={cn('bg-surface min-h-0 overflow-y-auto px-5 py-4', className)}
    >
      {!firstRunSeen ? <FirstRunCard /> : null}

      {active && entry ? (
        <div className="space-y-4">
          <div>
            <Eyebrow>
              {t('workspace.formEyebrow')} {pad2(index + 1)} / {pad2(sections.length)}
            </Eyebrow>
            <h1 className="text-panel-title mt-1">{t(entry.labelId)}</h1>
            <p className="text-caption text-ink-secondary mt-1">{t(entry.hintId)}</p>
          </div>

          <div className="pt-2">
            {active.kind === 'profile' && <ProfileEditor sectionId={active.id} />}
            {active.kind === 'summary' && <SummaryEditor sectionId={active.id} />}
            {active.kind === 'experience' && <ExperienceEditor sectionId={active.id} />}
            {active.kind === 'education' && <EducationEditor sectionId={active.id} />}
            {active.kind === 'skills' && <SkillsEditor sectionId={active.id} />}
            {active.kind === 'projects' && <ProjectsEditor sectionId={active.id} />}
            {active.kind === 'certifications' && <CertificationsEditor sectionId={active.id} />}
            {active.kind === 'languages' && <LanguagesEditor sectionId={active.id} />}
            {active.kind === 'awards' && <AwardsEditor sectionId={active.id} />}
            {active.kind === 'volunteering' && <VolunteeringEditor sectionId={active.id} />}
          </div>
        </div>
      ) : (
        <EmptyState icon={LayoutList} title={t('rail.empty')} body={t('rail.empty')} />
      )}
    </section>
  )
}

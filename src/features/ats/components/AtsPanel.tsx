import { useMemo } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { useAtsStore } from '@/store/atsStore'
import { usePagination } from '@/features/preview/usePagination'
import { getSpec, resolveSpec } from '@/features/templates/specs'
import { t } from '@/lib/i18n'
import { simulateParseOrder } from '../parseTape'
import { focusTarget } from '../focusTarget'
import { canvasPathForAtsTarget, openCanvasSessionForAts } from '@/features/canvas/canvasAts'
import { runAtsCheck } from '../runCheck'
import { clockLabel } from '../clock'
import type { AtsTarget } from '../types'
import { IssueList } from './IssueList'
import { JobDescriptionField } from './JobDescriptionField'
import { KeywordSummary } from './KeywordSummary'
import { firstSkillGroupFieldId } from '../fieldTargets'
import { ParseTapeView } from './ParseTapeView'
import { ScoreBlock } from './ScoreBlock'

export type AtsPanelProps = {
  onClose: () => void
  /** Panel versi dock tidak punya tombol silang sendiri. */
  showClose: boolean
}

export function AtsPanel({ onClose, showClose }: AtsPanelProps) {
  const doc = useDocStore((state) => state.doc)
  const setActiveSection = useDocStore((state) => state.setActiveSection)
  const report = useAtsStore((state) => state.report)
  const isChecking = useAtsStore((state) => state.isChecking)
  const atsTab = useUiStore((state) => state.atsTab)
  const setAtsTab = useUiStore((state) => state.setAtsTab)
  const setActiveTab = useUiStore((state) => state.setActiveTab)
  const showMarks = useUiStore((state) => state.showKeywordMarks)
  const panelMode = useUiStore((state) => state.panelMode)
  const includeMarksInPdf = useUiStore((state) => state.includeMarksInPdf)
  const setIncludeMarksInPdf = useUiStore((state) => state.setIncludeMarksInPdf)
  const editMode = useUiStore((state) => state.editMode)

  const plan = usePagination(doc, doc.templateId)
  const spec = useMemo(
    () => resolveSpec(doc.templateId, doc.theme, doc.settings.page),
    [doc.templateId, doc.theme, doc.settings.page],
  )
  const tape = useMemo(() => simulateParseOrder(doc, spec, plan), [doc, spec, plan])
  const templateLabel = t(getSpec(doc.templateId).nameId)

  const actionable = report?.issues.filter((issue) => issue.severity !== 'ok').length ?? 0

  const fix = (target: AtsTarget | undefined): void => {
    // C5.2 — di mode kanvas, `Perbaiki →` membuka field target langsung di atas
    // kertas. Field di luar matriks §4 tetap jatuh ke form (perilaku T7.4).
    if (editMode === 'canvas' && canvasPathForAtsTarget(doc, target)) {
      // Drawer modal di bawah 1280px menutupi kertas & menahan fokus, jadi
      // ditutup lebih dulu — sama seperti jalur form.
      if (panelMode !== '3col') onClose()
      openCanvasSessionForAts(target)
      return
    }
    focusTarget(target, {
      setActiveSection,
      setActiveTab,
      closeDrawer: onClose,
      // §5.6 — di bawah 1280px drawer menutupi seluruh layar kerja.
      shouldCloseDrawer: panelMode !== '3col',
    })
  }

  const pickMissing = (): void => {
    const skills = doc.sections.find((section) => section.kind === 'skills')
    if (!skills) return
    fix({ sectionId: skills.id, field: firstSkillGroupFieldId(doc.sections) })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-rule flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-panel-title" id="ats-drawer-title">
          {t('ats.drawer.title')}
        </h2>
        {showClose ? (
          <button
            type="button"
            aria-label={t('ats.drawer.close')}
            onClick={onClose}
            className="text-ink-tertiary hover:bg-hover hover:text-ink flex size-8 items-center justify-center rounded-md"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        ) : null}
      </div>

      {/* P5 — disclaimer permanen: dia ikut tampil di setiap state (belum
          diperiksa, tanpa isu, skor tinggi), tidak pernah disembunyikan UI. */}
      <p
        className="text-caption text-ink-secondary border-rule border-b px-4 py-2.5"
        data-probe="ats-disclaimer"
      >
        {t('ats.disclaimer')}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto" data-probe="ats-panel">
        <JobDescriptionField />

        {report ? (
          <ScoreBlock
            report={report}
            templateLabel={templateLabel}
            checkedTime={clockLabel(report.checkedAt)}
          />
        ) : (
          <div className="border-rule border-b px-4 py-4">
            <p className="text-rail-label text-ink font-semibold">{t('ats.notChecked.title')}</p>
            <p className="text-caption text-ink-secondary mt-1">{t('ats.notChecked.body')}</p>
            <Button
              type="button"
              data-probe="ats-check-now"
              className="mt-3"
              disabled={isChecking}
              onClick={() => void runAtsCheck(plan.pageCount)}
            >
              {isChecking ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {isChecking ? t('ats.checking') : t('ats.notChecked.action')}
            </Button>
          </div>
        )}

        <KeywordSummary keywords={report?.keywords ?? null} onPickMissing={pickMissing} />

        {report ? (
          <label className="border-rule flex items-center gap-2 border-b px-4 py-2.5">
            <input
              type="checkbox"
              data-probe="ats-marks-in-pdf"
              checked={includeMarksInPdf}
              onChange={(event) => setIncludeMarksInPdf(event.target.checked)}
              className="accent-accent size-4"
            />
            <span className="text-label text-ink-secondary">{t('ats.marksInPdf')}</span>
          </label>
        ) : null}

        <Tabs
          value={atsTab}
          onValueChange={(value) => setAtsTab(value === 'tape' ? 'tape' : 'issues')}
          className="px-4 pt-3"
        >
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="issues" data-probe="ats-tab-issues">
              {t('ats.tab.issues', { count: actionable })}
            </TabsTrigger>
            <TabsTrigger value="tape" data-probe="ats-tab-tape">
              {t('ats.tab.tape')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="pt-2">
            {!report ? null : actionable === 0 ? (
              <div className="px-0 py-3">
                <p className="text-rail-label text-ink font-semibold">{t('ats.noIssues.title')}</p>
                <p className="text-caption text-ink-secondary mt-1">{t('ats.noIssues.body')}</p>
              </div>
            ) : (
              <IssueList issues={report.issues} onFix={fix} />
            )}
          </TabsContent>

          <TabsContent value="tape" className="pt-2">
            <ParseTapeView
              lines={tape.lines}
              stats={tape.stats}
              keywords={report?.keywords?.matched ?? []}
              showMarks={showMarks}
              templateLabel={templateLabel}
            />
          </TabsContent>
        </Tabs>
      </div>

      <p aria-live="polite" className="sr-only">
        {report ? t('ats.aria.score', { score: report.score, band: t(report.band.labelId) }) : ''}
      </p>
    </div>
  )
}

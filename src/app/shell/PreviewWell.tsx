import { cn } from 'cn'
import { t } from '@/lib/i18n'

/** §5.5 — well workbench + lembar A4; renderer template menyusul di Fase 4. */
export function PreviewWell({ className }: { className?: string }) {
  return (
    <section
      id="pane-preview"
      aria-label={t('workspace.previewTitle')}
      className={cn(
        'bg-workbench shadow-[var(--shadow-well)] min-h-0 overflow-auto p-6',
        className,
      )}
    >
      <div className="flex min-w-fit flex-col items-center gap-4">
        <div
          data-probe="paper"
          className="animate-paper-settle border-rule bg-raised shadow-paper h-[1123px] w-[794px] shrink-0 rounded-[var(--radius-paper)] border"
        >
          <div className="h-full px-16 py-14">
            <p className="text-data text-ink-tertiary">{t('workspace.previewPending')}</p>
          </div>
        </div>
        <p className="text-data text-ink-secondary uppercase">{t('workspace.previewCaption')} 1</p>
      </div>
    </section>
  )
}

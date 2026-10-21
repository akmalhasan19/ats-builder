import { cn } from 'cn'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'

/**
 * §5.7 — dua tab, indikator geser; hanya di bawah 1024px.
 *
 * §5.3 — saat mode kanvas aktif, tab Pratinjau mendapat badge titik kecil
 * (`data-probe="mobile-badge-canvas"`) sebagai tanda bahwa ada target edit
 * langsung di kertas. Titik aria-hidden; nama aksesibel tab diperluas lewat
 * `aria-label` yang tetap memuat label yang terlihat ("Pratinjau") supaya
 * aturan "label in name" axe tetap lulus.
 */
export function MobileTabBar() {
  const activeTab = useUiStore((state) => state.activeTab)
  const setActiveTab = useUiStore((state) => state.setActiveTab)
  const editMode = useUiStore((state) => state.editMode)

  const tabs = [
    { id: 'form' as const, label: t('mobile.tabForm'), controls: 'pane-form' },
    {
      id: 'preview' as const,
      label: t('mobile.tabPreview'),
      controls: 'pane-preview',
      badge: editMode === 'canvas',
    },
  ]

  return (
    <div
      role="tablist"
      aria-label={t('mobile.tabList')}
      className="border-rule bg-sunken sticky top-[52px] z-20 flex h-11 items-center border-b px-3 md:top-14 lg:hidden"
    >
      <div className="relative flex h-8 flex-1 items-center gap-1 rounded-md">
        <span
          aria-hidden="true"
          className={cn(
            'bg-raised shadow-raised absolute inset-y-0 left-0 w-[calc(50%-0.125rem)] rounded-md transition-transform duration-[var(--dur-base)]',
            activeTab === 'preview' && 'translate-x-[calc(100%+0.25rem)]',
          )}
        />
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={tab.controls}
              aria-label={tab.badge ? t('mobile.tabPreviewCanvas') : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'text-button relative z-10 flex h-8 flex-1 items-center justify-center rounded-md transition-colors duration-[var(--dur-fast)]',
                selected ? 'text-ink font-semibold' : 'text-ink-secondary hover:text-ink',
              )}
            >
              {tab.label}
              {tab.badge ? (
                <span
                  data-probe="mobile-badge-canvas"
                  aria-hidden="true"
                  className="bg-accent-ink absolute right-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full"
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

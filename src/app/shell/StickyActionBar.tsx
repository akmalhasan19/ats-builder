import { useState } from 'react'
import { List } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { sectionRegistry } from '@/features/sections/registry'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'

/** §5.7 — bar bawah mobile + sheet "Bagian" sebagai pengganti rail. */
export function StickyActionBar() {
  const [open, setOpen] = useState(false)
  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)
  const setActiveSection = useDocStore((state) => state.setActiveSection)
  const setActiveTab = useUiStore((state) => state.setActiveTab)

  return (
    <>
      <div className="border-rule bg-raised fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-center gap-2 border-t px-3 pb-[env(safe-area-inset-bottom)] md:hidden">
        <Button variant="ghost" className="h-11 gap-1.5 px-3" onClick={() => setOpen(true)}>
          <List aria-hidden="true" className="size-4" />
          {t('mobile.sections')}
        </Button>
        <Button disabled className="text-button-lg h-11 flex-1">
          {t('topbar.download')}
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[80dvh]">
          <SheetHeader>
            <SheetTitle>{t('mobile.sectionsTitle')}</SheetTitle>
            <SheetDescription>{t('rail.visibleOf')}</SheetDescription>
          </SheetHeader>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4">
            {sections.map((section) => {
              const entry = sectionRegistry[section.kind]
              const Icon = entry.icon
              const active = section.id === activeSectionId
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    setActiveSection(section.id)
                    setActiveTab('form')
                    setOpen(false)
                  }}
                  className={cn(
                    'text-rail-label border-rule bg-raised text-ink flex h-11 items-center gap-2 rounded-md border px-3 text-left',
                    active && 'border-cyanotype bg-cyanotype-wash text-cyanotype',
                  )}
                >
                  <Icon aria-hidden="true" className="size-[15px] shrink-0" />
                  <span className="truncate">{t(entry.labelId)}</span>
                </button>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}

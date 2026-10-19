import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Eyebrow } from '@/components/ui/eyebrow'
import { PanelHeader } from '@/components/ui/panel-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  calculateTotalCompleteness,
  countSectionIssues,
  getSectionCompleteness,
  sectionRegistry,
} from '@/features/sections/registry'
import { SECTION_ORDER } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import type { SectionInstance } from '@/types/resume'
import { t } from '@/lib/i18n'

function CompletenessDots({ dots }: { dots: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((step) => {
        const filled = dots >= step
        const isOk = dots === 3
        return (
          <span
            key={step}
            className={cn(
              'size-1 rounded-full transition-colors',
              isOk
                ? 'bg-signal-ok'
                : filled
                  ? 'bg-accent'
                  : 'border-rule-strong border bg-transparent',
            )}
          />
        )
      })}
    </div>
  )
}

function SectionItem({
  section,
  index,
  total,
  active,
  iconOnly,
  onSelect,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDeleteRequest,
}: {
  section: SectionInstance
  index: number
  total: number
  active: boolean
  iconOnly: boolean
  onSelect: () => void
  onToggleVisible: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onDeleteRequest: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const entry = sectionRegistry[section.kind]
  const Icon = entry.icon
  const label = t(entry.labelId)
  const completeness = getSectionCompleteness(section)
  const issueCount = countSectionIssues(section)

  const tooltipText = completeness.isComplete
    ? t('rail.completenessTooltip', {
        filled: completeness.filled,
        total: completeness.total,
      })
    : t('rail.completenessIncomplete', {
        filled: completeness.filled,
        total: completeness.total,
      })

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="flex h-10 items-center px-2">
        <div className="bg-accent h-0.5 w-full rounded-full" aria-hidden="true" />
      </div>
    )
  }

  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={onSelect}
            className={cn(
              'hover:bg-hover flex h-10 w-full flex-col items-center justify-center gap-1 rounded-md transition-colors duration-[var(--dur-fast)]',
              !section.visible && 'opacity-55',
              active
                ? 'bg-accent-wash text-accent-ink shadow-[var(--shadow-active-bar)]'
                : 'text-ink',
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                'size-[18px] shrink-0',
                active ? 'text-accent-ink' : 'text-ink-tertiary',
              )}
            />
            <CompletenessDots dots={completeness.dots} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div>
            <p className="font-medium">{label}</p>
            <p className="text-hint text-ink-tertiary mt-0.5">{tooltipText}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex h-10 items-center rounded-md px-2 text-left',
        active
          ? 'bg-accent-wash text-ink font-semibold shadow-[var(--shadow-active-bar)]'
          : 'text-ink hover:bg-hover',
      )}
    >
      {/*
        Isi baris dibungkus sendiri supaya `group-hover:` bisa dipakai pada
        elemen anak. Varian `group-*` hanya berlaku untuk turunan elemen
        `group`; memakai `group-hover:` pada elemen `group` itu sendiri tidak
        pernah cocok — ruang untuk tombol aksi pun tidak pernah dibuka.
      */}
      <div className="flex min-w-0 flex-1 items-center gap-2 pr-0 transition-[padding] duration-[var(--dur-fast)] group-hover:pr-[120px] group-focus-within:pr-[120px]">
        <button
          type="button"
          role="checkbox"
          aria-checked={section.visible}
          aria-label={`${t('rail.toggleVisibility')}: ${label}`}
          onClick={(event) => {
            event.stopPropagation()
            onToggleVisible()
          }}
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
            section.visible
              ? 'border-accent-ink bg-accent text-accent-on'
              : 'border-rule-strong bg-raised text-transparent',
          )}
        >
          <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <Icon
            aria-hidden="true"
            className={cn('size-[15px] shrink-0', active ? 'text-accent-ink' : 'text-ink-tertiary')}
          />
          {/*
            Nama bagian memudar saat baris disorot: tombol aksi punya ruang
            sendiri di kanan, jadi nama panjang tidak pernah menutupi ikon.
          */}
          <span
            className={cn(
              'text-rail-label min-w-0 truncate transition-opacity duration-[var(--dur-fast)] group-hover:opacity-0',
              !section.visible && 'text-ink-tertiary',
            )}
          >
            {label}
          </span>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="py-1 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
              <CompletenessDots dots={completeness.dots} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span className="text-hint">{tooltipText}</span>
          </TooltipContent>
        </Tooltip>

        {issueCount > 0 ? (
          <span className="text-hint text-signal-warn bg-bad-wash rounded px-1 font-mono transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
            {t('rail.issuesBadge', { count: issueCount })}
          </span>
        ) : null}
      </div>

      {/*
        Tombol aksi muncul saat baris disorot atau saat salah satunya difokuskan
        (pintu keyboard). `focus-within` di sini, bukan `group-focus-within`,
        supaya tab ke tombol section tidak memunculkan aksi yang belum difokuskan.

        `pointer-events-none` saat tersembunyi penting: overlay ini melayang di
        atas nama bagian, jadi kalau tombol yang tak terlihat tetap menerima
        klik, klik di tengah nama jatuh ke tombol "pindah naik" — bukan memilih
        bagian itu. Gagang seret dan menu "Tindakan bagian" dikecualikan
        (kelasnya sendiri): keduanya letaknya di luar kotak nama, jadi tidak
        pernah menelan klik nama, dan tetap bisa dipakai di layar sentuh
        yang tidak punya hover.
      */}
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            aria-label={t('rail.moveUp')}
            onClick={(event) => {
              event.stopPropagation()
              onMoveUp()
            }}
            className="text-ink-tertiary hover:text-ink flex size-7 items-center justify-center rounded disabled:opacity-20"
          >
            <ArrowUp className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            aria-label={t('rail.moveDown')}
            onClick={(event) => {
              event.stopPropagation()
              onMoveDown()
            }}
            className="text-ink-tertiary hover:text-ink flex size-7 items-center justify-center rounded disabled:opacity-20"
          >
            <ArrowDown className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          aria-label={t('rail.dragHandle')}
          className="text-ink-tertiary hover:text-ink pointer-events-auto flex size-6 cursor-grab items-center justify-center transition-opacity active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('rail.moreActions')}
              className="text-ink-tertiary hover:text-ink pointer-events-auto flex size-6 items-center justify-center rounded transition-opacity"
            >
              <MoreVertical className="size-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onToggleVisible}>
              {section.visible ? (
                <>
                  <EyeOff className="mr-2 size-3.5" aria-hidden="true" />
                  <span>{t('rail.hide')}</span>
                </>
              ) : (
                <>
                  <Eye className="mr-2 size-3.5" aria-hidden="true" />
                  <span>{t('rail.show')}</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 size-3.5" aria-hidden="true" />
              <span>{t('rail.duplicate')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDeleteRequest}
              className="text-signal-bad focus:bg-bad-wash focus:text-signal-bad"
            >
              <Trash2 className="mr-2 size-3.5" aria-hidden="true" />
              <span>{t('rail.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function Rail() {
  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)
  const setActiveSection = useDocStore((state) => state.setActiveSection)
  const toggleSectionVisible = useDocStore((state) => state.toggleSectionVisible)
  const reorderSection = useDocStore((state) => state.reorderSection)
  const addSection = useDocStore((state) => state.addSection)
  const duplicateSection = useDocStore((state) => state.duplicateSection)
  const removeSection = useDocStore((state) => state.removeSection)
  const panelMode = useUiStore((state) => state.panelMode)
  const setAtsDrawerOpen = useUiStore((state) => state.setAtsDrawerOpen)

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SectionInstance | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const iconOnly = panelMode === 'icon-rail'
  const visibleCount = sections.filter((section) => section.visible).length
  const totalCompleteness = calculateTotalCompleteness(sections)

  const existingKinds = new Set(sections.map((section) => section.kind))
  const availableCatalogKinds = SECTION_ORDER.filter((kind) => !existingKinds.has(kind))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((section) => section.id === active.id)
      const newIndex = sections.findIndex((section) => section.id === over.id)
      if (oldIndex >= 0 && newIndex >= 0) {
        reorderSection(oldIndex, newIndex)
        const moved = sections[oldIndex]
        if (moved) {
          const name = t(sectionRegistry[moved.kind].labelId)
          setAnnouncement(
            t('rail.reorderAnnounce', {
              name,
              pos: newIndex + 1,
              total: sections.length,
            }),
          )
        }
      }
    }
  }

  const activeDragSection = activeDragId
    ? sections.find((section) => section.id === activeDragId)
    : undefined

  const handleDeleteRequest = (section: SectionInstance) => {
    const completeness = getSectionCompleteness(section)
    if (completeness.filled > 0) {
      setDeleteTarget(section)
    } else {
      removeSection(section.id)
    }
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      removeSection(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  return (
    <TooltipProvider>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <aside
        aria-label={t('rail.heading')}
        className="border-rule bg-sunken hidden flex-col border-r lg:flex lg:w-14 xl:w-[248px]"
      >
        <PanelHeader
          title={t('rail.heading')}
          meta={`${visibleCount}/${sections.length}`}
          className="hidden px-2.5 pt-3 pb-2 xl:flex"
        />

        <ScrollArea className="min-h-0 flex-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <nav className="flex flex-col gap-1 px-1.5 py-2">
                {sections.map((section, index) => (
                  <SectionItem
                    key={section.id}
                    section={section}
                    index={index}
                    total={sections.length}
                    active={section.id === activeSectionId}
                    iconOnly={iconOnly}
                    onSelect={() => setActiveSection(section.id)}
                    onToggleVisible={() => toggleSectionVisible(section.id)}
                    onMoveUp={() => {
                      if (index > 0) {
                        reorderSection(index, index - 1)
                        const name = t(sectionRegistry[section.kind].labelId)
                        setAnnouncement(
                          t('rail.reorderAnnounce', {
                            name,
                            pos: index,
                            total: sections.length,
                          }),
                        )
                      }
                    }}
                    onMoveDown={() => {
                      if (index < sections.length - 1) {
                        reorderSection(index, index + 1)
                        const name = t(sectionRegistry[section.kind].labelId)
                        setAnnouncement(
                          t('rail.reorderAnnounce', {
                            name,
                            pos: index + 2,
                            total: sections.length,
                          }),
                        )
                      }
                    }}
                    onDuplicate={() => duplicateSection(section.id)}
                    onDeleteRequest={() => handleDeleteRequest(section)}
                  />
                ))}
              </nav>
            </SortableContext>

            <DragOverlay>
              {activeDragSection ? (
                <div
                  data-probe="drag-overlay"
                  className="border-rule bg-raised shadow-raised flex h-10 scale-[1.01] items-center gap-2 rounded-md border px-3"
                >
                  <span className="text-rail-label text-ink font-semibold">
                    {t(sectionRegistry[activeDragSection.kind].labelId)}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {!iconOnly && (
            <div className="px-2 pt-1 pb-3">
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="border-rule-strong text-button text-ink-secondary hover:border-accent-ink hover:text-accent-ink hover:bg-accent-wash flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed transition-colors"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>{t('rail.addSection')}</span>
              </button>
            </div>
          )}
        </ScrollArea>

        {!iconOnly && (
          <div data-probe="rail-completeness" className="border-rule border-t px-2.5 pt-2.5 pb-3">
            <button
              type="button"
              onClick={() => setAtsDrawerOpen(true)}
              className="hover:bg-hover -mx-1 block w-[calc(100%+8px)] rounded p-1 text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <Eyebrow>{t('rail.completeness')}</Eyebrow>
                <span className="text-data text-ink-secondary">{totalCompleteness}%</span>
              </div>
              <div className="bg-rule mt-1.5 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full transition-all duration-[var(--dur-base)]"
                  style={{ width: `${totalCompleteness}%` }}
                />
              </div>
            </button>
          </div>
        )}
      </aside>

      {/* Catalog Dialog */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rail.catalogTitle')}</DialogTitle>
            <DialogDescription>{t('rail.catalogDesc')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
            {availableCatalogKinds.length === 0 ? (
              <p className="text-body text-ink-secondary py-4 text-center">
                {t('rail.catalogEmpty')}
              </p>
            ) : (
              availableCatalogKinds.map((kind) => {
                const entry = sectionRegistry[kind]
                const Icon = entry.icon
                return (
                  <div
                    key={kind}
                    className="border-rule bg-raised flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="bg-accent-wash text-accent-ink mt-0.5 flex size-8 shrink-0 items-center justify-center rounded">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-rail-label text-ink font-semibold">
                          {t(entry.labelId)}
                        </h2>
                        <p className="text-caption text-ink-secondary">{t(entry.descriptionId)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        addSection(kind)
                        setCatalogOpen(false)
                      }}
                    >
                      {t('rail.add')}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget
                ? t('rail.deleteConfirmTitle', {
                    name: t(sectionRegistry[deleteTarget.kind].labelId),
                  })
                : ''}
            </DialogTitle>
            <DialogDescription>{t('rail.deleteConfirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('rail.deleteConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

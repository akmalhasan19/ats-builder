import { useSyncExternalStore, type ReactNode } from 'react'
import { Copy, Plus, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip } from '@/components/ui/chip'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PanelHeader } from '@/components/ui/panel-header'
import { Eyebrow } from '@/components/ui/eyebrow'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DevPageShell } from '@/app/dev/DevPageShell'
import { t, type TranslationKey } from '@/lib/i18n'

type ColorGroup = {
  titleKey: TranslationKey
  noteKey?: TranslationKey
  names: string[]
}

const COLOR_GROUPS: ColorGroup[] = [
  {
    titleKey: 'tokens.section.surface',
    noteKey: 'tokens.note.surface',
    names: ['workbench', 'sunken', 'surface', 'raised'],
  },
  {
    titleKey: 'tokens.section.ink',
    names: ['ink', 'ink-secondary', 'ink-tertiary', 'rule', 'rule-strong'],
  },
  {
    titleKey: 'tokens.section.accent',
    noteKey: 'tokens.note.accent',
    names: ['cyanotype', 'cyanotype-active', 'cyanotype-wash'],
  },
  {
    titleKey: 'tokens.section.highlighter',
    noteKey: 'tokens.note.highlighter',
    names: ['highlighter'],
  },
  {
    titleKey: 'tokens.section.signal',
    noteKey: 'tokens.note.signal',
    names: ['signal-ok', 'signal-warn', 'signal-bad'],
  },
  {
    titleKey: 'tokens.section.machine',
    noteKey: 'tokens.note.machine',
    names: ['machine', 'machine-text', 'machine-dim'],
  },
]

const COLOR_TOKEN_NAMES = COLOR_GROUPS.flatMap((group) => group.names)

type TypeSample = {
  utility: string
  sampleKey: TranslationKey
  stageClass?: string
}

const TYPE_CHROME: TypeSample[] = [
  { utility: 'text-brand', sampleKey: 'tokens.sample' },
  { utility: 'text-eyebrow', sampleKey: 'tokens.sample.mono' },
  { utility: 'text-panel-title', sampleKey: 'tokens.sample' },
  { utility: 'text-label', sampleKey: 'tokens.sample' },
  { utility: 'text-input', sampleKey: 'tokens.sample' },
  { utility: 'text-body', sampleKey: 'tokens.sample' },
  { utility: 'text-button-primary', sampleKey: 'tokens.sample', stageClass: 'bg-cyanotype' },
  { utility: 'text-data', sampleKey: 'tokens.sample.mono' },
  { utility: 'text-tape', sampleKey: 'tokens.sample.mono', stageClass: 'bg-machine' },
]

const TYPE_HOMEPAGE: TypeSample[] = [
  { utility: 'display-xl', sampleKey: 'tokens.sample' },
  { utility: 'display-md', sampleKey: 'tokens.sample' },
  { utility: 'body-lg', sampleKey: 'tokens.sample' },
]

const FONT_FACES = [
  { family: 'IBM Plex Sans', weight: '300', style: 'normal' },
  { family: 'IBM Plex Sans', weight: '400', style: 'normal' },
  { family: 'IBM Plex Sans', weight: '400', style: 'italic' },
  { family: 'IBM Plex Sans', weight: '500', style: 'normal' },
  { family: 'IBM Plex Sans', weight: '600', style: 'normal' },
  { family: 'IBM Plex Mono', weight: '400', style: 'normal' },
  { family: 'IBM Plex Mono', weight: '500', style: 'normal' },
  { family: 'IBM Plex Mono', weight: '600', style: 'normal' },
  { family: 'Archivo', weight: '600', style: 'normal' },
  { family: 'Archivo Expanded', weight: '700', style: 'normal' },
  // Fase 6 (§2.3): nama/body Classic ATS & Executive + meta italic.
  { family: 'Source Serif 4', weight: '400', style: 'normal' },
  { family: 'Source Serif 4', weight: '700', style: 'normal' },
  { family: 'Source Serif 4', weight: '400', style: 'italic' },
] as const

const faceKey = (family: string, weight: string, style: string) => `${family}|${weight}|${style}`

type TypeMetrics = {
  family: string
  size: string
  weight: string
  tracking: string
  lineHeight: string
  color: string
}

type FontFaceStatus = { declared: boolean; loaded: boolean }

type TokenReadout = {
  colors: Record<string, string>
  type: Record<string, TypeMetrics>
  faces: Record<string, FontFaceStatus>
}

function collect(): TokenReadout {
  const rootStyle = getComputedStyle(document.documentElement)
  const colors: Record<string, string> = {}
  for (const name of COLOR_TOKEN_NAMES) {
    colors[name] = rootStyle.getPropertyValue(`--color-${name}`).trim()
  }

  const type: Record<string, TypeMetrics> = {}
  for (const element of document.querySelectorAll<HTMLElement>('[data-type-token]')) {
    const key = element.dataset.typeToken ?? ''
    if (!key) continue
    const computed = getComputedStyle(element)
    type[key] = {
      family: computed.fontFamily,
      size: computed.fontSize,
      weight: computed.fontWeight,
      tracking: computed.letterSpacing,
      lineHeight: computed.lineHeight,
      color: computed.color,
    }
  }

  const faces: Record<string, FontFaceStatus> = {}
  for (const face of FONT_FACES) {
    faces[faceKey(face.family, face.weight, face.style)] = { declared: false, loaded: false }
  }
  document.fonts.forEach((available) => {
    const family = available.family.replace(/^["']|["']$/g, '')
    const key = faceKey(family, available.weight, available.style)
    if (key in faces) faces[key] = { declared: true, loaded: faces[key]?.loaded ?? false }
  })
  for (const face of FONT_FACES) {
    const key = faceKey(face.family, face.weight, face.style)
    const probe = `${face.style === 'italic' ? 'italic ' : ''}${face.weight} 14px "${face.family}"`
    faces[key] = { declared: faces[key]?.declared ?? false, loaded: document.fonts.check(probe) }
  }

  return { colors, type, faces }
}

let snapshot: TokenReadout | null = null

const getSnapshot = (): TokenReadout => {
  if (!snapshot) snapshot = collect()
  return snapshot
}

const subscribe = (onStoreChange: () => void): (() => void) => {
  const refresh = () => {
    snapshot = collect()
    onStoreChange()
  }
  void document.fonts.ready.then(refresh)
  window.addEventListener('resize', refresh)
  return () => window.removeEventListener('resize', refresh)
}

const METRIC_KEYS = [
  ['family', 'tokens.computed.family'],
  ['size', 'tokens.computed.size'],
  ['weight', 'tokens.computed.weight'],
  ['tracking', 'tokens.computed.tracking'],
  ['lineHeight', 'tokens.computed.lineHeight'],
  ['color', 'tokens.computed.color'],
] as const satisfies readonly (readonly [keyof TypeMetrics, TranslationKey])[]

function TypeSampleRow({ sample, metrics }: { sample: TypeSample; metrics?: TypeMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-rule py-3 md:grid-cols-[200px_minmax(0,1fr)_minmax(280px,auto)]">
      <code className="text-data text-cyanotype">{sample.utility}</code>
      <div className={`rounded-md px-3 py-2 ${sample.stageClass ?? 'bg-raised'}`}>
        <span data-type-token={sample.utility} className={sample.utility}>
          {t(sample.sampleKey)}
        </span>
      </div>
      {metrics ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 self-center">
          {METRIC_KEYS.map(([metricKey, labelKey]) => (
            <div key={metricKey} className="flex gap-2">
              <dt className="text-data text-ink-tertiary">{t(labelKey)}</dt>
              <dd className="text-data truncate text-ink-secondary" title={metrics[metricKey]}>
                {metrics[metricKey]}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

function Section({
  titleKey,
  note,
  catalog,
  children,
}: {
  titleKey: TranslationKey
  note?: TranslationKey
  catalog?: string
  children: ReactNode
}) {
  return (
    <section data-catalog={catalog} className="border-b border-rule py-8 first:pt-0">
      <h2 className="text-panel-title">{t(titleKey)}</h2>
      {note ? <p className="text-body mt-1 max-w-[90ch]">{t(note)}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SwatchGrid({ names, readout }: { names: string[]; readout: TokenReadout }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {names.map((name) => (
        <li
          key={name}
          data-probe="swatch"
          className="overflow-hidden rounded-lg border border-rule bg-raised"
        >
          <div
            className="h-16 w-full border-b border-rule"
            style={{ background: `var(--color-${name})` }}
          />
          <div className="p-2">
            <p className="text-data text-ink">--color-{name}</p>
            <p data-probe="swatch-value" className="text-data mt-1 text-ink-tertiary">
              {readout.colors[name] ?? '—'}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function PrimitiveCatalog() {
  return (
    <>
      <Section titleKey="tokens.section.panelHeader" catalog="panel-header">
        <div className="flex flex-col gap-4 rounded-lg border border-rule bg-raised p-4">
          <PanelHeader title={t('rail.heading')} meta="6/9" />
          <Eyebrow>{t('tokens.demo.eyebrow')}</Eyebrow>
          <p className="text-panel-title">{t('tokens.demo.panelTitle')}</p>
        </div>
      </Section>

      <Section titleKey="tokens.section.buttons" note="tokens.note.states" catalog="buttons">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t('tokens.button.primary')}</Button>
            <Button variant="secondary">{t('tokens.button.secondary')}</Button>
            <Button variant="ghost">{t('tokens.button.ghost')}</Button>
            <Button variant="subtle">{t('tokens.button.subtle')}</Button>
            <Button variant="destructive">{t('tokens.button.destructive')}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">{t('tokens.button.primary')}</Button>
            <Button size="md">{t('tokens.button.primary')}</Button>
            <Button size="lg">{t('tokens.button.primary')}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled>{t('tokens.demo.disabled')}</Button>
            <Button variant="secondary" disabled>
              {t('tokens.demo.disabled')}
            </Button>
            <Button variant="ghost" disabled>
              {t('tokens.demo.disabled')}
            </Button>
            <Button data-demo-focus="true">{t('tokens.button.focused')}</Button>
            <Button variant="secondary" data-demo-focus="true">
              {t('tokens.button.focused')}
            </Button>
          </div>
        </div>
      </Section>

      <Section titleKey="tokens.section.iconButtons" catalog="icon-buttons">
        <div className="flex flex-wrap items-center gap-3">
          <IconButton label={t('tokens.demo.iconAdd')} size="sm">
            <Plus aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={t('tokens.demo.iconCopy')} size="md">
            <Copy aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={t('tokens.demo.iconTrash')} size="lg" variant="subtle">
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={t('tokens.demo.iconTrash')} variant="secondary" data-demo-focus="true">
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={t('tokens.demo.iconMore')} disabled>
            <Plus aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </Section>

      <Section titleKey="tokens.section.fields" note="tokens.note.focus" catalog="fields">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            id="tokens-input-default"
            label={t('tokens.demo.fieldLabel')}
            hint={t('tokens.demo.fieldHint')}
          >
            <Input placeholder={t('tokens.demo.fieldPlaceholder')} defaultValue="Alex Morgan" />
          </Field>

          <Field
            id="tokens-field-error"
            label={t('tokens.demo.fieldErrorLabel')}
            required
            error={t('tokens.demo.fieldError')}
          >
            <Input defaultValue="alex@mail" />
          </Field>

          <Field id="tokens-field-disabled" label={t('tokens.demo.fieldDisabled')}>
            <Input disabled defaultValue="alex@mail.com" />
          </Field>

          <Field id="tokens-field-focus" label={t('tokens.demo.fieldFocus')}>
            <Input data-demo-focus="true" defaultValue="Alex Morgan" />
          </Field>

          <Field
            id="tokens-field-textarea"
            label={t('tokens.demo.textareaLabel')}
            className="md:col-span-2"
          >
            <Textarea placeholder={t('tokens.demo.textareaPlaceholder')} />
          </Field>
        </div>
      </Section>

      <Section titleKey="tokens.section.toggles" catalog="toggles">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 rounded-md border border-rule bg-raised px-3 py-2">
            <div>
              <Label htmlFor="tokens-switch-default">{t('tokens.demo.switchLabel')}</Label>
              <p className="text-caption text-ink-secondary">{t('tokens.demo.switchDetail')}</p>
            </div>
            <Switch id="tokens-switch-default" defaultChecked />
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Switch aria-label={t('tokens.demo.disabled')} disabled />
            <Switch aria-label={t('tokens.demo.disabled')} disabled defaultChecked />
            <Switch aria-label={t('tokens.demo.fieldFocus')} data-demo-focus="true" />
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2">
              <Checkbox id="tokens-checkbox-default" />
              <Label htmlFor="tokens-checkbox-default">{t('tokens.demo.checkboxLabel')}</Label>
            </span>
            <span className="flex items-center gap-2">
              <Checkbox id="tokens-checkbox-checked" defaultChecked />
              <Label htmlFor="tokens-checkbox-checked">{t('tokens.demo.checkboxLabel')}</Label>
            </span>
            <span className="flex items-center gap-2">
              <Checkbox id="tokens-checkbox-disabled" disabled />
              <Label htmlFor="tokens-checkbox-disabled">{t('tokens.demo.checkboxDisabled')}</Label>
            </span>
            <Checkbox aria-label={t('tokens.demo.fieldFocus')} data-demo-focus="true" />
          </div>
        </div>
      </Section>

      <Section titleKey="tokens.section.chips" catalog="chips">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{t('tokens.demo.chipLabel')}</Chip>
            <Chip onRemove={() => undefined} removeLabel={t('tokens.demo.chipRemove')}>
              {t('tokens.demo.chipLabel')}
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t('tokens.demo.badgeOk')}</Badge>
            <Badge variant="ok">{t('tokens.demo.badgeOk')}</Badge>
            <Badge variant="warn">{t('tokens.demo.badgeWarn')}</Badge>
            <Badge variant="bad">{t('tokens.demo.badgeBad')}</Badge>
            <Badge variant="outline">{t('tokens.demo.disabled')}</Badge>
          </div>
        </div>
      </Section>

      <Section titleKey="tokens.section.emptyState" catalog="empty-state">
        <div className="rounded-lg border border-rule bg-raised">
          <EmptyState
            icon={Wrench}
            title={t('tokens.demo.emptyTitle')}
            body={t('tokens.demo.emptyBody')}
            action={
              <Button variant="secondary" size="sm">
                {t('tokens.demo.emptyAction')}
              </Button>
            }
          />
        </div>
      </Section>
    </>
  )
}

function OverlayCatalog() {
  return (
    <>
      <Section titleKey="tokens.section.dialog" catalog="dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">{t('tokens.demo.openDialog')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tokens.demo.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('tokens.demo.dialogBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost">{t('common.cancel')}</Button>
              <Button variant="destructive">{t('tokens.demo.dialogConfirm')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section titleKey="tokens.section.sheet" catalog="sheet">
        <div className="flex flex-wrap items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">{t('tokens.demo.openSheetRight')}</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t('tokens.demo.openSheetRight')}</SheetTitle>
                <SheetDescription>{t('tokens.demo.sheetBody')}</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">{t('tokens.demo.openSheetBottom')}</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60dvh]">
              <SheetHeader>
                <SheetTitle>{t('tokens.demo.openSheetBottom')}</SheetTitle>
                <SheetDescription>{t('tokens.demo.sheetBody')}</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </Section>

      <Section titleKey="tokens.section.popover" catalog="popover">
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="subtle">{t('tokens.demo.openPopover')}</Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <PopoverTitle>{t('tokens.demo.popoverTitle')}</PopoverTitle>
              <PopoverDescription>{t('tokens.demo.popoverBody')}</PopoverDescription>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle">{t('tokens.demo.menu')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{t('tokens.demo.menu')}</DropdownMenuLabel>
              <DropdownMenuItem>{t('tokens.demo.menuRename')}</DropdownMenuItem>
              <DropdownMenuItem>{t('tokens.demo.menuDuplicate')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                {t('tokens.demo.menuDelete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Section>

      <Section titleKey="tokens.section.tooltip" catalog="tooltip">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">{t('tokens.demo.tooltipTrigger')}</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('tokens.demo.tooltip')}</TooltipContent>
        </Tooltip>
      </Section>

      <Section titleKey="tokens.section.tabs" catalog="tabs">
        <Tabs defaultValue="issues" className="max-w-[420px]">
          <TabsList variant="line">
            <TabsTrigger value="issues">{t('tokens.demo.tabOne')}</TabsTrigger>
            <TabsTrigger value="tape">{t('tokens.demo.tabTwo')}</TabsTrigger>
          </TabsList>
          <TabsContent value="issues" className="text-body pt-2">
            {t('tokens.demo.tabBody')}
          </TabsContent>
          <TabsContent value="tape" className="text-body pt-2">
            {t('tokens.demo.tabBody')}
          </TabsContent>
        </Tabs>
      </Section>

      <Section titleKey="tokens.section.accordion" catalog="accordion">
        <Accordion type="single" collapsible className="max-w-[560px]">
          <AccordionItem value="faq-1" className="border-t border-rule border-b-0">
            <AccordionTrigger>{t('tokens.demo.accordionTitle')}</AccordionTrigger>
            <AccordionContent className="text-body">
              {t('tokens.demo.accordionBody')}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section titleKey="tokens.section.scroll" catalog="scroll">
        <div className="flex flex-col gap-4">
          <ScrollArea className="h-[120px] rounded-md border border-rule bg-raised">
            <ul className="flex flex-col gap-2 p-3">
              {Array.from({ length: 8 }, (_, index) => (
                <li key={index} className="text-data text-ink-secondary">
                  {index + 1} · {t('tokens.demo.scrollHint')}
                </li>
              ))}
            </ul>
          </ScrollArea>
          <Separator />
          <p className="text-hint text-ink-tertiary">{t('tokens.demo.separator')}</p>
        </div>
      </Section>

      <Section titleKey="tokens.section.toast" catalog="toast">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => toast(t('tokens.demo.toastMessage'))}>
            {t('tokens.demo.toast')}
          </Button>
          <Button variant="ghost" onClick={() => toast.error(t('tokens.demo.toastError'))}>
            {t('tokens.demo.toastError')}
          </Button>
        </div>
      </Section>
    </>
  )
}

export default function TokensPage() {
  const readout = useSyncExternalStore(subscribe, getSnapshot)

  return (
    <TooltipProvider>
      <DevPageShell titleKey="tokens.title" subtitleKey="tokens.subtitle">
        {COLOR_GROUPS.map((group) => (
          <Section key={group.titleKey} titleKey={group.titleKey} note={group.noteKey}>
            <SwatchGrid names={group.names} readout={readout} />
          </Section>
        ))}

        <Section titleKey="tokens.section.typeChrome">
          {TYPE_CHROME.map((sample) => (
            <TypeSampleRow
              key={sample.utility}
              sample={sample}
              metrics={readout.type[sample.utility]}
            />
          ))}
        </Section>

        <Section titleKey="tokens.section.typeHome">
          {TYPE_HOMEPAGE.map((sample) => (
            <TypeSampleRow
              key={sample.utility}
              sample={sample}
              metrics={readout.type[sample.utility]}
            />
          ))}
        </Section>

        <Section titleKey="tokens.section.families">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FONT_FACES.map((face) => {
              const status = readout.faces[faceKey(face.family, face.weight, face.style)]
              return (
                <li
                  key={faceKey(face.family, face.weight, face.style)}
                  data-probe="font-face"
                  data-declared={String(Boolean(status?.declared))}
                  data-loaded={String(Boolean(status?.loaded))}
                  className="rounded-lg border border-rule bg-raised p-3"
                >
                  <p className="text-label">{face.family}</p>
                  <p className="text-data mt-1 text-ink-secondary">
                    {face.weight} {face.style}
                  </p>
                  <p
                    className={`text-data mt-2 ${
                      status?.declared ? 'text-signal-ok' : 'text-signal-bad'
                    }`}
                  >
                    {status?.declared
                      ? t('tokens.fontStatus.declared')
                      : t('tokens.fontStatus.missing')}
                  </p>
                </li>
              )
            })}
          </ul>
        </Section>

        <PrimitiveCatalog />
        <OverlayCatalog />
      </DevPageShell>
    </TooltipProvider>
  )
}

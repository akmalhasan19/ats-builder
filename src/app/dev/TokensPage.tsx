import { useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  /** Latar khusus bila token itu memang hidup di atas surface tertentu (§2.3). */
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
  { family: 'IBM Plex Sans', weight: '400', style: 'normal' },
  { family: 'IBM Plex Sans', weight: '400', style: 'italic' },
  { family: 'IBM Plex Sans', weight: '500', style: 'normal' },
  { family: 'IBM Plex Sans', weight: '600', style: 'normal' },
  { family: 'IBM Plex Mono', weight: '400', style: 'normal' },
  { family: 'IBM Plex Mono', weight: '500', style: 'normal' },
  { family: 'IBM Plex Mono', weight: '600', style: 'normal' },
  { family: 'Archivo', weight: '600', style: 'normal' },
  { family: 'Archivo Expanded', weight: '700', style: 'normal' },
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
  children,
}: {
  titleKey: TranslationKey
  note?: TranslationKey
  children: ReactNode
}) {
  return (
    <section className="border-b border-rule py-8 first:pt-0">
      <h2 className="text-panel-title">{t(titleKey)}</h2>
      {note ? <p className="text-body mt-1 max-w-[90ch]">{t(note)}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function TokensPage() {
  const readout = useSyncExternalStore(subscribe, getSnapshot)

  return (
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

      <Section titleKey="tokens.section.buttons" note="tokens.note.states">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default">{t('tokens.button.primary')}</Button>
            <Button variant="outline">{t('tokens.button.secondary')}</Button>
            <Button variant="secondary">{t('tokens.button.subtle')}</Button>
            <Button variant="ghost">{t('tokens.button.ghost')}</Button>
            <Button variant="destructive">{t('tokens.button.destructive')}</Button>
            <Button variant="link">{t('tokens.button.ghost')}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">{t('tokens.button.subtle')}</Button>
            <Button size="default">{t('tokens.button.subtle')}</Button>
            <Button size="lg">{t('tokens.button.subtle')}</Button>
            <Button disabled>{t('tokens.button.primary')}</Button>
            <Button variant="outline" disabled>
              {t('tokens.button.secondary')}
            </Button>
            <Button variant="secondary">{t('tokens.button.focused')}</Button>
          </div>
        </div>
      </Section>

      <Section titleKey="tokens.section.inputs" note="tokens.note.states">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tokens-input-default">{t('tokens.input.label')}</Label>
            <Input
              id="tokens-input-default"
              placeholder={t('tokens.input.placeholder')}
              defaultValue="Alex Morgan"
            />
            <span className="text-data text-ink-tertiary">{t('tokens.input.hint')}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tokens-input-error">{t('tokens.input.errorLabel')}</Label>
            <Input
              id="tokens-input-error"
              aria-invalid
              aria-describedby="tokens-input-error-message"
              defaultValue="alex@mail"
            />
            <span id="tokens-input-error-message" className="text-body text-signal-bad">
              {t('tokens.input.error')}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tokens-input-disabled">{t('tokens.input.disabledLabel')}</Label>
            <Input id="tokens-input-disabled" disabled defaultValue="alex@mail.com" />
          </div>
        </div>
      </Section>
    </DevPageShell>
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

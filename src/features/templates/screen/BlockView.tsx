import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { mmToPx } from '@/lib/units'
import { useDocStore } from '@/store/docStore'
import { useMeasuredHeight } from '@/features/preview/useMeasuredHeight'
import { withRenderProbe } from '@/features/preview/renderProbe'
import type { BlockKind } from '@/features/preview/pagination'
import {
  entryContentOf,
  profileContact,
  sectionLabel,
  skillGroupLines,
  summaryText,
  type EntriesSectionKind,
} from '@/features/templates/contentLines'
import { contactLine, headingLabel, type TemplateSpec } from '@/features/templates/specs'
import type { ResumeDoc } from '@/types/resume'
import type { SectionKind } from '@/schema/resume'
import { screenStylesOf } from './screenStyles'
import { MarkedText } from './MarkedText'

/**
 * Blok dokumen di atas lembar A4 (T4.4). `BlockView` hanya menerima primitif +
 * spec stabil dan tiap jenis blok berlangganan potongannya sendiri, jadi satu
 * bullet yang berubah tidak pernah menyeret blok `skills`/`education` (Gate 4).
 */
export type BlockViewProps = {
  blockKey: string
  kind: BlockKind
  sectionKind: SectionKind
  sectionId: string
  itemId?: string
  lineIndex?: number
  padAfterMm: number
  spec: TemplateSpec
  keywords: readonly string[]
  showMarks: boolean
}

type Marked = { keywords: readonly string[]; showMarks: boolean }

type SliceProps = {
  sectionId: string
  itemId: string
  spec: TemplateSpec
  marked: Marked
}

const contentOf = (doc: ResumeDoc, sectionId: string, itemId: string) => {
  const section = doc.sections.find((item) => item.id === sectionId)
  if (
    !section ||
    section.kind === 'profile' ||
    section.kind === 'summary' ||
    section.kind === 'skills'
  )
    return null
  const entry = (section.data.entries as Record<string, unknown>[]).find(
    (item) => String(item.id) === itemId,
  )
  if (!entry) return null
  return entryContentOf(section.kind as EntriesSectionKind, entry, doc.settings.language)
}

const Text = ({ text, marked }: { text: string; marked: Marked }) => (
  <MarkedText text={text} keywords={marked.keywords} showMarks={marked.showMarks} />
)

const HeaderBlock = ({ sectionId, spec, marked }: SliceProps) => {
  const data = useDocStore(
    useShallow((state) => {
      const section = state.doc.sections.find((item) => item.id === sectionId)
      if (!section || section.kind !== 'profile') return { name: '', headline: '', contact: '' }
      return {
        name: section.data.fullName,
        headline: section.data.headline,
        contact: contactLine(profileContact(section.data), spec),
      }
    }),
  )
  const styles = screenStylesOf(spec)
  return (
    <header>
      {data.name ? (
        <div style={styles.name}>
          <Text text={data.name} marked={marked} />
        </div>
      ) : null}
      {data.headline ? (
        <div style={styles.headline}>
          <Text text={data.headline} marked={marked} />
        </div>
      ) : null}
      {data.contact ? <div style={styles.contact}>{data.contact}</div> : null}
    </header>
  )
}

const HeadingBlock = ({ sectionKind, spec }: { sectionKind: SectionKind; spec: TemplateSpec }) => {
  const styles = screenStylesOf(spec)
  return (
    <>
      <h2 style={styles.heading}>{headingLabel(sectionLabel(sectionKind), spec)}</h2>
      {styles.headingRule ? <div style={styles.headingRule} /> : null}
    </>
  )
}

const SummaryBlock = ({ sectionId, spec, marked }: SliceProps) => {
  const text = useDocStore((state) => {
    const section = state.doc.sections.find((item) => item.id === sectionId)
    return section ? summaryText(section) : ''
  })
  const styles = screenStylesOf(spec)
  return (
    <p style={styles.body}>
      <Text text={text} marked={marked} />
    </p>
  )
}

const SkillGroupBlock = ({ sectionId, itemId, spec, marked }: SliceProps) => {
  const data = useDocStore(
    useShallow((state) => {
      const section = state.doc.sections.find((item) => item.id === sectionId)
      if (!section || section.kind !== 'skills') return { name: '', items: '' }
      const group = section.data.groups.find((item) => item.id === itemId)
      const lines = group ? skillGroupLines(group) : []
      return { name: lines[0] ?? '', items: lines.slice(1).join(', ') }
    }),
  )
  const styles = screenStylesOf(spec)
  return (
    <div>
      {data.name ? (
        <div style={styles.entryTitle}>
          <Text text={data.name} marked={marked} />
        </div>
      ) : null}
      {data.items ? (
        <div style={styles.body}>
          <Text text={data.items} marked={marked} />
        </div>
      ) : null}
    </div>
  )
}

const EntryHeadBlock = ({ sectionId, itemId, spec, marked }: SliceProps) => {
  const data = useDocStore(
    useShallow((state) => {
      const content = contentOf(state.doc, sectionId, itemId)
      return { title: content?.title ?? '', meta: content?.meta ?? '' }
    }),
  )
  const styles = screenStylesOf(spec)
  return (
    <div>
      {data.title ? (
        <div style={styles.entryTitle}>
          <Text text={data.title} marked={marked} />
        </div>
      ) : null}
      {data.meta ? (
        <div style={styles.entryMeta}>
          <Text text={data.meta} marked={marked} />
        </div>
      ) : null}
    </div>
  )
}

const EntryLineBlock = ({
  sectionId,
  itemId,
  lineIndex,
  spec,
  marked,
}: SliceProps & { lineIndex: number }) => {
  const line = useDocStore(
    useShallow((state) => {
      const lines = contentOf(state.doc, sectionId, itemId)?.bodyLines ?? []
      const item = lines[lineIndex]
      return { text: item?.text ?? '', bullet: item?.bullet === true }
    }),
  )
  const styles = screenStylesOf(spec)
  if (line.text === '') return null
  if (!line.bullet)
    return (
      <div style={{ ...styles.body, ...styles.bodyIndent }}>
        <Text text={line.text} marked={marked} />
      </div>
    )
  return (
    <div style={styles.lineRow}>
      <span aria-hidden="true" style={styles.lineGlyph}>
        {styles.bulletGlyph}
      </span>
      <span style={styles.lineText}>
        <Text text={line.text} marked={marked} />
      </span>
    </div>
  )
}

export const BlockView = memo(function BlockView(props: BlockViewProps) {
  const ref = useMeasuredHeight<HTMLDivElement>(props.blockKey)
  const slice = {
    sectionId: props.sectionId,
    itemId: props.itemId ?? '',
    spec: props.spec,
    marked: { keywords: props.keywords, showMarks: props.showMarks },
  }
  const inner =
    props.kind === 'header' ? (
      <HeaderBlock {...slice} />
    ) : props.kind === 'section-heading' ? (
      <HeadingBlock sectionKind={props.sectionKind} spec={props.spec} />
    ) : props.kind === 'summary' ? (
      <SummaryBlock {...slice} />
    ) : props.kind === 'skill-group' ? (
      <SkillGroupBlock {...slice} />
    ) : props.kind === 'entry-head' ? (
      <EntryHeadBlock {...slice} />
    ) : (
      <EntryLineBlock {...slice} lineIndex={props.lineIndex ?? 0} />
    )

  return withRenderProbe(
    <div
      ref={ref}
      data-probe="preview-block"
      data-block-key={props.blockKey}
      data-block-kind={props.kind}
      style={{ display: 'flow-root', paddingBottom: mmToPx(props.padAfterMm) }}
    >
      {inner}
    </div>,
    props.blockKey,
  )
})

import { Fragment, memo, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { sectionLabel } from '@/features/templates/contentLines'
import {
  displaysContent,
  entryHeadGroups,
  entryLineGroups,
  fieldLabelOf,
  guideTextOf,
  headerGroups,
  skillGroupGroups,
  summaryGroups,
  type FieldSegment,
  type SegmentGroup,
} from '@/features/templates/fieldSegments'
import { headingLabel, type TemplateSpec } from '@/features/templates/specs'
import { screenStylesOf } from '@/features/templates/screen/screenStyles'
import type { BlockKind } from '@/features/preview/pagination'
import type { SectionKind } from '@/schema/resume'
import type { ResumeDoc, TemplateId } from '@/types/resume'

/**
 * Render mode kanvas (C2): isi dokumen di atas kertas dipecah jadi segmen
 * field, field kosong menampilkan guide, dan tiap segmen jadi target klik.
 *
 * Batas fase ini: segmen belum membuka editor (klik = no-op, C2.3) — editor
 * in-place menyusul di C3. Yang dipatuhi sekarang: urutan teks + separator
 * identik dengan `contentLines` (D4), guide hanya di layar (D5/D12), dan
 * affordance lewat CSS attribute selector supaya `BlockView` tak perlu prop
 * baru (D13/D15).
 */

const BUTTON_RESET: CSSProperties = {
  appearance: 'none',
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  display: 'inline',
  font: 'inherit',
  textAlign: 'inherit',
  cursor: 'text',
  borderRadius: 2,
}

/** Slot visual menentukan peran tipografi template untuk segmen. */
type CanvasFieldProps = {
  segment: FieldSegment
  role: CSSProperties
  guideColor: string
  templateId: TemplateId
}

/**
 * Satu segmen field: tombol ber-gaya teks. Field kosong menampilkan guide
 * dengan warna muted dokumen; nilai terisi memakai warna slot aslinya.
 */
const CanvasField = memo(function CanvasField({
  segment,
  role,
  guideColor,
  templateId,
}: CanvasFieldProps) {
  if (!segment.guideId) return <span>{segment.text}</span>
  const guideId = segment.guideId
  const isGuide = segment.text === ''
  const visible = isGuide ? guideTextOf(guideId, templateId) : segment.text
  return (
    <button
      type="button"
      data-field={segment.fieldPath}
      data-canvas-field="true"
      data-canvas-guide={isGuide ? 'true' : undefined}
      // D11 + P8: nama aksesibel menyebut aksi, field, dan teks yang terlihat —
      // tanpa teks terlihat, aturan "label in name" akan menandai tombol ini.
      aria-label={
        isGuide
          ? t('canvas.fillField', { field: fieldLabelOf(guideId), value: visible })
          : t('canvas.editField', { field: fieldLabelOf(guideId), value: visible })
      }
      style={{
        ...BUTTON_RESET,
        ...role,
        color: isGuide ? guideColor : 'inherit',
      }}
      className="canvas-field"
    >
      {visible}
    </button>
  )
})

/**
 * Satu baris dokumen: segmen field + pemisah literal di antaranya. Segmen yang
 * tidak menampilkan apa-apa (mis. IPK kosong) dilewati; pemisah hanya muncul
 * di antara dua bagian yang tampil — jadi baris kosong tidak pernah
 * meninggalkan "·" menggantung.
 */
const SegmentLine = memo(function SegmentLine({
  group,
  spec,
}: {
  group: SegmentGroup
  spec: TemplateSpec
}) {
  const styles = screenStylesOf(spec)
  const role = styles.roleOf[group.slot]
  const parts = group.segments.filter((segment) => displaysContent(segment))
  return (
    <>
      {parts.map((segment, index) => (
        <Fragment key={`${segment.fieldPath}-${index}`}>
          {index > 0 ? <span>{group.separator}</span> : null}
          <CanvasField
            segment={segment}
            role={role}
            guideColor={styles.guideColor}
            templateId={spec.id}
          />
        </Fragment>
      ))}
    </>
  )
})

/* --------------------------------------------------------------------------
 * Blok per jenis — selector tetap sempit, satu blok = satu subscription.
 * ----------------------------------------------------------------------- */

const entryOf = (
  doc: ResumeDoc,
  sectionId: string,
  itemId: string | undefined,
): Record<string, unknown> | null => {
  if (!itemId) return null
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
  return entry ?? null
}

const CanvasHeader = ({ sectionId, spec }: { sectionId: string; spec: TemplateSpec }) => {
  const profile = useDocStore(
    useShallow((state) => {
      const section = state.doc.sections.find((item) => item.id === sectionId)
      return section?.kind === 'profile' ? section.data : null
    }),
  )
  const styles = screenStylesOf(spec)
  const groups = headerGroups(profile, spec)
  return (
    <header>
      <div style={styles.name}>
        <SegmentLine group={groups[0]!} spec={spec} />
      </div>
      <div style={styles.headline}>
        <SegmentLine group={groups[1]!} spec={spec} />
      </div>
      <div style={styles.contact}>
        <SegmentLine group={groups[2]!} spec={spec} />
      </div>
    </header>
  )
}

const CanvasHeading = ({ sectionKind, spec }: { sectionKind: SectionKind; spec: TemplateSpec }) => {
  const styles = screenStylesOf(spec)
  return (
    <>
      <h2 style={styles.heading}>{headingLabel(sectionLabel(sectionKind), spec)}</h2>
      {styles.headingRule ? <div style={styles.headingRule} /> : null}
    </>
  )
}

const CanvasSummary = ({ sectionId, spec }: { sectionId: string; spec: TemplateSpec }) => {
  const text = useDocStore((state) => {
    const section = state.doc.sections.find((item) => item.id === sectionId)
    return section?.kind === 'summary' ? section.data.text : ''
  })
  const styles = screenStylesOf(spec)
  const groups = summaryGroups(text)
  return (
    <p style={styles.body}>
      <SegmentLine group={groups[0]!} spec={spec} />
    </p>
  )
}

const CanvasSkillGroup = ({
  sectionId,
  itemId,
  spec,
}: {
  sectionId: string
  itemId: string | undefined
  spec: TemplateSpec
}) => {
  const skillGroup = useDocStore(
    useShallow((state) => {
      const section = state.doc.sections.find((item) => item.id === sectionId)
      if (!section || section.kind !== 'skills') return null
      return section.data.groups.find((item) => item.id === itemId) ?? null
    }),
  )
  const styles = screenStylesOf(spec)
  const groups = skillGroupGroups(skillGroup, itemId ?? 'new')
  return (
    <div>
      <div style={styles.entryTitle}>
        <SegmentLine group={groups[0]!} spec={spec} />
      </div>
      <div style={styles.body}>
        <SegmentLine group={groups[1]!} spec={spec} />
      </div>
    </div>
  )
}

const CanvasEntryHead = ({
  sectionId,
  itemId,
  sectionKind,
  spec,
}: {
  sectionId: string
  itemId: string | undefined
  sectionKind: SectionKind
  spec: TemplateSpec
}) => {
  const slice = useDocStore(
    useShallow((state) => ({
      entry: entryOf(state.doc, sectionId, itemId),
      lang: state.doc.settings.language,
    })),
  )
  const styles = screenStylesOf(spec)
  const groups = entryHeadGroups(
    sectionKind as Parameters<typeof entryHeadGroups>[0],
    slice.entry,
    spec,
    slice.lang,
  )
  const title = groups.find((group) => group.slot === 'title')
  const dates = groups.find((group) => group.slot === 'dates')
  const meta = groups.find((group) => group.slot === 'meta')
  if (spec.entryLayout.datePosition === 'right') {
    return (
      <div>
        <div style={styles.entryHeadRow}>
          <span style={styles.entryHeadTitle}>
            {title ? <SegmentLine group={title} spec={spec} /> : null}
          </span>
          <span style={styles.entryHeadDates}>
            {dates ? <SegmentLine group={dates} spec={spec} /> : null}
          </span>
        </div>
        {meta ? (
          <div style={styles.entryMeta}>
            <SegmentLine group={meta} spec={spec} />
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <div>
      {title ? (
        <div style={styles.entryTitle}>
          <SegmentLine group={title} spec={spec} />
        </div>
      ) : null}
      {meta ? (
        <div style={styles.entryMeta}>
          <SegmentLine group={meta} spec={spec} />
        </div>
      ) : null}
    </div>
  )
}

const CanvasEntryLine = ({
  sectionId,
  itemId,
  sectionKind,
  lineIndex,
  spec,
}: {
  sectionId: string
  itemId: string | undefined
  sectionKind: SectionKind
  lineIndex: number
  spec: TemplateSpec
}) => {
  const entry = useDocStore(useShallow((state) => entryOf(state.doc, sectionId, itemId)))
  const styles = screenStylesOf(spec)
  const groups = entryLineGroups(
    sectionKind as Parameters<typeof entryLineGroups>[0],
    entry,
    lineIndex,
  )
  const group = groups[0]
  if (!group) return null
  const isBullet = group.segments[0]?.guideId === 'bullet'
  if (!isBullet) {
    return (
      <div style={{ ...styles.body, ...styles.bodyIndent }}>
        <SegmentLine group={group} spec={spec} />
      </div>
    )
  }
  return (
    <div style={styles.lineRow}>
      <span aria-hidden="true" style={styles.lineGlyph}>
        {styles.bulletGlyph}
      </span>
      <span style={styles.lineText}>
        <SegmentLine group={group} spec={spec} />
      </span>
    </div>
  )
}

export type CanvasBlockProps = {
  kind: BlockKind
  sectionKind: SectionKind
  sectionId: string
  itemId?: string
  lineIndex?: number
  spec: TemplateSpec
}

export const CanvasBlock = memo(function CanvasBlock({
  kind,
  sectionKind,
  sectionId,
  itemId,
  lineIndex,
  spec,
}: CanvasBlockProps) {
  if (kind === 'header') return <CanvasHeader sectionId={sectionId} spec={spec} />
  if (kind === 'section-heading') return <CanvasHeading sectionKind={sectionKind} spec={spec} />
  if (kind === 'summary') return <CanvasSummary sectionId={sectionId} spec={spec} />
  if (kind === 'skill-group')
    return <CanvasSkillGroup sectionId={sectionId} itemId={itemId} spec={spec} />
  if (kind === 'entry-head')
    return (
      <CanvasEntryHead
        sectionId={sectionId}
        itemId={itemId}
        sectionKind={sectionKind}
        spec={spec}
      />
    )
  return (
    <CanvasEntryLine
      sectionId={sectionId}
      itemId={itemId}
      sectionKind={sectionKind}
      lineIndex={lineIndex ?? 0}
      spec={spec}
    />
  )
})

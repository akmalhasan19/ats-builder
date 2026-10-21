import { Fragment, memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { useCanvasStore } from '@/store/canvasStore'
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
import { CanvasDatesEditor } from './CanvasDatesEditor'
import { CanvasFieldEditor } from './CanvasFieldEditor'
import { CANVAS_BUTTON_RESET } from './canvasButtonStyle'
import { blockKeyForField, canvasFieldSpecOf } from './canvasFields'
import { startCanvasEdit } from './canvasEditZoom'
import type { BlockKind } from '@/features/preview/pagination'
import type { SectionKind } from '@/schema/resume'
import type { ResumeDoc, TemplateId } from '@/types/resume'

/**
 * Render mode kanvas (C2): isi dokumen di atas kertas dipecah jadi segmen
 * field, field kosong menampilkan guide, dan tiap segmen jadi target klik.
 *
 * C3 — klik sebuah segmen membuka sesi edit dan menukar teksnya
 * dengan editor in-place (D3). Segmen di luar matriks C3 (kepala entri,
 * tanggal, bullet — C4) tetap tombol tanpa aksi, persis seperti pada C2.
 *
 * Yang dipatuhi sekarang: urutan teks + separator identik dengan
 * `contentLines` (D4), guide hanya di layar (D5/D12), dan affordance lewat
 * CSS attribute selector supaya `BlockView` tak perlu prop baru (D13/D15).
 */

/** Slot visual menentukan peran tipografi template untuk segmen. */
type CanvasFieldProps = {
  segment: FieldSegment
  role: CSSProperties
  guideColor: string
  templateId: TemplateId
  /** Id section pemilik segmen — dipakai untuk menulis ke dokumen (C3). */
  sectionId: string
}

/**
 * Satu segmen field: tombol ber-gaya teks. Field kosong menampilkan guide
 * dengan warna muted dokumen; nilai terisi memakai warna slot aslinya.
 *
 * C3 — segmen yang masuk matriks §4 fase ini membuka sesi edit saat diklik;
 * editor menukar teks segmen dengan control yang bisa diisi (D3).
 */
const CanvasField = memo(function CanvasField({
  segment,
  role,
  guideColor,
  templateId,
  sectionId,
}: CanvasFieldProps) {
  const session = useCanvasStore((state) =>
    state.session &&
    state.session.sectionId === sectionId &&
    state.session.fieldPath === segment.fieldPath
      ? state.session
      : null,
  )
  const spec = useMemo(
    () => canvasFieldSpecOf(sectionId, segment.fieldPath),
    [sectionId, segment.fieldPath],
  )
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  // D11 — fokus kembali ke tombol pemicu begitu sesi ditutup (commit/batal).
  useEffect(() => {
    if (wasEditing.current && !session) buttonRef.current?.focus()
    wasEditing.current = Boolean(session)
  }, [session])

  if (!segment.guideId) return <span>{segment.text}</span>

  if (session && spec) {
    if (spec.target.kind === 'entry-dates') {
      return (
        <CanvasDatesEditor
          target={spec.target}
          valueText={segment.text}
          guideText={guideTextOf(segment.guideId, templateId)}
          style={{ ...role, color: segment.text === '' ? guideColor : 'inherit' }}
        />
      )
    }
    return (
      <CanvasFieldEditor
        spec={spec}
        guideText={guideTextOf(segment.guideId, templateId)}
        style={role}
      />
    )
  }

  const guideId = segment.guideId
  const isGuide = segment.text === ''
  const visible = isGuide ? guideTextOf(guideId, templateId) : segment.text
  return (
    <button
      ref={buttonRef}
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
      onClick={(event) => {
        if (!spec) return
        // D7 + addendum layar sempit — zoom edit (75%) & pemusatan field
        // dikemas satu pintu masuk supaya semua jalur edit punya perilaku sama.
        startCanvasEdit(event.currentTarget, {
          blockKey: blockKeyForField(sectionId, segment.fieldPath),
          sectionId,
          fieldPath: segment.fieldPath,
          kind: spec.widget,
        })
      }}
      style={{
        ...CANVAS_BUTTON_RESET,
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
  sectionId,
}: {
  group: SegmentGroup
  spec: TemplateSpec
  sectionId: string
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
            sectionId={sectionId}
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
        <SegmentLine group={groups[0]!} spec={spec} sectionId={sectionId} />
      </div>
      <div style={styles.headline}>
        <SegmentLine group={groups[1]!} spec={spec} sectionId={sectionId} />
      </div>
      <div style={styles.contact}>
        <SegmentLine group={groups[2]!} spec={spec} sectionId={sectionId} />
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
      <SegmentLine group={groups[0]!} spec={spec} sectionId={sectionId} />
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
        <SegmentLine group={groups[0]!} spec={spec} sectionId={sectionId} />
      </div>
      <div style={styles.body}>
        <SegmentLine group={groups[1]!} spec={spec} sectionId={sectionId} />
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
            {title ? <SegmentLine group={title} spec={spec} sectionId={sectionId} /> : null}
          </span>
          <span style={styles.entryHeadDates}>
            {dates ? <SegmentLine group={dates} spec={spec} sectionId={sectionId} /> : null}
          </span>
        </div>
        {meta ? (
          <div style={styles.entryMeta}>
            <SegmentLine group={meta} spec={spec} sectionId={sectionId} />
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <div>
      {title ? (
        <div style={styles.entryTitle}>
          <SegmentLine group={title} spec={spec} sectionId={sectionId} />
        </div>
      ) : null}
      {meta ? (
        <div style={styles.entryMeta}>
          <SegmentLine group={meta} spec={spec} sectionId={sectionId} />
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
        <SegmentLine group={group} spec={spec} sectionId={sectionId} />
      </div>
    )
  }
  return (
    <div style={styles.lineRow}>
      <span aria-hidden="true" style={styles.lineGlyph}>
        {styles.bulletGlyph}
      </span>
      <span style={styles.lineText}>
        <SegmentLine group={group} spec={spec} sectionId={sectionId} />
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

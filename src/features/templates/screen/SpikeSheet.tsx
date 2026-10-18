import type { CSSProperties, Ref } from 'react'
import { A4_PX, mmToPx, ptToPx } from '@/lib/units'
import type { SpikeContent } from '../spikeContent'
import { SPIKE_FONTS, formatContactLine, headingLabel, spikeSpec } from '../spikeSpec'

const spec = spikeSpec

/**
 * Padanan layar dari `pdf/SpikeDocument`. Setiap nilai diturunkan dari
 * `spikeSpec` lewat konversi mm/pt → px, jadi tidak ada angka layout di sini (P4).
 */
const styles = {
  sheet: {
    width: A4_PX.w,
    height: A4_PX.h,
    flex: 'none',
    padding: mmToPx(spec.marginMm),
    background: '#FFFFFF',
    color: spec.colors.ink,
    fontFamily: SPIKE_FONTS[spec.fonts.body].css,
    fontSize: ptToPx(spec.type.bodyPt),
    lineHeight: spec.lineHeight.body,
    overflow: 'hidden',
  },
  header: { marginBottom: mmToPx(spec.gapMm.contactToFirstSection) },
  name: {
    fontFamily: SPIKE_FONTS[spec.fonts.name].css,
    fontSize: ptToPx(spec.type.namePt),
    fontWeight: spec.type.nameWeight,
    lineHeight: spec.lineHeight.name,
    marginBottom: mmToPx(spec.gapMm.nameToHeadline),
  },
  headline: {
    fontSize: ptToPx(spec.type.headlinePt),
    fontWeight: spec.type.headlineWeight,
    lineHeight: spec.lineHeight.headline,
    color: spec.colors.secondary,
    marginBottom: mmToPx(spec.gapMm.headlineToContact),
  },
  contact: {
    fontSize: ptToPx(spec.type.contactPt),
    color: spec.colors.secondary,
  },
  section: { marginTop: mmToPx(spec.gapMm.betweenSections) },
  sectionFirst: { marginTop: 0 },
  heading: {
    fontFamily: SPIKE_FONTS[spec.fonts.heading].css,
    fontSize: ptToPx(spec.type.headingPt),
    fontWeight: spec.type.headingWeight,
    letterSpacing: `${spec.type.headingTrackingEm}em`,
    color: spec.colors.ink,
    marginBottom: mmToPx(spec.gapMm.headingToRule),
  },
  headingRule: {
    height: ptToPx(spec.type.headingRulePt),
    background: spec.colors.ink,
    marginBottom: mmToPx(spec.gapMm.ruleToBody),
  },
  entryTitle: {
    fontSize: ptToPx(spec.type.bodyPt),
    fontWeight: spec.type.titleWeight,
    marginBottom: mmToPx(spec.gapMm.titleToMeta),
  },
  entryMeta: {
    fontFamily: SPIKE_FONTS[spec.fonts.meta].css,
    fontSize: ptToPx(spec.type.metaPt),
    color: spec.colors.secondary,
  },
  entryDate: {
    fontFamily: SPIKE_FONTS[spec.fonts.meta].css,
    fontSize: ptToPx(spec.type.metaPt),
    color: spec.colors.tertiary,
    marginBottom: mmToPx(spec.gapMm.metaToBullets),
  },
  bullets: { display: 'flex', flexDirection: 'column', gap: mmToPx(spec.gapMm.betweenBullets) },
  bulletRow: { display: 'flex', flexDirection: 'row' },
  bulletGlyph: {
    width: mmToPx(spec.bulletIndentMm),
    flex: 'none',
    fontSize: ptToPx(spec.type.bodyPt),
    color: spec.colors.ink,
  },
  bulletText: {
    flex: 1,
    fontSize: ptToPx(spec.type.bodyPt),
    color: spec.colors.secondary,
  },
} satisfies Record<string, CSSProperties>

export type SpikeSheetProps = {
  content: SpikeContent
  scale: number
  sheetRef?: Ref<HTMLDivElement>
}

export function SpikeSheet({ content, scale, sheetRef }: SpikeSheetProps) {
  return (
    <div
      className="flex items-start justify-center"
      style={{ width: A4_PX.w * scale, height: A4_PX.h * scale }}
    >
      <div
        ref={sheetRef}
        data-probe="sheet"
        className="rounded-paper shadow-paper"
        style={{
          ...styles.sheet,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <header data-probe="header" style={styles.header}>
          <div data-probe="name" style={styles.name}>
            {content.name}
          </div>
          <div data-probe="headline" style={styles.headline}>
            {content.headline}
          </div>
          <div data-probe="contact" style={styles.contact}>
            {formatContactLine(content.contact, spec)}
          </div>
        </header>

        {content.sections.map((section, sectionIndex) => (
          <section
            key={section.heading}
            style={sectionIndex === 0 ? styles.sectionFirst : styles.section}
          >
            <h2 data-probe="heading" style={styles.heading}>
              {headingLabel(section.heading, spec)}
            </h2>
            <div data-probe="heading-rule" style={styles.headingRule} />

            {section.entries.map((entry) => (
              <article key={`${entry.title}-${entry.org}`}>
                <div data-probe="entry-title" style={styles.entryTitle}>
                  {entry.title}
                </div>
                <div data-probe="entry-meta" style={styles.entryMeta}>
                  {`${entry.org} · ${entry.location}`}
                </div>
                <div data-probe="entry-date" style={styles.entryDate}>
                  {entry.dateLabel}
                </div>
                <div style={styles.bullets}>
                  {entry.bullets.map((bullet, bulletIndex) => (
                    <div key={bulletIndex} data-probe="bullet" style={styles.bulletRow}>
                      <span aria-hidden="true" style={styles.bulletGlyph}>
                        {spec.bulletGlyph}
                      </span>
                      <span style={styles.bulletText}>{bullet}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

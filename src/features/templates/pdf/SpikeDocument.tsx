import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { mmToPt } from '@/lib/units'
import type { SpikeContent, SpikeRenderOptions } from '../spikeContent'
import { SPIKE_FONTS, formatContactLine, headingLabel, spikeSpec } from '../spikeSpec'

const spec = spikeSpec

const styles = StyleSheet.create({
  page: {
    margin: mmToPt(spec.marginMm),
    fontFamily: SPIKE_FONTS[spec.fonts.body].pdf,
    fontSize: spec.type.bodyPt,
    lineHeight: spec.lineHeight.body,
    color: spec.colors.ink,
  },
  header: {
    marginBottom: mmToPt(spec.gapMm.contactToFirstSection),
  },
  name: {
    fontFamily: SPIKE_FONTS[spec.fonts.name].pdf,
    fontSize: spec.type.namePt,
    fontWeight: spec.type.nameWeight,
    lineHeight: spec.lineHeight.name,
    marginBottom: mmToPt(spec.gapMm.nameToHeadline),
  },
  headline: {
    fontSize: spec.type.headlinePt,
    fontWeight: spec.type.headlineWeight,
    lineHeight: spec.lineHeight.headline,
    color: spec.colors.secondary,
    marginBottom: mmToPt(spec.gapMm.headlineToContact),
  },
  contact: {
    fontSize: spec.type.contactPt,
    color: spec.colors.secondary,
  },
  section: {
    marginTop: mmToPt(spec.gapMm.betweenSections),
  },
  sectionFirst: {
    marginTop: 0,
  },
  heading: {
    fontFamily: SPIKE_FONTS[spec.fonts.heading].pdf,
    fontSize: spec.type.headingPt,
    fontWeight: spec.type.headingWeight,
    letterSpacing: spec.type.headingTrackingEm * spec.type.headingPt,
    color: spec.colors.ink,
    marginBottom: mmToPt(spec.gapMm.headingToRule),
  },
  headingRule: {
    height: spec.type.headingRulePt,
    backgroundColor: spec.colors.ink,
    marginBottom: mmToPt(spec.gapMm.ruleToBody),
  },
  entryTitle: {
    fontSize: spec.type.bodyPt,
    fontWeight: spec.type.titleWeight,
    marginBottom: mmToPt(spec.gapMm.titleToMeta),
  },
  entryMeta: {
    fontFamily: SPIKE_FONTS[spec.fonts.meta].pdf,
    fontSize: spec.type.metaPt,
    color: spec.colors.secondary,
  },
  entryDate: {
    fontFamily: SPIKE_FONTS[spec.fonts.meta].pdf,
    fontSize: spec.type.metaPt,
    color: spec.colors.tertiary,
    marginBottom: mmToPt(spec.gapMm.metaToBullets),
  },
  bullets: {
    gap: mmToPt(spec.gapMm.betweenBullets),
  },
  bulletRow: {
    flexDirection: 'row',
  },
  bulletGlyph: {
    width: mmToPt(spec.bulletIndentMm),
    fontSize: spec.type.bodyPt,
    color: spec.colors.ink,
  },
  bulletText: {
    flex: 1,
    fontSize: spec.type.bodyPt,
    color: spec.colors.secondary,
  },
})

export type SpikeDocumentProps = {
  content: SpikeContent
  options: SpikeRenderOptions
}

export function SpikeDocument({ content, options }: SpikeDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View fixed={options.repeatHeader} style={styles.header}>
          <Text style={styles.name}>{content.name}</Text>
          <Text style={styles.headline}>{content.headline}</Text>
          <Text style={styles.contact}>{formatContactLine(content.contact, spec)}</Text>
        </View>

        {content.sections.map((section, sectionIndex) => (
          <View
            key={section.heading}
            style={sectionIndex === 0 ? styles.sectionFirst : styles.section}
          >
            <Text style={styles.heading}>{headingLabel(section.heading, spec)}</Text>
            <View style={styles.headingRule} />

            {section.entries.map((entry) => (
              <View key={`${entry.title}-${entry.org}`}>
                <Text style={styles.entryTitle}>{entry.title}</Text>
                <Text style={styles.entryMeta}>{`${entry.org} · ${entry.location}`}</Text>
                <Text style={styles.entryDate}>{entry.dateLabel}</Text>
                <View style={styles.bullets}>
                  {entry.bullets.map((bullet, bulletIndex) => (
                    <View key={bulletIndex} style={styles.bulletRow}>
                      <Text style={styles.bulletGlyph}>{spec.bulletGlyph}</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}

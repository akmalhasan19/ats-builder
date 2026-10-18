import { mmToPx, ptToPx } from '@/lib/units'
import {
  SPEC_COLOR_VAR,
  TEMPLATE_FONTS,
  type SpecColorSlot,
  type TemplateSpec,
  type TypeRole,
} from '../specs'

/**
 * Gaya renderer layar (T4.4). Setiap nilai diturunkan dari `TemplateSpec` lewat
 * konversi mm/pt → px — tidak ada angka layout di komponen (P4).
 */

const roleStyle = (role: TypeRole) => ({
  fontFamily: TEMPLATE_FONTS[role.font],
  fontSize: ptToPx(role.sizePt),
  fontWeight: role.weight,
  lineHeight: role.lineHeight,
  letterSpacing: role.trackingEm === 0 ? undefined : `${role.trackingEm}em`,
})

export function screenStylesOf(spec: TemplateSpec) {
  const color = (slot: SpecColorSlot): string => SPEC_COLOR_VAR[spec.colors[slot]]

  const ruleHeightPx = ptToPx(spec.headingStyle.rule.widthPt)
  const ruleColor = SPEC_COLOR_VAR[spec.headingStyle.rule.color]

  return {
    sheet: {
      color: color('body'),
      fontFamily: TEMPLATE_FONTS[spec.typeScale.body.font],
      fontSize: ptToPx(spec.typeScale.body.sizePt),
      lineHeight: spec.typeScale.body.lineHeight,
    },
    name: {
      ...roleStyle(spec.typeScale.name),
      color: color('name'),
      textAlign: spec.nameAlign,
      marginBottom: mmToPx(spec.gapMm.nameToHeadline),
    },
    headline: {
      ...roleStyle(spec.typeScale.headline),
      color: color('headline'),
      marginBottom: mmToPx(spec.gapMm.headlineToContact),
      textAlign: spec.nameAlign,
    },
    contact: {
      ...roleStyle(spec.typeScale.contact),
      color: color('contact'),
      textAlign: spec.contactStyle.align,
    },
    heading: {
      ...roleStyle(spec.typeScale.heading),
      color: color('heading'),
      marginBottom: mmToPx(spec.gapMm.headingToRule),
    },
    headingRule:
      spec.headingStyle.rule.kind === 'none'
        ? undefined
        : spec.headingStyle.rule.kind === 'solid'
          ? { height: ruleHeightPx, background: ruleColor }
          : {
              borderBottom: `${ruleHeightPx}px ${spec.headingStyle.rule.kind} ${ruleColor}`,
            },
    entryTitle: {
      ...roleStyle(spec.typeScale.title),
      color: color('entryTitle'),
      marginBottom: mmToPx(spec.gapMm.titleToMeta),
    },
    entryMeta: { ...roleStyle(spec.typeScale.meta), color: color('entryMeta') },
    body: { ...roleStyle(spec.typeScale.body), color: color('body') },
    bodyIndent: { paddingLeft: mmToPx(spec.gapMm.bulletIndent) },
    lineRow: { display: 'flex', alignItems: 'flex-start' },
    lineGlyph: {
      ...roleStyle(spec.typeScale.body),
      color: color('body'),
      width: mmToPx(spec.gapMm.bulletIndent),
      flex: 'none',
    },
    lineText: { ...roleStyle(spec.typeScale.body), color: color('body'), flex: 1 },
    bulletGlyph: spec.bulletGlyph,
  }
}

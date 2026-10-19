import { hasGapOver, isReverseChronological } from '@/lib/dates'
import type { ResumeDoc } from '@/types/resume'
import type { AtsIssue } from '../types'

/**
 * T7.1 `dates.ts` — tanggal terisi & bisa diurai, urutan reverse-chronological,
 * celah > 6 bulan (advisory), dan `current` hanya pada entri terbaru.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const GAP_MONTHS = 6

/**
 * Bagian yang punya rentang (mulai–selesai) wajib keduanya; bagian bertanggal
 * tunggal (proyek, sertifikasi, penghargaan) hanya butuh satu tanggal — proyek
 * yang masih berjalan sah tanpa tanggal selesai.
 */
const RANGE_KINDS = new Set(['experience', 'volunteering', 'education'])

const DATE_PREFIX: Record<string, string> = {
  experience: 'exp',
  education: 'edu',
  projects: 'proj',
  volunteering: 'vol',
}

/**
 * Nama field tanggal tiap jenis bagian; `end` kosong = tanggal tunggal.
 * Bahasa & bagian lain tanpa tanggal tidak masuk daftar — memeriksa tanggal
 * pada bagian yang memang tidak punya tanggal menghasilkan isu palsu.
 */
const DATE_FIELDS: Record<string, { start: string; end?: string }> = {
  experience: { start: 'startDate', end: 'endDate' },
  volunteering: { start: 'startDate', end: 'endDate' },
  education: { start: 'startDate', end: 'endDate' },
  projects: { start: 'startDate' },
  certifications: { start: 'issuedAt' },
  awards: { start: 'awardedAt' },
}

type EntryRef = {
  sectionId: string
  sectionKind: string
  entryId: string
  start: string
  end: string
  current: boolean
}

const datedEntriesOf = (doc: ResumeDoc): EntryRef[] => {
  const refs: EntryRef[] = []
  for (const section of doc.sections) {
    if (!section.visible) continue
    if (section.kind === 'profile' || section.kind === 'summary' || section.kind === 'skills')
      continue
    if (!('entries' in section.data)) continue
    const fields = DATE_FIELDS[section.kind]
    if (!fields) continue
    for (const entry of section.data.entries) {
      const holder = entry as Record<string, unknown>
      const start = typeof holder[fields.start] === 'string' ? (holder[fields.start] as string) : ''
      const end =
        fields.end && typeof holder[fields.end] === 'string' ? (holder[fields.end] as string) : ''
      refs.push({
        sectionId: section.id,
        sectionKind: section.kind,
        entryId: String(holder.id ?? ''),
        start,
        end,
        current: holder.current === true,
      })
    }
  }
  return refs.filter((ref) => ref.entryId !== '')
}

const fieldId = (ref: EntryRef, part: 'start' | 'end'): string =>
  `${DATE_PREFIX[ref.sectionKind] ?? ref.sectionKind}-${ref.entryId}-dates-${part}`

export function checkDates(doc: ResumeDoc): AtsIssue[] {
  const issues: AtsIssue[] = []
  const refs = datedEntriesOf(doc)

  let unparseable = 0
  let missingStart = 0
  let missingEnd = 0
  let inverted = 0

  for (const ref of refs) {
    const startOk = MONTH_RE.test(ref.start)
    const endOk = MONTH_RE.test(ref.end)
    const target = (field: string): { sectionId: string; entryId: string; field: string } => ({
      sectionId: ref.sectionId,
      entryId: ref.entryId,
      field,
    })

    if (!startOk && ref.start !== '') unparseable += 1
    if (!endOk && ref.end !== '') unparseable += 1

    if (ref.start === '') {
      missingStart += 1
      issues.push({
        id: `dates.${ref.entryId}.start`,
        ruleId: 'dates.missing',
        severity: 'bad',
        titleId: 'ats.dates.startBad.title',
        detailId: 'ats.dates.startBad.detail',
        points: 12,
        target: target(fieldId(ref, 'start')),
        fixHintId: 'ats.fix.fillField',
      })
    }

    if (RANGE_KINDS.has(ref.sectionKind) && !ref.current && ref.end === '') {
      missingEnd += 1
      issues.push({
        id: `dates.${ref.entryId}.end`,
        ruleId: 'dates.missing',
        severity: 'bad',
        titleId: 'ats.dates.endBad.title',
        detailId: 'ats.dates.endBad.detail',
        points: 12,
        target: target(fieldId(ref, 'end')),
        fixHintId: 'ats.fix.fillField',
      })
    }

    if (startOk && endOk && ref.end < ref.start) {
      inverted += 1
      issues.push({
        id: `dates.${ref.entryId}.inverted`,
        ruleId: 'dates.range',
        severity: 'bad',
        titleId: 'ats.dates.invertedBad.title',
        detailId: 'ats.dates.invertedBad.detail',
        points: 12,
        params: { start: ref.start, end: ref.end },
        target: target(fieldId(ref, 'end')),
        fixHintId: 'ats.fix.fillField',
      })
    }
  }

  const ranges = refs
    .filter((ref) => ref.sectionKind === 'experience')
    .map((ref) => ({ startDate: ref.start, endDate: ref.end, current: ref.current }))

  if (ranges.length > 1 && !isReverseChronological(ranges)) {
    issues.push({
      id: 'dates.experience.order',
      ruleId: 'dates.order',
      severity: 'warn',
      titleId: 'ats.dates.orderWarn.title',
      detailId: 'ats.dates.orderWarn.detail',
      points: 4,
      target: refs[0] ? { sectionId: refs[0].sectionId, entryId: refs[0].entryId } : undefined,
      fixHintId: 'ats.fix.reorderEntries',
    })
  }

  if (ranges.length > 1 && hasGapOver(ranges, GAP_MONTHS)) {
    issues.push({
      id: 'dates.experience.gap',
      ruleId: 'dates.gap',
      severity: 'info',
      titleId: 'ats.dates.gapInfo.title',
      detailId: 'ats.dates.gapInfo.detail',
      points: 1,
      params: { months: GAP_MONTHS },
      fixHintId: 'ats.fix.explainGap',
    })
  }

  const currentRefs = refs.filter((ref) => ref.current)
  if (currentRefs.length > 1) {
    issues.push({
      id: 'dates.current.multiple',
      ruleId: 'dates.current',
      severity: 'warn',
      titleId: 'ats.dates.currentWarn.title',
      detailId: 'ats.dates.currentWarn.detail',
      points: 4,
      params: { count: currentRefs.length },
      target: currentRefs[1]
        ? {
            sectionId: currentRefs[1].sectionId,
            entryId: currentRefs[1].entryId,
            field: fieldId(currentRefs[1], 'end'),
          }
        : undefined,
      fixHintId: 'ats.fix.fillField',
    })
  } else if (refs.length > 1 && currentRefs.length === 1 && !refs[0]?.current) {
    issues.push({
      id: 'dates.current.position',
      ruleId: 'dates.current',
      severity: 'warn',
      titleId: 'ats.dates.currentPositionWarn.title',
      detailId: 'ats.dates.currentPositionWarn.detail',
      points: 4,
      target: {
        sectionId: currentRefs[0]!.sectionId,
        entryId: currentRefs[0]!.entryId,
      },
      fixHintId: 'ats.fix.reorderEntries',
    })
  }

  issues.push({
    id: 'dates.summary',
    ruleId: 'dates.summary',
    severity: 'ok',
    titleId: 'ats.dates.summaryOk.title',
    detailId: 'ats.dates.summaryOk.detail',
    points: 0,
    params: { total: refs.length, unparseable, missingStart, missingEnd, inverted },
  })

  return issues
}

/** Dipakai aturan `length` untuk menentukan target panjang halaman. */
export function monthsOfExperience(doc: ResumeDoc): number {
  const spans: [number, number][] = []
  for (const ref of datedEntriesOf(doc)) {
    if (ref.sectionKind !== 'experience') continue
    const start = /^(\d{4})-(\d{2})$/.exec(ref.start)
    if (!start) continue
    const from = Number(start[1]) * 12 + Number(start[2]) - 1
    if (ref.current) {
      const now = new Date()
      spans.push([from, now.getFullYear() * 12 + now.getMonth()])
      continue
    }
    const end = /^(\d{4})-(\d{2})$/.exec(ref.end)
    const to = end ? Number(end[1]) * 12 + Number(end[2]) - 1 : from
    spans.push([from, to])
  }
  if (spans.length === 0) return 0
  spans.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1] + 1) last[1] = Math.max(last[1], span[1])
    else merged.push([...span])
  }
  return merged.reduce((sum, [from, to]) => sum + Math.max(0, to - from), 0)
}

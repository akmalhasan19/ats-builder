import { getLang, type Lang } from '@/lib/i18n'
import type { ISOYearMonth } from '@/types/resume'

const LOCALE: Record<Lang, string> = { id: 'id-ID', en: 'en-US' }
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

const monthNumber = (value: ISOYearMonth | ''): number | null => {
  const match = MONTH_RE.exec(value)
  if (!match) return null
  return Number(match[1]) * 12 + Number(match[2]) - 1
}

const nowMonthNumber = (): number => {
  const now = new Date()
  return now.getFullYear() * 12 + now.getMonth()
}

export function formatMonth(month: ISOYearMonth | '', lang: Lang = getLang()): string {
  const parsed = monthNumber(month)
  if (parsed === null) return ''
  const year = Math.floor(parsed / 12)
  const monthIndex = parsed % 12
  return new Intl.DateTimeFormat(LOCALE[lang], { month: 'short', year: 'numeric' }).format(
    new Date(year, monthIndex, 1),
  )
}

export function durationLabel(
  start: ISOYearMonth | '',
  end: ISOYearMonth | '',
  current: boolean,
  lang: Lang = getLang(),
): string {
  const startMonths = monthNumber(start)
  const endMonths = current ? nowMonthNumber() : monthNumber(end)
  if (startMonths === null || endMonths === null || endMonths < startMonths) return ''

  const total = endMonths - startMonths
  const years = Math.floor(total / 12)
  const months = total % 12
  const parts: string[] = []
  if (years > 0) parts.push(lang === 'id' ? `${years} thn` : `${years} yr`)
  if (months > 0 || parts.length === 0) parts.push(lang === 'id' ? `${months} bln` : `${months} mo`)
  return parts.join(' ')
}

type DatedEntry = {
  startDate: ISOYearMonth | ''
  endDate: ISOYearMonth | ''
  current?: boolean
}

const recencyKey = (entry: DatedEntry): number => {
  if (entry.current === true) return Number.MAX_SAFE_INTEGER
  const end = monthNumber(entry.endDate)
  if (end !== null) return end
  return monthNumber(entry.startDate) ?? 0
}

export function isReverseChronological(entries: readonly DatedEntry[]): boolean {
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]!
    const current = entries[index]!
    if (recencyKey(previous) < recencyKey(current)) return false
  }
  return true
}

type ParsedEntry = { start: number; end: number | null; current: boolean }

export function hasGapOver(entries: readonly DatedEntry[], months: number): boolean {
  const dated: ParsedEntry[] = []
  for (const entry of entries) {
    const start = monthNumber(entry.startDate)
    if (start === null) continue
    dated.push({ start, end: monthNumber(entry.endDate), current: entry.current === true })
  }
  dated.sort((a, b) => a.start - b.start)

  for (let index = 1; index < dated.length; index += 1) {
    const previous = dated[index - 1]!
    const next = dated[index]!

    if (previous.current) {
      const overlap = next.start - nowMonthNumber()
      if (overlap > 0 && overlap > months) return true
      continue
    }
    if (previous.end === null) continue

    const gap = next.start - previous.end
    if (gap > months) return true
  }
  return false
}

import type { TranslationKey } from '@/lib/i18n'

/**
 * T7.1 — bentuk laporan checker. `titleId`/`detailId` adalah kunci kamus, bukan
 * kalimat jadi (P7): komponen memanggil `t(issue.titleId, issue.params)`.
 */
export type AtsSeverity = 'bad' | 'warn' | 'info' | 'ok'

/** Arahkan tombol `Perbaiki →` ke field yang salah — bukan ke sekadar bagian. */
export type AtsTarget = {
  sectionId: string
  entryId?: string
  field?: string
}

export type AtsIssue = {
  /** Stabil untuk dokumen yang sama — dipakai key React & snapshot test. */
  id: string
  ruleId: string
  severity: AtsSeverity
  titleId: TranslationKey
  detailId: TranslationKey
  points: number
  params?: Record<string, string | number>
  target?: AtsTarget
  fixHintId?: TranslationKey
}

export type KeywordMatch = {
  matched: string[]
  missing: string[]
  /** 0–1: porsi kata kunci lowongan yang sudah ada di dokumen. */
  density: number
}

export type AtsBand = {
  score: number
  labelId: TranslationKey
  /** Token §2.2 — warna band tidak pernah jadi pembawa makna tunggal (aturan 3). */
  colorKey: 'signal-bad' | 'signal-warn' | 'accent' | 'signal-ok'
}

export type AtsReport = {
  issues: AtsIssue[]
  score: number
  band: AtsBand
  keywords: KeywordMatch | null
  pageCount: number
  checkedAt: number
}

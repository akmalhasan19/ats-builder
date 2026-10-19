import type { AtsBand, AtsIssue, AtsSeverity } from './types'

/**
 * T7.2 — skor dari daftar isu. Basis 100; `bad` −12 (maks −48), `warn` −4
 * (maks −24), `info` −1 (maks −6); lantai 0.
 *
 * Label resmi **Indeks Struktur**, bukan "ATS Score" (P5): angka ini mengukur
 * kelengkapan struktur & keterbacaan, bukan peluang lolos mesin tertentu.
 */

const BASIS = 100
const PENALTY: Record<AtsSeverity, { per: number; cap: number }> = {
  bad: { per: 12, cap: 48 },
  warn: { per: 4, cap: 24 },
  info: { per: 1, cap: 6 },
  ok: { per: 0, cap: 0 },
}

export type ScoreBuckets = Record<'bad' | 'warn' | 'info' | 'ok', number>

export const countBySeverity = (issues: readonly AtsIssue[]): ScoreBuckets => {
  const buckets: ScoreBuckets = { bad: 0, warn: 0, info: 0, ok: 0 }
  for (const issue of issues) buckets[issue.severity] += 1
  return buckets
}

export function scoreOf(issues: readonly AtsIssue[]): number {
  const buckets = countBySeverity(issues)
  let score = BASIS
  for (const severity of ['bad', 'warn', 'info'] as const) {
    score -= Math.min(PENALTY[severity].cap, buckets[severity] * PENALTY[severity].per)
  }
  return Math.max(0, score)
}

/** Band §5.6 — 0–49 · 50–74 · 75–89 · 90–100. */
export function bandOf(score: number): AtsBand {
  if (score <= 49) return { score, labelId: 'ats.band.low', colorKey: 'signal-bad' }
  if (score <= 74) return { score, labelId: 'ats.band.fair', colorKey: 'signal-warn' }
  if (score <= 89) return { score, labelId: 'ats.band.good', colorKey: 'accent' }
  return { score, labelId: 'ats.band.excellent', colorKey: 'signal-ok' }
}

/**
 * 20 tick: sebaran severity yang sama dengan daftar isu. Bukan gauge melingkar
 * (§2.8) — tick diisi berurutan bad → warn → info → ok.
 */
export const TICK_COUNT = 20

export function tickColors(buckets: ScoreBuckets): AtsSeverity[] {
  const ticks: AtsSeverity[] = []
  const push = (severity: AtsSeverity, count: number): void => {
    for (let index = 0; index < count; index += 1) ticks.push(severity)
  }
  push('bad', buckets.bad)
  push('warn', buckets.warn)
  push('info', buckets.info)
  const filled = Math.min(TICK_COUNT, ticks.length)
  push('ok', TICK_COUNT - filled)
  return ticks.slice(0, TICK_COUNT)
}

/**
 * Unit dpi-independen (§3 keputusan arsitektur #2).
 * Layar  = 96 dpi  → px
 * PDF    = 72 pt/in → pt
 * Keduanya diturunkan dari mm supaya preview dan PDF tidak bisa menyimpang.
 */

export const PX_PER_INCH = 96
export const PT_PER_INCH = 72
export const MM_PER_INCH = 25.4

export const PX_PER_MM = PX_PER_INCH / MM_PER_INCH
export const PT_PER_MM = PT_PER_INCH / MM_PER_INCH
export const MM_PER_PX = MM_PER_INCH / PX_PER_INCH
export const PX_PER_PT = PX_PER_INCH / PT_PER_INCH

export const A4_MM = { w: 210, h: 297 } as const

/** A4 di layar: 794 × 1123 px (pembulatan dari 210/297 mm pada 96 dpi). */
export const A4_PX = { w: 794, h: 1123 } as const

/** A4 di PDF: 595.28 × 841.89 pt. */
export const A4_PT = { w: 595.28, h: 841.89 } as const

export const mmToPx = (mm: number): number => mm * PX_PER_MM

export const mmToPt = (mm: number): number => mm * PT_PER_MM

export const pxToMm = (px: number): number => px * MM_PER_PX

export const ptToPx = (pt: number): number => pt * PX_PER_PT

/** 1 mm dalam px — dipakai sebagai toleransi perbandingan layar vs PDF. */
export const TOLERANCE_MM = 1
export const TOLERANCE_PX = mmToPx(TOLERANCE_MM)
export const TOLERANCE_PT = mmToPt(TOLERANCE_MM)

export const round2 = (n: number): number => Math.round(n * 100) / 100

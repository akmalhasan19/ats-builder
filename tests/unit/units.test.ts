import { describe, expect, it } from 'vitest'
import {
  A4_PT,
  A4_PX,
  mmToPt,
  mmToPx,
  ptToPx,
  pxToMm,
  round2,
  TOLERANCE_PT,
  TOLERANCE_PX,
} from '@/lib/units'

describe('units', () => {
  it('mengonversi mm ke px pada 96 dpi', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 10)
    expect(mmToPx(0)).toBe(0)
    expect(mmToPx(16)).toBeCloseTo(60.4724, 3)
  })

  it('mengonversi mm ke pt pada 72 pt/inch', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 10)
    expect(mmToPt(16)).toBeCloseTo(45.3543, 3)
  })

  it('mengonversi px kembali ke mm', () => {
    expect(pxToMm(96)).toBeCloseTo(25.4, 10)
    for (const mm of [0, 1, 14, 16, 18, 20, 210, 297]) {
      expect(pxToMm(mmToPx(mm))).toBeCloseTo(mm, 9)
    }
  })

  it('mengonversi pt ke px dengan rasio 4/3', () => {
    expect(ptToPx(72)).toBeCloseTo(96, 10)
    expect(ptToPx(9)).toBeCloseTo(12, 10)
    expect(ptToPx(24)).toBeCloseTo(32, 10)
  })

  it('A4_PX adalah pembulatan A4 dalam mm pada 96 dpi', () => {
    expect(A4_PX.w).toBe(Math.round(mmToPx(210)))
    expect(A4_PX.h).toBe(Math.round(mmToPx(297)))
    expect(A4_PX).toEqual({ w: 794, h: 1123 })
  })

  it('A4_PT adalah A4 dalam mm pada 72 pt/inch', () => {
    expect(round2(mmToPt(210))).toBe(A4_PT.w)
    expect(round2(mmToPt(297))).toBe(A4_PT.h)
    expect(A4_PT).toEqual({ w: 595.28, h: 841.89 })
  })

  it('toleransi ±1 mm tersedia dalam px dan pt', () => {
    expect(TOLERANCE_PX).toBeCloseTo(3.7795, 3)
    expect(TOLERANCE_PT).toBeCloseTo(2.8346, 3)
  })
})

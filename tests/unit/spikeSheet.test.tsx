import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SpikeSheet } from '@/features/templates/screen/SpikeSheet'
import { spikeContent } from '@/features/templates/spikeContent'
import { spikeSpec } from '@/features/templates/spikeSpec'
import { A4_PX, mmToPx, ptToPx } from '@/lib/units'

afterEach(cleanup)

/**
 * P4: renderer layar tidak boleh punya angka layout sendiri. Kalau ada yang
 * menulis nilai literal di SpikeSheet, uji ini gagal karena angkanya tidak lagi
 * sama dengan hasil konversi spikeSpec.
 */
describe('SpikeSheet', () => {
  it('memakai kotak A4 794×1123 dengan tinggi kontainer terkalkulasi (T0.5)', () => {
    const { container } = render(<SpikeSheet content={spikeContent} scale={0.5} />)
    const sizer = container.firstElementChild as HTMLElement
    expect(sizer.style.width).toBe(`${A4_PX.w * 0.5}px`)
    expect(sizer.style.height).toBe(`${A4_PX.h * 0.5}px`)

    const sheet = sizer.firstElementChild as HTMLElement
    expect(sheet.style.width).toBe(`${A4_PX.w}px`)
    expect(sheet.style.height).toBe(`${A4_PX.h}px`)
    expect(sheet.style.transform).toBe('scale(0.5)')
    expect(sheet.style.transformOrigin).toBe('top center')
  })

  it('margin sheet = mm spec dikonversi ke px', () => {
    const { container } = render(<SpikeSheet content={spikeContent} scale={1} />)
    const sheet = container.firstElementChild?.firstElementChild as HTMLElement
    expect(sheet.style.padding).toBe(`${mmToPx(spikeSpec.marginMm)}px`)
  })

  it('ukuran font nama di layar = pt spec dikonversi ke px', () => {
    const { container } = render(<SpikeSheet content={spikeContent} scale={1} />)
    const name = container.querySelector('[data-probe="name"]') as HTMLElement
    expect(name.style.fontSize).toBe(`${ptToPx(spikeSpec.type.namePt)}px`)
  })

  it('heading memakai teks yang sudah di-uppercase dari spec', () => {
    const { container } = render(<SpikeSheet content={spikeContent} scale={1} />)
    expect(container.querySelector('[data-probe="heading"]')?.textContent).toBe('EXPERIENCE')
  })
})

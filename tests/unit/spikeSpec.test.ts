import { describe, expect, it } from 'vitest'
import { formatContactLine, headingLabel, spikeSpec } from '@/features/templates/spikeSpec'

describe('spikeSpec', () => {
  it('menulis kontak dalam satu baris dipisah · (§2.3 aturan ATS)', () => {
    expect(formatContactLine(['a@b.com', '+62 812', 'Jakarta'])).toBe('a@b.com · +62 812 · Jakarta')
  })

  it('mengabaikan bagian kontak yang kosong', () => {
    expect(formatContactLine(['a@b.com', '', 'Jakarta'])).toBe('a@b.com · Jakarta')
  })

  it('mengubah heading di data, bukan lewat CSS, supaya teks PDF & layar identik', () => {
    expect(headingLabel('Experience')).toBe('EXPERIENCE')
  })

  it('margin dan ukuran font tersimpan dalam satuan dpi-independen', () => {
    expect(spikeSpec.marginMm).toBe(16)
    expect(spikeSpec.type.bodyPt).toBe(10)
    expect(spikeSpec.headingTransform).toBe('uppercase')
  })
})

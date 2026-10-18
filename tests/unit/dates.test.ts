import { describe, expect, it } from 'vitest'
import { durationLabel, formatMonth, hasGapOver, isReverseChronological } from '@/lib/dates'

const monthOffset = (offset: number): string => {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
}

describe('formatMonth', () => {
  it('memformat YYYY-MM menjadi label bulan lokal', () => {
    expect(formatMonth('2024-03', 'id')).toBe('Mar 2024')
    expect(formatMonth('2024-03', 'en')).toBe('Mar 2024')
    expect(formatMonth('2024-12', 'id')).toBe('Des 2024')
    expect(formatMonth('2024-12', 'en')).toBe('Dec 2024')
  })

  it('mengembalikan string kosong untuk input kosong atau salah format', () => {
    expect(formatMonth('', 'id')).toBe('')
    expect(formatMonth('2024-13', 'id')).toBe('')
    expect(formatMonth('03-2024', 'id')).toBe('')
  })
})

describe('durationLabel', () => {
  it('menghitung tahun dan bulan dalam Bahasa', () => {
    expect(durationLabel('2022-04', '2023-08', false, 'id')).toBe('1 thn 4 bln')
    expect(durationLabel('2022-04', '2023-08', false, 'en')).toBe('1 yr 4 mo')
  })

  it('menghilangkan komponen nol', () => {
    expect(durationLabel('2020-01', '2021-01', false, 'id')).toBe('1 thn')
    expect(durationLabel('2024-01', '2024-04', false, 'id')).toBe('3 bln')
    expect(durationLabel('2024-01', '2024-01', false, 'id')).toBe('0 bln')
  })

  it('menghitung dari bulan berjalan saat current = true', () => {
    const label = durationLabel('2000-01', '', true, 'id')
    expect(label).toMatch(/\d+ thn/)
  })

  it('mengembalikan kosong untuk input tidak valid atau urutan terbalik', () => {
    expect(durationLabel('', '2023-08', false, 'id')).toBe('')
    expect(durationLabel('2023-08', '2022-04', false, 'id')).toBe('')
    expect(durationLabel('2024-99', '2025-01', false, 'id')).toBe('')
  })
})

describe('isReverseChronological', () => {
  const newestFirst = [
    { startDate: '2022-04', endDate: '', current: true },
    { startDate: '2019-08', endDate: '2022-03', current: false },
    { startDate: '2017-01', endDate: '2019-07', current: false },
  ]

  it('true saat urutan terbaru dulu', () => {
    expect(isReverseChronological(newestFirst)).toBe(true)
    expect(isReverseChronological([])).toBe(true)
  })

  it('false saat ada entri yang lebih lama muncul belakangan', () => {
    expect(isReverseChronological([...newestFirst].reverse())).toBe(false)
  })

  it('memakai startDate bila endDate kosong dan bukan current', () => {
    expect(
      isReverseChronological([
        { startDate: '2021-01', endDate: '' },
        { startDate: '2020-01', endDate: '2020-12' },
      ]),
    ).toBe(true)
    expect(
      isReverseChronological([
        { startDate: '2021-01', endDate: '' },
        { startDate: '2022-01', endDate: '' },
      ]),
    ).toBe(false)
  })
  it('entri tanpa tanggal sama sekali dianggap paling lama', () => {
    expect(
      isReverseChronological([
        { startDate: '2021-01', endDate: '2023-01' },
        { startDate: '', endDate: '' },
      ]),
    ).toBe(true)
    expect(
      isReverseChronological([
        { startDate: '', endDate: '' },
        { startDate: '2021-01', endDate: '2023-01' },
      ]),
    ).toBe(false)
  })
})

describe('hasGapOver', () => {
  it('false bila jeda antar entri lebih kecil dari ambang', () => {
    expect(
      hasGapOver(
        [
          { startDate: '2020-01', endDate: '2021-06' },
          { startDate: '2021-07', endDate: '2023-01' },
        ],
        4,
      ),
    ).toBe(false)
  })

  it('true bila ada celah lebih besar dari ambang bulan', () => {
    expect(
      hasGapOver(
        [
          { startDate: '2020-01', endDate: '2021-06' },
          { startDate: '2021-12', endDate: '2023-01' },
        ],
        4,
      ),
    ).toBe(true)
  })

  it('mengabaikan entri tanpa tanggal saat menghitung celah', () => {
    expect(
      hasGapOver(
        [
          { startDate: '2020-01', endDate: '2021-01' },
          { startDate: '', endDate: '' },
          { startDate: '2023-06', endDate: '2024-01' },
        ],
        12,
      ),
    ).toBe(true)
  })

  it('entri current tetap diperiksa terhadap pendahulunya', () => {
    const entries = [
      { startDate: '2020-01', endDate: '', current: true },
      { startDate: '2018-01', endDate: '2019-06' },
    ]
    expect(hasGapOver(entries, 12)).toBe(false)
    expect(hasGapOver(entries, 3)).toBe(true)
  })

  it('melewati celah bila pekerjaan sebelumnya belum punya tanggal selesai', () => {
    expect(
      hasGapOver(
        [
          { startDate: '2020-01', endDate: '', current: false },
          { startDate: '2021-06', endDate: '2022-01' },
        ],
        4,
      ),
    ).toBe(false)
  })

  it('mengukur tumpang-tindih entri current terhadap entri berikutnya di masa depan', () => {
    const currentEntry = { startDate: '2018-01', endDate: '', current: true }

    expect(hasGapOver([currentEntry, { startDate: monthOffset(2), endDate: '' }], 6)).toBe(false)
    expect(hasGapOver([currentEntry, { startDate: monthOffset(20), endDate: '' }], 6)).toBe(true)
  })
})

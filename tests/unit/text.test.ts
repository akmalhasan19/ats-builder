import { describe, expect, it } from 'vitest'
import {
  charLen,
  containsMetric,
  startsWithActionVerb,
  stripDiacritics,
  tokenize,
  wordCount,
} from '@/lib/text'

describe('wordCount & charLen', () => {
  it('menghitung kata dan karakter', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('   ')).toBe(0)
    expect(wordCount('satu dua  tiga')).toBe(3)
    expect(wordCount('sudah\tdi\nspasi')).toBe(3)
    expect(charLen('abc')).toBe(3)
    expect(charLen('')).toBe(0)
  })
})

describe('startsWithActionVerb', () => {
  it('true untuk kata kerja aksi umum di awal kalimat', () => {
    expect(startsWithActionVerb('Led a team of 5 engineers')).toBe(true)
    expect(startsWithActionVerb('Built microservices for checkout')).toBe(true)
    expect(startsWithActionVerb('built the service')).toBe(true)
    expect(startsWithActionVerb('Mengelola 3 tim lintas fungsi')).toBe(true)
  })

  it('false untuk kalimat pasif, kosong, atau bukan kata kerja aksi', () => {
    expect(startsWithActionVerb('Was responsible for payments')).toBe(false)
    expect(startsWithActionVerb('Responsible for payments')).toBe(false)
    expect(startsWithActionVerb('')).toBe(false)
    expect(startsWithActionVerb('   ')).toBe(false)
  })
})

describe('containsMetric', () => {
  it('true bila ada angka, false bila tidak', () => {
    expect(containsMetric('cut latency by 45%')).toBe(true)
    expect(containsMetric('reduced latency significantly')).toBe(false)
    expect(containsMetric('')).toBe(false)
  })
})

describe('stripDiacritics & tokenize', () => {
  it('membuang diakritik', () => {
    expect(stripDiacritics('Café résumé naïve')).toBe('Cafe resume naive')
    expect(stripDiacritics('tanpa diakritik')).toBe('tanpa diakritik')
  })

  it('tokenisasi huruf dan angka, lowercase, tanpa tanda baca', () => {
    expect(tokenize('Café-Resume, v2!')).toEqual(['cafe', 'resume', 'v2'])
    expect(tokenize('  Kata   Kedua  ')).toEqual(['kata', 'kedua'])
    expect(tokenize('')).toEqual([])
  })
})

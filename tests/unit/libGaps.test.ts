import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { contrastRatio, parseHex, relativeLuminance } from '@/lib/contrast'
import { durationLabel, formatMonth, hasGapOver, isReverseChronological } from '@/lib/dates'
import { getLang, setLang, t, type TranslationKey } from '@/lib/i18n'
import { id } from '@/dictionaries/id'
import {
  charLen,
  containsMetric,
  isAllowedUrl,
  normalizeUrlInput,
  slugify,
  startsWithActionVerb,
  stripDiacritics,
  tokenize,
  wordCount,
} from '@/lib/text'
import {
  A4_MM,
  A4_PX,
  MM_PER_INCH,
  PX_PER_INCH,
  PT_PER_INCH,
  mmToPt,
  mmToPx,
  pxToMm,
  ptToPx,
  round2,
} from '@/lib/units'

/**
 * T9.1 — penutup cabang `src/lib` (target ≥95% branch). Berkas ini sengaja
 * mengukur modul murni tanpa React: rasio kontras WCAG, penerjemah, helper
 * teks/URL (T9.6), unit dpi-independen, dan tanggal.
 */

// Sumber kebenaran warna tetap tokens.css (sama seperti contrast.test.ts),
// supaya tes ini tidak mengawetkan salinan yang bisa menyimpang.
const tokensCss = readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

const hexToken = (name: string): string => {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokensCss)
  if (!match || !match[1]) throw new Error(`Token --color-${name} tidak ada di tokens.css`)
  return match[1]
}

const WHITE = hexToken('raised')

/** `color-mix(in srgb, HEX p%, transparent)` yang ditumpuk di atas `base`. */
const mixOver = (topHex: string, baseHex: string, percent: number): string => {
  const top = parseHex(topHex)
  const base = parseHex(baseHex)
  if (!top || !base) throw new Error('mixOver memakai hex tidak valid')
  const alpha = percent / 100
  const chan = (a: number, b: number): string =>
    Math.round(a * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0')
  return `#${chan(top.r, base.r)}${chan(top.g, base.g)}${chan(top.b, base.b)}`
}

const asRatio = (a: string, b: string): number => {
  const value = contrastRatio(a, b)
  if (value === null) throw new Error(`contrastRatio(${a}, ${b}) mengembalikan null`)
  return value
}

afterEach(() => {
  setLang('id')
})

describe('contrast.ts — parseHex', () => {
  it('mengurai hex 6 digit dengan atau tanpa tanda #, huruf besar, dan spasi tepi', () => {
    expect(parseHex('#10161F')).toEqual({ r: 16, g: 22, b: 31 })
    expect(parseHex('  10161f  ')).toEqual({ r: 16, g: 22, b: 31 })
    expect(parseHex('F2D600')).toEqual({ r: 242, g: 214, b: 0 })
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('menyembangbiakkan hex 3 digit persis seperti padangan 6 digit', () => {
    expect(parseHex('#36F')).toEqual({ r: 51, g: 102, b: 255 })
    expect(parseHex('#36f')).toEqual(parseHex('#3366FF'))
    expect(parseHex('fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 })
    expect(parseHex('#000')).toEqual(parseHex('#000000'))
  })

  it('menolak panjang dan karakter yang bukan hex', () => {
    for (const bad of ['', '   ', '#', '12345', '1234567', 'ff00', 'fffffff', 'var(--color-ink)']) {
      expect(parseHex(bad), `panjang salah: ${JSON.stringify(bad)}`).toBeNull()
    }
    // Panjang 6 tapi karakter non-hex: cabang regex, bukan cabang panjang.
    for (const bad of ['gggggg', '#zzzzzz', '#12g456', '12 456', '#0f5a7-']) {
      expect(parseHex(bad), `karakter salah: ${JSON.stringify(bad)}`).toBeNull()
    }
  })
})

describe('contrast.ts — relativeLuminance', () => {
  it('hitam 0 dan putih 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 12)
  })

  it('kanal gelap memakai segmen linear (<= 0.03928)', () => {
    // 10/255 = 0.03922 -> linear; pembobotan kanal jumlahkan ke 1 untuk gray.
    expect(relativeLuminance({ r: 10, g: 10, b: 10 })).toBeCloseTo(10 / 255 / 12.92, 12)
  })

  it('kanal terang memakai segmen gamma', () => {
    const expected = ((11 / 255 + 0.055) / 1.055) ** 2.4
    expect(relativeLuminance({ r: 11, g: 11, b: 11 })).toBeCloseTo(expected, 12)
    // 11 > 10 dalam rumus apa pun: luminositas naik monoton.
    expect(relativeLuminance({ r: 11, g: 11, b: 11 })).toBeGreaterThan(
      relativeLuminance({ r: 10, g: 10, b: 10 }),
    )
  })

  it('hanya kanal hijau yang dominan untuk cahaya hijau murni', () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 })
    expect(green).toBeCloseTo(0.7152, 12)
    expect(green).toBeGreaterThan(relativeLuminance({ r: 255, g: 0, b: 0 }))
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 12)
  })
})

describe('contrast.ts — contrastRatio (§2.2, T7.1)', () => {
  it('teks `--ink` di atas kertas putih lolos AA 4.5:1', () => {
    expect(asRatio(WHITE, hexToken('ink'))).toBeGreaterThanOrEqual(4.5)
    expect(asRatio(WHITE, hexToken('ink'))).toBeCloseTo(18.157, 2)
  })

  it('`--ink-tertiary`, `--signal-warn`, `--cyanotype` di atas putih lolos AA 4.5:1', () => {
    for (const name of [
      'ink-tertiary',
      'signal-warn',
      'cyanotype',
      'ink-secondary',
      'signal-ok',
      'signal-bad',
    ]) {
      const ratio = asRatio(WHITE, hexToken(name))
      expect(
        ratio,
        `--color-${name} di atas putih hanya ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5)
    }
    // Nilai presisi untuk dua pasangan yang disebut tugas.
    expect(asRatio(WHITE, hexToken('ink-tertiary'))).toBeCloseTo(5.505, 2)
    expect(asRatio(WHITE, hexToken('signal-warn'))).toBeCloseTo(5.692, 2)
    expect(asRatio(WHITE, hexToken('cyanotype'))).toBeCloseTo(7.625, 2)
  })

  it('stabilo #F2D600 di atas putih hanya dekoratif: rasionya jauh di bawah 3:1', () => {
    const ratio = asRatio(WHITE, '#F2D600')
    expect(ratio).toBeLessThan(1.6)
    expect(ratio).toBeCloseTo(1.459, 2)
  })

  it('teks `--ink` di atas wash stabilo 34% (§5.5) lolos AA 4.5:1', () => {
    const wash = mixOver(hexToken('highlighter'), WHITE, 34)
    expect(wash).toBe('#fbf1a8')
    expect(asRatio(hexToken('ink'), wash)).toBeGreaterThanOrEqual(4.5)
    expect(asRatio(hexToken('ink'), wash)).toBeCloseTo(15.779, 2)
    // Di atas stabilo pekat pun teks tetap lolos (kasus Parse Tape §5.6).
    expect(asRatio(hexToken('ink'), hexToken('highlighter'))).toBeGreaterThanOrEqual(4.5)
  })

  it('rasio simetris dan 1 untuk warna sama', () => {
    const a = hexToken('cyanotype')
    expect(contrastRatio(a, WHITE)).toBeCloseTo(asRatio(WHITE, a), 12)
    expect(contrastRatio(a, a)).toBeCloseTo(1, 12)
    expect(asRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('mengembalikan null bila salah satu sisi bukan hex', () => {
    expect(contrastRatio('var(--color-ink)', WHITE)).toBeNull()
    expect(contrastRatio(WHITE, 'var(--color-ink)')).toBeNull()
    expect(contrastRatio('', '')).toBeNull()
    expect(contrastRatio('12345', '#ffffff')).toBeNull()
    expect(contrastRatio('#12g456', '#ffffff')).toBeNull()
  })
})

describe('i18n.ts — getLang / setLang', () => {
  it('default id dan berpindah ke en', () => {
    expect(getLang()).toBe('id')
    setLang('en')
    expect(getLang()).toBe('en')
    setLang('id')
    expect(getLang()).toBe('id')
  })
})

describe('i18n.ts — t()', () => {
  it('memakai kamus aktif untuk kunci yang punya terjemahan en', () => {
    expect(t('app.name')).toBe('Resume Studio')
    setLang('en')
    expect(t('app.tagline')).toBe('Structured resume builder')
    expect(t('doc.untitled')).toBe('Untitled CV')
  })

  it('jatuh balik ke kamus id untuk kunci yang belum ada di en', () => {
    setLang('en')
    expect(t('section.profile')).toBe(id['section.profile'])
    expect(t('section.profile')).toBe('Profil')
  })

  it('mengembalikan kunci itu sendiri bila tidak ada di kamus mana pun', () => {
    const missing = 'bab.tidak.terdaftar' as TranslationKey
    expect(getLang()).toBe('id')
    expect(t(missing)).toBe(missing)
    setLang('en')
    expect(t(missing)).toBe(missing)
  })

  it('menyisipkan beberapa param dalam satu panggilan ({n} diganti global, bukan sekali)', () => {
    expect(t('preview.pageCounter', { page: 3, total: 12 })).toBe('HAL 3 / 12')
    expect(t('rail.reorderAnnounce', { name: 'Pendidikan', pos: 2, total: 10 })).toBe(
      'Pendidikan pindah ke posisi 2 dari 10',
    )
  })

  it('mengganti setiap kemunculan placeholder dan tidak me-rekursi nilai param', () => {
    // Nilai yang disisipkan tidak dipindai ulang: placeholder di dalamnya tetap utuh.
    expect(t('bullet.textLabel', { n: '{n}' })).toBe('Isi bullet {n}')
    expect(t('bullet.textLabel', { n: 7 })).toBe('Isi bullet 7')
    // Kunci yang tidak ada di template diabaikan; placeholder yang tidak diberi
    // nilai dibiarkan apa adanya (perilaku nyata regex global per kunci params).
    expect(t('preview.pageCounter', { page: 1 })).toBe('HAL 1 / {total}')
    expect(t('preview.pageCounter')).toBe('HAL {page} / {total}')
  })

  it('tidak pernah mengembalikan string kosong untuk kunci nyata, di kedua bahasa', () => {
    const keys = Object.keys(id) as TranslationKey[]
    for (const lang of ['id', 'en'] as const) {
      setLang(lang)
      for (const key of keys) {
        expect(t(key), `t('${key}') kosong saat bahasa ${lang}`).not.toBe('')
      }
    }
  })

  it('melewati penggantian param bila teks hasil pencarian kosong (kunci string kosong)', () => {
    expect(t('' as TranslationKey, { n: 1 })).toBe('')
  })
})

describe('text.ts — isAllowedUrl (T9.6)', () => {
  it('menerima skema yang diizinkan', () => {
    expect(isAllowedUrl('https://linkedin.com/in/x')).toBe(true)
    expect(isAllowedUrl('http://example.com')).toBe(true)
    expect(isAllowedUrl('mailto:alex@mail.com')).toBe(true)
    expect(isAllowedUrl('  https://example.com  ')).toBe(true)
  })

  it('menolak skema berbahaya atau tidak diizinkan', () => {
    expect(isAllowedUrl('ftp://files.example.com')).toBe(false)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedUrl('JaVaScRiPt:alert(1)')).toBe(false)
    expect(isAllowedUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedUrl('tel:+62812345678')).toBe(false)
    expect(isAllowedUrl('about:blank')).toBe(false)
  })

  it('menerima nilai kosong dan nilai tanpa skema (belum absolut)', () => {
    expect(isAllowedUrl('')).toBe(true)
    expect(isAllowedUrl('  ')).toBe(true)
    expect(isAllowedUrl('linkedin.com/in/x')).toBe(true)
    expect(isAllowedUrl('not a url at all')).toBe(true)
    expect(isAllowedUrl('Café ☕')).toBe(true)
  })

  it('menolak nilai berskema yang gagal diparsing sebagai URL', () => {
    // Skema khusus (http/https) mewajibkan authority: new URL melempar.
    expect(isAllowedUrl('http:')).toBe(false)
    expect(isAllowedUrl('https:')).toBe(false)
    expect(isAllowedUrl('http://')).toBe(false)
  })
})

describe('text.ts — normalizeUrlInput (T9.6)', () => {
  it('kosong atau hanya spasi menjadi string kosong', () => {
    expect(normalizeUrlInput('')).toBe('')
    expect(normalizeUrlInput('   ')).toBe('')
  })

  it('memotong spasi tepi dan menambahkan https:// untuk nilai tanpa skema', () => {
    expect(normalizeUrlInput('  linkedin.com/in/x  ')).toBe('https://linkedin.com/in/x')
    expect(normalizeUrlInput('github.com/alexmorgan')).toBe('https://github.com/alexmorgan')
    expect(normalizeUrlInput('\texample.com/a b\t')).toBe('https://example.com/a b')
  })

  it('skema berbahaya tidak boleh menyisakan javascript: / data:', () => {
    const js = normalizeUrlInput('javascript:alert(1)')
    expect(js).not.toContain('javascript:')
    expect(js).toBe('javascriptalert(1)')
    const data = normalizeUrlInput('data:text/html,<script>')
    expect(data).not.toContain('data:')
    expect(data).toBe('datatext/html,<script>')
    expect(isAllowedUrl(js)).toBe(true)
    expect(isAllowedUrl(data)).toBe(true)
  })

  it('skema yang diizinkan dipertahankan apa adanya, skema bahaya dikoloni', () => {
    // Cabang berskema dijaga `isAllowedUrl`: http/https/mailto tidak boleh
    // tersentuh, sisanya kehilangan pemisah skema sehingga tidak pernah bisa
    // jadi `javascript:`/`data:` yang hidup di data dokumen maupun `href`.
    expect(normalizeUrlInput('https://example.com')).toBe('https://example.com')
    expect(normalizeUrlInput('  http://x.test  ')).toBe('http://x.test')
    expect(normalizeUrlInput('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(normalizeUrlInput('HTTPS://example.com')).toBe('HTTPS://example.com')

    for (const dangerous of [
      'javascript:alert(1)',
      'data:text/html,<script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://files.test',
    ]) {
      const out = normalizeUrlInput(dangerous)
      expect(out, dangerous).not.toMatch(/^(javascript|data|vbscript|file|ftp):/i)
      expect(out, dangerous).toBe(dangerous.replace(':', ''))
      // Setelah dinormalisasi nilai tidak lagi membawa skema, jadi lolos lagi —
      // bukti bahwa `:` memang satu-satunya pembawa bahaya yang dibuang.
      expect(isAllowedUrl(out), dangerous).toBe(true)
    }
  })
})

describe('text.ts — cabang helper lain', () => {
  it('wordCount memisahkan kata dan menganggap spasi murni kosong', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount(' \n\t ')).toBe(0)
    expect(wordCount('satu')).toBe(1)
    expect(wordCount('  dua   kata  ')).toBe(2)
  })

  it('startsWithActionVerb menolak string kosong dan menerima kata kerja', () => {
    expect(startsWithActionVerb('')).toBe(false)
    expect(startsWithActionVerb(' \t ')).toBe(false)
    expect(startsWithActionVerb('led the team')).toBe(true)
    expect(startsWithActionVerb('BUILD a thing')).toBe(false) // hanya bentuk kecil yang terdaftar
    expect(startsWithActionVerb('BUILT a thing')).toBe(true)
  })

  it('slugify jatuh ke "resume" untuk nilai yang tidak menyisakan slug', () => {
    expect(slugify('')).toBe('resume')
    expect(slugify('   ')).toBe('resume')
    expect(slugify('---')).toBe('resume')
    expect(slugify('!!!')).toBe('resume')
    expect(slugify('Ciafe Résumé')).toBe('ciafe-resume')
    expect(slugify('  Cíafé Résumé ')).toBe('ciafe-resume')
    expect(slugify('Alex Morgan 2024')).toBe('alex-morgan-2024')
  })

  it('charLen, containsMetric dan tokenize menutup helper teks lainnya', () => {
    expect(charLen('')).toBe(0)
    expect(charLen('abc 123')).toBe(7)
    expect(containsMetric('')).toBe(false)
    expect(containsMetric('tanpa angka')).toBe(false)
    expect(containsMetric('memangkas 45%')).toBe(true)
    expect(stripDiacritics('Café résumé naïve')).toBe('Cafe resume naive')
    expect(tokenize('Café-Resume, v2!')).toEqual(['cafe', 'resume', 'v2'])
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })
})

describe('units.ts — konversi dan batas', () => {
  it('menetapkan konstanta dasar', () => {
    expect(MM_PER_INCH).toBe(25.4)
    expect(PX_PER_INCH).toBe(96)
    expect(PT_PER_INCH).toBe(72)
    expect(A4_MM).toEqual({ w: 210, h: 297 })
    expect(A4_PX).toEqual({ w: 794, h: 1123 })
  })

  it('nol tetap nol dan negatif dikalikan linear (tidak ditebak/dijepit)', () => {
    expect(mmToPx(0)).toBe(0)
    expect(mmToPt(0)).toBe(0)
    expect(pxToMm(0)).toBe(0)
    expect(ptToPx(0)).toBe(0)
    expect(mmToPx(-10)).toBeCloseTo(-37.7952755906, 6)
    expect(pxToMm(-96)).toBeCloseTo(-25.4, 10)
    expect(mmToPt(-25.4)).toBeCloseTo(-72, 9)
    expect(ptToPx(-9)).toBeCloseTo(-12, 9)
  })

  it('putaran mm -> px -> mm dan pt -> px konsisten', () => {
    for (const mm of [0, 1, 14, 16, 18, 20, 210, 297]) {
      expect(pxToMm(mmToPx(mm))).toBeCloseTo(mm, 9)
      expect(mmToPt(mm)).toBeCloseTo(mmToPx(mm) * 0.75, 9)
    }
    expect(ptToPx(72)).toBeCloseTo(96, 10)
    expect(round2(595.2834645669)).toBe(595.28)
    expect(round2(-1.005)).toBe(-1)
    expect(round2(0)).toBe(0)
  })
})

describe('dates.ts — formatMonth dan cache formatter', () => {
  it('memakai bahasa eksplisit dan cache-nya per bahasa', () => {
    // Pemanggilan pertama mengisi cache (miss), berikutnya memakai entri cache (hit).
    expect(formatMonth('2024-03', 'id')).toBe('Mar 2024')
    expect(formatMonth('2024-03', 'id')).toBe('Mar 2024')
    expect(formatMonth('2024-12', 'en')).toBe('Dec 2024')
    expect(formatMonth('2024-12', 'en')).toBe('Dec 2024')
    expect(formatMonth('2024-01', 'id')).toBe('Jan 2024')
    expect(formatMonth('2024-01', 'en')).toBe('Jan 2024')
  })

  it('default bahasa mengikuti getLang(), bukan nilai yang tertinggal', () => {
    expect(formatMonth('2024-03')).toBe('Mar 2024')
    setLang('en')
    expect(getLang()).toBe('en')
    expect(formatMonth('2024-03')).toBe('Mar 2024')
    setLang('id')
    expect(formatMonth('2024-03')).toBe('Mar 2024')
  })

  it('kosong atau format salah menghasilkan string kosong', () => {
    expect(formatMonth('')).toBe('')
    expect(formatMonth('2024-13', 'id')).toBe('')
    expect(formatMonth('2024-00', 'id')).toBe('')
    expect(formatMonth('03-2024', 'id')).toBe('')
    expect(formatMonth('2024-3', 'id')).toBe('')
    expect(formatMonth('2024-03-01', 'id')).toBe('')
  })
})

describe('dates.ts — durationLabel', () => {
  it('menyusun tahun dan bulan dalam dua bahasa', () => {
    expect(durationLabel('2022-04', '2023-08', false, 'id')).toBe('1 thn 4 bln')
    expect(durationLabel('2022-04', '2023-08', false, 'en')).toBe('1 yr 4 mo')
    expect(durationLabel('2021-04', '2023-08', false, 'id')).toBe('2 thn 4 bln')
    expect(durationLabel('2021-04', '2023-08', false, 'en')).toBe('2 yr 4 mo')
  })

  it('membuang komponen nol, tetap menyisakan 0 bln untuk durasi nol', () => {
    expect(durationLabel('2020-01', '2021-01', false, 'id')).toBe('1 thn')
    expect(durationLabel('2020-01', '2021-01', false, 'en')).toBe('1 yr')
    expect(durationLabel('2024-01', '2024-04', false, 'id')).toBe('3 bln')
    expect(durationLabel('2024-01', '2024-04', false, 'en')).toBe('3 mo')
    expect(durationLabel('2024-05', '2024-05', false, 'id')).toBe('0 bln')
    expect(durationLabel('2024-05', '2024-05', false, 'en')).toBe('0 mo')
  })

  it('memakai bahasa aktif saat lang tidak diberikan', () => {
    expect(durationLabel('2022-04', '2023-08', false)).toBe('1 thn 4 bln')
    setLang('en')
    expect(durationLabel('2022-04', '2023-08', false)).toBe('1 yr 4 mo')
  })

  it('current = true menghitung sampai bulan berjalan, tanpa melihat endDate', () => {
    expect(durationLabel('2020-01', '2020-02', true, 'id')).not.toBe('')
    expect(durationLabel('2000-01', '', true, 'en')).toMatch(/yr/)
    expect(durationLabel('2000-01', '', true, 'id')).toMatch(/thn/)
  })

  it('kosong untuk tanggal tidak valid atau urutan terbalik', () => {
    expect(durationLabel('', '2023-08', false, 'id')).toBe('')
    expect(durationLabel('2023-13', '2024-01', false, 'id')).toBe('')
    expect(durationLabel('2023-08', '', false, 'id')).toBe('')
    expect(durationLabel('2023-08', '2024-99', false, 'id')).toBe('')
    expect(durationLabel('2023-08', '2022-04', false, 'id')).toBe('')
  })
})

describe('dates.ts — isReverseChronological', () => {
  it('array kosong dan satu entri selalu terurut', () => {
    expect(isReverseChronological([])).toBe(true)
    expect(isReverseChronological([{ startDate: '2020-01', endDate: '2020-06' }])).toBe(true)
  })

  it('true untuk terbaru dulu, false saat ada yang lebih muda di bawahnya', () => {
    const newest = [
      { startDate: '2022-04', endDate: '', current: true },
      { startDate: '2019-08', endDate: '2022-03' },
      { startDate: '2017-01', endDate: '2019-07' },
    ]
    expect(isReverseChronological(newest)).toBe(true)
    expect(isReverseChronological([...newest].reverse())).toBe(false)
  })

  it('recencyKey: current -> startDate -> 0 untuk entri tanpa tanggal', () => {
    expect(
      isReverseChronological([
        { startDate: '2021-01', endDate: '2030-01' },
        { startDate: '2021-01', endDate: '', current: true },
      ]),
    ).toBe(false) // entri current selalu dianggap paling muda
    expect(
      isReverseChronological([
        { startDate: '2021-01', endDate: '' },
        { startDate: '', endDate: '' },
      ]),
    ).toBe(true)
    expect(
      isReverseChronological([
        { startDate: '', endDate: '' },
        { startDate: '2010-01', endDate: '2010-02' },
      ]),
    ).toBe(false)
    expect(
      isReverseChronological([
        { startDate: '2021-05', endDate: 'bukan-tanggal' },
        { startDate: '2021-01', endDate: '2021-02' },
      ]),
    ).toBe(true)
  })

  it('entri dengan kunci sama (tidak menurun) masih dianggap terurut', () => {
    expect(
      isReverseChronological([
        { startDate: '2021-01', endDate: '2021-06' },
        { startDate: '2021-01', endDate: '2021-06' },
      ]),
    ).toBe(true)
  })
})

describe('dates.ts — hasGapOver', () => {
  it('false untuk satu entri atau array kosong', () => {
    expect(hasGapOver([], 6)).toBe(false)
    expect(hasGapOver([{ startDate: '2020-01', endDate: '2020-06' }], 6)).toBe(false)
  })

  it('mengabaikan entri tanpa tanggal mulai saat menyusun urutan', () => {
    expect(
      hasGapOver(
        [
          { startDate: '', endDate: '' },
          { startDate: '2020-01', endDate: '2020-06' },
          { startDate: '2021-06', endDate: '2022-01' },
        ],
        6,
      ),
    ).toBe(true)
  })

  it('mendeteksi celah lebih besar dari ambang dan tidak untuk celah kecil', () => {
    expect(
      hasGapOver(
        [
          { startDate: '2020-01', endDate: '2021-06' },
          { startDate: '2021-07', endDate: '2023-01' },
        ],
        4,
      ),
    ).toBe(false)
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

  it('melompati pasangan bila pendahulunya belum selesai dan bukan current', () => {
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

  it('entri current diurut ke belakang: celah dihitung terhadap bulan berjalan', () => {
    const entries = [
      { startDate: '2020-01', endDate: '', current: true },
      { startDate: '2018-01', endDate: '2019-06' },
    ]
    expect(hasGapOver(entries, 12)).toBe(false)
    expect(hasGapOver(entries, 3)).toBe(true)
  })

  it('tumpang-tindih masa depan di bawah ambang tidak dihitung sebagai celah', () => {
    const offset = (months: number): string => {
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth() + months, 1)
      return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
    }
    const current = { startDate: '2018-01', endDate: '', current: true }
    expect(hasGapOver([current, { startDate: offset(2), endDate: '' }], 6)).toBe(false)
    expect(hasGapOver([current, { startDate: offset(20), endDate: '' }], 6)).toBe(true)
  })

  it('tanggal akhir tidak valid pada pendahulu diabaikan', () => {
    expect(
      hasGapOver(
        [
          { startDate: '2020-01', endDate: '2020-13' },
          { startDate: '2024-01', endDate: '2024-06' },
        ],
        3,
      ),
    ).toBe(false)
  })
})

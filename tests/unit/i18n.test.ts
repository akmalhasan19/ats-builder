import { afterEach, describe, expect, it } from 'vitest'
import { getLang, setLang, t } from '@/lib/i18n'

afterEach(() => {
  setLang('id')
})

describe('t()', () => {
  it('memakai Bahasa Indonesia sebagai default', () => {
    expect(getLang()).toBe('id')
    expect(t('doc.untitled')).toBe('CV tanpa judul')
    expect(t('app.name')).toBe('Vetra')
  })

  it('menampilkan teks en bila bahasa dipindah', () => {
    setLang('en')
    expect(getLang()).toBe('en')
    expect(t('doc.untitled')).toBe('Untitled CV')
  })

  it('jatuh balik ke id untuk kunci yang belum diterjemahkan', () => {
    setLang('en')
    expect(t('section.profile')).toBe('Profil')
  })
})

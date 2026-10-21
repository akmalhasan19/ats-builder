import { describe, expect, it } from 'vitest'
import {
  canvasFullFor,
  workspaceLayoutFor,
  type WorkspaceLayout,
  type WorkspacePanelMode,
} from '@/app/useWorkspaceLayout'

/**
 * FASE 13 — T1.1 — matriks tata letak workspace.
 *
 * Fungsinya murni (tanpa React, tanpa store), jadi seluruh matriks §4 bisa
 * diuji di node: tidak perlu DOM, tidak perlu browser.
 */

/** Lima rentang lebar §4 + panel mode & status dock ATS yang menyertainya. */
const BREAKPOINTS: {
  label: string
  panelMode: WorkspacePanelMode
  atsDocked: boolean
}[] = [
  { label: '< 640', panelMode: 'tabs', atsDocked: false },
  { label: '640–1023', panelMode: 'tabs', atsDocked: false },
  { label: '1024–1279', panelMode: 'icon-rail', atsDocked: false },
  { label: '1280–1599', panelMode: '3col', atsDocked: false },
  { label: '≥ 1600', panelMode: '3col', atsDocked: true },
]

const form = (overrides: Partial<Parameters<typeof workspaceLayoutFor>[0]> = {}) =>
  workspaceLayoutFor({
    editMode: 'form',
    panelMode: '3col',
    activeTab: 'form',
    atsDocked: false,
    canvasFullscreen: true,
    ...overrides,
  })

const canvas = (overrides: Partial<Parameters<typeof workspaceLayoutFor>[0]> = {}) =>
  workspaceLayoutFor({
    editMode: 'canvas',
    panelMode: '3col',
    activeTab: 'form',
    atsDocked: false,
    canvasFullscreen: true,
    ...overrides,
  })

/** Tidak boleh ada `undefined`/`false` yang bocor ke atribut class DOM. */
const expectNoLeak = (layout: WorkspaceLayout): void => {
  for (const value of [
    layout.gridClass,
    layout.heightClass,
    layout.railClass,
    layout.formClass,
    layout.previewClass,
  ]) {
    expect(value).not.toMatch(/undefined|null|false/)
  }
}

describe('workspaceLayoutFor — mode form (regresi nol)', () => {
  it('mengembalikan grid tiga kolom seperti sebelum Fase 13', () => {
    const layout = form()
    expect(layout.gridClass).toContain('lg:grid-cols-[56px_minmax(360px,1fr)_1fr]')
    expect(layout.gridClass).toContain('xl:grid-cols-[248px_minmax(380px,520px)_1fr]')
    expect(layout.gridStyle).toBeUndefined()
  })

  it('menulis kolom ATS ke-4 sebagai gaya inline saat drawer di-dock', () => {
    const layout = form({ atsDocked: true })
    expect(layout.gridStyle).toEqual({
      gridTemplateColumns: '248px minmax(380px, 520px) 1fr 400px',
    })
    // Kolom xl (248px) tidak lagiutility — gaya inline yang mengaturnya.
    expect(layout.gridClass).not.toContain('xl:grid-cols-')
    expect(layout.atsMode).toBe('dock')
  })

  it('mempertahankan tinggi workspace persis seperti sebelumnya', () => {
    expect(form().heightClass).toBe(
      'h-[calc(100dvh-96px)] md:h-[calc(100dvh-100px)] lg:h-[calc(100dvh-56px)]',
    )
  })

  it('mempertahankan tab bar, anchor beranda, dan rail', () => {
    const layout = form()
    expect(layout.showTabs).toBe(true)
    expect(layout.showHomeAnchor).toBe(true)
    expect(layout.railClass).toBe('')
  })

  it('menampilkan pane formulir di layout tab dan menyembunyikannya di layout kolom', () => {
    // Layout tab: pane formulir mengikuti tab aktif.
    expect(form({ panelMode: 'tabs', activeTab: 'form' }).formClass).toBe('block')
    expect(form({ panelMode: 'tabs', activeTab: 'preview' }).formClass).toBe('hidden lg:block')
    // Layout kolom: `lg:block` menampanye di ≥1024px, apa pun tab aktif.
    expect(form({ panelMode: '3col', activeTab: 'form' }).formClass).toBe('block lg:block')
    expect(form({ panelMode: '3col', activeTab: 'preview' }).formClass).toBe('hidden lg:block')
  })

  it('menampilkan pane pratinjau mengikuti tab aktif di layout tab', () => {
    expect(form({ panelMode: 'tabs', activeTab: 'preview' }).previewClass).toBe('block')
    expect(form({ panelMode: 'tabs', activeTab: 'form' }).previewClass).toBe('hidden lg:block')
  })

  it('ATS jadi lapisan (bukan kolom) di bawah 1600px', () => {
    expect(form({ atsDocked: false }).atsMode).toBe('overlay')
  })
})

describe('workspaceLayoutFor — mode kanvas layar penuh', () => {
  it('menjadi satu kolom penuh di semua rentang lebar §4', () => {
    for (const bp of BREAKPOINTS) {
      const layout = canvas({ panelMode: bp.panelMode, atsDocked: bp.atsDocked })
      expect(layout.gridClass).toBe('grid-cols-1')
      expect(layout.gridStyle).toBeUndefined()
      expectNoLeak(layout)
    }
  })

  it('menyembunyikan rail & formulir, menampilkan pratinjau', () => {
    const layout = canvas()
    expect(layout.railClass).toContain('hidden')
    expect(layout.formClass).toContain('hidden')
    expect(layout.previewClass).toBe('block')
  })

  it('memakai tinggi 100dvh−52px (mobile) dan 100dvh−56px (md/lg)', () => {
    expect(canvas().heightClass).toBe(
      'h-[calc(100dvh-52px)] md:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-56px)]',
    )
  })

  it('tidak merender tab bar mobile maupun anchor beranda', () => {
    const layout = canvas()
    expect(layout.showTabs).toBe(false)
    expect(layout.showHomeAnchor).toBe(false)
  })

  it('memaksa ATS jadi lapisan walau drawer di-dock (≥1600px)', () => {
    const layout = canvas({ atsDocked: true })
    expect(layout.atsMode).toBe('overlay')
    expect(layout.gridStyle).toBeUndefined()
  })
})

describe('workspaceLayoutFor — matriks §4 (lima rentang × dua mode)', () => {
  it('mode form tetap berpanel di semua rentang lebar', () => {
    for (const bp of BREAKPOINTS) {
      const layout = form({ panelMode: bp.panelMode, atsDocked: bp.atsDocked })
      expect(layout.gridClass).toContain('lg:grid-cols-')
      expect(layout.showTabs).toBe(true)
      expect(layout.showHomeAnchor).toBe(true)
      expectNoLeak(layout)
    }
  })

  it('mode kanvas selalu satu pane di semua rentang lebar', () => {
    for (const bp of BREAKPOINTS) {
      const layout = canvas({ panelMode: bp.panelMode, atsDocked: bp.atsDocked })
      expect(layout.gridClass).toBe('grid-cols-1')
      expect(layout.railClass).toContain('hidden')
      expect(layout.formClass).toContain('hidden')
      expect(layout.previewClass).toBe('block')
      expect(layout.showTabs).toBe(false)
      expect(layout.showHomeAnchor).toBe(false)
      expect(layout.atsMode).toBe('overlay')
      expectNoLeak(layout)
    }
  })
})

describe('D2 — preferensi layar penuh dimatikan', () => {
  it('mode kanvas dengan canvasFullscreen=false kembali ke layout mode form', () => {
    const layout = workspaceLayoutFor({
      editMode: 'canvas',
      panelMode: '3col',
      activeTab: 'form',
      atsDocked: false,
      canvasFullscreen: false,
    })
    expect(layout.gridClass).toContain('lg:grid-cols-')
    expect(layout.showTabs).toBe(true)
    expect(layout.showHomeAnchor).toBe(true)
    expect(layout.railClass).toBe('')
  })

  it('layar penuh hanya aktif untuk mode kanvas dengan preferensi menyala', () => {
    expect(canvasFullFor('canvas', true)).toBe(true)
    expect(canvasFullFor('form', true)).toBe(false)
    expect(canvasFullFor('canvas', false)).toBe(false)
    expect(canvasFullFor('form', false)).toBe(false)
  })
})

/**
 * FASE 13 — T6.1 — matriks LENGKAP §4: 5 rentang lebar × 2 mode × ATS
 * buka/tutup (20 kombinasi). Tes di atas sudah menyentuh setiap baris matriks
 * lewat `BREAKPOINTS`; blok ini memaksa silang penuh supaya tidak ada sel
 * matriks yang lolos hanya karena keberuntungan pilihan `atsDocked` per
 * breakpoint.
 */
describe('T6.1 — matriks penuh §4 (5 rentang × 2 mode × ATS buka/tutup)', () => {
  it('mode form berpanel di semua sel matriks, ATS kolom hanya saat dock', () => {
    for (const bp of BREAKPOINTS) {
      for (const atsDocked of [false, true]) {
        const layout = form({ panelMode: bp.panelMode, atsDocked })
        const where = `${bp.label} atsDocked=${atsDocked}`
        expect(layout.gridClass, where).toContain('lg:grid-cols-')
        expect(layout.showTabs, where).toBe(true)
        expect(layout.showHomeAnchor, where).toBe(true)
        expect(layout.railClass, where).toBe('')
        expect(layout.atsMode, where).toBe(atsDocked ? 'dock' : 'overlay')
        expect(layout.gridStyle, where).toEqual(
          atsDocked ? { gridTemplateColumns: '248px minmax(380px, 520px) 1fr 400px' } : undefined,
        )
        expectNoLeak(layout)
      }
    }
  })

  it('mode kanvas layar penuh satu pane di semua sel matriks, ATS selalu overlay', () => {
    for (const bp of BREAKPOINTS) {
      for (const atsDocked of [false, true]) {
        const layout = canvas({ panelMode: bp.panelMode, atsDocked })
        const where = `${bp.label} atsDocked=${atsDocked}`
        expect(layout.gridClass, where).toBe('grid-cols-1')
        expect(layout.gridStyle, where).toBeUndefined()
        expect(layout.railClass, where).toBe('hidden lg:hidden')
        expect(layout.formClass, where).toBe('hidden lg:hidden')
        expect(layout.previewClass, where).toBe('block')
        expect(layout.showTabs, where).toBe(false)
        expect(layout.showHomeAnchor, where).toBe(false)
        expect(layout.atsMode, where).toBe('overlay')
        expectNoLeak(layout)
      }
    }
  })
})

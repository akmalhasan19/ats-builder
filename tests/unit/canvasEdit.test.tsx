import { act, render, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import {
  MIN_READABLE_ZOOM,
  RAISED_ZOOM,
  effectiveScaleOf,
  ensureReadableZoom,
} from '@/features/canvas/canvasZoom'
import { MAX_ZOOM, MAX_ZOOM_CANVAS, MIN_ZOOM } from '@/features/preview/previewZoom'
import { useCanvasStore } from '@/store/canvasStore'
import { useDocStore } from '@/store/docStore'
import { scheduleHeight, usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { createSampleDoc } from '@/schema/resume'
import type { ProfileData, ResumeDoc, SkillGroup } from '@/types/resume'

/**
 * C3 — edit langsung di CV: editor in-place, sesi & pembekuan repaginasi,
 * guard zoom, dan paritas dokumen kanvas vs form.
 */

vi.mock('sonner', () => ({ toast: vi.fn() }))

const load = (doc: ResumeDoc) => {
  act(() => {
    usePreviewStore.getState().resetHeights()
    useDocStore.getState().loadDoc(doc)
    useCanvasStore.setState({ session: null, modeHintSeen: false, zoomRaised: false })
  })
}

const renderWell = () =>
  render(
    <TooltipProvider>
      <PreviewWell />
    </TooltipProvider>,
  )

const fieldButton = (path: string) =>
  document.querySelector<HTMLButtonElement>(`[data-field="${path}"]`)

const editor = () =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.canvas-editor')

const sectionOf = (kind: 'profile' | 'summary' | 'skills') =>
  useDocStore.getState().doc.sections.find((section) => section.kind === kind)

const profileData = () => sectionOf('profile')?.data as ProfileData

const summaryText = () => (sectionOf('summary')?.data as { text: string }).text

const skillGroups = () => (sectionOf('skills')?.data as { groups: SkillGroup[] }).groups

/** Isi satu field lewat editor kanvas (klik → ketik → commit). */
const fillCanvas = async (user: UserEvent, path: string, value: string) => {
  const button = fieldButton(path)
  expect(button, `segmen ${path} harus ada`).not.toBeNull()
  await user.click(button!)
  const control = editor()
  expect(control, `editor untuk ${path} harus terbuka`).not.toBeNull()
  await user.clear(control!)
  await user.type(control!, value)
  if (control!.tagName === 'TEXTAREA') {
    await user.keyboard('{Control>}{Enter}{/Control}')
  } else {
    await user.keyboard('{Enter}')
  }
  await waitFor(() => expect(editor()).toBeNull())
}

/** Isi field yang sama lewat jalur form — `updateSection`, tanpa UI. */
const fillViaForm = (doc: ResumeDoc) => {
  const store = useDocStore.getState()
  const profile = doc.sections.find((section) => section.kind === 'profile')
  const summary = doc.sections.find((section) => section.kind === 'summary')
  const skills = doc.sections.find((section) => section.kind === 'skills')
  if (!profile || !summary || !skills) throw new Error('dokumen sampel tidak lengkap')
  const groupId = (skills.data as { groups: SkillGroup[] }).groups[0]!.id

  store.updateSection(profile.id, (prev) => ({
    ...(prev as ProfileData),
    fullName: 'Budi Santoso',
    headline: 'Staff Engineer',
    email: 'budi@mail.com',
    phone: '+62 811 2222 3333',
    location: 'Surabaya',
    links: (prev as ProfileData).links.map((link, index) =>
      index === 0 ? { ...link, url: 'https://linkedin.com/in/budi' } : link,
    ),
  }))
  store.updateSection(summary.id, () => ({ text: 'Ringkasan baru.' }))
  store.updateSection(skills.id, (prev) => ({
    ...prev,
    groups: (prev as { groups: SkillGroup[] }).groups.map((group) =>
      group.id === groupId ? { ...group, name: 'Bahasa', items: ['Go', 'Rust'] } : group,
    ),
  }))
}

/** Buang `meta` — `updatedAt` memang berbeda antara dua jalur penulisan. */
const withoutMeta = (doc: ResumeDoc) => ({ ...doc, meta: undefined })

/**
 * jsdom tidak punya layout, jadi `offsetHeight` selalu 0 dan laporan tinggi
 * tidak pernah masuk store. Stub ini membuat pengukuran bisa lured — tanpa
 * itu, bukti pembekuan repaginasi tidak bisa diamati.
 */
const stubOffsetHeight = (height: number) => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => height,
  })
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
    else Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
  }
}

beforeEach(() => {
  act(() => {
    useUiStore.setState({ editMode: 'form', fitMode: false, zoom: 1 })
    useCanvasStore.setState({ session: null, modeHintSeen: false, zoomRaised: false })
    vi.mocked(toast).mockReset()
  })
})

describe('editor in-place di atas kertas (C3.1)', () => {
  it('klik segmen: control menggantikan teks segmen, fokus + select isi', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    expect(fieldButton('profile.fullName')).not.toBeNull()
    await user.click(fieldButton('profile.fullName')!)

    const control = editor()
    expect(control).not.toBeNull()
    expect(fieldButton('profile.fullName')).toBeNull()
    expect(control).toHaveValue('Alex Morgan')
    await waitFor(() => expect(control).toHaveFocus())
  })

  it('Enter commit: nilai baru masuk ke dokumen dan segmen menampilkannya', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('profile.fullName')!)
    const control = editor()!
    await user.clear(control)
    await user.type(control, 'Budi Santoso')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(profileData().fullName).toBe('Budi Santoso'))
    expect(fieldButton('profile.fullName')?.textContent).toBe('Budi Santoso')
    expect(useCanvasStore.getState().session).toBeNull()
  })

  it('blur commit: pindah ke segmen lain menutup sesi & menulis nilai', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('profile.fullName')!)
    const control = editor()!
    await user.clear(control)
    await user.type(control, 'Budi Santoso')

    // Klik segmen lain → editor lama blur → commit, sesi berikutnya dibuka.
    await user.click(fieldButton('profile.headline')!)

    await waitFor(() => expect(profileData().fullName).toBe('Budi Santoso'))
    expect(fieldButton('profile.headline')).toBeNull()
    await waitFor(() => expect(editor()).not.toBeNull())
  })

  it('Escape membatalkan sesi: draft dibuang, dokumen tidak berubah, fokus ke pemicu', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('profile.fullName')!)
    const control = editor()!
    await user.clear(control)
    await user.type(control, 'Budi')
    await user.keyboard('{Escape}')

    expect(profileData().fullName).toBe('Alex Morgan')
    expect(fieldButton('profile.fullName')).not.toBeNull()
    await waitFor(() => expect(fieldButton('profile.fullName')).toHaveFocus())
  })

  it('commit tidak valid: editor tetap terbuka + pesan error + aria-invalid', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('profile.email')!)
    const control = editor()!
    await user.clear(control)
    await user.type(control, 'bukan-email')
    await user.keyboard('{Enter}')

    expect(editor()).not.toBeNull()
    const alert = document.querySelector('.canvas-editor-shell [role="alert"]')
    expect(alert?.textContent).toContain('Email belum benar')
    expect(editor()).toHaveAttribute('aria-invalid', 'true')
    expect(profileData().email).toBe('alex.morgan@mail.com')
  })

  it('field wajib dikosongkan: revert + toast, nilai lama bertahan', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('profile.fullName')!)
    const control = editor()!
    await user.clear(control)
    await user.keyboard('{Enter}')

    expect(toast).toHaveBeenCalledWith(t('canvas.emptyRequired', { field: 'nama lengkap' }))
    expect(profileData().fullName).toBe('Alex Morgan')
    expect(editor()).toBeNull()
  })

  it('ringkasan: textarea auto-grow, Ctrl+Enter commit', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('summary.text')!)
    const control = editor()!
    expect(control.tagName).toBe('TEXTAREA')
    await user.clear(control)
    await user.type(control, 'Ringkasan baru.')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => expect(summaryText()).toBe('Ringkasan baru.'))
  })

  it('daftar skill: teks bebas dipecah per koma (trim, tanpa duplikat)', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    const groupId = skillGroups()[0]!.id
    await user.click(fieldButton(`skills.groups.${groupId}.items`)!)
    const control = editor()!
    await user.clear(control)
    await user.type(control, 'Go, Rust,  Go ')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(skillGroups()[0]!.items).toEqual(['Go', 'Rust']))
  })
})

describe('sesi & pembekuan repaginasi (C3.2)', () => {
  it('laporan tinggi ditahan selama sesi: rencana halaman tidak berubah sampai sesi ditutup', async () => {
    const user = userEvent.setup()
    const restoreHeight = stubOffsetHeight(120)
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    // Tunggu pengukuran awal masuk store — kondisi nyata, bukan jeda tetap
    // 250ms (T6.5): di mesin tertekan jeda itu pernah tidak cukup dan tes gagal
    // dengan "expected undefined to be 120" (flake Fase 3/4, bukan regresi).
    const blockKey =
      document.querySelector('[data-probe="preview-block"]')?.getAttribute('data-block-key') ?? ''
    await waitFor(() => expect(usePreviewStore.getState().heights[blockKey]).toBe(120), {
      timeout: 5000,
    })
    // Snapshot settled (debounce 60ms) ikut terukur supaya rencana halaman
    // memakai tinggi terukur, bukan perkiraan. Ini cooldown timer — syaratnya
    // hanya "sudah menyala", jadi lebih lama selalu aman: tidak ada lagi yang
    // berubah sebelum sesi edit dibuka di bawah.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120))
    })
    const sheetsBefore = document.querySelectorAll('[data-probe="page-sheet"]').length
    expect(usePreviewStore.getState().heights[blockKey]).toBe(120)

    await user.click(fieldButton('profile.fullName')!)
    act(() => {
      scheduleHeight(blockKey, 100_000)
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
    })

    // Ditahan: tinggi baru tidak masuk store, rencana halaman tetap.
    expect(usePreviewStore.getState().heights[blockKey]).toBe(120)
    expect(document.querySelectorAll('[data-probe="page-sheet"]').length).toBe(sheetsBefore)

    // Blok yang sedang diedit tidak unmount saat mengetik.
    const blockNode = document.querySelector('[data-probe="preview-block"]')
    await user.type(editor()!, 'X')
    expect(document.querySelector('[data-probe="preview-block"]')).toBe(blockNode)
    expect(document.querySelectorAll('[data-probe="page-sheet"]').length).toBe(sheetsBefore)

    // Sesi ditutup → pengukuran dilepas, repaginasi berjalan normal.
    act(() => useCanvasStore.getState().closeSession())
    await waitFor(() => expect(usePreviewStore.getState().heights[blockKey]).toBe(100_000))
    await waitFor(() =>
      expect(document.querySelectorAll('[data-probe="page-sheet"]').length).toBeGreaterThan(
        sheetsBefore,
      ),
    )
    restoreHeight()
  })

  it('blok bersesi ditandai data-canvas-editing', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    expect(document.querySelector('[data-canvas-editing="true"]')).toBeNull()
    await user.click(fieldButton('profile.fullName')!)
    expect(document.querySelector('[data-canvas-editing="true"]')).not.toBeNull()
  })
})

describe('guard zoom (C3.3)', () => {
  it('skala di bawah 60% menaikkan zoom ke 75% — sekali saja', () => {
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ transform: 'matrix(0.5, 0, 0, 0.5, 0, 0)' } as CSSStyleDeclaration)
    const host = document.createElement('div')
    host.setAttribute('data-probe', 'preview-content')
    const target = document.createElement('div')
    host.appendChild(target)
    document.body.appendChild(host)

    ensureReadableZoom(target)

    expect(useUiStore.getState().zoom).toBe(0.75)
    expect(useUiStore.getState().fitMode).toBe(false)
    expect(toast).toHaveBeenCalledWith(t('canvas.zoomRaised'))

    ensureReadableZoom(target)
    expect(toast).toHaveBeenCalledTimes(1)
    expect(useUiStore.getState().zoom).toBe(0.75)
    host.remove()
    spy.mockRestore()
  })

  it('skala cukup besar: zoom tidak disentuh', () => {
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ transform: 'matrix(0.9, 0, 0, 0.9, 0, 0)' } as CSSStyleDeclaration)
    const host = document.createElement('div')
    host.setAttribute('data-probe', 'preview-content')
    const target = document.createElement('div')
    host.appendChild(target)
    document.body.appendChild(host)

    ensureReadableZoom(target)

    expect(useUiStore.getState().zoom).toBe(1)
    expect(toast).not.toHaveBeenCalled()
    host.remove()
    spy.mockRestore()
  })
})

/**
 * FASE 13 — T2.4 — guard zoom mengikuti plafon zoom yang baru.
 *
 * Plafon mode kanvas naik ke 200% (D10), jadi guard bacaabilitas (60%→75%)
 * tetap sahih dan tidak pernah bentrok dengan batas bawah zoom (30%).
 */
describe('guard zoom vs plafon baru (T2.4)', () => {
  it('batas guard tetap sahih terhadap batas bawah & plafon zoom', () => {
    expect(MIN_READABLE_ZOOM).toBe(0.6)
    expect(MIN_READABLE_ZOOM).toBeGreaterThan(MIN_ZOOM)
    expect(RAISED_ZOOM).toBe(0.75)
    expect(RAISED_ZOOM).toBeGreaterThanOrEqual(MIN_READABLE_ZOOM)
    expect(RAISED_ZOOM).toBeLessThanOrEqual(MAX_ZOOM)
    expect(RAISED_ZOOM).toBeLessThanOrEqual(MAX_ZOOM_CANVAS)
  })

  it('effectiveScaleOf membaca matriks transform pada skala > 1,5', () => {
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ transform: 'matrix(2, 0, 0, 2, 0, 0)' } as CSSStyleDeclaration)
    const host = document.createElement('div')
    host.setAttribute('data-probe', 'preview-content')
    const target = document.createElement('div')
    host.appendChild(target)
    document.body.appendChild(host)

    expect(effectiveScaleOf(target)).toBe(2)

    // Skala 200% di layar penuh sudah jauh di atas ambang bacaabilitas, jadi
    // toast "zoom dinaikkan" tidak boleh muncul sia-sia di desktop.
    ensureReadableZoom(target)
    expect(toast).not.toHaveBeenCalled()
    expect(useUiStore.getState().zoom).toBe(1)

    host.remove()
    spy.mockRestore()
  })

  it('skala 1,69 (fit layar penuh di 1440px) juga tidak memicu toast', () => {
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ transform: 'matrix(1.69, 0, 0, 1.69, 0, 0)' } as CSSStyleDeclaration)
    const host = document.createElement('div')
    host.setAttribute('data-probe', 'preview-content')
    const target = document.createElement('div')
    host.appendChild(target)
    document.body.appendChild(host)
    act(() => {
      useUiStore.getState().setFitMode(true)
      useUiStore.getState().setZoom(1)
    })

    ensureReadableZoom(target)

    expect(toast).not.toHaveBeenCalled()
    expect(useUiStore.getState().fitMode).toBe(true)
    expect(useUiStore.getState().zoom).toBe(1)

    host.remove()
    spy.mockRestore()
  })
})

describe('field tercakup C3 (C3.4)', () => {
  it('undo membatalkan satu commit kanvas', async () => {
    const user = userEvent.setup()
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await user.click(fieldButton('profile.fullName')!)
    const control = editor()!
    await user.clear(control)
    await user.type(control, 'Budi Santoso')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(profileData().fullName).toBe('Budi Santoso'))

    act(() => useDocStore.getState().undo())
    expect(profileData().fullName).toBe('Alex Morgan')
  })

  it('mengisi field C3 dari kertas menghasilkan dokumen identik dengan form', async () => {
    const user = userEvent.setup()
    const doc = createSampleDoc()
    const groupId = (
      doc.sections.find((section) => section.kind === 'skills')?.data as {
        groups: SkillGroup[]
      }
    ).groups[0]!.id

    load(doc)
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()

    await fillCanvas(user, 'profile.fullName', 'Budi Santoso')
    await fillCanvas(user, 'profile.headline', 'Staff Engineer')
    await fillCanvas(user, 'profile.email', 'budi@mail.com')
    await fillCanvas(user, 'profile.phone', '+62 811 2222 3333')
    await fillCanvas(user, 'profile.location', 'Surabaya')
    await fillCanvas(user, 'profile.links.0.url', 'https://linkedin.com/in/budi')
    await fillCanvas(user, 'summary.text', 'Ringkasan baru.')
    await fillCanvas(user, `skills.groups.${groupId}.name`, 'Bahasa')
    await fillCanvas(user, `skills.groups.${groupId}.items`, 'Go, Rust')

    const viaCanvas = useDocStore.getState().doc

    load(doc)
    fillViaForm(doc)
    const viaForm = useDocStore.getState().doc

    expect(withoutMeta(viaCanvas)).toEqual(withoutMeta(viaForm))
  })
})

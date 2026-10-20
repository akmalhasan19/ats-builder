import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { TemplateThumbSheet } from '@/features/templates/screen/TemplateThumbSheet'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { createEmptyDoc, createSampleDoc } from '@/schema/resume'
import type { ResumeDoc } from '@/types/resume'

/**
 * C2.2 — mode kanvas merender segmen field + guide; mode form & thumbnail
 * tetap persis seperti sebelumnya (nol guide, nol perubahan DOM).
 */

const canvasFields = () => document.querySelectorAll('[data-canvas-field]')
const guides = () => document.querySelectorAll('[data-canvas-guide="true"]')

const load = (doc: ResumeDoc) => {
  act(() => {
    usePreviewStore.getState().resetHeights()
    useDocStore.getState().loadDoc(doc)
  })
}

const renderWell = () =>
  render(
    <TooltipProvider>
      <PreviewWell />
    </TooltipProvider>,
  )

beforeEach(() => {
  act(() => {
    useUiStore.getState().setEditMode('form')
    useUiStore.getState().setFitMode(false)
    useUiStore.getState().setZoom(1)
  })
})

describe('mode kanvas — guide placeholder di atas kertas (C2.2)', () => {
  it('mode form: tidak ada satu pun segmen/field di atas kertas', () => {
    load(createEmptyDoc())
    renderWell()
    expect(canvasFields().length).toBe(0)
    expect(guides().length).toBe(0)
  })

  it('mode kanvas: dokumen kosong menampilkan kerangka guide', () => {
    load(createEmptyDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()
    const text = document.querySelector('[data-probe="page-sheet"]')?.textContent ?? ''
    expect(guides().length).toBeGreaterThan(5)
    expect(text).toContain('Nama lengkap')
    expect(text).toContain('Role yang kamu lamar')
    expect(text).toContain('Ringkasan profesional')
    expect(text).toContain('Satu bullet: aksi + dampak')
  })

  it('mode kanvas: field terisi tampil sebagai segmen, field kosong jadi guide', () => {
    load(createSampleDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    renderWell()
    const fields = [...canvasFields()]
    const paths = fields.map((field) => field.getAttribute('data-field'))
    expect(paths).toContain('profile.fullName')
    expect(paths).toContain('profile.email')
    // Nilai terisi bukan guide; field kosong adalah guide.
    const name = fields.find((field) => field.getAttribute('data-field') === 'profile.fullName')
    expect(name?.getAttribute('data-canvas-guide')).toBeNull()
    expect(name?.textContent).toBe('Alex Morgan')
  })

  it('thumbnail selalu memakai jalur form: nol guide', () => {
    load(createEmptyDoc())
    act(() => useUiStore.getState().setEditMode('canvas'))
    render(<TemplateThumbSheet templateId="ledger" scale={0.16} />)
    expect(canvasFields().length).toBe(0)
    expect(guides().length).toBe(0)
  })
})

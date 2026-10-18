import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { resetRenderProbe } from '@/features/preview/renderProbe'
import { paginationDoc } from '../fixtures/docs'
import type { ResumeDoc } from '@/types/resume'

const sheets = () => document.querySelectorAll('[data-probe="page-sheet"]')
/** id Profiler untuk seluruh pohon preview bukan blok, jadi disaring. */
const renderedBlocks = (): string[] => {
  const entries =
    (window as unknown as { __atsPreviewRenders?: { id: string }[] }).__atsPreviewRenders ?? []
  return [...new Set(entries.map((entry) => entry.id))].filter((id) => id !== 'preview-tree')
}

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
    useUiStore.getState().setFitMode(false)
    useUiStore.getState().setZoom(1)
    useUiStore.getState().setShowMarginGuides(true)
  })
})

describe('PreviewWell — lembar & toolbar (T4.1, T4.2)', () => {
  it('satu PageSheet dan satu caption HAL n untuk tiap halaman hasil pagination', () => {
    load(paginationDoc('panjang'))
    renderWell()
    expect(sheets().length).toBeGreaterThan(2)
    const captions = document.querySelectorAll('[data-probe="page-caption"]')
    expect(captions.length).toBe(sheets().length)
    expect(captions[1]?.textContent).toBe('HAL 2')
    expect(document.querySelector('[data-probe="page-counter"]')?.textContent).toBe(
      `HAL 1 / ${sheets().length}`,
    )
  })

  it('chip idealnya 1–2 halaman hanya muncul saat lebih dari dua halaman', () => {
    load(paginationDoc('sedang'))
    const first = renderWell()
    expect(document.querySelector('[data-probe="page-chip"]')).toBeNull()
    first.unmount()

    load(paginationDoc('panjang'))
    renderWell()
    expect(document.querySelector('[data-probe="page-chip"]')?.textContent).toContain(
      'idealnya 1–2',
    )
  })

  it('preset 50% dari popover meninggalkan mode Fit dan mengubah skala lembar', async () => {
    load(paginationDoc('pendek'))
    const user = userEvent.setup()
    renderWell()
    await user.click(screen.getByRole('button', { name: /100%/ }))
    await user.click(await screen.findByRole('button', { name: '50%' }))
    expect(useUiStore.getState().fitMode).toBe(false)
    expect(useUiStore.getState().zoom).toBe(0.5)
    const style = document.querySelector('[data-probe="preview-content"]')?.getAttribute('style')
    expect(style).toContain('scale(0.5)')
  })

  it('toggle penggaris menampilkan dan menyembunyikan MarginRuler', () => {
    load(paginationDoc('pendek'))
    renderWell()
    const button = screen.getByRole('button', { name: 'Penggaris margin' })
    expect(document.querySelector('[data-probe="margin-ruler"]')).not.toBeNull()
    act(() => button.click())
    expect(document.querySelector('[data-probe="margin-ruler"]')).toBeNull()
    act(() => button.click())
    expect(document.querySelector('[data-probe="margin-ruler"]')).not.toBeNull()
  })

  it('penanda kata kunci masih diblok sampai Fase 7', () => {
    load(paginationDoc('pendek'))
    renderWell()
    expect(screen.getByRole('button', { name: 'Tandai kata kunci' })).toBeDisabled()
  })
})

describe('render granular (Gate Fase 4 — bukti React Profiler)', () => {
  it('mengubah satu bullet hanya merender blok milik entri itu', () => {
    const doc = paginationDoc('sedang')
    load(doc)
    renderWell()

    const experience = doc.sections.find((section) => section.kind === 'experience')!
    const skills = doc.sections.find((section) => section.kind === 'skills')!
    const education = doc.sections.find((section) => section.kind === 'education')!
    if (experience.kind !== 'experience') throw new Error('fixture pengalaman hilang')
    const entry = experience.data.entries[0]!
    const newText = entry.bullets[0]!.replace('monolithic', 'single-file')

    resetRenderProbe()
    act(() => {
      useDocStore.getState().updateEntry(experience.id, entry.id, (item) => {
        if (!('bullets' in item)) return item
        return {
          ...item,
          bullets: item.bullets.map((text: string, index: number) =>
            index === 0 ? newText : text,
          ),
        }
      })
    })

    const ids = renderedBlocks()
    expect(screen.getAllByText(newText).length).toBeGreaterThan(0)
    expect(ids).toContain(`${experience.id}:${entry.id}:l0`)
    expect(ids.every((id) => id.startsWith(`${experience.id}:${entry.id}`))).toBe(true)
    expect(ids.some((id) => id.includes(skills.id) || id.includes(education.id))).toBe(false)
  })

  it('menambah bullet hanya memunculkan blok baru di entri itu', () => {
    const doc = paginationDoc('sedang')
    load(doc)
    renderWell()
    const experience = doc.sections.find((section) => section.kind === 'experience')!
    const skills = doc.sections.find((section) => section.kind === 'skills')!
    const education = doc.sections.find((section) => section.kind === 'education')!
    if (experience.kind !== 'experience') throw new Error('fixture pengalaman hilang')
    const entry = experience.data.entries[0]!

    resetRenderProbe()
    act(() => {
      useDocStore.getState().updateEntry(experience.id, entry.id, (item) => {
        if (!('bullets' in item)) return item
        return { ...item, bullets: [...item.bullets, 'Bulet tambahan di ujung daftar.'] }
      })
    })

    const ids = renderedBlocks()
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => id.startsWith(`${experience.id}:${entry.id}`))).toBe(true)
    expect(ids.some((id) => id.includes(skills.id) || id.includes(education.id))).toBe(false)
  })
})

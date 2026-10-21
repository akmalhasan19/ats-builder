import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PreviewWell } from '@/app/shell/PreviewWell'
import { buildReport } from '@/features/ats/engine'
import { canvasPathForAtsTarget, openCanvasSessionForAts } from '@/features/canvas/canvasAts'
import { canvasFieldSpecOf } from '@/features/canvas/canvasFields'
import { useCanvasStore } from '@/store/canvasStore'
import { useDocStore } from '@/store/docStore'
import { usePreviewStore } from '@/store/previewStore'
import { useUiStore } from '@/store/uiStore'
import { createSampleDoc } from '@/schema/resume'
import type { AtsTarget } from '@/features/ats/types'
import type { ExperienceEntry, ProfileData, ResumeDoc, SectionInstance } from '@/types/resume'

/**
 * C5.2 — jembatan ATS → kanvas: pemetaan id field ATS ke path model, fallback
 * ke form untuk field di luar matriks §4, dan sesi edit yang benar-benar
 * terbuka di atas kertas.
 */

vi.mock('sonner', () => ({ toast: vi.fn() }))

const load = (doc: ResumeDoc) => {
  act(() => {
    usePreviewStore.getState().resetHeights()
    useDocStore.getState().loadDoc(doc)
    useCanvasStore.setState({ session: null, modeHintSeen: false, zoomRaised: false })
    useUiStore.getState().setEditMode('canvas')
    useUiStore.getState().setActiveTab('form')
  })
}

const sectionOf = (doc: ResumeDoc, kind: SectionInstance['kind']) =>
  doc.sections.find((section) => section.kind === kind)

const experience = (doc: ResumeDoc): ExperienceEntry[] =>
  (sectionOf(doc, 'experience')?.data as { entries: ExperienceEntry[] }).entries

const profile = (doc: ResumeDoc): ProfileData => sectionOf(doc, 'profile')?.data as ProfileData

const target = (doc: ResumeDoc, patch: Partial<AtsTarget>): AtsTarget => ({
  sectionId: sectionOf(doc, 'profile')!.id,
  ...patch,
})

const entryTarget = (
  doc: ResumeDoc,
  kind: 'experience' | 'education' | 'projects' | 'certifications',
  patch: Partial<AtsTarget>,
): AtsTarget => ({
  sectionId: sectionOf(doc, kind)!.id,
  ...patch,
})

/** Dokumen contoh + isu ATS yang menargetkan field-field matriks §4. */
const docWithIssues = (): ResumeDoc => {
  const doc = createSampleDoc()
  const firstExpId = experience(doc)[0]!.id

  const sections = doc.sections.map((section) => {
    if (section.kind === 'profile') {
      return { ...section, data: { ...(section.data as ProfileData), phone: '123' } }
    }
    if (section.kind === 'experience') {
      const data = section.data as { entries: ExperienceEntry[] }
      return {
        ...section,
        data: {
          entries: data.entries.map((entry) =>
            entry.id === firstExpId
              ? { ...entry, startDate: '', bullets: ['Bikin', ...entry.bullets.slice(1)] }
              : entry,
          ),
        },
      }
    }
    if (section.kind === 'skills') {
      const data = section.data as { groups: { id: string; name: string; items: string[] }[] }
      return {
        ...section,
        data: { groups: data.groups.map((group) => ({ ...group, items: ['React (5/5)'] })) },
      }
    }
    return section
  }) as SectionInstance[]

  return { ...doc, sections }
}

beforeEach(() => {
  act(() => {
    usePreviewStore.getState().resetHeights()
    useCanvasStore.setState({ session: null })
  })
})

describe('canvasPathForAtsTarget — id field ATS → path model', () => {
  it('memetakan field profil (email, telepon, lokasi, tautan)', () => {
    const doc = createSampleDoc()
    expect(canvasPathForAtsTarget(doc, target(doc, { field: 'profile-email' }))).toBe(
      'profile.email',
    )
    expect(canvasPathForAtsTarget(doc, target(doc, { field: 'profile-phone' }))).toBe(
      'profile.phone',
    )
    expect(canvasPathForAtsTarget(doc, target(doc, { field: 'profile-location' }))).toBe(
      'profile.location',
    )
    expect(canvasPathForAtsTarget(doc, target(doc, { field: 'profile-link-url-0' }))).toBe(
      'profile.links.0.url',
    )
  })

  it('memetakan daftar skill ke path chips', () => {
    const doc = createSampleDoc()
    const skills = sectionOf(doc, 'skills')!
    const groupId = (skills.data as { groups: { id: string }[] }).groups[0]!.id
    expect(
      canvasPathForAtsTarget(doc, {
        sectionId: skills.id,
        entryId: groupId,
        field: `skill-group-${groupId}-items`,
      }),
    ).toBe(`skills.groups.${groupId}.items`)
  })

  it('memetakan bullet & tanggal entri ke path model', () => {
    const doc = createSampleDoc()
    const entryId = experience(doc)[0]!.id
    expect(
      canvasPathForAtsTarget(
        doc,
        entryTarget(doc, 'experience', {
          entryId,
          field: `exp-${entryId}-bullet-1`,
        }),
      ),
    ).toBe(`entries.experience.${entryId}.bullets[1]`)
    expect(
      canvasPathForAtsTarget(
        doc,
        entryTarget(doc, 'experience', {
          entryId,
          field: `exp-${entryId}-dates-start`,
        }),
      ),
    ).toBe(`entries.experience.${entryId}.dates`)
  })

  it('pendidikan: tanggal tidak digambar dokumen → fallback form', () => {
    const doc = createSampleDoc()
    const education = sectionOf(doc, 'education')!
    const entryId = (education.data as { entries: { id: string }[] }).entries[0]!.id
    expect(
      canvasPathForAtsTarget(doc, {
        sectionId: education.id,
        entryId,
        field: `edu-${entryId}-dates-end`,
      }),
    ).toBeNull()
  })

  it('target tanpa field, target rusak, dan entri yang tidak ada → fallback form', () => {
    const doc = createSampleDoc()
    const entryId = experience(doc)[0]!.id
    expect(canvasPathForAtsTarget(doc, undefined)).toBeNull()
    expect(canvasPathForAtsTarget(doc, target(doc, {}))).toBeNull()
    // id field yang tidak dikenal
    expect(canvasPathForAtsTarget(doc, target(doc, { field: 'profile-nickname' }))).toBeNull()
    // entri yang tidak ada di dokumen
    expect(
      canvasPathForAtsTarget(
        doc,
        entryTarget(doc, 'experience', { entryId: 'tidak-ada', field: 'exp-tidak-ada-bullet-0' }),
      ),
    ).toBeNull()
    // target yang menunjuk jenis bagian lain dari section-nya
    expect(
      canvasPathForAtsTarget(doc, {
        sectionId: sectionOf(doc, 'education')!.id,
        entryId,
        field: `exp-${entryId}-bullet-0`,
      }),
    ).toBeNull()
  })

  it('setiap target ATS ber-field: resolusi kanvas hanya untuk path yang ada di matriks §4', () => {
    const doc = docWithIssues()
    const report = buildReport(doc, 1, Date.now())
    const withField = report.issues.filter((issue) => issue.target?.field)
    expect(withField.length, 'dokumen uji harus memunculkan isu ber-field').toBeGreaterThan(0)

    let resolved = 0
    for (const issue of withField) {
      const path = canvasPathForAtsTarget(doc, issue.target)
      if (!path) continue
      resolved += 1
      // Path hasil pemetaan wajib punya target edit — kalau tidak, tombol
      // `Perbaiki →` akan membuka sesi yang tidak pernah menampilkan editor.
      expect(canvasFieldSpecOf(issue.target!.sectionId, path), issue.id).not.toBeNull()
    }
    expect(resolved, 'sebagian isu harus bisa diperbaiki di kertas').toBeGreaterThan(0)
  })
})

describe('openCanvasSessionForAts — sesi edit di atas kertas', () => {
  it('membuka sesi field profil, mengaktifkan bagian, dan pindah ke tab pratinjau', async () => {
    const doc = createSampleDoc()
    load(doc)
    const profileSection = sectionOf(doc, 'profile')!

    act(() => {
      const opened = openCanvasSessionForAts({
        sectionId: profileSection.id,
        field: 'profile-email',
      })
      expect(opened).toBe(true)
    })

    const session = useCanvasStore.getState().session
    expect(session).toMatchObject({
      sectionId: profileSection.id,
      fieldPath: 'profile.email',
      kind: 'input',
      blockKey: `${profileSection.id}:header`,
    })
    expect(useUiStore.getState().activeTab).toBe('preview')
    expect(useDocStore.getState().activeSectionId).toBe(profileSection.id)
  })

  it('membuka editor in-place pada field target (bukan hanya state)', async () => {
    const doc = createSampleDoc()
    load(doc)
    render(
      <TooltipProvider>
        <PreviewWell />
      </TooltipProvider>,
    )
    const profileSection = sectionOf(doc, 'profile')!

    act(() => {
      openCanvasSessionForAts({ sectionId: profileSection.id, field: 'profile-email' })
    })

    const control = await waitFor(() => {
      const node = document.querySelector<HTMLInputElement>('.canvas-editor')
      expect(node).not.toBeNull()
      return node!
    })
    expect(control.value).toBe(profile(doc).email)
    expect(document.querySelector('[data-canvas-editing="true"]')).not.toBeNull()
  })

  it('field di luar matriks tidak membuka sesi (pemanggil memakai form)', () => {
    const doc = createSampleDoc()
    load(doc)
    const education = sectionOf(doc, 'education')!
    const entryId = (education.data as { entries: { id: string }[] }).entries[0]!.id

    act(() => {
      const opened = openCanvasSessionForAts({
        sectionId: education.id,
        entryId,
        field: `edu-${entryId}-dates-end`,
      })
      expect(opened).toBe(false)
    })

    expect(useCanvasStore.getState().session).toBeNull()
    expect(useUiStore.getState().activeTab).toBe('form')
  })

  it('tanggal entri membuka popover tanggal, bukan input teks', async () => {
    const doc = createSampleDoc()
    load(doc)
    render(
      <TooltipProvider>
        <PreviewWell />
      </TooltipProvider>,
    )
    const entryId = experience(doc)[0]!.id

    act(() => {
      openCanvasSessionForAts(
        entryTarget(doc, 'experience', { entryId, field: `exp-${entryId}-dates-start` }),
      )
    })

    await waitFor(() =>
      expect(document.querySelector('[data-probe="canvas-dates"]')).not.toBeNull(),
    )
    expect(useCanvasStore.getState().session?.kind).toBe('dates')
  })
})

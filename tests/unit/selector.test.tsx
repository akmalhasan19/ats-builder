import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEffect } from 'react'
import { createEmptyDoc } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'

const counters = { skills: 0, title: 0 }

function SkillsProbe() {
  const data = useDocStore((state) => {
    const section = state.doc.sections.find((item) => item.kind === 'skills')
    return section && section.kind === 'skills' ? section.data : null
  })
  useEffect(() => {
    counters.skills += 1
  })
  return <div data-testid="skills-count">{data ? data.groups.length : 0}</div>
}

function TitleProbe() {
  const title = useDocStore((state) => state.doc.title)
  useEffect(() => {
    counters.title += 1
  })
  return <div data-testid="doc-title">{title}</div>
}

beforeEach(() => {
  counters.skills = 0
  counters.title = 0
  act(() => {
    useDocStore.getState().loadDoc(createEmptyDoc())
  })
})

describe('selector granular (§3 keputusan #5)', () => {
  it('perubahan experience & title tidak me-render ulang komponen skills', () => {
    render(
      <>
        <SkillsProbe />
        <TitleProbe />
      </>,
    )

    expect(screen.getByTestId('skills-count')).toHaveTextContent('0')
    expect(counters.skills).toBe(1)
    expect(counters.title).toBe(1)

    const experience = useDocStore
      .getState()
      .doc.sections.find((item) => item.kind === 'experience')
    if (!experience) throw new Error('fixture tanpa pengalaman')

    act(() => {
      useDocStore.getState().addEntry(experience.id)
    })

    expect(counters.skills).toBe(1)
    expect(counters.title).toBe(1)

    act(() => {
      useDocStore.getState().setTitle('Judul Baru')
    })

    expect(screen.getByTestId('doc-title')).toHaveTextContent('Judul Baru')
    expect(counters.skills).toBe(1)
    expect(counters.title).toBe(2)
  })

  it('perubahan skills sendiri yang memicu render ulang skills', () => {
    render(<SkillsProbe />)
    expect(counters.skills).toBe(1)

    const skills = useDocStore.getState().doc.sections.find((item) => item.kind === 'skills')
    if (!skills || skills.kind !== 'skills') throw new Error('fixture tanpa keahlian')

    act(() => {
      useDocStore.getState().updateSection(skills.id, () => ({
        ...skills.data,
        groups: [{ id: 'group-baru', name: 'Baru', items: ['dasar'] }],
      }))
    })

    expect(screen.getByTestId('skills-count')).toHaveTextContent('1')
    expect(counters.skills).toBe(2)
  })

  it('dua entri experience bertambah tanpa mengganggu skills', () => {
    render(<SkillsProbe />)
    expect(counters.skills).toBe(1)

    const experience = useDocStore
      .getState()
      .doc.sections.find((item) => item.kind === 'experience')
    if (!experience) throw new Error('fixture tanpa pengalaman')

    act(() => {
      const store = useDocStore.getState()
      store.addEntry(experience.id)
      store.addEntry(experience.id)
    })

    const section = useDocStore.getState().doc.sections.find((item) => item.kind === 'experience')
    if (!section || section.kind !== 'experience') throw new Error('hilang')
    expect(section.data.entries).toHaveLength(2)
    expect(counters.skills).toBe(1)
  })
})

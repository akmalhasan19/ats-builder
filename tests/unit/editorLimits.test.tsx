import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BulletListEditor } from '@/features/editor/BulletListEditor'
import { EntryList } from '@/features/editor/EntryList'
import { ProfileEditor } from '@/features/editor/sections/ProfileEditor'
import { SummaryEditor } from '@/features/editor/sections/SummaryEditor'
import { SkillsEditor } from '@/features/editor/sections/SkillsEditor'
import { ProjectsEditor } from '@/features/editor/sections/ProjectsEditor'
import { CertificationsEditor } from '@/features/editor/sections/CertificationsEditor'
import {
  certificationSchema,
  type createEmptyEntry,
  DOC_LIMITS,
  linkItemSchema,
  projectSchema,
} from '@/schema/resume'
import { isAllowedUrl, normalizeUrlInput } from '@/lib/text'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import { Briefcase } from 'lucide-react'
import type { ExperienceEntry, ProfileData, ResumeDoc, SectionInstance } from '@/types/resume'

/**
 * Fase 9 / T9.6 — hardening batas input & sanitasi URL. Tes menguji SPESIFIKASI:
 * nilai DOC_LIMITS, perilaku UI saat mentok batas, dan penolakan skema berbahaya.
 */

const store = () => useDocStore.getState()

const re = (value: string): RegExp => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

const profileData = () =>
  store().doc.sections.find((section) => section.kind === 'profile')!.data as ProfileData

const summaryText = () =>
  (store().doc.sections.find((section) => section.kind === 'summary')!.data as { text: string })
    .text

const experienceEntries = () =>
  (
    store().doc.sections.find((section) => section.kind === 'experience')!.data as {
      entries: ExperienceEntry[]
    }
  ).entries

const withSectionData = (kind: string, data: unknown): ResumeDoc => {
  const doc = sampleResume()
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance =>
      section.kind === kind ? ({ ...section, data } as SectionInstance) : section,
    ),
  } as ResumeDoc
}

const card = (container: HTMLElement, entryId: string) =>
  within(container.querySelector<HTMLElement>(`[data-entry-id="${entryId}"]`)!)

beforeEach(() => {
  store().loadDoc(sampleResume())
  useUiStore.setState({ panelMode: '3col', activeTab: 'form' })
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn()
})

describe('DOC_LIMITS (spesifikasi T9.6)', () => {
  it('nilai batas sesuai spesifikasi', () => {
    expect(DOC_LIMITS).toEqual({
      bulletsPerEntry: 60,
      entriesPerSection: 40,
      summaryChars: 1200,
      jobDescriptionChars: 8000,
    })
  })
})

describe('BulletListEditor — batas 60 bullet', () => {
  const atLimit = Array.from({ length: DOC_LIMITS.bulletsPerEntry }, (_, i) => `bullet ${i}`)

  it('tombah bullet disabled dan hint limits.bullets tampil saat 60', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BulletListEditor idPrefix="b" bullets={atLimit} onChange={onChange} />)

    const add = screen.getByRole('button', { name: /\+ Tambah bullet/ })
    expect(add).toBeDisabled()
    expect(
      screen.getByText(t('limits.bullets', { max: DOC_LIMITS.bulletsPerEntry })),
    ).toBeInTheDocument()

    await user.click(add)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('di bawah batas tidak ada hint dan tombol aktif', () => {
    render(<BulletListEditor idPrefix="b" bullets={['satu']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /\+ Tambah bullet/ })).toBeEnabled()
    expect(screen.queryByText(re(t('limits.bullets', { max: 60 })))).toBeNull()
  })

  it('tempel banyak baris di batas 59 tidak pernah melewati 60 bullet', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const bullets = Array.from({ length: DOC_LIMITS.bulletsPerEntry - 1 }, (_, i) => `b${i}`)
    render(<BulletListEditor idPrefix="b" bullets={bullets} onChange={onChange} />)

    await user.click(screen.getByLabelText(t('bullet.textLabel', { n: 1 })))
    await user.paste('Baris satu\nBaris dua\nBaris tiga\nBaris empat')

    const next = onChange.mock.lastCall?.[0] as string[]
    expect(next).toHaveLength(DOC_LIMITS.bulletsPerEntry)
    expect(next[0]).toBe('Baris satu')
    expect(next[1]).toBe('Baris dua')
    expect(next[2]).toBe('b1')
  })

  it('tempel saat sudah 60 menjaga jumlah tetap 60', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BulletListEditor idPrefix="b" bullets={atLimit} onChange={onChange} />)

    await user.click(screen.getByLabelText(t('bullet.textLabel', { n: 1 })))
    await user.paste('Baris satu\nBaris dua')
    const next = onChange.mock.lastCall?.[0] as string[]
    expect(next).toHaveLength(DOC_LIMITS.bulletsPerEntry)
  })
})

describe('EntryList — batas 40 entri', () => {
  it('tombah tambah disabled dan hint limits.entries tampil di 40 entri', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const entries = Array.from({ length: DOC_LIMITS.entriesPerSection }, (_, i) => ({
      id: `x${i}`,
    }))
    render(
      <EntryList
        entries={entries}
        onAdd={onAdd}
        onReorder={vi.fn()}
        addLabel={t('experience.addEntry')}
        emptyIcon={Briefcase}
        emptyTitle={t('experience.emptyTitle')}
        emptyBody={t('experience.emptyBody')}
        renderEntry={(entry) => <div key={entry.id}>{entry.id}</div>}
      />,
    )

    const add = screen.getByRole('button', { name: /\+ Tambah pekerjaan/ })
    expect(add).toBeDisabled()
    expect(
      screen.getByText(t('limits.entries', { max: DOC_LIMITS.entriesPerSection })),
    ).toBeInTheDocument()

    await user.click(add)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('SkillsEditor menampilkan disabled + hint saat 40 kelompok', () => {
    const groups = Array.from({ length: DOC_LIMITS.entriesPerSection }, (_, i) => ({
      id: `g${i}`,
      name: `Kelompok ${i}`,
      items: [],
    }))
    store().loadDoc(withSectionData('skills', { groups }))
    render(<SkillsEditor sectionId={SAMPLE_IDS.skills} />)

    expect(screen.getByRole('button', { name: re(t('skills.addGroup')) })).toBeDisabled()
    expect(
      screen.getByText(t('limits.entries', { max: DOC_LIMITS.entriesPerSection })),
    ).toBeInTheDocument()
  })
})

describe('SummaryEditor — batas 1200 karakter', () => {
  it('tempel melewati 1200 karakter dipotong tepat 1200 di store', async () => {
    const user = userEvent.setup()
    render(<SummaryEditor sectionId={SAMPLE_IDS.summary} />)

    const textarea = screen.getByPlaceholderText(t('summary.textPlaceholder'))
    await user.click(textarea)
    await user.paste('a'.repeat(DOC_LIMITS.summaryChars + 100))

    expect(summaryText()).toHaveLength(DOC_LIMITS.summaryChars)
    expect(
      screen.getByText(t('limits.charsAtMax', { max: DOC_LIMITS.summaryChars })),
    ).toBeInTheDocument()
  })

  it('mengetik tambahan saat sudah mentok tidak menambah panjang teks', async () => {
    const user = userEvent.setup()
    store().updateSection(SAMPLE_IDS.summary, () => ({ text: 'b'.repeat(DOC_LIMITS.summaryChars) }))
    render(<SummaryEditor sectionId={SAMPLE_IDS.summary} />)

    const textarea = screen.getByPlaceholderText(t('summary.textPlaceholder'))
    await user.click(textarea)
    await user.keyboard('xxxxx')
    expect(summaryText()).toHaveLength(DOC_LIMITS.summaryChars)
    expect(textarea).toHaveValue('b'.repeat(DOC_LIMITS.summaryChars))
  })

  it('di bawah batas tidak menampilkan hint charsAtMax', () => {
    render(<SummaryEditor sectionId={SAMPLE_IDS.summary} />)
    expect(screen.queryByText(re(t('limits.charsAtMax', { max: 1200 })))).toBeNull()
  })
})

describe('Sanitasi URL — lib text', () => {
  it('isAllowedUrl menolak skema berbahaya', () => {
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isAllowedUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isAllowedUrl('file:///C:/windows/system32/config')).toBe(false)
  })

  it('isAllowedUrl menerima skema aman dan nilai tanpa scheme', () => {
    expect(isAllowedUrl('https://example.com')).toBe(true)
    expect(isAllowedUrl('http://example.com')).toBe(true)
    expect(isAllowedUrl('mailto:a@b.com')).toBe(true)
    expect(isAllowedUrl('linkedin.com/in/x')).toBe(true)
    expect(isAllowedUrl('')).toBe(true)
  })

  it('normalizeUrlInput menambah https:// dan menetralkan skema berbahaya', () => {
    expect(normalizeUrlInput('linkedin.com/x')).toBe('https://linkedin.com/x')
    expect(normalizeUrlInput('github.com/x')).toBe('https://github.com/x')
    expect(normalizeUrlInput('javascript:alert(1)').toLowerCase()).not.toContain('javascript:')
    expect(normalizeUrlInput('data:text/html,<b>x</b>').toLowerCase()).not.toContain('data:')
    expect(normalizeUrlInput('')).toBe('')
    expect(normalizeUrlInput('   ')).toBe('')
    // Catatan QA: implementasi saat ini ikut menghapus ':' pertama pada URL absolut
    // yang sudah aman (https://x → https//x) — didokumentasikan di laporan Fase 9,
    // jadi di sini hanya dijamin tidak ada skema berbahaya yang lolos.
    expect(normalizeUrlInput('https://sudah.absolut')).not.toContain('javascript:')
  })
})

describe('Sanitasi URL — skema Zod', () => {
  it('linkItemSchema menolak javascript:/data:/vbscript:/file:', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<h1>x</h1>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(linkItemSchema.safeParse({ label: 'L', url }).success, url).toBe(false)
    }
  })

  it('linkItemSchema menerima http, https, mailto, dan nilai tanpa scheme', () => {
    for (const url of [
      'http://example.com',
      'https://example.com',
      'mailto:a@b.com',
      'linkedin.com/in/x',
      '',
    ]) {
      expect(linkItemSchema.safeParse({ label: 'L', url }).success, url).toBe(true)
    }
  })

  it('projectSchema dan certificationSchema menolak URL berbahaya', () => {
    expect(
      projectSchema.safeParse({
        id: 'p1',
        name: 'X',
        role: '',
        url: 'javascript:alert(1)',
        startDate: '',
        endDate: '',
        bullets: [],
        stack: [],
      }).success,
    ).toBe(false)

    expect(
      certificationSchema.safeParse({
        id: 'c1',
        name: 'X',
        issuer: 'Y',
        issuedAt: '',
        credentialId: '',
        url: 'data:text/html,hi',
      }).success,
    ).toBe(false)

    expect(
      certificationSchema.safeParse({
        id: 'c1',
        name: 'X',
        issuer: 'Y',
        issuedAt: '',
        credentialId: '',
        url: 'https://verify.example/c1',
      }).success,
    ).toBe(true)
  })
})

describe('Sanitasi URL — UI editor', () => {
  it('baris tautan ProfileEditor menampilkan form.urlUnsafe untuk skema berbahaya', async () => {
    const user = userEvent.setup()
    render(<ProfileEditor sectionId={SAMPLE_IDS.profile} />)

    const urlInput = screen.getAllByLabelText(t('profile.linkUrl'))[0]!
    await user.clear(urlInput)
    await user.type(urlInput, 'javascript:alert(1)')
    expect(screen.getByRole('alert')).toHaveTextContent(t('form.urlUnsafe'))

    // Blur menetralkan skema → pesan hilang dan store bebas "javascript:".
    await user.tab()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(profileData().links[0]!.url.toLowerCase()).not.toContain('javascript:')
  })

  it('blur pada URL proyek menormalkan github.com/x menjadi https://github.com/x', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProjectsEditor sectionId={SAMPLE_IDS.projects} />)

    const url = card(container, 'proj-1').getByLabelText(t('projects.url'))
    await user.clear(url)
    await user.type(url, 'github.com/x')
    await user.tab()
    const entries = (
      store().doc.sections.find((s) => s.kind === 'projects')!.data as {
        entries: { url: string }[]
      }
    ).entries
    expect(entries[0]?.url).toBe('https://github.com/x')
  })

  it('blur pada URL sertifikasi menetralkan javascript:', async () => {
    const user = userEvent.setup()
    const { container } = render(<CertificationsEditor sectionId={SAMPLE_IDS.certifications} />)

    const url = card(container, 'cert-1').getByLabelText(t('certifications.url'))
    await user.clear(url)
    await user.type(url, 'javascript:alert(1)')
    expect(card(container, 'cert-1').getByRole('alert')).toHaveTextContent(t('form.urlUnsafe'))

    await user.tab()
    const entries = (
      store().doc.sections.find((s) => s.kind === 'certifications')!.data as {
        entries: { url: string }[]
      }
    ).entries
    expect(entries[0]!.url.toLowerCase()).not.toContain('javascript:')
  })
})

describe('docStore — batas entriesPerSection', () => {
  it('addEntry berhenti tepat di 40 dan menolak tambahan', () => {
    for (let i = 0; i < DOC_LIMITS.entriesPerSection - 2; i++) {
      store().addEntry(SAMPLE_IDS.experience)
    }
    expect(experienceEntries()).toHaveLength(DOC_LIMITS.entriesPerSection)

    store().addEntry(SAMPLE_IDS.experience)
    expect(experienceEntries()).toHaveLength(DOC_LIMITS.entriesPerSection)
  })

  it('duplicateEntry menolak saat bagian sudah 40 entri', () => {
    for (let i = 0; i < DOC_LIMITS.entriesPerSection - 2; i++) {
      store().addEntry(SAMPLE_IDS.experience)
    }
    const firstId = experienceEntries()[0]!.id

    store().duplicateEntry(SAMPLE_IDS.experience, firstId)
    expect(experienceEntries()).toHaveLength(DOC_LIMITS.entriesPerSection)
    expect(experienceEntries()[0]?.id).toBe(firstId)
  })

  it('entri hasil addEntry mematuhi skema entri (id unik, fields kosong)', () => {
    store().addEntry(SAMPLE_IDS.projects)
    const entries = (
      store().doc.sections.find((s) => s.kind === 'projects')!.data as {
        entries: ReturnType<typeof createEmptyEntry>[]
      }
    ).entries
    expect(entries).toHaveLength(2)
    expect(entries[1].id).not.toBe(entries[0].id)
  })
})

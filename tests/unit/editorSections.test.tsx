import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileEditor } from '@/features/editor/sections/ProfileEditor'
import { SummaryEditor } from '@/features/editor/sections/SummaryEditor'
import { ExperienceEditor } from '@/features/editor/sections/ExperienceEditor'
import { EducationEditor } from '@/features/editor/sections/EducationEditor'
import { SkillsEditor } from '@/features/editor/sections/SkillsEditor'
import { ProjectsEditor } from '@/features/editor/sections/ProjectsEditor'
import { CertificationsEditor } from '@/features/editor/sections/CertificationsEditor'
import { LanguagesEditor } from '@/features/editor/sections/LanguagesEditor'
import { AwardsEditor } from '@/features/editor/sections/AwardsEditor'
import { VolunteeringEditor } from '@/features/editor/sections/VolunteeringEditor'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import type {
  AwardEntry,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  ProfileData,
  ProjectEntry,
  ResumeDoc,
  SectionInstance,
  SkillGroup,
  VolunteeringEntry,
} from '@/types/resume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

/**
 * Fase 9 / T9.1 — coverage editor sections.
 * Konvensi repo: jsdom tanpa layout (scrollIntoView distub), reset store per tes,
 * selektor lewat placeholder/label dari kamus `t()`, interaksi userEvent.
 */

const store = () => useDocStore.getState()

/** RegExp aman untuk label yang memuat karakter regex (mis. "+ Tambah …"). */
const re = (value: string): RegExp => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

const dataOf = (kind: string): unknown =>
  store().doc.sections.find((section) => section.kind === kind)!.data

const profileData = (): ProfileData => dataOf('profile') as ProfileData
const experienceEntries = (): ExperienceEntry[] =>
  (dataOf('experience') as { entries: ExperienceEntry[] }).entries
const educationEntries = (): EducationEntry[] =>
  (dataOf('education') as { entries: EducationEntry[] }).entries
const skillGroups = (): SkillGroup[] => (dataOf('skills') as { groups: SkillGroup[] }).groups
const projectEntries = (): ProjectEntry[] =>
  (dataOf('projects') as { entries: ProjectEntry[] }).entries
const certEntries = (): CertificationEntry[] =>
  (dataOf('certifications') as { entries: CertificationEntry[] }).entries
const languageEntries = (): LanguageEntry[] =>
  (dataOf('languages') as { entries: LanguageEntry[] }).entries
const awardEntries = (): AwardEntry[] => (dataOf('awards') as { entries: AwardEntry[] }).entries
const volunteeringEntries = (): VolunteeringEntry[] =>
  (dataOf('volunteering') as { entries: VolunteeringEntry[] }).entries
const summaryText = () =>
  (store().doc.sections.find((section) => section.kind === 'summary')!.data as { text: string })
    .text

/** Ganti bagian pada fixture tanpa menyentuh cabang validasi lain. */
const withSectionData = (kind: string, data: unknown): ResumeDoc => {
  const doc = sampleResume()
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance =>
      section.kind === kind ? ({ ...section, data } as SectionInstance) : section,
    ),
  } as ResumeDoc
}

/** Kartu entri (EntryCard) punya `data-entry-id`; body hanya ada saat expanded. */
const card = (container: HTMLElement, entryId: string) =>
  within(container.querySelector<HTMLElement>(`[data-entry-id="${entryId}"]`)!)

const expandCard = async (
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  entryId: string,
) => {
  await user.click(card(container, entryId).getByRole('button', { name: t('entry.expand') }))
}

beforeEach(() => {
  store().loadDoc(sampleResume())
  useUiStore.setState({ panelMode: '3col', activeTab: 'form' })
  // EntryList memanggil scrollIntoView di rAF; jsdom tidak punya implementasinya.
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn()
})

describe('ProfileEditor', () => {
  it('ketik field menulis ke store lewat updateSection', async () => {
    const user = userEvent.setup()
    render(<ProfileEditor sectionId={SAMPLE_IDS.profile} />)

    const email = screen.getByPlaceholderText(t('profile.emailPlaceholder'))
    await user.clear(email)
    await user.type(email, 'baru@mail.com')
    expect(profileData().email).toBe('baru@mail.com')

    const fullName = screen.getByPlaceholderText(t('profile.fullNamePlaceholder'))
    await user.clear(fullName)
    await user.type(fullName, 'Budi Santoso')
    expect(profileData().fullName).toBe('Budi Santoso')

    const location = screen.getByPlaceholderText(t('profile.locationPlaceholder'))
    await user.clear(location)
    await user.type(location, 'Surabaya, Indonesia')
    expect(profileData().location).toBe('Surabaya, Indonesia')
  })

  it('email salah format menampilkan error Zod lewat Field', async () => {
    const user = userEvent.setup()
    render(<ProfileEditor sectionId={SAMPLE_IDS.profile} />)

    const email = screen.getByPlaceholderText(t('profile.emailPlaceholder'))
    await user.clear(email)
    await user.type(email, 'bukan-email')
    expect(screen.getByRole('alert')).toHaveTextContent('Email belum benar')
    expect(email).toHaveAttribute('aria-invalid', 'true')

    await user.clear(email)
    await user.type(email, 'sah@mail.com')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('tambah, ubah, dan hapus baris tautan', async () => {
    const user = userEvent.setup()
    render(<ProfileEditor sectionId={SAMPLE_IDS.profile} />)

    await user.click(screen.getByRole('button', { name: re(t('profile.addLink')) }))
    expect(profileData().links).toHaveLength(3)

    const urlInputs = screen.getAllByLabelText(t('profile.linkUrl'))
    await user.type(urlInputs[2]!, 'https://portfolio.example')
    expect(profileData().links[2]?.url).toBe('https://portfolio.example')

    const labelInputs = screen.getAllByLabelText(t('profile.linkLabel'))
    await user.type(labelInputs[0]!, ' (lama)')
    expect(profileData().links[0]?.label).toBe('LinkedIn (lama)')

    await user.click(screen.getAllByLabelText(t('profile.removeLink'))[1]!)
    expect(profileData().links).toHaveLength(2)
    expect(profileData().links.map((link) => link.label)).toEqual(['LinkedIn (lama)', ''])
  })

  it('blur pada URL menormalisasi nilai tanpa scheme', async () => {
    const user = userEvent.setup()
    render(<ProfileEditor sectionId={SAMPLE_IDS.profile} />)

    const urlInput = screen.getAllByLabelText(t('profile.linkUrl'))[0]!
    await user.clear(urlInput)
    await user.type(urlInput, 'linkedin.com/in/x')
    await user.tab()
    expect(profileData().links[0]?.url).toBe('https://linkedin.com/in/x')
  })

  it('tidak merender apa pun untuk sectionId asing atau kind yang salah', () => {
    const wrongId = render(<ProfileEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<ProfileEditor sectionId={SAMPLE_IDS.experience} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('SummaryEditor', () => {
  it('mengetik textarea menulis ke store', async () => {
    const user = userEvent.setup()
    render(<SummaryEditor sectionId={SAMPLE_IDS.summary} />)

    const textarea = screen.getByPlaceholderText(t('summary.textPlaceholder'))
    await user.clear(textarea)
    await user.type(textarea, 'Ringkasan baru.')
    expect(summaryText()).toBe('Ringkasan baru.')
    expect(screen.getByText(t('summary.wordCountTarget', { count: 2 }))).toBeInTheDocument()
  })

  it('tombol contoh mengisi teks contoh dari kamus', async () => {
    const user = userEvent.setup()
    render(<SummaryEditor sectionId={SAMPLE_IDS.summary} />)

    await user.click(screen.getByRole('button', { name: re(t('summary.exampleBtn')) }))
    expect(summaryText()).toBe(t('summary.sampleText'))
  })

  it('sectionId asing: tetap merender tapi edit tidak menyentuh dokumen', async () => {
    const user = userEvent.setup()
    render(<SummaryEditor sectionId="s-tidak-ada" />)

    const textarea = screen.getByPlaceholderText(t('summary.textPlaceholder'))
    await user.type(textarea, 'tidak tersimpan')
    const sampleSummarySection = sampleResume().sections[1]
    expect(sampleSummarySection).toBeDefined()
    expect(summaryText()).toBe((sampleSummarySection!.data as { text: string }).text)
  })
})

describe('ExperienceEditor', () => {
  it('entri pertama otomatis terbuka; ketik role & location menulis ke store', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    const role = card(container, 'exp-1').getByPlaceholderText(t('experience.rolePlaceholder'))
    expect(role).toHaveValue('Senior Software Engineer')
    await user.clear(role)
    await user.type(role, 'Staff Engineer')
    expect(experienceEntries()[0]?.role).toBe('Staff Engineer')

    const location = card(container, 'exp-1').getByPlaceholderText(
      t('experience.locationPlaceholder'),
    )
    await user.clear(location)
    await user.type(location, 'Remote')
    expect(experienceEntries()[0]?.location).toBe('Remote')
  })

  it('entri tersembunyi dibuka lewat header kartu (entry.expand)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    // exp-2 collapsed: body belum ada.
    expect(
      card(container, 'exp-2').queryByPlaceholderText(t('experience.rolePlaceholder')),
    ).toBeNull()

    await expandCard(user, container, 'exp-2')
    const company = card(container, 'exp-2').getByPlaceholderText(
      t('experience.companyPlaceholder'),
    )
    expect(company).toHaveValue('Kirana Digital')
    await user.clear(company)
    await user.type(company, 'Kirana Digital Tbk')
    expect(experienceEntries()[1]?.company).toBe('Kirana Digital Tbk')
    expect(
      card(container, 'exp-2').getByRole('button', { name: t('entry.collapse') }),
    ).toBeInTheDocument()
  })

  it('tombah entri baru, otomatis terbuka, lalu ketik ke entri baru', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    await user.click(screen.getByRole('button', { name: re(t('experience.addEntry')) }))
    expect(experienceEntries()).toHaveLength(3)

    const newId = experienceEntries()[2]!.id
    const role = card(container, newId).getByPlaceholderText(t('experience.rolePlaceholder'))
    await user.type(role, 'Intern')
    expect(experienceEntries()[2]?.role).toBe('Intern')
  })

  it('duplikat entri menyisipkan salinan dengan id baru', () => {
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    card(container, 'exp-1')
      .getByRole('button', { name: t('entry.duplicate') })
      .click()
    const entries = experienceEntries()
    expect(entries).toHaveLength(3)
    expect(entries[1]?.role).toBe('Senior Software Engineer')
    expect(entries[1]!.id).not.toBe('exp-1')
  })

  it('hapus entri berisi data butuh konfirmasi dialog (batal lalu hapus)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    await user.click(card(container, 'exp-1').getByRole('button', { name: t('entry.delete') }))
    expect(await screen.findByText(t('entry.deleteConfirmTitle'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('common.cancel') }))
    expect(experienceEntries()).toHaveLength(2)

    await user.click(card(container, 'exp-1').getByRole('button', { name: t('entry.delete') }))
    await user.click(await screen.findByRole('button', { name: t('common.delete') }))
    const entries = experienceEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('exp-2')
  })

  it('hapus entri kosong tanpa dialog konfirmasi', async () => {
    const user = userEvent.setup()
    store().addEntry(SAMPLE_IDS.experience)
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)
    const addedEntry = experienceEntries()[2]
    expect(addedEntry).toBeDefined()
    const newId = addedEntry!.id

    await user.click(card(container, newId).getByRole('button', { name: t('entry.delete') }))
    expect(experienceEntries()).toHaveLength(2)
    expect(screen.queryByText(t('entry.deleteConfirmTitle'))).toBeNull()
  })

  it('move up/down memanggil reorderEntry dan mengubah urutan store', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    // exp-1 di indeks 0 → move up disabled (cabang canMoveUp=false).
    expect(card(container, 'exp-1').getByRole('button', { name: t('entry.moveUp') })).toBeDisabled()

    await user.click(card(container, 'exp-2').getByRole('button', { name: t('entry.moveUp') }))
    expect(experienceEntries().map((entry) => entry.id)).toEqual(['exp-2', 'exp-1'])

    await user.click(card(container, 'exp-2').getByRole('button', { name: t('entry.moveDown') }))
    expect(experienceEntries().map((entry) => entry.id)).toEqual(['exp-1', 'exp-2'])
  })

  it('tanggal salah format memunculkan error Zod lewat DateRangeField', () => {
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    const start = card(container, 'exp-1').getByLabelText(t('experience.startDate'))
    within(container).getByText(t('experience.startDate'))
    Object.defineProperty(start, 'value', { value: '2022/04', configurable: true })
    start.dispatchEvent(new Event('input', { bubbles: true }))

    expect(within(container).getByRole('alert')).toHaveTextContent('YYYY-MM')
  })

  it('bullet: tambah lalu ketik menulis ke store; chips stack menerima Enter', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    await user.click(card(container, 'exp-1').getByRole('button', { name: /\+ Tambah bullet/ }))
    expect(experienceEntries()[0]?.bullets).toHaveLength(4)

    await user.type(
      card(container, 'exp-1').getByLabelText(t('bullet.textLabel', { n: 4 })),
      'Membangun pipeline CI baru.',
    )
    expect(experienceEntries()[0]?.bullets[3]).toBe('Membangun pipeline CI baru.')

    await user.type(
      card(container, 'exp-1').getByLabelText(t('experience.stackLabel')),
      'Go{Enter}',
    )
    expect(experienceEntries()[0]?.stack).toContain('Go')
  })

  it('current switch menulis current=true dan mengosongkan endDate', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceEditor sectionId={SAMPLE_IDS.experience} />)

    await expandCard(user, container, 'exp-2')
    await user.click(card(container, 'exp-2').getByLabelText(t('experience.current')))
    expect(experienceEntries()[1]?.current).toBe(true)
    expect(experienceEntries()[1]?.endDate).toBe('')
    expect(card(container, 'exp-2').getByText(t('experience.presentChip'))).toBeInTheDocument()
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<ExperienceEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<ExperienceEditor sectionId={SAMPLE_IDS.education} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('EducationEditor', () => {
  it('ketik gelar/institusi menulis ke store', async () => {
    const user = userEvent.setup()
    const { container } = render(<EducationEditor sectionId={SAMPLE_IDS.education} />)

    const degree = card(container, 'edu-1').getByPlaceholderText(t('education.degreePlaceholder'))
    await user.clear(degree)
    await user.type(degree, 'S.Kom')
    expect(educationEntries()[0]?.degree).toBe('S.Kom')

    const institution = card(container, 'edu-1').getByPlaceholderText(
      t('education.institutionPlaceholder'),
    )
    await user.clear(institution)
    await user.type(institution, 'Universitas Gadjah Mada')
    expect(educationEntries()[0]?.institution).toBe('Universitas Gadjah Mada')
  })

  it('IPK di luar 0.00–4.00 menampilkan error Zod; nilai valid menghapusnya', async () => {
    const user = userEvent.setup()
    const { container } = render(<EducationEditor sectionId={SAMPLE_IDS.education} />)

    const gpa = card(container, 'edu-1').getByLabelText(t('education.gpa'))
    await user.clear(gpa)
    await user.type(gpa, '4.5')
    expect(educationEntries()[0]?.gpa).toBe('4.5')
    expect(within(container).getByRole('alert')).toHaveTextContent('IPK harus antara 0.00')

    await user.clear(gpa)
    await user.type(gpa, '3.90')
    expect(within(container).queryByRole('alert')).toBeNull()
  })

  it('tambah & duplikat entri pendidikan', async () => {
    const user = userEvent.setup()
    const { container } = render(<EducationEditor sectionId={SAMPLE_IDS.education} />)

    await user.click(screen.getByRole('button', { name: re(t('education.addEntry')) }))
    expect(educationEntries()).toHaveLength(2)

    card(container, 'edu-1')
      .getByRole('button', { name: t('entry.duplicate') })
      .click()
    expect(educationEntries()).toHaveLength(3)
    expect(educationEntries()[1]?.institution).toBe('Institut Teknologi Bandung')
  })

  it('catatan (notes) lewat BulletListEditor menulis ke store', async () => {
    const user = userEvent.setup()
    const { container } = render(<EducationEditor sectionId={SAMPLE_IDS.education} />)

    await user.click(card(container, 'edu-1').getByRole('button', { name: /\+ Tambah bullet/ }))
    await user.type(
      card(container, 'edu-1').getByLabelText(t('bullet.textLabel', { n: 2 })),
      'Asisten laboratorium basis data.',
    )
    expect(educationEntries()[0]?.notes[1]).toBe('Asisten laboratorium basis data.')
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<EducationEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<EducationEditor sectionId={SAMPLE_IDS.skills} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('SkillsEditor', () => {
  it('ubah nama kelompok & tambah item chip lewat Enter', async () => {
    const user = userEvent.setup()
    render(<SkillsEditor sectionId={SAMPLE_IDS.skills} />)

    const nameInputs = screen.getAllByPlaceholderText(t('skills.groupNamePlaceholder'))
    await user.clear(nameInputs[0]!)
    await user.type(nameInputs[0]!, 'Stack Utama')
    expect(skillGroups()[0]?.name).toBe('Stack Utama')

    const itemInputs = screen.getAllByLabelText(t('skills.itemsLabel'))
    await user.type(itemInputs[0]!, 'Rust{Enter}')
    expect(skillGroups()[0]?.items).toContain('Rust')
  })

  it('tambah dan hapus kelompok', async () => {
    const user = userEvent.setup()
    render(<SkillsEditor sectionId={SAMPLE_IDS.skills} />)

    await user.click(screen.getByRole('button', { name: re(t('skills.addGroup')) }))
    expect(skillGroups()).toHaveLength(3)

    await user.click(screen.getAllByLabelText(t('skills.removeGroup'))[0]!)
    const groups = skillGroups()
    expect(groups).toHaveLength(2)
    expect(groups[0]?.id).toBe('skill-2')
  })

  it('empty state menawarkan tombol tambah kelompok; klik membuat kelompok pertama', async () => {
    const user = userEvent.setup()
    store().loadDoc(withSectionData('skills', { groups: [] }))
    render(<SkillsEditor sectionId={SAMPLE_IDS.skills} />)

    expect(screen.getByText(t('skills.emptyTitle'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: re(t('skills.addGroup')) }))
    expect(skillGroups()).toHaveLength(1)
    expect(skillGroups()[0]?.name).toBe('')
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<SkillsEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<SkillsEditor sectionId={SAMPLE_IDS.projects} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('ProjectsEditor', () => {
  it('ketik nama/peran menulis ke store', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProjectsEditor sectionId={SAMPLE_IDS.projects} />)

    const name = card(container, 'proj-1').getByPlaceholderText(t('projects.namePlaceholder'))
    await user.clear(name)
    await user.type(name, 'Transit API v2')
    expect(projectEntries()[0]?.name).toBe('Transit API v2')
  })

  it('blur URL menormalkan nilai tanpa scheme', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProjectsEditor sectionId={SAMPLE_IDS.projects} />)

    const url = card(container, 'proj-1').getByLabelText(t('projects.url'))
    await user.clear(url)
    await user.type(url, 'github.com/x')
    await user.tab()
    expect(projectEntries()[0]?.url).toBe('https://github.com/x')
  })

  it('URL berbahaya menampilkan pesan form.urlUnsafe', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProjectsEditor sectionId={SAMPLE_IDS.projects} />)

    const url = card(container, 'proj-1').getByLabelText(t('projects.url'))
    await user.clear(url)
    await user.type(url, 'javascript:alert(1)')
    expect(within(container).getByRole('alert')).toHaveTextContent(t('form.urlUnsafe'))
  })

  it('tambah & duplikat proyek', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProjectsEditor sectionId={SAMPLE_IDS.projects} />)

    await user.click(screen.getByRole('button', { name: re(t('projects.addEntry')) }))
    expect(projectEntries()).toHaveLength(2)

    card(container, 'proj-1')
      .getByRole('button', { name: t('entry.duplicate') })
      .click()
    expect(projectEntries()).toHaveLength(3)
    expect(projectEntries()[1]?.name).toBe('Open Transit API')
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<ProjectsEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<ProjectsEditor sectionId={SAMPLE_IDS.certifications} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('CertificationsEditor', () => {
  it('ketik nama/issuer/credentialId dan bulan terbit menulis ke store', async () => {
    const user = userEvent.setup()
    const { container } = render(<CertificationsEditor sectionId={SAMPLE_IDS.certifications} />)

    const name = card(container, 'cert-1').getByPlaceholderText(t('certifications.namePlaceholder'))
    await user.clear(name)
    await user.type(name, 'Google Cloud Professional')
    expect(certEntries()[0]?.name).toBe('Google Cloud Professional')

    const credential = card(container, 'cert-1').getByPlaceholderText(
      t('certifications.credentialIdPlaceholder'),
    )
    await user.clear(credential)
    await user.type(credential, 'GCP-99')
    expect(certEntries()[0]?.credentialId).toBe('GCP-99')

    const issued = card(container, 'cert-1').getByLabelText(t('certifications.issuedAt'))
    await user.clear(issued)
    await user.type(issued, '2024-01')
    expect(certEntries()[0]?.issuedAt).toBe('2024-01')
  })

  it('blur URL sertifikasi menormalkan nilai', async () => {
    const user = userEvent.setup()
    const { container } = render(<CertificationsEditor sectionId={SAMPLE_IDS.certifications} />)

    const url = card(container, 'cert-1').getByLabelText(t('certifications.url'))
    await user.clear(url)
    await user.type(url, 'site.example/cert')
    await user.tab()
    expect(certEntries()[0]?.url).toBe('https://site.example/cert')
  })

  it('tambah dan hapus sertifikasi', async () => {
    const user = userEvent.setup()
    const { container } = render(<CertificationsEditor sectionId={SAMPLE_IDS.certifications} />)

    await user.click(screen.getByRole('button', { name: re(t('certifications.addEntry')) }))
    expect(certEntries()).toHaveLength(2)

    // Entri kosong baru dibuat → hapus langsung tanpa dialog.
    const newId = certEntries()[1]!.id
    await user.click(card(container, newId).getByRole('button', { name: t('entry.delete') }))
    expect(certEntries()).toHaveLength(1)
    expect(certEntries()[0]?.id).toBe('cert-1')

    // Entri berisi data → dialog konfirmasi.
    await user.click(card(container, 'cert-1').getByRole('button', { name: t('entry.delete') }))
    await user.click(await screen.findByRole('button', { name: t('common.delete') }))
    expect(certEntries()).toHaveLength(0)
    expect(screen.getByText(t('certifications.emptyTitle'))).toBeInTheDocument()
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<CertificationsEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<CertificationsEditor sectionId={SAMPLE_IDS.languages} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('LanguagesEditor', () => {
  it('ketik nama dan ganti select kemahiran menulis ke store', async () => {
    const user = userEvent.setup()
    const { container } = render(<LanguagesEditor sectionId={SAMPLE_IDS.languages} />)

    const name = card(container, 'lang-1').getByPlaceholderText(t('languages.namePlaceholder'))
    await user.clear(name)
    await user.type(name, 'Bahasa Jawa')
    expect(languageEntries()[0]?.name).toBe('Bahasa Jawa')

    const select = card(container, 'lang-1').getByLabelText(re(t('languages.proficiency')))
    await user.selectOptions(select, 'Fluent')
    expect(languageEntries()[0]?.proficiency).toBe('Fluent')
  })

  it('duplikat entri dan hapus dengan pembatalan dialog', async () => {
    const user = userEvent.setup()
    const { container } = render(<LanguagesEditor sectionId={SAMPLE_IDS.languages} />)

    card(container, 'lang-1')
      .getByRole('button', { name: t('entry.duplicate') })
      .click()
    expect(languageEntries()).toHaveLength(3)

    await user.click(card(container, 'lang-1').getByRole('button', { name: t('entry.delete') }))
    await user.click(await screen.findByRole('button', { name: t('common.cancel') }))
    expect(languageEntries()).toHaveLength(3)
  })

  it('tambah dari daftar entri dan hapus entri kosong tanpa dialog', async () => {
    const user = userEvent.setup()
    store().loadDoc(withSectionData('languages', { entries: [] }))
    const { container } = render(<LanguagesEditor sectionId={SAMPLE_IDS.languages} />)

    expect(screen.getByText(t('languages.emptyTitle'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: re(t('languages.addEntry')) }))
    expect(languageEntries()).toHaveLength(1)

    const newId = languageEntries()[0]!.id
    await user.click(card(container, newId).getByRole('button', { name: t('entry.delete') }))
    expect(languageEntries()).toHaveLength(0)
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<LanguagesEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<LanguagesEditor sectionId={SAMPLE_IDS.awards} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('AwardsEditor', () => {
  it('empty state → tambah entri → ketik judul/issuer → bulan diperoleh → duplikat', async () => {
    const user = userEvent.setup()
    const { container } = render(<AwardsEditor sectionId={SAMPLE_IDS.awards} />)

    expect(screen.getByText(t('awards.emptyTitle'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: re(t('awards.addEntry')) }))
    expect(awardEntries()).toHaveLength(1)

    const newId = awardEntries()[0]!.id
    const title = card(container, newId).getByPlaceholderText(t('awards.titlePlaceholder'))
    await user.type(title, 'Hackathon Winner')
    expect(awardEntries()[0]?.title).toBe('Hackathon Winner')

    const issuer = card(container, newId).getByPlaceholderText(t('awards.issuerPlaceholder'))
    await user.type(issuer, 'Kementerian')
    expect(awardEntries()[0]?.issuer).toBe('Kementerian')

    const awarded = card(container, newId).getByLabelText(t('awards.awardedAt'))
    await user.type(awarded, '2024-05')
    expect(awardEntries()[0]?.awardedAt).toBe('2024-05')

    const description = card(container, newId).getByPlaceholderText(
      t('awards.descriptionPlaceholder'),
    )
    await user.type(description, 'Juara 1 kategori edukasi.')
    expect(awardEntries()[0]?.description).toBe('Juara 1 kategori edukasi.')

    card(container, newId)
      .getByRole('button', { name: t('entry.duplicate') })
      .click()
    expect(awardEntries()).toHaveLength(2)
    expect(awardEntries()[1]?.title).toBe('Hackathon Winner')
  })

  it('entri tanpa judul memakai placeholder entry.untitled pada header', async () => {
    const user = userEvent.setup()
    render(<AwardsEditor sectionId={SAMPLE_IDS.awards} />)

    await user.click(screen.getByRole('button', { name: re(t('awards.addEntry')) }))
    expect(screen.getByText(t('entry.untitled'))).toBeInTheDocument()
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<AwardsEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<AwardsEditor sectionId={SAMPLE_IDS.volunteering} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

describe('VolunteeringEditor', () => {
  it('tambah entri, isi role/organisasi, lalu hapus dengan konfirmasi', async () => {
    const user = userEvent.setup()
    const { container } = render(<VolunteeringEditor sectionId={SAMPLE_IDS.volunteering} />)

    expect(screen.getByText(t('volunteering.emptyTitle'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: re(t('volunteering.addEntry')) }))
    expect(volunteeringEntries()).toHaveLength(1)

    const newId = volunteeringEntries()[0]!.id
    const role = card(container, newId).getByPlaceholderText(t('volunteering.rolePlaceholder'))
    await user.type(role, 'Pengajar sukarela')
    expect(volunteeringEntries()[0]?.role).toBe('Pengajar sukarela')

    const org = card(container, newId).getByPlaceholderText(
      t('volunteering.organizationPlaceholder'),
    )
    await user.type(org, 'Yayasan Literasi')
    expect(volunteeringEntries()[0]?.organization).toBe('Yayasan Literasi')

    // Sekarang hasData=true → hapus butuh konfirmasi.
    await user.click(card(container, newId).getByRole('button', { name: t('entry.delete') }))
    await user.click(await screen.findByRole('button', { name: t('common.delete') }))
    expect(volunteeringEntries()).toHaveLength(0)
    expect(screen.getByText(t('volunteering.emptyTitle'))).toBeInTheDocument()
  })

  it('bullet kontribusi menulis ke store dan switch current mengosongkan endDate', async () => {
    const user = userEvent.setup()
    store().addEntry(SAMPLE_IDS.volunteering)
    const { container } = render(<VolunteeringEditor sectionId={SAMPLE_IDS.volunteering} />)
    const addedEntry = volunteeringEntries()[0]
    expect(addedEntry).toBeDefined()
    const newId = addedEntry!.id

    await user.click(card(container, newId).getByRole('button', { name: /\+ Tambah bullet/ }))
    await user.type(
      card(container, newId).getByLabelText(t('bullet.textLabel', { n: 1 })),
      'Mengajar 30 siswa tiap minggu.',
    )
    expect(volunteeringEntries()[0]?.bullets[0]).toBe('Mengajar 30 siswa tiap minggu.')

    const start = card(container, newId).getByLabelText(t('experience.startDate'))
    await user.type(start, '2023-01')
    const end = card(container, newId).getByLabelText(t('experience.endDate'))
    await user.type(end, '2023-12')
    await user.click(card(container, newId).getByLabelText(t('experience.current')))
    expect(volunteeringEntries()[0]?.current).toBe(true)
    expect(volunteeringEntries()[0]?.endDate).toBe('')
  })

  it('tidak merender apa pun untuk sectionId asing atau kind salah', () => {
    const wrongId = render(<VolunteeringEditor sectionId="s-tidak-ada" />)
    expect(wrongId.container).toBeEmptyDOMElement()
    wrongId.unmount()

    const wrongKind = render(<VolunteeringEditor sectionId={SAMPLE_IDS.awards} />)
    expect(wrongKind.container).toBeEmptyDOMElement()
  })
})

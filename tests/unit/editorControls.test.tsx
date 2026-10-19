import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { Briefcase } from 'lucide-react'
import { ChipsInput } from '@/features/editor/ChipsInput'
import { EntryCard } from '@/features/editor/EntryCard'
import { EntryList } from '@/features/editor/EntryList'
import { FirstRunCard } from '@/features/editor/FirstRunCard'
import { BulletListEditor } from '@/features/editor/BulletListEditor'
import { DateRangeField } from '@/features/editor/DateRangeField'
import { MonthPicker } from '@/features/editor/MonthPicker'
import { FIRST_RUN_KEY, writeValue } from '@/features/persistence/idb'
import { DOC_LIMITS } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { sampleResume } from '../fixtures/sampleResume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

vi.mock('@/features/persistence/idb', () => ({
  DOC_KEY: 'ats:doc:v1',
  PREFS_KEY: 'ats:prefs:v1',
  FIRST_RUN_KEY: 'ats:firstRun',
  corruptKey: (timestamp: number) => `ats:doc:corrupt:${timestamp}`,
  readValue: vi.fn(async () => undefined),
  writeValue: vi.fn(async () => undefined),
  quarantineCorruptDoc: vi.fn(async () => undefined),
}))

/**
 * Fase 9 — kontrol editor: ChipsInput, EntryCard, EntryList, FirstRunCard,
 * BulletListEditor, DateRangeField, MonthPicker. Komponen presentasional diuji
 * lewat harness/spy; FirstRunCard diuji terhadap store sungguhan.
 */

const store = () => useDocStore.getState()

beforeEach(() => {
  store().loadDoc(sampleResume())
  useUiStore.setState({ panelMode: '3col', activeTab: 'form', firstRunSeen: false })
  vi.mocked(writeValue).mockImplementation(async () => undefined)
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn()
})

// ---------- ChipsInput ----------

function ChipsHarness({ initial = [] }: { initial?: string[] }) {
  const [chips, setChips] = useState<string[]>(initial)
  return (
    <ChipsInput
      id="harness-chips"
      label="Stack"
      hint={t('common.optional')}
      chips={chips}
      onChange={setChips}
      placeholder={t('experience.stackPlaceholder')}
    />
  )
}

describe('ChipsInput', () => {
  it('Enter membuat chip baru dan mengosongkan input', async () => {
    const user = userEvent.setup()
    render(<ChipsHarness initial={['React']} />)

    const input = screen.getByLabelText('Stack')
    await user.type(input, 'TypeScript{Enter}')
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('koma juga membuat chip', async () => {
    const user = userEvent.setup()
    render(<ChipsHarness />)

    await user.type(screen.getByLabelText('Stack'), 'Node.js,')
    expect(screen.getByText('Node.js')).toBeInTheDocument()
  })

  it('Backspace pada input kosong menghapus chip terakhir', async () => {
    const user = userEvent.setup()
    render(<ChipsHarness initial={['React', 'Vue', 'Svelte']} />)

    const input = screen.getByLabelText('Stack')
    await user.click(input)
    await user.keyboard('{Backspace}')
    expect(screen.queryByText('Svelte')).toBeNull()
    expect(screen.getByText('Vue')).toBeInTheDocument()
  })

  it('chip duplikat dan input whitespace diabaikan', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipsInput id="spy-chips" chips={['React']} onChange={onChange} placeholder="tambah" />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'React{Enter}')
    expect(onChange).not.toHaveBeenCalled()

    await user.type(input, '   {Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tombol hapus chip (chip.remove) menghapus chip terkait', async () => {
    const user = userEvent.setup()
    render(<ChipsHarness initial={['React']} />)

    await user.click(screen.getByRole('button', { name: t('chip.remove', { name: 'React' }) }))
    expect(screen.queryByText('React')).toBeNull()
  })

  it('blur menambah teks yang masih tertinggal di input', async () => {
    const user = userEvent.setup()
    render(<ChipsHarness />)

    const input = screen.getByLabelText('Stack')
    await user.type(input, 'Go')
    await user.tab()
    expect(screen.getByText('Go')).toBeInTheDocument()
  })

  it('menampilkan error lewat role alert dan hint', () => {
    render(
      <ChipsInput id="err-chips" label="Stack" chips={[]} onChange={vi.fn()} error="Ada masalah" />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Ada masalah')
  })
})

// ---------- EntryCard ----------

type CardOverrides = Partial<{
  onToggleExpand: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}>

function CardHarness({
  hasData = true,
  expanded = false,
  ...overrides
}: { hasData?: boolean; expanded?: boolean } & CardOverrides) {
  return (
    <DndContext>
      <SortableContext items={['e1']} strategy={verticalListSortingStrategy}>
        <EntryCard
          id="e1"
          title="Senior Engineer"
          subtitle="Tech Nusantara · 2022-04"
          expanded={expanded}
          canMoveUp
          canMoveDown={false}
          hasData={hasData}
          onToggleExpand={() => undefined}
          onDuplicate={() => undefined}
          onDelete={() => undefined}
          onMoveUp={() => undefined}
          onMoveDown={() => undefined}
          {...overrides}
        >
          <p>isi body kartu</p>
        </EntryCard>
      </SortableContext>
    </DndContext>
  )
}

describe('EntryCard', () => {
  it('collapsed menyembunyikan body; klik header memanggil onToggleExpand', async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    render(<CardHarness onToggleExpand={onToggleExpand} />)

    expect(screen.queryByText('isi body kartu')).toBeNull()
    const header = screen.getByRole('button', { name: t('entry.expand') })
    expect(header).toHaveAttribute('aria-expanded', 'false')

    await user.click(header)
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })

  it('expanded merender body dengan aria-label collapse', () => {
    render(<CardHarness expanded />)
    expect(screen.getByText('isi body kartu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('entry.collapse') })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('Enter dan spasi pada header fokus memicu toggle', async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    const { container } = render(<CardHarness onToggleExpand={onToggleExpand} />)

    const header = screen.getByRole('button', { name: t('entry.expand') })
    header.focus()
    await user.keyboard('{Enter}')
    expect(onToggleExpand).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(container.querySelector('[role="button"][tabindex="0"]')!, { key: ' ' })
    expect(onToggleExpand).toHaveBeenCalledTimes(2)

    // Tombol drag (bukan Enter/spasi) tidak memicu toggle.
    fireEvent.keyDown(container.querySelector('[role="button"][tabindex="0"]')!, { key: 'a' })
    expect(onToggleExpand).toHaveBeenCalledTimes(2)
  })

  it('move up memanggil callback; move down disabled saat canMoveDown=false', async () => {
    const user = userEvent.setup()
    const onMoveUp = vi.fn()
    render(<CardHarness onMoveUp={onMoveUp} />)

    await user.click(screen.getByRole('button', { name: t('entry.moveUp') }))
    expect(onMoveUp).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: t('entry.moveDown') })).toBeDisabled()
  })

  it('duplikat memanggil onDuplicate tanpa memicu toggle header', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn()
    const onToggleExpand = vi.fn()
    render(<CardHarness onDuplicate={onDuplicate} onToggleExpand={onToggleExpand} />)

    await user.click(screen.getByRole('button', { name: t('entry.duplicate') }))
    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(onToggleExpand).not.toHaveBeenCalled()
  })

  it('hapus dengan data lewat dialog: batal tidak menghapus, konfirmasi menghapus', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<CardHarness onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: t('entry.delete') }))
    expect(await screen.findByText(t('entry.deleteConfirmTitle'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('common.cancel') }))
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: t('entry.delete') }))
    await user.click(await screen.findByRole('button', { name: t('common.delete') }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
  })

  it('hapus entri kosong memanggil onDelete langsung tanpa dialog', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<CardHarness hasData={false} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: t('entry.delete') }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(t('entry.deleteConfirmTitle'))).toBeNull()
  })

  it('judul kosong memakai entry.untitled; error menampilkan badge entry.issues', () => {
    render(
      <DndContext>
        <SortableContext items={['e1']} strategy={verticalListSortingStrategy}>
          <EntryCard
            id="e1"
            title=""
            expanded
            canMoveUp={false}
            canMoveDown
            hasError
            errorCount={2}
            onToggleExpand={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
            onMoveUp={() => undefined}
            onMoveDown={() => undefined}
          >
            <p>body</p>
          </EntryCard>
        </SortableContext>
      </DndContext>,
    )

    expect(screen.getByText(t('entry.untitled'))).toBeInTheDocument()
    expect(screen.getByText(t('entry.issues', { count: 2 }))).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('entry.moveUp') })).toBeDisabled()
  })
})

// ---------- EntryList ----------

type FakeEntry = { id: string; label: string }

function ListHarness({
  entries,
  onAdd,
  onReorder,
}: {
  entries: FakeEntry[]
  onAdd: () => void
  onReorder: (from: number, to: number) => void
}) {
  return (
    <EntryList
      entries={entries}
      onAdd={onAdd}
      onReorder={onReorder}
      addLabel={t('experience.addEntry')}
      emptyIcon={Briefcase}
      emptyTitle={t('experience.emptyTitle')}
      emptyBody={t('experience.emptyBody')}
      renderEntry={(entry, _index, isExpanded) => (
        <div key={entry.id} data-marker={entry.id} data-expanded={String(isExpanded)}>
          {entry.label}
        </div>
      )}
    />
  )
}

describe('EntryList', () => {
  it('empty state menampilkan ajakan menambah; klik memanggil onAdd', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ListHarness entries={[]} onAdd={onAdd} onReorder={vi.fn()} />)

    expect(screen.getByText(t('experience.emptyTitle'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /\+ Tambah pekerjaan/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('entri pertama default terbuka; entri yang baru muncul otomatis terbuka', async () => {
    const first: FakeEntry[] = [{ id: 'a1', label: 'satu' }]
    const { rerender } = render(<ListHarness entries={first} onAdd={vi.fn()} onReorder={vi.fn()} />)
    expect(document.querySelector('[data-marker="a1"]')).toHaveAttribute('data-expanded', 'true')

    rerender(
      <ListHarness
        entries={[...first, { id: 'a2', label: 'dua' }]}
        onAdd={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(document.querySelector('[data-marker="a2"]')).toHaveAttribute('data-expanded', 'true'),
    )
    expect(document.querySelector('[data-marker="a1"]')).toHaveAttribute('data-expanded', 'false')
  })

  it('pada batas DOC_LIMITS tombol tambah disabled dan hint limits.entries tampil', () => {
    const entries = Array.from({ length: DOC_LIMITS.entriesPerSection }, (_, i) => ({
      id: `x${i}`,
      label: `entri ${i}`,
    }))
    render(<ListHarness entries={entries} onAdd={vi.fn()} onReorder={vi.fn()} />)

    expect(screen.getByRole('button', { name: /\+ Tambah pekerjaan/ })).toBeDisabled()
    expect(
      screen.getByText(t('limits.entries', { max: DOC_LIMITS.entriesPerSection })),
    ).toBeInTheDocument()
  })

  it('di bawah batas tidak menampilkan hint', () => {
    render(
      <ListHarness
        entries={[
          { id: 'a1', label: 'satu' },
          { id: 'a2', label: 'dua' },
        ]}
        onAdd={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    expect(
      screen.queryByText(t('limits.entries', { max: DOC_LIMITS.entriesPerSection })),
    ).toBeNull()
    expect(screen.getByRole('button', { name: /\+ Tambah pekerjaan/ })).toBeEnabled()
  })
})

// ---------- FirstRunCard ----------

describe('FirstRunCard', () => {
  const radiogroup = () => screen.getByRole('radiogroup', { name: t('firstRun.eyebrow') })

  it('default opsi contoh; lanjut menandai first-run dan menyimpan flag tanpa mengubah dokumen', async () => {
    const user = userEvent.setup()
    render(<FirstRunCard />)

    expect(
      within(radiogroup()).getByRole('radio', { name: new RegExp(t('firstRun.sampleTitle')) }),
    ).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: new RegExp(t('firstRun.continue')) }))
    expect(toast).toHaveBeenCalledWith(t('firstRun.sampleToast'))
    expect(useUiStore.getState().firstRunSeen).toBe(true)
    await waitFor(() => expect(writeValue).toHaveBeenCalledWith(FIRST_RUN_KEY, true))
    expect(store().doc.title).toBe(sampleResume().title)
  })

  it('opsi kosong membuat dokumen baru via resetDoc(createEmptyDoc())', async () => {
    const user = userEvent.setup()
    render(<FirstRunCard />)

    await user.click(
      within(radiogroup()).getByRole('radio', { name: new RegExp(t('firstRun.emptyTitle')) }),
    )
    await user.click(screen.getByRole('button', { name: new RegExp(t('firstRun.continue')) }))

    expect(toast).toHaveBeenCalledWith(t('firstRun.emptyToast'))
    expect(store().doc.title).toBe('')
    const experience = store().doc.sections.find((section) => section.kind === 'experience')
    expect((experience!.data as { entries: unknown[] }).entries).toHaveLength(0)
    expect(useUiStore.getState().firstRunSeen).toBe(true)
  })

  it('opsi nanti saja menutup kartu tanpa toast dan tanpa reset dokumen', async () => {
    const user = userEvent.setup()
    render(<FirstRunCard />)

    await user.click(
      within(radiogroup()).getByRole('radio', { name: new RegExp(t('firstRun.laterTitle')) }),
    )
    await user.click(screen.getByRole('button', { name: new RegExp(t('firstRun.continue')) }))

    expect(toast).not.toHaveBeenCalled()
    expect(useUiStore.getState().firstRunSeen).toBe(true)
    expect(store().doc.id).toBe(sampleResume().id)
  })

  it('gagal menulis flag tidak menghentikan alur', async () => {
    vi.mocked(writeValue).mockRejectedValue(new Error('quota'))
    const user = userEvent.setup()
    render(<FirstRunCard />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('firstRun.continue')) }))
    await waitFor(() => expect(useUiStore.getState().firstRunSeen).toBe(true))
  })
})

// ---------- BulletListEditor ----------

describe('BulletListEditor', () => {
  function BulletHarness({ initial }: { initial: string[] }) {
    const [bullets, setBullets] = useState<string[]>(initial)
    return (
      <BulletListEditor idPrefix="h" bullets={bullets} onChange={setBullets} label="Pencapaian" />
    )
  }

  it('tambah bullet mengakhiri daftar dengan item kosong', async () => {
    const user = userEvent.setup()
    render(<BulletHarness initial={['satu']} />)

    await user.click(screen.getByRole('button', { name: /\+ Tambah bullet/ }))
    expect(screen.getByLabelText(t('bullet.textLabel', { n: 2 }))).toHaveValue('')
  })

  it('mengetik mengubah teks bullet pada indeks terkait', async () => {
    const user = userEvent.setup()
    render(<BulletHarness initial={['satu', 'dua']} />)

    await user.type(screen.getByLabelText(t('bullet.textLabel', { n: 1 })), '!')
    expect(screen.getByLabelText(t('bullet.textLabel', { n: 1 }))).toHaveValue('satu!')
  })

  it('hapus dan move up/down memanggil onChange dengan daftar baru', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BulletListEditor idPrefix="h" bullets={['satu', 'dua', 'tiga']} onChange={onChange} />)

    const ups = screen.getAllByRole('button', { name: t('bullet.moveUp') })
    const downs = screen.getAllByRole('button', { name: t('bullet.moveDown') })
    expect(ups[0]).toBeDisabled()
    expect(downs[2]).toBeDisabled()

    await user.click(downs[0]!)
    expect(onChange).toHaveBeenLastCalledWith(['dua', 'satu', 'tiga'])

    onChange.mockClear()
    await user.click(screen.getAllByRole('button', { name: t('bullet.remove') })[1]!)
    expect(onChange).toHaveBeenLastCalledWith(['satu', 'tiga'])
  })

  it('tempel banyak baris memecah teks menjadi beberapa bullet', async () => {
    const user = userEvent.setup()
    render(<BulletHarness initial={['target']} />)

    await user.click(screen.getByLabelText(t('bullet.textLabel', { n: 1 })))
    await user.paste('Memimpin tim rilis\nMembangun dashboard 24 metrik\nMentoring 3 engineer')
    expect(screen.getByLabelText(t('bullet.textLabel', { n: 1 }))).toHaveValue('Memimpin tim rilis')
    expect(screen.getByLabelText(t('bullet.textLabel', { n: 3 }))).toHaveValue(
      'Mentoring 3 engineer',
    )
  })

  it('hint metric tampil untuk bullet berawalan kata kerja tanpa angka', () => {
    render(
      <BulletListEditor
        idPrefix="h"
        bullets={['membangun sistem anotasi data medis lintas rumah sakit']}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(t('bullet.metricHint'))).toBeInTheDocument()
  })

  it('hint verb tampil saat bullet panjang tidak berawalan kata kerja aksi', () => {
    render(
      <BulletListEditor
        idPrefix="h"
        bullets={['teks biasa tanpa kata kerja aksi yang lumayan panjang']}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(t('bullet.verbHint'))).toBeInTheDocument()
  })

  it('penghitung karakter menandai tooShort dan tooLong', () => {
    const re = (value: string): RegExp => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    const { unmount } = render(
      <BulletListEditor idPrefix="h" bullets={['pendek']} onChange={vi.fn()} />,
    )
    expect(screen.getByText(re(t('bullet.tooShort')))).toBeInTheDocument()
    unmount()

    render(<BulletListEditor idPrefix="h" bullets={[`x${'y'.repeat(201)}`]} onChange={vi.fn()} />)
    expect(screen.getByText(re(t('bullet.tooLong')))).toBeInTheDocument()
  })

  it('bullet kosong tidak menampilkan penghitung maupun hint', () => {
    render(<BulletListEditor idPrefix="h" bullets={['']} onChange={vi.fn()} />)
    expect(screen.queryByText(t('bullet.tooShort'))).toBeNull()
    expect(screen.queryByText(t('bullet.verbHint'))).toBeNull()
  })
})

// ---------- DateRangeField ----------

describe('DateRangeField', () => {
  it('label default pengalaman dipakai saat label kustom absen', () => {
    render(
      <DateRangeField
        idPrefix="dr"
        startDate="2020-01"
        endDate="2021-02"
        current={false}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onCurrentChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(t('experience.startDate'))).toHaveValue('2020-01')
    expect(screen.getByLabelText(t('experience.endDate'))).toHaveValue('2021-02')
    expect(screen.getByLabelText(t('experience.current'))).toBeInTheDocument()
  })

  it('memakai label kustom saat diberikan', () => {
    render(
      <DateRangeField
        idPrefix="dr"
        startDate=""
        endDate=""
        current={false}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onCurrentChange={vi.fn()}
        startLabel="Mulai magang"
        endLabel="Selesai magang"
        currentLabel="Masih berjalan"
      />,
    )
    expect(screen.getByLabelText('Mulai magang')).toBeInTheDocument()
    expect(screen.getByLabelText('Selesai magang')).toBeInTheDocument()
    expect(screen.getByLabelText('Masih berjalan')).toBeInTheDocument()
  })

  it('perubahan bulan memanggil callback terkait', async () => {
    const user = userEvent.setup()
    const onStartDateChange = vi.fn()
    render(
      <DateRangeField
        idPrefix="dr"
        startDate=""
        endDate=""
        current={false}
        onStartDateChange={onStartDateChange}
        onEndDateChange={vi.fn()}
        onCurrentChange={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText(t('experience.startDate')), '2024-03')
    expect(onStartDateChange).toHaveBeenLastCalledWith('2024-03')
  })

  it('current=true menampilkan chip SEKARANG dan menonaktifkan picker akhir', () => {
    render(
      <DateRangeField
        idPrefix="dr"
        startDate="2020-01"
        endDate="2021-02"
        current
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onCurrentChange={vi.fn()}
      />,
    )
    expect(screen.getByText(t('experience.presentChip'))).toBeInTheDocument()
    expect(screen.getByLabelText(t('experience.endDate'))).toBeDisabled()
    expect(screen.getByLabelText(t('experience.endDate'))).toHaveValue('')
  })

  it('switch memanggil onCurrentChange', async () => {
    const user = userEvent.setup()
    const onCurrentChange = vi.fn()
    render(
      <DateRangeField
        idPrefix="dr"
        startDate=""
        endDate=""
        current={false}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onCurrentChange={onCurrentChange}
      />,
    )
    await user.click(screen.getByLabelText(t('experience.current')))
    expect(onCurrentChange).toHaveBeenCalledWith(true)
  })

  it('error tampil sebagai alert dan menandai aria-invalid pada picker', () => {
    render(
      <DateRangeField
        idPrefix="dr"
        startDate="salah"
        endDate=""
        current={false}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onCurrentChange={vi.fn()}
        error="Tanggal harus format YYYY-MM."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('YYYY-MM')
    expect(screen.getByLabelText(t('experience.startDate'))).toHaveAttribute('aria-invalid', 'true')
  })
})

// ---------- MonthPicker ----------

describe('MonthPicker', () => {
  it('merender input dengan nilai awal dan memanggil onChange saat berubah', () => {
    const onChange = vi.fn()
    render(<MonthPicker id="mp" value="2024-06" onChange={onChange} />)
    const input = document.getElementById('mp') as HTMLInputElement
    expect(input).toHaveValue('2024-06')
    fireEvent.change(input, { target: { value: '2025-01' } })
    expect(onChange).toHaveBeenCalledWith('2025-01')
  })

  it('meneruskan disabled, className, dan aria-describedby/aria-invalid', () => {
    render(
      <MonthPicker
        id="mp2"
        value=""
        onChange={vi.fn()}
        disabled
        className="ekstra"
        aria-describedby="help"
        aria-invalid
      />,
    )
    const input = document.getElementById('mp2') as HTMLInputElement
    expect(input).toBeDisabled()
    expect(input).toHaveClass('ekstra')
    expect(input).toHaveAttribute('aria-describedby', 'help')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})

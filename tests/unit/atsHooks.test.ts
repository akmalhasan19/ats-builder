import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildReport, docSignature } from '@/features/ats/engine'
import { runAtsCheck } from '@/features/ats/runCheck'
import { useAtsAutoCheck, useOpenAtsDrawer } from '@/features/ats/useAtsCheck'
import { ATS_DOCK_MIN, useAtsDocked } from '@/features/ats/useAtsDock'
import { firstSkillGroupFieldId } from '@/features/ats/fieldTargets'
import { focusTarget } from '@/features/ats/focusTarget'
import { clockLabel } from '@/features/ats/clock'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { SAMPLE_IDS, sampleResume } from '../fixtures/sampleResume'
import type { ResumeDoc } from '@/types/resume'

/**
 * T9.x — hook & pintu eksekusi pemeriksaan ATS.
 * Semua timer dikendalikan (fake timers / pompa `requestAnimationFrame` manual)
 * supaya debounce 1500ms, tahan-scan 700ms, dan batas 20 frame bisa dibuktikan
 * secara deterministik, bukan lewat `waitFor` yang longgar.
 */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const DOCK_QUERY = `(min-width: ${ATS_DOCK_MIN}px)`

type FakeMediaList = {
  media: string
  matches: boolean
  change: (matches: boolean) => void
  listenerCount: () => number
}

/** Stub `window.matchMedia`; setiap query punya daftar listener yang tercatat. */
function stubMedia(initial: Record<string, boolean>): Record<string, FakeMediaList> {
  const handles: Record<string, FakeMediaList> = {}
  const impl = (query: string) => {
    const listeners = new Set<(event: { matches: boolean }) => void>()
    const list: FakeMediaList = {
      media: query,
      matches: initial[query] === true,
      change: (matches: boolean) => {
        list.matches = matches
        for (const listener of listeners) listener({ matches })
      },
      listenerCount: () => listeners.size,
    }
    handles[query] = list
    const media = list as FakeMediaList & {
      addEventListener: (type: string, cb: (event: { matches: boolean }) => void) => void
      removeEventListener: (type: string, cb: (event: { matches: boolean }) => void) => void
    }
    media.addEventListener = (_type, cb) => {
      listeners.add(cb)
    }
    media.removeEventListener = (_type, cb) => {
      listeners.delete(cb)
    }
    return media
  }
  vi.stubGlobal('matchMedia', impl)
  return handles
}

/** Antrean frame manual: tidak ada satu pun callback jalan sebelum `pump()`. */
function stubFrames(): {
  callbacks: () => number
  pump: (times?: number) => void
  cancel: ReturnType<typeof vi.fn>
} {
  const queue: Array<{ id: number; cb: FrameRequestCallback }> = []
  let nextId = 1
  const request = (cb: FrameRequestCallback): number => {
    const id = nextId++
    queue.push({ id, cb })
    return id
  }
  const cancel = vi.fn((id: number) => {
    const index = queue.findIndex((frame) => frame.id === id)
    if (index >= 0) queue.splice(index, 1)
  })
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', cancel)
  return {
    callbacks: () => queue.length,
    pump: (times = 1) => {
      for (let frame = 0; frame < times; frame += 1) {
        const pending = queue.splice(0, queue.length)
        if (pending.length === 0) return
        for (const item of pending) item.cb(performance.now())
      }
    },
    cancel,
  }
}

const docWithout = (kind: string): ResumeDoc => ({
  ...sampleResume(),
  sections: sampleResume().sections.filter((section) => section.kind !== kind),
})

beforeEach(() => {
  useDocStore.getState().loadDoc(sampleResume())
  useUiStore.setState({
    atsDrawerOpen: true,
    atsTab: 'issues',
    panelMode: '3col',
    activeTab: 'form',
  })
  useAtsStore.setState({
    report: null,
    isChecking: false,
    hasOpened: false,
    lastCheckedAt: null,
    keywords: [],
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('runCheck.ts — satu pintu eksekusi', () => {
  it('mengisi report, mematikan isChecking, dan mencatat meta.lastCheckedAt di dokumen', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 10, 14, 32, 0))

    const promise = runAtsCheck(3)
    expect(useAtsStore.getState().isChecking).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    await promise

    const state = useAtsStore.getState()
    expect(state.isChecking).toBe(false)
    expect(state.report?.pageCount).toBe(3)
    expect(state.report?.checkedAt).toBe(Date.now())
    expect(state.lastCheckedAt).toBe(Date.now())
    expect(useDocStore.getState().doc.meta.lastCheckedAt).toBe(Date.now())
    expect(state.keywords).toEqual(state.report?.keywords?.matched ?? [])
  })

  it('menahan status memeriksa ~700ms saat motion menyala, langsung saat reduced motion', async () => {
    stubMedia({ [REDUCED_MOTION]: false })
    vi.useFakeTimers()
    let finished = false
    runAtsCheck(2).then(() => {
      finished = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(useAtsStore.getState().isChecking).toBe(true)
    await vi.advanceTimersByTimeAsync(600)
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(finished).toBe(true)
    expect(useAtsStore.getState().isChecking).toBe(false)

    stubMedia({ [REDUCED_MOTION]: true })
    useAtsStore.setState({ report: null, isChecking: false })
    const fast = runAtsCheck(2)
    await vi.advanceTimersByTimeAsync(0)
    await fast
    expect(useAtsStore.getState().report).not.toBeNull()
  })

  it('pemeriksaan yang sudah makan waktu > SCAN_MS tidak ditahan lagi', async () => {
    stubMedia({ [REDUCED_MOTION]: false })
    vi.useFakeTimers()
    const t0 = new Date(2026, 4, 1, 10, 0, 0).getTime()
    vi.setSystemTime(t0)
    // Satu timer 0ms yang dipasang lebih dulu memajukan jam sampai 1000ms, jadi
    // `remaining = SCAN_MS - 1000` negatif dan tahan sapuan dilewati.
    window.setTimeout(() => vi.setSystemTime(t0 + 1000), 0)

    let finished = false
    const promise = runAtsCheck(2)
    promise.then(() => {
      finished = true
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)

    expect(Date.now()).toBe(t0 + 1000)
    expect(finished).toBe(true)
    expect(useAtsStore.getState().isChecking).toBe(false)
    expect(useAtsStore.getState().report?.checkedAt).toBe(t0 + 1000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pemeriksaan kedua dilewati selagi yang pertama jalan (guard isChecking)', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    useAtsStore.setState({ isChecking: true })
    const before = useDocStore.getState().doc
    await runAtsCheck(2)
    expect(useAtsStore.getState().isChecking).toBe(true)
    expect(useAtsStore.getState().report).toBeNull()
    expect(useDocStore.getState().doc).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('report identik dengan buildReport untuk dokumen & halaman yang sama', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0))
    const promise = runAtsCheck(2)
    await vi.advanceTimersByTimeAsync(0)
    await promise
    const expected = buildReport(useDocStore.getState().doc, 2, Date.now())
    expect(useAtsStore.getState().report?.issues.map((issue) => issue.id)).toEqual(
      expected.issues.map((issue) => issue.id),
    )
    expect(useAtsStore.getState().report?.score).toBe(expected.score)
  })
})

describe('engine.docSignature — cache pemeriksaan', () => {
  it('mengabaikan seluruh meta, termasuk lastCheckedAt yang ditulis checker', () => {
    const doc = sampleResume()
    const afterCheck: ResumeDoc = {
      ...doc,
      meta: { createdAt: 1, updatedAt: 2, lastCheckedAt: 3 },
    }
    expect(docSignature(afterCheck)).toBe(docSignature({ ...doc, meta: doc.meta }))
    expect(docSignature({ ...doc, title: 'Judul baru' })).not.toBe(docSignature(doc))
  })

  it('perubahan isi dokumen menghasilkan signature berbeda → pemeriksaan jalan lagi', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    const first = runAtsCheck(2)
    await vi.advanceTimersByTimeAsync(0)
    await first
    const signatureBefore = docSignature(useDocStore.getState().doc)
    useDocStore.getState().setTitle('CV diubah setelah pemeriksaan')
    const signatureAfter = docSignature(useDocStore.getState().doc)
    expect(signatureAfter).not.toBe(signatureBefore)
    expect(useDocStore.getState().doc.title).toBe('CV diubah setelah pemeriksaan')
  })

  it('penulisan meta.lastCheckedAt tidak mengubah signature (tanpa loop tak berujung)', () => {
    const doc = sampleResume()
    const before = docSignature(doc)
    useDocStore.getState().loadDoc(doc)
    useDocStore.getState().setLastCheckedAt(123456)
    expect(docSignature(useDocStore.getState().doc)).toBe(before)
    expect(useDocStore.getState().doc.meta.lastCheckedAt).toBe(123456)
  })
})

describe('useAtsCheck — re-check otomatis ber-debounce', () => {
  it('drawer belum pernah dibuka → tidak ada timer & tidak ada pemeriksaan', () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    useAtsStore.setState({ hasOpened: false })
    const { unmount } = renderHook(() => useAtsAutoCheck(2))
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(useAtsStore.getState().report).toBeNull()
    expect(useAtsStore.getState().lastCheckedAt).toBeNull()
    unmount()
  })

  it('drawer pernah dibuka → jalan tepat setelah 1500ms, bukan sebelumnya', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    useAtsStore.setState({ hasOpened: true })
    const { unmount } = renderHook(() => useAtsAutoCheck(2))
    vi.advanceTimersByTime(1499)
    expect(useAtsStore.getState().report).toBeNull()
    expect(useAtsStore.getState().isChecking).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    // Pintu pemeriksaan menahan status "memeriksa" satu tick lagi.
    expect(useAtsStore.getState().isChecking).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    expect(useAtsStore.getState().report?.pageCount).toBe(2)
    expect(useAtsStore.getState().isChecking).toBe(false)
    unmount()
  })

  it('setiap ketikan mengulang debounce 1500ms dari nol', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    useAtsStore.setState({ hasOpened: true })
    const doc = sampleResume()
    useDocStore.getState().loadDoc(doc)
    const { unmount, rerender } = renderHook(
      ({ pages }: { pages: number }) => useAtsAutoCheck(pages),
      {
        initialProps: { pages: 2 },
      },
    )
    vi.advanceTimersByTime(1000)
    act(() => {
      useDocStore.getState().setTitle('Judul tengah diketik')
    })
    rerender({ pages: 2 })
    // 1000ms sebelum edit + 500ms sesudahnya: total sudah melewati 1500ms,
    // tetapi timer lama dibuang, jadi belum boleh ada pemeriksaan.
    vi.advanceTimersByTime(500)
    expect(useAtsStore.getState().report).toBeNull()
    expect(useAtsStore.getState().isChecking).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(50)
    expect(useAtsStore.getState().report?.pageCount).toBe(2)
    unmount()
  })

  it('penulisan meta.lastCheckedAt tidak memicu pemeriksaan kedua; perubahan isi memicu', async () => {
    stubMedia({ [REDUCED_MOTION]: true })
    vi.useFakeTimers()
    useAtsStore.setState({ hasOpened: true })
    const { unmount, rerender } = renderHook(() => useAtsAutoCheck(2))
    await vi.advanceTimersByTimeAsync(1600)
    const first = useAtsStore.getState().report
    expect(first).not.toBeNull()

    // Meta ditulis oleh pemeriksaan itu sendiri → signature sama → effect tidak
    // dijalankan ulang, jadi maju waktu sejauh apa pun tidak menghasilkan report baru.
    vi.advanceTimersByTime(10_000)
    expect(useAtsStore.getState().report).toBe(first)
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      useDocStore.getState().setTitle('Isi dokumen benar-benar berubah')
    })
    rerender()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(1600)
    expect(useAtsStore.getState().report).not.toBe(first)
    unmount()
  })

  it('useOpenAtsDrawer menandai pernah dibuka lalu membuka drawer', () => {
    useUiStore.setState({ atsDrawerOpen: false })
    useAtsStore.setState({ hasOpened: false })
    const { result } = renderHook(() => useOpenAtsDrawer())
    act(() => result.current())
    expect(useAtsStore.getState().hasOpened).toBe(true)
    expect(useUiStore.getState().atsDrawerOpen).toBe(true)
  })
})

describe('useAtsDock — dock ≥1600px vs overlay', () => {
  it('≥1600px → docked, dan perubahan media query ikut diikuti', () => {
    const handles = stubMedia({ [DOCK_QUERY]: true })
    const { result, unmount } = renderHook(() => useAtsDocked())
    expect(result.current).toBe(true)
    const list = handles[DOCK_QUERY]
    expect(list).toBeDefined()
    expect(list?.media).toBe(DOCK_QUERY)
    expect(list?.listenerCount()).toBe(1)
    act(() => list?.change(false))
    expect(result.current).toBe(false)
    act(() => unmount())
    expect(list?.listenerCount()).toBe(0)
  })

  it('<1600px → overlay (docked false) sejak render pertama', () => {
    const handles = stubMedia({ [DOCK_QUERY]: false })
    const { result } = renderHook(() => useAtsDocked())
    expect(result.current).toBe(false)
    act(() => handles[DOCK_QUERY]?.change(true))
    expect(result.current).toBe(true)
  })

  it('tanpa matchMedia (lingkungan lama) → tidak melempar, tetap overlay', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useAtsDocked())
    expect(result.current).toBe(false)
  })
})

describe('fieldTargets — pemetaan isu → id field form', () => {
  it('grup keahlian pertama → `skill-group-<id>-items`', () => {
    expect(firstSkillGroupFieldId(sampleResume().sections)).toBe('skill-group-skill-1-items')
  })

  it('dokumen tanpa bagian skills → string kosong', () => {
    expect(firstSkillGroupFieldId(docWithout('skills').sections)).toBe('')
  })

  it('bagian skills tanpa grup → string kosong', () => {
    const sections: readonly { kind: string; data: unknown }[] = [{ kind: 'skills', data: {} }]
    expect(firstSkillGroupFieldId(sections)).toBe('')
    const emptyGroups: readonly { kind: string; data: unknown }[] = [
      { kind: 'skills', data: { groups: [] } },
    ]
    expect(firstSkillGroupFieldId(emptyGroups)).toBe('')
  })
})

/** DOM mentah (tanpa JSX) — berkas ini `.ts`, jadi field dibuat imperatif. */
function mount(html: string): HTMLDivElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

describe('focusTarget — cabang pencarian field', () => {
  let scroll = vi.fn()

  beforeEach(() => {
    scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: scroll,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('field ditemukan pada frame pertama → fokus, flash di shell, drawer ditutup', () => {
    const frames = stubFrames()
    const host = mount(
      '<div data-field-shell><input id="profile-email" value="alex@mail.com" /></div>',
    )
    const closeDrawer = vi.fn()
    const setActiveSection = vi.fn()
    const setActiveTab = vi.fn()

    focusTarget(
      { sectionId: SAMPLE_IDS.profile, field: 'profile-email' },
      { setActiveSection, setActiveTab, closeDrawer, shouldCloseDrawer: true },
    )
    // Navigasi bagian/tab ditulis segera; pencarian field yang menyusul per frame.
    expect(document.activeElement?.id ?? '').toBe('')
    expect(frames.callbacks()).toBe(1)
    frames.pump()

    expect(closeDrawer).toHaveBeenCalledTimes(1)
    expect(setActiveSection).toHaveBeenCalledWith(SAMPLE_IDS.profile)
    expect(setActiveTab).toHaveBeenCalledWith('form')
    expect(document.activeElement?.id).toBe('profile-email')
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(host.querySelector('[data-field-shell]')?.classList.contains('ats-field-flash')).toBe(
      true,
    )
    expect(frames.callbacks()).toBe(0)
  })

  it('field muncul setelah kartu entri dibuka → frame berikutnya menemukan elemennya', () => {
    const frames = stubFrames()
    mount(
      '<div id="pane-form"><div data-entry-id="exp-1"><button type="button" role="button" aria-expanded="false">Buka</button></div></div>',
    )
    const header = document.querySelector<HTMLButtonElement>('[role="button"]')
    if (!header) throw new Error('header kartu tidak ada')
    // Kartu diciutkan: field baru ditulis ke DOM saat header diklik.
    header.addEventListener('click', () => {
      const input = document.createElement('input')
      input.id = 'exp-1-bullet-0'
      document.body.appendChild(input)
      header.setAttribute('aria-expanded', 'true')
    })

    focusTarget(
      { sectionId: SAMPLE_IDS.experience, entryId: 'exp-1', field: 'exp-1-bullet-0' },
      {
        setActiveSection: () => undefined,
        setActiveTab: () => undefined,
        closeDrawer: () => undefined,
        shouldCloseDrawer: false,
      },
    )
    frames.pump(1)
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement?.id ?? '').toBe('')
    frames.pump(1)
    expect(document.activeElement?.id).toBe('exp-1-bullet-0')
  })

  it('field tidak pernah muncul → berhenti setelah 20 frame tanpa melempar', () => {
    const frames = stubFrames()
    const host = mount('<div id="pane-form">form</div>')
    focusTarget(
      { sectionId: SAMPLE_IDS.skills, field: 'field-yang-tidak-ada' },
      {
        setActiveSection: () => undefined,
        setActiveTab: () => undefined,
        closeDrawer: () => undefined,
        shouldCloseDrawer: true,
      },
    )
    // 1 frame awal + percobaan sampai frame ke-20 (batas MAX_FRAMES).
    expect(() => frames.pump(22)).not.toThrow()
    expect(frames.callbacks()).toBe(0)
    expect(document.activeElement?.id ?? '').toBe('')
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(host.textContent).toBe('form')
  })

  it('target tanpa field → tetap mencoba sampai habis lalu scroll ke pane form', () => {
    const frames = stubFrames()
    mount('<div id="pane-form">isi form</div>')
    focusTarget(
      { sectionId: SAMPLE_IDS.summary },
      {
        setActiveSection: () => undefined,
        setActiveTab: () => undefined,
        closeDrawer: () => undefined,
        shouldCloseDrawer: false,
      },
    )
    frames.pump(1)
    // Tanpa field dan tanpa kartu, pencarian tetap berhenti sendiri.
    expect(frames.callbacks()).toBe(1)
    frames.pump(25)
    expect(frames.callbacks()).toBe(0)
    const pane = document.getElementById('pane-form')
    expect(scroll).toHaveBeenLastCalledWith({ block: 'start', behavior: 'smooth' })
    expect(pane?.textContent).toBe('isi form')
  })

  it('flash dicabut lagi setelah 600ms', () => {
    vi.useFakeTimers()
    const frames = stubFrames()
    const host = mount('<div data-field-shell><input id="profile-phone" value="0812" /></div>')
    focusTarget(
      { sectionId: SAMPLE_IDS.profile, field: 'profile-phone' },
      {
        setActiveSection: () => undefined,
        setActiveTab: () => undefined,
        closeDrawer: () => undefined,
        shouldCloseDrawer: true,
      },
    )
    frames.pump(1)
    const shell = host.querySelector('[data-field-shell]')
    expect(shell?.classList.contains('ats-field-flash')).toBe(true)
    vi.advanceTimersByTime(599)
    expect(shell?.classList.contains('ats-field-flash')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(shell?.classList.contains('ats-field-flash')).toBe(false)
  })

  it('tanpa `data-field-shell`, flash menempel pada elemen field itu sendiri', () => {
    const frames = stubFrames()
    const host = mount('<input id="profile-location" value="Jakarta" />')
    focusTarget(
      { sectionId: SAMPLE_IDS.profile, field: 'profile-location' },
      {
        setActiveSection: () => undefined,
        setActiveTab: () => undefined,
        closeDrawer: () => undefined,
        shouldCloseDrawer: false,
      },
    )
    frames.pump(1)
    const input = host.querySelector('#profile-location')
    expect(input?.classList.contains('ats-field-flash')).toBe(true)
    expect(document.activeElement?.id).toBe('profile-location')
  })

  it('tanpa target sama sekali → tidak ada frame & tidak ada aksi', () => {
    const frames = stubFrames()
    const closeDrawer = vi.fn()
    focusTarget(undefined, {
      setActiveSection: () => undefined,
      setActiveTab: () => undefined,
      closeDrawer,
      shouldCloseDrawer: true,
    })
    expect(closeDrawer).not.toHaveBeenCalled()
    expect(frames.callbacks()).toBe(0)
  })
})

describe('clock — label waktu pemeriksaan', () => {
  it('jam & menit lokal dengan padding dua digit', () => {
    expect(clockLabel(new Date(2026, 3, 10, 9, 7).getTime())).toBe('09.07')
    expect(clockLabel(new Date(2026, 11, 31, 23, 59).getTime())).toBe('23.59')
    expect(clockLabel(new Date(2026, 0, 1, 0, 0).getTime())).toBe('00.00')
  })
})

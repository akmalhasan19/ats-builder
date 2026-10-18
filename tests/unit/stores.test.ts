import { describe, expect, it } from 'vitest'
import { useAtsStore } from '@/store/atsStore'
import { useSyncStore } from '@/store/syncStore'
import { useUiStore } from '@/store/uiStore'

describe('uiStore', () => {
  it('default sesuai spesifikasi', () => {
    const state = useUiStore.getState()
    expect(state.zoom).toBe(1)
    expect(state.fitMode).toBe(true)
    expect(state.panelMode).toBe('3col')
    expect(state.activeTab).toBe('form')
    expect(state.showMarginGuides).toBe(true)
    expect(state.showKeywordMarks).toBe(true)
    expect(state.atsDrawerOpen).toBe(false)
    expect(state.atsTab).toBe('issues')
    expect(state.firstRunSeen).toBe(false)
  })

  it('set hanya mengubah bagiannya', () => {
    const {
      setZoom,
      setFitMode,
      setPanelMode,
      setActiveTab,
      setShowMarginGuides,
      setShowKeywordMarks,
      setAtsDrawerOpen,
      setAtsTab,
      setFirstRunSeen,
    } = useUiStore.getState()

    setZoom(0.75)
    setFitMode(false)
    setPanelMode('icon-rail')
    setActiveTab('preview')
    setShowMarginGuides(false)
    setShowKeywordMarks(false)
    setAtsDrawerOpen(true)
    setAtsTab('tape')
    setFirstRunSeen(true)

    const state = useUiStore.getState()
    expect(state.zoom).toBe(0.75)
    expect(state.fitMode).toBe(false)
    expect(state.panelMode).toBe('icon-rail')
    expect(state.activeTab).toBe('preview')
    expect(state.showMarginGuides).toBe(false)
    expect(state.showKeywordMarks).toBe(false)
    expect(state.atsDrawerOpen).toBe(true)
    expect(state.atsTab).toBe('tape')
    expect(state.firstRunSeen).toBe(true)
  })
})

describe('atsStore', () => {
  it('default kosong — bentuk laporan menyusul Fase 7', () => {
    const state = useAtsStore.getState()
    expect(state.report).toBeNull()
    expect(state.isChecking).toBe(false)
    expect(state.lastCheckedAt).toBeNull()
    expect(state.keywords).toEqual([])
  })

  it('setter mengubah state', () => {
    useAtsStore.getState().setReport({ score: 80 })
    useAtsStore.getState().setChecking(true)
    useAtsStore.getState().setLastCheckedAt(123)
    useAtsStore.getState().setKeywords(['typescript', 'react'])

    const state = useAtsStore.getState()
    expect(state.report).toEqual({ score: 80 })
    expect(state.isChecking).toBe(true)
    expect(state.lastCheckedAt).toBe(123)
    expect(state.keywords).toEqual(['typescript', 'react'])
  })
})

describe('syncStore', () => {
  it('default saved-local dan storage idb', () => {
    const state = useSyncStore.getState()
    expect(state.status).toBe('saved-local')
    expect(state.lastSyncedAt).toBeNull()
    expect(state.error).toBeNull()
    expect(state.storageMode).toBe('idb')
  })

  it('setter mengubah state', () => {
    useSyncStore.getState().setStatus('saving')
    useSyncStore.getState().setStatus('offline')
    useSyncStore.getState().setLastSyncedAt(456)
    useSyncStore.getState().setError('galat')
    useSyncStore.getState().setStorageMode('memory')

    const state = useSyncStore.getState()
    expect(state.status).toBe('offline')
    expect(state.lastSyncedAt).toBe(456)
    expect(state.error).toBe('galat')
    expect(state.storageMode).toBe('memory')
  })
})

import { create } from 'zustand'

export type PanelMode = '3col' | 'icon-rail' | 'tabs'

export type UiStore = {
  zoom: number
  fitMode: boolean
  panelMode: PanelMode
  activeTab: 'form' | 'preview'
  showMarginGuides: boolean
  showKeywordMarks: boolean
  atsDrawerOpen: boolean
  atsTab: 'issues' | 'tape'
  /** T7.5 — stabilo ikut ke PDF? Default mati: berkas unduhan tetap netral. */
  includeMarksInPdf: boolean
  firstRunSeen: boolean
  setZoom: (zoom: number) => void
  setFitMode: (fitMode: boolean) => void
  setPanelMode: (panelMode: PanelMode) => void
  setActiveTab: (activeTab: 'form' | 'preview') => void
  setShowMarginGuides: (showMarginGuides: boolean) => void
  setShowKeywordMarks: (showKeywordMarks: boolean) => void
  setAtsDrawerOpen: (atsDrawerOpen: boolean) => void
  setAtsTab: (atsTab: 'issues' | 'tape') => void
  setIncludeMarksInPdf: (includeMarksInPdf: boolean) => void
  setFirstRunSeen: (firstRunSeen: boolean) => void
}

export const useUiStore = create<UiStore>((set) => ({
  zoom: 1,
  fitMode: true,
  panelMode: '3col',
  activeTab: 'form',
  showMarginGuides: true,
  showKeywordMarks: true,
  atsDrawerOpen: false,
  atsTab: 'issues',
  includeMarksInPdf: false,
  firstRunSeen: false,
  setZoom: (zoom) => set({ zoom }),
  setFitMode: (fitMode) => set({ fitMode }),
  setPanelMode: (panelMode) => set({ panelMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setShowMarginGuides: (showMarginGuides) => set({ showMarginGuides }),
  setShowKeywordMarks: (showKeywordMarks) => set({ showKeywordMarks }),
  setAtsDrawerOpen: (atsDrawerOpen) => set({ atsDrawerOpen }),
  setAtsTab: (atsTab) => set({ atsTab }),
  setIncludeMarksInPdf: (includeMarksInPdf) => set({ includeMarksInPdf }),
  setFirstRunSeen: (firstRunSeen) => set({ firstRunSeen }),
}))

import { create } from 'zustand'

export type PanelMode = '3col' | 'icon-rail' | 'tabs'

/** C1.2 — cara user mengerjakan CV: form terpandu atau langsung di kertas (D1). */
export type EditMode = 'form' | 'canvas'

export type UiStore = {
  zoom: number
  fitMode: boolean
  panelMode: PanelMode
  activeTab: 'form' | 'preview'
  editMode: EditMode
  showMarginGuides: boolean
  showKeywordMarks: boolean
  atsDrawerOpen: boolean
  atsTab: 'issues' | 'tape'
  /** T7.5 — stabilo ikut ke PDF? Default mati: berkas unduhan tetap netral. */
  includeMarksInPdf: boolean
  /**
   * C4.4 — dialog katalog bagian. State hidup di store (bukan di `Rail`) karena
   * dua pemanggilnya: tombol "+ Tambah bagian" di rail dan ghost row
   * "+ Tambahkan bagian" di kertas (D10) memakai dialog yang sama.
   */
  sectionCatalogOpen: boolean
  firstRunSeen: boolean
  setZoom: (zoom: number) => void
  setFitMode: (fitMode: boolean) => void
  setPanelMode: (panelMode: PanelMode) => void
  setActiveTab: (activeTab: 'form' | 'preview') => void
  setEditMode: (editMode: EditMode) => void
  setShowMarginGuides: (showMarginGuides: boolean) => void
  setShowKeywordMarks: (showKeywordMarks: boolean) => void
  setAtsDrawerOpen: (atsDrawerOpen: boolean) => void
  setAtsTab: (atsTab: 'issues' | 'tape') => void
  setIncludeMarksInPdf: (includeMarksInPdf: boolean) => void
  setSectionCatalogOpen: (sectionCatalogOpen: boolean) => void
  setFirstRunSeen: (firstRunSeen: boolean) => void
}

export const useUiStore = create<UiStore>((set) => ({
  zoom: 1,
  fitMode: true,
  panelMode: '3col',
  activeTab: 'form',
  editMode: 'form',
  showMarginGuides: true,
  showKeywordMarks: true,
  atsDrawerOpen: false,
  atsTab: 'issues',
  includeMarksInPdf: false,
  sectionCatalogOpen: false,
  firstRunSeen: false,
  setZoom: (zoom) => set({ zoom }),
  setFitMode: (fitMode) => set({ fitMode }),
  setPanelMode: (panelMode) => set({ panelMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setEditMode: (editMode) => set({ editMode }),
  setShowMarginGuides: (showMarginGuides) => set({ showMarginGuides }),
  setShowKeywordMarks: (showKeywordMarks) => set({ showKeywordMarks }),
  setAtsDrawerOpen: (atsDrawerOpen) => set({ atsDrawerOpen }),
  setAtsTab: (atsTab) => set({ atsTab }),
  setIncludeMarksInPdf: (includeMarksInPdf) => set({ includeMarksInPdf }),
  setSectionCatalogOpen: (sectionCatalogOpen) => set({ sectionCatalogOpen }),
  setFirstRunSeen: (firstRunSeen) => set({ firstRunSeen }),
}))

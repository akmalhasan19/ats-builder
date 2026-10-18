import { create } from 'zustand'

type PdfExportState = {
  isGenerating: boolean
  setGenerating: (isGenerating: boolean) => void
}

export const usePdfExportStore = create<PdfExportState>((set) => ({
  isGenerating: false,
  setGenerating: (isGenerating) => set({ isGenerating }),
}))

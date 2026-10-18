import { create } from 'zustand'
import {
  createEmptyEntry,
  createEmptySectionData,
  createSampleDoc,
  type EntriesSectionKind,
  type SectionData,
  type SectionKind,
} from '@/schema/resume'
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  AwardEntry,
  PageSettings,
  ProjectEntry,
  ResumeDoc,
  SectionInstance,
  TemplateId,
  ThemeTokens,
  VolunteeringEntry,
} from '@/types/resume'

export type SectionEntry =
  | ExperienceEntry
  | EducationEntry
  | ProjectEntry
  | CertificationEntry
  | LanguageEntry
  | AwardEntry
  | VolunteeringEntry

type EntryListState = { entries: SectionEntry[] }

// History dipakai undo/redo di Fase 11; dibatasi supaya memori tidak
// tumbuh tanpa batas saat mengetik panjang.
const HISTORY_LIMIT = 50

const move = <T>(items: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const moved = next.splice(from, 1)[0]!
  next.splice(to, 0, moved)
  return next
}

const withEntries = (
  doc: ResumeDoc,
  sectionId: string,
  mutate: (entries: SectionEntry[]) => SectionEntry[],
): ResumeDoc => ({
  ...doc,
  sections: doc.sections.map((section): SectionInstance => {
    if (section.id !== sectionId) return section
    const data = section.data as EntryListState
    return { ...section, data: { ...data, entries: mutate(data.entries) } } as SectionInstance
  }),
})

export type DocStore = {
  doc: ResumeDoc
  activeSectionId: string
  history: ResumeDoc[]
  commit: (updater: (doc: ResumeDoc) => ResumeDoc) => void
  updateSection: (sectionId: string, mutator: (data: SectionData) => SectionData) => void
  updateEntry: (
    sectionId: string,
    entryId: string,
    mutator: (entry: SectionEntry) => SectionEntry,
  ) => void
  addEntry: (sectionId: string) => void
  removeEntry: (sectionId: string, entryId: string) => void
  duplicateEntry: (sectionId: string, entryId: string) => void
  reorderSection: (from: number, to: number) => void
  reorderEntry: (sectionId: string, from: number, to: number) => void
  toggleSectionVisible: (sectionId: string) => void
  addSection: (kind: SectionKind) => void
  removeSection: (sectionId: string) => void
  setActiveSection: (sectionId: string) => void
  setTemplate: (templateId: TemplateId) => void
  setTitle: (title: string) => void
  setPageSettings: (page: Partial<PageSettings>) => void
  setThemeTokens: (theme: Partial<ThemeTokens>) => void
  resetDoc: (doc: ResumeDoc) => void
  loadDoc: (doc: ResumeDoc) => void
}

const initialDoc = createSampleDoc()

export const useDocStore = create<DocStore>((set, get) => ({
  doc: initialDoc,
  activeSectionId: initialDoc.sections[0]?.id ?? '',
  history: [],

  commit: (updater) =>
    set((state) => {
      const next = updater(state.doc)
      if (next === state.doc) return state
      return {
        doc: {
          ...next,
          meta: { ...next.meta, updatedAt: Date.now() },
        },
        history: [...state.history, state.doc].slice(-HISTORY_LIMIT),
      }
    }),

  updateSection: (sectionId, mutator) =>
    get().commit((doc) => ({
      ...doc,
      sections: doc.sections.map((section): SectionInstance =>
        section.id === sectionId
          ? ({ ...section, data: mutator(section.data) } as SectionInstance)
          : section,
      ),
    })),

  updateEntry: (sectionId, entryId, mutator) =>
    get().commit((doc) =>
      withEntries(doc, sectionId, (entries) =>
        entries.map((entry) => (entry.id === entryId ? mutator(entry) : entry)),
      ),
    ),

  addEntry: (sectionId) => {
    const target = get().doc.sections.find((section) => section.id === sectionId)
    if (!target || !('entries' in target.data)) return
    const entry = createEmptyEntry(target.kind as EntriesSectionKind)
    get().commit((doc) => withEntries(doc, sectionId, (entries) => [...entries, entry]))
  },

  removeEntry: (sectionId, entryId) =>
    get().commit((doc) =>
      withEntries(doc, sectionId, (entries) => entries.filter((entry) => entry.id !== entryId)),
    ),

  duplicateEntry: (sectionId, entryId) => {
    const source = get().doc.sections.find((section) => section.id === sectionId)
    if (!source || !('entries' in source.data)) return
    const index = source.data.entries.findIndex((entry) => entry.id === entryId)
    if (index < 0) return
    get().commit((doc) =>
      withEntries(doc, sectionId, (entries) => {
        const original = entries[index]!
        const copy = { ...original, id: crypto.randomUUID() } as SectionEntry
        return [...entries.slice(0, index + 1), copy, ...entries.slice(index + 1)]
      }),
    )
  },

  reorderSection: (from, to) =>
    get().commit((doc) => {
      const sections = move(doc.sections, from, to)
      return sections === doc.sections ? doc : { ...doc, sections }
    }),

  reorderEntry: (sectionId, from, to) =>
    get().commit((doc) => withEntries(doc, sectionId, (entries) => move(entries, from, to))),

  toggleSectionVisible: (sectionId) =>
    get().commit((doc) => ({
      ...doc,
      sections: doc.sections.map((section) =>
        section.id === sectionId ? { ...section, visible: !section.visible } : section,
      ),
    })),

  addSection: (kind) => {
    const id = crypto.randomUUID()
    get().commit((doc) => ({
      ...doc,
      sections: [
        ...doc.sections,
        { id, kind, visible: true, data: createEmptySectionData(kind) } as SectionInstance,
      ],
    }))
    set({ activeSectionId: id })
  },

  removeSection: (sectionId) => {
    get().commit((doc) => {
      const sections = doc.sections.filter((section) => section.id !== sectionId)
      return sections.length === doc.sections.length ? doc : { ...doc, sections }
    })
    if (get().activeSectionId === sectionId) {
      set({ activeSectionId: get().doc.sections[0]?.id ?? '' })
    }
  },

  // Navigasi rail (T2.4). activeSectionId bukan bagian dari dokumen, jadi
  // tidak lewat commit dan tidak mengubah meta.updatedAt.
  setActiveSection: (sectionId) => set({ activeSectionId: sectionId }),

  setTemplate: (templateId) =>
    get().commit((doc) => (doc.templateId === templateId ? doc : { ...doc, templateId })),

  setTitle: (title) => get().commit((doc) => (doc.title === title ? doc : { ...doc, title })),

  setPageSettings: (page) =>
    get().commit((doc) => ({
      ...doc,
      settings: { ...doc.settings, page: { ...doc.settings.page, ...page } },
    })),

  setThemeTokens: (theme) => get().commit((doc) => ({ ...doc, theme: { ...doc.theme, ...theme } })),

  resetDoc: (doc) => get().commit(() => doc),

  loadDoc: (doc) =>
    set({
      doc,
      history: [],
      activeSectionId: doc.sections[0]?.id ?? '',
    }),
}))

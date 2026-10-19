import { wordCount } from '@/lib/text'
import {
  entriesOf,
  entryContentOf,
  profileContact,
  sectionLabel,
  skillGroupLines,
  summaryText,
  type EntriesSectionKind,
} from '@/features/templates/contentLines'
import { headingLabel, type TemplateSpec } from '@/features/templates/specs'
import type { PagePlan } from '@/features/preview/pagination'
import type { ResumeDoc, SectionInstance } from '@/types/resume'

/**
 * T7.3 — Parse Tape: urutan baris **persis seperti urutan render template**,
 * bukan urutan form. Sumbernya `PagePlan` yang sama dengan pratinjau dan PDF
 * (P4), jadi tape bisa disilangkan dengan `pdftotext` hasil ekspor.
 */

export type TapeTag =
  | 'NAME'
  | 'HEADLINE'
  | 'EMAIL'
  | 'PHONE'
  | 'LOCATION'
  | 'LINK'
  | 'HEADING'
  | 'ENTRY_TITLE'
  | 'ORG'
  | 'DATE'
  | 'BULLET'
  | 'META'
  | 'UNCLAIMED'

export type TapeLine = {
  tag: TapeTag
  text: string
  sourceRef?: { sectionId: string; entryId?: string }
}

export type TapeStats = {
  chars: number
  words: number
  pages: number
}

export type TapeResult = {
  lines: TapeLine[]
  stats: TapeStats
}

/**
 * Karakter yang masih bisa dipetakan parser: huruf, angka, tanda baca, dan
 * simbol lazim dokumen. Di luar itu (emoji, kontrol, glif hias) teksnya tetap
 * tercetak tapi tidak bisa diklaim jadi field — ditandai `UNCLAIMED`.
 * `\\-` dan `^` di-escape agar tidak terbaca sebagai rentang/negasi kelas.
 */
const LEGIBLE_EXTRA = `.,;:!?'"()\\[\\]{}/\\\\_*&@#%+=<>~$€£¥°§•·\\^\\-–—`
const ILLEGIBLE_RE = new RegExp(`[^\\p{L}\\p{M}\\p{N}\\s${LEGIBLE_EXTRA}]`, 'u')

export function isMachineLegible(text: string): boolean {
  return !ILLEGIBLE_RE.test(text)
}

const entryOf = (doc: ResumeDoc, sectionId: string, entryId: string) => {
  const section = doc.sections.find((item) => item.id === sectionId)
  if (
    !section ||
    section.kind === 'profile' ||
    section.kind === 'summary' ||
    section.kind === 'skills'
  )
    return null
  const entry = entriesOf(section).find((item) => String(item.id) === entryId)
  if (!entry) return null
  return entryContentOf(section.kind as EntriesSectionKind, entry, doc.settings.language)
}

/** "Senior Software Engineer — Tech Nusantara Corp" → judul + organisasi. */
const splitTitle = (title: string): { title: string; org: string } => {
  const parts = title.split(' — ')
  if (parts.length < 2) return { title, org: '' }
  return { title: parts[0] ?? '', org: parts.slice(1).join(' — ') }
}

export function simulateParseOrder(doc: ResumeDoc, spec: TemplateSpec, plan: PagePlan): TapeResult {
  const lines: TapeLine[] = []
  const push = (tag: TapeTag, text: string, sourceRef?: TapeLine['sourceRef']): void => {
    const value = text.trim()
    if (value === '') return
    lines.push({ tag: isMachineLegible(value) ? tag : 'UNCLAIMED', text: value, sourceRef })
  }

  const profile = doc.sections.find(
    (section): section is Extract<SectionInstance, { kind: 'profile' }> =>
      section.kind === 'profile' && section.visible,
  )

  for (const block of plan.blocks) {
    const section = doc.sections.find((item) => item.id === block.sectionId)
    if (!section) continue

    if (block.kind === 'header') {
      if (!profile) continue
      const ref = { sectionId: profile.id }
      push('NAME', profile.data.fullName, ref)
      push('HEADLINE', profile.data.headline, ref)
      // Kontak digambar satu baris dipisah ` · ` (§2.3); tape memecahnya
      // menjadi field bernama tanpa mengubah urutan bacanya.
      push('EMAIL', profile.data.email, ref)
      push('PHONE', profile.data.phone, ref)
      push('LOCATION', profile.data.location, ref)
      for (const link of profileContact(profile.data).slice(3)) push('LINK', link, ref)
      continue
    }

    if (block.kind === 'section-heading') {
      push('HEADING', headingLabel(sectionLabel(section.kind), spec), { sectionId: section.id })
      continue
    }

    if (block.kind === 'summary') {
      push('META', summaryText(section), { sectionId: section.id })
      continue
    }

    if (block.kind === 'skill-group' && section.kind === 'skills') {
      const group = section.data.groups.find((item) => item.id === block.itemId)
      const groupLines = group ? skillGroupLines(group) : []
      const [name, ...items] = groupLines
      push('ENTRY_TITLE', name ?? '', { sectionId: section.id, entryId: block.itemId })
      push('META', items.join(', '), { sectionId: section.id, entryId: block.itemId })
      continue
    }

    const entryId = block.itemId ?? ''
    const content = entryOf(doc, block.sectionId, entryId)
    if (!content) continue
    const ref = { sectionId: block.sectionId, entryId }

    if (block.kind === 'entry-head') {
      const { title, org } = splitTitle(content.title)
      push('ENTRY_TITLE', title, ref)
      if (org) push('ORG', org, ref)
      if (spec.entryLayout.datePosition === 'right') {
        // Renderer tanggal-kanan menggambar judul, tanggal (sebelah kanan baris
        // yang sama), lalu sisa meta — tiga string terpisah.
        push('DATE', content.dates, ref)
        push('META', content.metaNoDates, ref)
      } else {
        // Tanggal baris-berikutnya: tanggal ada DI DALAM satu string meta
        // (mis. "Kota · Apr 2022 – Sekarang" atau "Penerbit · Nov 2023 · ID").
        // Memecahnya sesuai urutan g string itu, bukan mengurutkan ulang —
        // supaya tape tetap sama persis dengan yang digambar renderer.
        for (const segment of content.meta.split(' · ')) {
          const value = segment.trim()
          if (value === '') continue
          push(value === content.dates.trim() ? 'DATE' : 'META', value, ref)
        }
      }
      continue
    }

    if (block.kind === 'entry-line') {
      const line = content.bodyLines[block.lineIndex ?? 0]
      if (!line) continue
      push(line.bullet ? 'BULLET' : 'META', line.text, ref)
    }
  }

  const text = lines.map((line) => line.text).join(' ')
  return {
    lines,
    stats: {
      chars: text.length,
      words: wordCount(text),
      pages: plan.pageCount,
    },
  }
}

/** Teks utuh tape — dipakai tombol `Salin teks` dan uji silang `pdf:verify`. */
export const tapeText = (lines: readonly TapeLine[]): string =>
  lines.map((line) => line.text).join('\n')

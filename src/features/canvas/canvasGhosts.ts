import { entryBulletListKey } from '@/features/templates/fieldSegments'
import { GUIDE_ENTRY_ID } from './canvasFields'
import type { DocBlock } from '@/features/preview/pagination'
import type { EntriesSectionKind } from '@/features/templates/contentLines'

/**
 * C4.4 — jangkar ghost row on-canvas (D10). Operasi struktural v1 hanya
 * *menambah*: entri baru di akhir tiap bagian ber-entri, bullet baru di akhir
 * tiap entri, dan bagian baru di akhir dokumen. Reorder/hide/duplicate/delete
 * tetap milik rail/form (OQ1).
 *
 * Ghost dihitung dari daftar blok rencana halaman, bukan dari DOM: ia menempel
 * pada blok TERAKHIR milik entri/bagian, jadi posisinya benar walaupun bagian itu
 * berpindah halaman atau terpotong di tengah.
 */

export type CanvasGhost =
  | { kind: 'entry'; sectionId: string; entryKind: EntriesSectionKind }
  | {
      kind: 'bullet'
      sectionId: string
      entryKind: EntriesSectionKind
      entryId: string
    }
  | { kind: 'section' }

const isEntriesKind = (sectionKind: string): sectionKind is EntriesSectionKind =>
  sectionKind !== 'profile' && sectionKind !== 'summary' && sectionKind !== 'skills'

const belongsToEntry = (block: DocBlock): boolean =>
  (block.kind === 'entry-head' || block.kind === 'entry-line') &&
  block.itemId !== undefined &&
  block.itemId !== GUIDE_ENTRY_ID

export const canvasGhostsAfterBlock = (blocks: readonly DocBlock[]): Map<string, CanvasGhost[]> => {
  const anchors = new Map<string, CanvasGhost[]>()
  const push = (key: string, ghost: CanvasGhost): void => {
    const current = anchors.get(key)
    if (current) current.push(ghost)
    else anchors.set(key, [ghost])
  }

  blocks.forEach((block, index) => {
    const next = blocks[index + 1]
    const endsEntry =
      belongsToEntry(block) &&
      (next?.itemId !== block.itemId || next?.sectionId !== block.sectionId)
    const endsSection = next === undefined || next.sectionId !== block.sectionId

    if (endsEntry && isEntriesKind(block.sectionKind)) {
      const entryKind = block.sectionKind
      if (entryBulletListKey(entryKind) && block.itemId) {
        push(block.key, {
          kind: 'bullet',
          sectionId: block.sectionId,
          entryKind,
          entryId: block.itemId,
        })
      }
    }

    if (endsSection && isEntriesKind(block.sectionKind)) {
      push(block.key, {
        kind: 'entry',
        sectionId: block.sectionId,
        entryKind: block.sectionKind,
      })
    }
  })

  const last = blocks.at(-1)
  if (last) push(last.key, { kind: 'section' })

  return anchors
}

/**
 * FASE 12 C5 — keputusan owner atas temuan ⛔ C4.4 (opsi A): ghost row butuh
 * ruang di **anggaran halaman rencana kanvas**, kalau tidak barisnya terpotong
 * dasar kotak konten (`PageSheet` `overflow: hidden`) di halaman yang penuh —
 * dan blok konten yang jadi jangkarnya sendiri bisa lewat batas karena tinggi
 * terukur mode kanvas memuat teks guide (catatan parity di Gate C2).
 *
 * Angkanya per baris ghost, bukan tinggi terukur DOM (rencana halaman dihitung
 * sinkron): tombol ghost ±32 px di desktop dan 44 px di mobile (§5.3) plus
 * `margin-top` 2 px — 48 px menutup keduanya dengan sedikit longgar. Sisa
 * kelonggaran diuji di unit test anggaran.
 *
 * Dipakai HANYA oleh pass kanvas (`createPagePlan` dengan `guides`); rencana
 * isi yang dibaca ATS dan ekspor PDF tidak pernah memanggilnya, jadi PDF dan
 * mode form tidak berubah.
 */
export const CANVAS_GHOST_RESERVE_PX = 48

/** Tinggi extra (`px`) yang harus disisakan per blok jangkar ber-ghost. */
export const canvasGhostExtraPxOf = (blocks: readonly DocBlock[]): Map<string, number> => {
  const anchors = canvasGhostsAfterBlock(blocks)
  const extras = new Map<string, number>()
  anchors.forEach((ghosts, key) => {
    extras.set(key, ghosts.length * CANVAS_GHOST_RESERVE_PX)
  })
  return extras
}

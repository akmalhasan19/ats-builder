import { blockFootprintPx, type DocBlock, type HeightMap } from './pagination'

/**
 * Aturan pemecahan halaman (T4.2). Semua keputusan berbasis footprint blok yang
 * sudah diukur (atau diperkirakan sebelum pengukuran), dalam px pada lebar konten.
 */

// orphans & widows untuk daftar bullet: minimal 2 baris entri di tiap sisi batas halaman.
const MIN_RUN_LINES = 2

const itemKey = (block: DocBlock): string => `${block.sectionId}:${block.itemId ?? ''}`

const isRunOf = (block: DocBlock, reference: DocBlock): boolean =>
  block.kind === 'entry-line' && itemKey(block) === itemKey(reference)

/** Baris-baris paling akhir di halaman yang termasuk entri yang sama. */
function trailingRun(page: DocBlock[], block: DocBlock): number {
  let count = 0
  for (let index = page.length - 1; index >= 0; index -= 1) {
    const candidate = page[index]!
    if (!isRunOf(candidate, block)) break
    count += 1
  }
  return count
}

/**
 * Saat `block` tidak muat, pindahkan tetangga yang diperlukan dari ujung halaman
 * lama supaya aturan janda/yatim tetap terpenuhi. `page` dimutasi (blok popped).
 */
function carryForOverflow(
  block: DocBlock,
  page: DocBlock[],
  footprint: (block: DocBlock) => number,
  contentHeightPx: number,
): DocBlock[] {
  const carry: DocBlock[] = []

  if (block.kind === 'entry-line') {
    const onPage = trailingRun(page, block)
    const total = block.entryLineCount ?? onPage + 1
    const rest = Math.max(1, total - onPage)
    const moveWholeRun = total < MIN_RUN_LINES * 2 || (onPage > 0 && onPage < MIN_RUN_LINES)
    const moveWidow = rest < MIN_RUN_LINES ? MIN_RUN_LINES - rest : 0
    const moveCount = moveWholeRun || onPage === 0 ? onPage : Math.min(moveWidow, onPage)
    for (let index = 0; index < moveCount; index += 1) carry.unshift(page.pop()!)
  }

  // Kepala entri & heading section tidak boleh menjadi penghujung halaman.
  while (page.length > 0 && page[page.length - 1]!.minWithNext > 0) {
    carry.unshift(page.pop()!)
  }

  // Kelompok yang dipindah harus muat di halaman baru; kalau tidak, pemindahan
  // cuma memindahkan masalah (halaman jebol) — kembali ke pecahan biasa.
  const carried = carry.reduce((total, item) => total + footprint(item), 0)
  if (carry.length > 0 && carried + footprint(block) > contentHeightPx) {
    page.push(...carry)
    carry.length = 0
  }

  return carry
}

export function paginateBlocks(
  blocks: readonly DocBlock[],
  contentHeightPx: number,
  heights: HeightMap = {},
  /** C5 (opsi A, temuan C4.4) — foot print tambahan per blok (ghost row kanvas). */
  extraPx: (block: DocBlock) => number = () => 0,
): DocBlock[][] {
  const footprint = (block: DocBlock): number => blockFootprintPx(block, heights) + extraPx(block)
  const pages: DocBlock[][] = []
  let current: DocBlock[] = []
  let used = 0

  const keepWithNextFits = (index: number, own: number): boolean => {
    const block = blocks[index]!
    let needed = own
    for (let step = 1; step <= block.minWithNext; step += 1) {
      const next = blocks[index + step]
      if (!next) break
      needed += footprint(next)
    }
    return used + needed <= contentHeightPx
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    const own = footprint(block)
    const overflows = used + own > contentHeightPx
    const breaksKeep = block.minWithNext > 0 && !keepWithNextFits(index, own)

    if (current.length > 0 && (overflows || breaksKeep)) {
      const carry = carryForOverflow(block, current, footprint, contentHeightPx)
      if (current.length > 0) pages.push(current)
      current = [...carry, block]
      used = carry.reduce((total, item) => total + footprint(item), 0) + own
      continue
    }

    current.push(block)
    used += own
  }

  if (current.length > 0) pages.push(current)
  return pages.filter((page) => page.length > 0)
}

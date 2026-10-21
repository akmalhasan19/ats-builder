import { useCanvasStore } from '@/store/canvasStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import type { AtsTarget } from '@/features/ats/types'
import type { EntriesSectionKind } from '@/features/templates/contentLines'
import type { ResumeDoc } from '@/types/resume'
import {
  blockKeyForField,
  bulletListKeyOf,
  canvasFieldSpecOf,
  datesShapeOf,
  entryIdForField,
  entryRecordOf,
} from './canvasFields'
import { ensureReadableZoom } from './canvasZoom'

/**
 * C5.2 — jembatan ATS → kanvas (D2, §5.6).
 *
 * Tombol `Perbaiki →` di drawer ATS sudah punya target presisi (`sectionId`,
 * `entryId`, `field`) sejak T7.4, tetapi `focusTarget` selalu menuju form.
 * Di mode kanvas, arah yang benar adalah membuka sesi edit field itu **di atas
 * kertas** — sama seperti klik segmen — supaya user memperbaiki isu di tempat
 * yang sama dengan tempat ia melihatnya.
 *
 * Pemetaannya sengaja tidak menduplikasi aturan matriks §4: id field ATS
 * diterjemahkan ke path model, lalu `canvasFieldSpecOf` yang memutuskan apakah
 * field itu memang punya target edit di kertas. Path di luar matriks (mis.
 * tanggal pendidikan, field yang tidak digambar dokumen) mengembalikan `null`
 * sehingga pemanggil jatuh ke jalur form seperti sebelumnya.
 */

/** Awalan id field ATS → jenis bagian entri (konvensi `fieldTargets` Fase 3). */
const PREFIX_TO_KIND: Record<string, EntriesSectionKind> = {
  exp: 'experience',
  edu: 'education',
  proj: 'projects',
  vol: 'volunteering',
  cert: 'certifications',
  award: 'awards',
}

const PROFILE_PATH: Record<string, string> = {
  'profile-email': 'profile.email',
  'profile-phone': 'profile.phone',
  'profile-location': 'profile.location',
}

/** `profile-link-url-<n>` → `profile.links.<n>.url`. */
const PROFILE_LINK_RE = /^profile-link-url-(\d+)$/
/** `skill-group-<groupId>-items` → `skills.groups.<groupId>.items`. */
const SKILL_ITEMS_RE = /^skill-group-(.+)-items$/
/** `<prefix>-<entryId>-bullet-<i>` / `<prefix>-<entryId>-dates-start|end`. */
const ENTRY_FIELD_RE = /^(exp|edu|proj|vol|cert|award)-(.+)-(bullet|dates)-(.+)$/

const sectionKindOf = (doc: ResumeDoc, sectionId: string): string | null =>
  doc.sections.find((section) => section.id === sectionId)?.kind ?? null

/**
 * Path model field kanvas yang menjadi tujuan `Perbaiki →`, atau `null` bila
 * field itu tidak bisa diedit di kertas (pemanggil memakai form).
 */
export const canvasPathForAtsTarget = (
  doc: ResumeDoc,
  target: AtsTarget | undefined,
): string | null => {
  if (!target?.field) return null
  const field = target.field
  const sectionId = target.sectionId

  const candidate = ((): string | null => {
    const profilePath = PROFILE_PATH[field]
    if (profilePath) return profilePath

    const link = PROFILE_LINK_RE.exec(field)
    if (link) return `profile.links.${link[1]}.url`

    const skill = SKILL_ITEMS_RE.exec(field)
    if (skill) return `skills.groups.${skill[1]}.items`

    const entry = ENTRY_FIELD_RE.exec(field)
    if (!entry) return null
    const kind = PREFIX_TO_KIND[entry[1]!]
    const entryId = entry[2]!
    const part = entry[3]!
    const rest = entry[4]!
    if (!kind) return null
    // Target yang menunjuk jenis bagian lain dari section-nya adalah target
    // rusak — lebih aman jatuh ke form daripada menulis ke entri yang salah.
    if (sectionKindOf(doc, sectionId) !== kind) return null
    if (!entryRecordOf(doc, sectionId, entryId)) return null

    if (part === 'bullet') {
      const list = bulletListKeyOf(kind)
      if (!list || !/^\d+$/.test(rest)) return null
      return `entries.${kind}.${entryId}.${list}[${rest}]`
    }
    // Tanggal yang tidak digambar dokumen (pendidikan) tidak punya segmen.
    if (!datesShapeOf(kind)) return null
    return `entries.${kind}.${entryId}.dates`
  })()

  if (!candidate) return null
  // Matriks §4 adalah otoritas terakhir: path tanpa target edit (entri maya,
  // grup skill maya, field di luar matriks) bukan urusan kanvas.
  return canvasFieldSpecOf(sectionId, candidate) ? candidate : null
}

const REVEAL_MAX_FRAMES = 24

/**
 * Gulirkan blok yang baru dibuka ke tengah well + jaga zoom tetap terbaca (D7).
 * Ditunda beberapa frame karena blok bisa lahir dari render berikutnya (bagian
 * yang tadinya tidak aktif) — pola yang sama dengan `focusTarget`.
 */
const revealEditor = (): void => {
  const attempt = (frame: number): void => {
    const block = document.querySelector<HTMLElement>('#pane-preview [data-canvas-editing="true"]')
    if (block) {
      ensureReadableZoom(block)
      // `scrollIntoView` tidak ada di jsdom (unit test), jadi dipanggil opsional.
      block.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    if (frame >= REVEAL_MAX_FRAMES) return
    window.requestAnimationFrame(() => attempt(frame + 1))
  }
  window.requestAnimationFrame(() => attempt(0))
}

/**
 * Buka sesi edit kanvas untuk target ATS. `false` = field tidak tercakup
 * matriks kanvas (atau target kosong) → pemanggil memakai `focusTarget`.
 *
 * Urutannya: aktifkan bagian (rail + form ikut), pindah ke tab pratinjau
 * (penting di mobile), buka sesi (editor menggantikan segmen), lalu gulirkan.
 */
export const openCanvasSessionForAts = (target: AtsTarget | undefined): boolean => {
  if (!target) return false
  const doc = useDocStore.getState().doc
  const path = canvasPathForAtsTarget(doc, target)
  if (!path) return false
  const spec = canvasFieldSpecOf(target.sectionId, path)
  if (!spec) return false

  useDocStore.getState().setActiveSection(target.sectionId)
  useUiStore.getState().setActiveTab('preview')
  useCanvasStore.getState().openSession({
    blockKey: blockKeyForField(target.sectionId, path),
    sectionId: target.sectionId,
    entryId: entryIdForField(path) ?? target.entryId,
    fieldPath: path,
    kind: spec.widget,
  })
  revealEditor()
  return true
}

/**
 * FASE 13 — D4 — tata letak workspace diturunkan dari SATU fungsi murni.
 *
 * Sebelumnya grid, tinggi, dan visibilitas pane ditulis sebagai cabang JSX
 * inline di `AppShell`. Fase 13 membutuhkannya jadi fungsi supaya aturan
 * "mode kanvas = satu pane penuh" bisa diuji tanpa DOM (matriks §4) dan
 * supaya mode form tidak bisa bergeser diam-diam.
 *
 * Modul ini murni: tanpa impor React, tanpa impor store. Tipe di bawah dibuat
 * lokal (struktur sama dengan `uiStore`) supaya file ini tidak menarik modul
 * apa pun saat runtime.
 */

/** Mode pengerjaan — cerminan `EditMode` di `uiStore`. */
export type WorkspaceEditMode = 'form' | 'canvas'

/** Mode panel — cerminan `PanelMode` di `uiStore`. */
export type WorkspacePanelMode = '3col' | 'icon-rail' | 'tabs'

/** Tab yang aktif di layout tab (mobile). */
export type WorkspaceActiveTab = 'form' | 'preview'

/** Bentuk drawer ATS: kolom ke-4 (dock) atau lapisan di atas kertas (overlay). */
export type AtsMode = 'dock' | 'overlay'

/** Gaya grid yang ditulis inline (bukan utility) — lihat catatan `AppShell`. */
export type WorkspaceGridStyle = { gridTemplateColumns: string } | undefined

export type WorkspaceLayoutInput = {
  editMode: WorkspaceEditMode
  panelMode: WorkspacePanelMode
  /** Tab aktif: menentukan pane mana yang tampil di layout tab (<1024px). */
  activeTab: WorkspaceActiveTab
  /** Drawer ATS menjadi kolom ke-4 (≥1600px). */
  atsDocked: boolean
  /** Preferensi "kertas layar penuh" (D2). */
  canvasFullscreen: boolean
}

export type WorkspaceLayout = {
  /** Utility grid: jumlah & ukuran kolom. */
  gridClass: string
  /** Gaya grid inline — hanya untuk kolom ATS ke-4. */
  gridStyle: WorkspaceGridStyle
  /** Utility tinggi workspace. */
  heightClass: string
  /** Kelas tambahan untuk `<aside>` rail. */
  railClass: string
  /** Kelas tambahan untuk `#pane-form`. */
  formClass: string
  /** Kelas tambahan untuk `#pane-preview`. */
  previewClass: string
  /** Tab bar mobile dirender? */
  showTabs: boolean
  /** Anchor beranda dirender? */
  showHomeAnchor: boolean
  /** Bentuk drawer ATS. */
  atsMode: AtsMode
}

/**
 * D1/D2 — layar penuh menyala hanya bila mode kanvas **dan** preferensi
 * `canvasFullscreen` aktif. Default preferensi (D2) hidup di `uiStore`.
 */
export const canvasFullFor = (editMode: WorkspaceEditMode, canvasFullscreen: boolean): boolean =>
  editMode === 'canvas' && canvasFullscreen

/**
 * Visibilitas pane.
 *
 * Di layout tab (<1024px) pane yang tidak dipilih disembunyikan; di layout
 * kolom `lg:block` menampanye di ≥1024px. Rangkaian kelas di bawah mengikuti
 * aturan sebelum Fase 13, sehingga mode form tidak bergeser satu piksel pun:
 * pane terpilih tampil, pane lainnya `hidden` (lalu `lg:block` di ≥1024px).
 */
const paneClass = (selected: boolean, panelMode: WorkspacePanelMode): string => {
  if (!selected) return 'hidden lg:block'
  // Di layout tab, `lg:block` memang tidak pernah berlaku — tappingnya sia-sia.
  return panelMode === 'tabs' ? 'block' : 'block lg:block'
}

/**
 * Tata letak workspace untuk satu kombinasi state.
 *
 * Mode form: kembalikan **persis** nilai yang dipakai sebelum Fase 13.
 * Mode kanvas layar penuh: satu kolom, rail & formulir disembunyikan, tab bar
 * dan anchor beranda tidak dirender, ATS jadi lapisan (D9).
 */
export function workspaceLayoutFor(input: WorkspaceLayoutInput): WorkspaceLayout {
  const { editMode, panelMode, activeTab, atsDocked, canvasFullscreen } = input

  if (canvasFullFor(editMode, canvasFullscreen)) {
    return {
      gridClass: 'grid-cols-1',
      gridStyle: undefined,
      heightClass: 'h-[calc(100dvh-52px)] md:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-56px)]',
      // `lg:hidden` wajib, bukan `hidden` saja: `<aside>` rail punya
      // `lg:flex` bawaan yang menang di cascade utility Tailwind.
      railClass: 'hidden lg:hidden',
      formClass: 'hidden lg:hidden',
      previewClass: 'block',
      showTabs: false,
      showHomeAnchor: false,
      atsMode: 'overlay',
    }
  }

  return {
    gridClass: atsDocked
      ? 'lg:grid-cols-[56px_minmax(360px,1fr)_1fr]'
      : 'lg:grid-cols-[56px_minmax(360px,1fr)_1fr] xl:grid-cols-[248px_minmax(380px,520px)_1fr]',
    // Kolom ke-4 hanya ada saat drawer di-dock (≥1600px). Ditulis sebagai
    // inline style, bukan utility `min-[1600px]:…`, karena dua utility
    // grid-cols yang hidup berdampingan bergantung pada urutan CSS —
    // inline style membuat lebar kolom tidak bisa kalah oleh `xl:`.
    gridStyle: atsDocked
      ? { gridTemplateColumns: '248px minmax(380px, 520px) 1fr 400px' }
      : undefined,
    heightClass: 'h-[calc(100dvh-96px)] md:h-[calc(100dvh-100px)] lg:h-[calc(100dvh-56px)]',
    railClass: '',
    formClass: paneClass(activeTab === 'form', panelMode),
    previewClass: paneClass(activeTab === 'preview', panelMode),
    showTabs: true,
    showHomeAnchor: true,
    atsMode: atsDocked ? 'dock' : 'overlay',
  }
}

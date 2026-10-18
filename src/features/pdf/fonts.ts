/**
 * Inventaris font TTF untuk PDF (§2.3: pdf-lib menanam TTF, bukan WOFF2) dan
 * cara memetakannya ke keluarga yang dipakai `TemplateSpec`.
 *
 * Berkas di `pdf/` dihasilkan `scripts/subset-fonts.mjs`: subset Latin (Dasar +
 * Extended-A/B) tanpa feature ligatur GSUB. Ligatur mengganti `fi` dengan satu
 * glyph gabungan yang tidak punya padanan Unicode, sehingga parser membaca
 * `traffic` sebagai `traf c` — dokumen ATS tidak boleh bergantung pada
 * substitusi glyph. Kepadatan ini juga yang menjaga total font ekspor < 400 KB
 * (T5.4) tanpa mengubah font layar.
 */

export type PdfFontFamily = 'plex-sans' | 'plex-mono' | 'archivo' | 'source-serif'
export type PdfFontStyle = 'normal' | 'italic'

type PdfFontSource = {
  file: string
  weight: number
  style: PdfFontStyle
}

export const FONT_SOURCES: Record<PdfFontFamily, PdfFontSource[]> = {
  'plex-sans': [
    { file: 'pdf/IBMPlexSans-Light.ttf', weight: 300, style: 'normal' },
    { file: 'pdf/IBMPlexSans-Regular.ttf', weight: 400, style: 'normal' },
    { file: 'pdf/IBMPlexSans-Medium.ttf', weight: 500, style: 'normal' },
    { file: 'pdf/IBMPlexSans-SemiBold.ttf', weight: 600, style: 'normal' },
  ],
  'plex-mono': [
    { file: 'pdf/IBMPlexMono-Regular.ttf', weight: 400, style: 'normal' },
    { file: 'pdf/IBMPlexMono-SemiBold.ttf', weight: 600, style: 'normal' },
  ],
  archivo: [{ file: 'pdf/Archivo-SemiBold.ttf', weight: 600, style: 'normal' }],
  'source-serif': [
    { file: 'pdf/SourceSerif4-Regular.ttf', weight: 400, style: 'normal' },
    { file: 'pdf/SourceSerif4-Bold.ttf', weight: 700, style: 'normal' },
    { file: 'pdf/SourceSerif4-Italic.ttf', weight: 400, style: 'italic' },
  ],
}

export function fontFileFor(
  family: PdfFontFamily,
  weight: number,
  style: PdfFontStyle = 'normal',
): string {
  const face = FONT_SOURCES[family].find(
    (candidate) => candidate.weight === weight && candidate.style === style,
  )
  if (!face) {
    throw new Error(`font TTF belum terdaftar: ${family} ${weight} ${style}`)
  }
  return face.file
}

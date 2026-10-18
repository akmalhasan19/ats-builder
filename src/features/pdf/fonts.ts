/**
 * Inventaris font TTF untuk PDF (§2.3: pdf-lib menanam TTF, bukan WOFF2) dan
 * cara memetakannya ke keluarga yang dipakai `spikeSpec`.
 * Fase 5 (T5.1) memperluas ini jadi registrasi penuh per template.
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
    { file: 'IBMPlexSans-Regular.ttf', weight: 400, style: 'normal' },
    { file: 'IBMPlexSans-Italic.ttf', weight: 400, style: 'italic' },
    { file: 'IBMPlexSans-Medium.ttf', weight: 500, style: 'normal' },
    { file: 'IBMPlexSans-SemiBold.ttf', weight: 600, style: 'normal' },
    { file: 'IBMPlexSans-Bold.ttf', weight: 700, style: 'normal' },
  ],
  'plex-mono': [
    { file: 'IBMPlexMono-Regular.ttf', weight: 400, style: 'normal' },
    { file: 'IBMPlexMono-Medium.ttf', weight: 500, style: 'normal' },
    { file: 'IBMPlexMono-SemiBold.ttf', weight: 600, style: 'normal' },
  ],
  archivo: [
    { file: 'Archivo-SemiBold.ttf', weight: 600, style: 'normal' },
    { file: 'Archivo-Bold.ttf', weight: 700, style: 'normal' },
  ],
  'source-serif': [
    { file: 'SourceSerif4-Regular.ttf', weight: 400, style: 'normal' },
    { file: 'SourceSerif4-Italic.ttf', weight: 400, style: 'italic' },
    { file: 'SourceSerif4-Bold.ttf', weight: 700, style: 'normal' },
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

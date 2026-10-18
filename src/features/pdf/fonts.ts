import { Font } from '@react-pdf/renderer'

type PdfFontSource = {
  file: string
  weight: number
  style?: 'italic' | 'normal'
}

export type PdfFontFamily = 'plex-sans' | 'plex-mono' | 'archivo' | 'source-serif'

/**
 * TTF (bukan WOFF2) karena @react-pdf/renderer tidak mendukung WOFF2 (§2.3).
 * Semua file sudah di-subset latin; lihat `public/fonts/OFL-*.txt` untuk lisensi.
 */
const FONT_SOURCES: Record<PdfFontFamily, PdfFontSource[]> = {
  'plex-sans': [
    { file: 'IBMPlexSans-Regular.ttf', weight: 400 },
    { file: 'IBMPlexSans-Italic.ttf', weight: 400, style: 'italic' },
    { file: 'IBMPlexSans-Medium.ttf', weight: 500 },
    { file: 'IBMPlexSans-SemiBold.ttf', weight: 600 },
    { file: 'IBMPlexSans-Bold.ttf', weight: 700 },
  ],
  'plex-mono': [
    { file: 'IBMPlexMono-Regular.ttf', weight: 400 },
    { file: 'IBMPlexMono-Medium.ttf', weight: 500 },
    { file: 'IBMPlexMono-SemiBold.ttf', weight: 600 },
  ],
  archivo: [
    { file: 'Archivo-SemiBold.ttf', weight: 600 },
    { file: 'Archivo-Bold.ttf', weight: 700 },
  ],
  'source-serif': [
    { file: 'SourceSerif4-Regular.ttf', weight: 400 },
    { file: 'SourceSerif4-Italic.ttf', weight: 400, style: 'italic' },
    { file: 'SourceSerif4-Bold.ttf', weight: 700 },
  ],
}

/**
 * `resolveSrc` membedakan browser (`/fonts/x.ttf`) dan Node (path absolut),
 * supaya dokumen PDF yang sama bisa dirender di kedua tempat.
 */
export function registerPdfFonts(resolveSrc: (file: string) => string): void {
  // Ditemukan di spike Fase 0: hyphenation bawaan react-pdf memotong kata
  // Indonesia di tengah dan membuang sisa kata saat baris penuh ("...dan
  // menambahk" → "an antrian" hilang). Fase 5 (T5.1) mengganti ini dengan
  // kebijakan per-panjang-kata.
  Font.registerHyphenationCallback((word) => [word])

  for (const family of Object.keys(FONT_SOURCES) as PdfFontFamily[]) {
    Font.register({
      family,
      fonts: FONT_SOURCES[family].map(({ file, weight, style }) => ({
        src: resolveSrc(file),
        weight,
        ...(style ? { style } : {}),
      })),
    })
  }
}

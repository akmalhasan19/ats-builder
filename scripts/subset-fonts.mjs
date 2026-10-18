/**
 * T5.4 — sumber TTF ber-cakupan penuh + subset untuk ekspor PDF.
 *
 * Font layar (`public/fonts/*.ttf`/`*.woff2`) adalah potongan "latin" dari Google
 * Fonts: cmap-nya hanya ±250 glyph, sehingga `Ł`, `ź`, `ő`, `ș` hilang dan
 * pdf-lib diam-diam tidak menggambar glyph-nya. Untuk PDF itu tidak boleh terjadi
 * (Gate Fase 5: "tidak ada glyph hilang"), jadi skrip ini mengambil font lengkap,
 * memilih instance statisnya (font variabel `Plex Sans`/`Archivo`), lalu
 * men-subset ke rentang yang dibutuhkan dokumen CV.
 *
 * Sumber di-cache di `artifacts/font-sources/` (di luar git). Berkas hasil di
 * `public/fonts/pdf/` di-commit karena diambil exporter saat runtime.
 *
 * Jalankan: `node scripts/subset-fonts.mjs` (butuh jaringan saat cache kosong,
 * `pyftsubset` dari fonttools, dan `python` yang punya `fontTools` — override
 * lewat env `PYTHON`).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const GOOGLE_FONTS = 'https://raw.githubusercontent.com/google/fonts/main/ofl'

const UNICODES = [
  'U+0000-024F', // Latin Dasar, Latin-1 Supplement, Latin Extended-A/B
  'U+0259',
  'U+02B0-02FF', // modifier & spacing letters (ʼ, ˆ, ˇ)
  'U+2000-206F', // tanda baca umum (· – — ‘ ’ “ ” … •)
  'U+20A0-20BF', // mata uang
  'U+2122,U+2190-2193,U+2212',
].join(',')

const SOURCES = [
  {
    file: 'IBMPlexSans-Regular.ttf',
    url: `${GOOGLE_FONTS}/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf`,
    axes: ['wght=400', 'wdth=100'],
  },
  {
    file: 'IBMPlexSans-Medium.ttf',
    url: `${GOOGLE_FONTS}/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf`,
    axes: ['wght=500', 'wdth=100'],
  },
  {
    file: 'IBMPlexSans-SemiBold.ttf',
    url: `${GOOGLE_FONTS}/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf`,
    axes: ['wght=600', 'wdth=100'],
  },
  {
    file: 'IBMPlexMono-Regular.ttf',
    url: `${GOOGLE_FONTS}/ibmplexmono/IBMPlexMono-Regular.ttf`,
  },
  {
    file: 'IBMPlexMono-SemiBold.ttf',
    url: `${GOOGLE_FONTS}/ibmplexmono/IBMPlexMono-SemiBold.ttf`,
  },
  {
    file: 'Archivo-SemiBold.ttf',
    url: `${GOOGLE_FONTS}/archivo/Archivo%5Bwdth,wght%5D.ttf`,
    axes: ['wght=600', 'wdth=100'],
  },
]

const python = process.env.PYTHON ?? 'python'
const cacheDir = path.resolve('artifacts', 'font-sources')
const outDir = path.resolve('public', 'fonts', 'pdf')
mkdirSync(cacheDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

async function download(url, target) {
  if (existsSync(target)) return
  const response = await fetch(url)
  if (!response.ok) throw new Error(`gagal mengunduh ${url}: ${response.status}`)
  writeFileSync(target, new Uint8Array(await response.arrayBuffer()))
}

for (const source of SOURCES) {
  const downloaded = path.join(cacheDir, path.basename(new URL(source.url).pathname))
  await download(source.url, downloaded)

  const staticFile = path.join(cacheDir, `static-${source.file}`)
  if (source.axes && !existsSync(staticFile)) {
    execFileSync(python, [
      '-m',
      'fontTools.varLib.instancer',
      downloaded,
      ...source.axes,
      '-o',
      staticFile,
    ])
  }

  const subset = path.join(outDir, source.file)
  execFileSync('pyftsubset', [
    source.axes ? staticFile : downloaded,
    `--output-file=${subset}`,
    `--unicodes=${UNICODES}`,
    // Hanya feature penempatan yang disimpan. Ligatur GSUB (liga/clig/calt) akan
    // mengganti "fi" dengan satu glyph gabungan yang tidak punya padanan Unicode,
    // sehingga parser membaca "high-traf c". Dokumen ATS tidak boleh bergantung
    // pada substitusi glyph apa pun (P5/§2.3).
    '--layout-features=kern',
    '--no-hinting',
  ])
  console.log(`${source.file}: ${(statSync(subset).size / 1024).toFixed(1)} KB`)
}

const total = readdirSync(outDir)
  .filter((name) => name.endsWith('.ttf'))
  .reduce((sum, name) => sum + statSync(path.join(outDir, name)).size, 0)
console.log(`total subset PDF: ${(total / 1024).toFixed(1)} KB`)

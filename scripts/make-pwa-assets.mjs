/**
 * Generator ikon PWA dari logo merek, tanpa dependensi baru.
 *
 * Sumber: `public/vetra-mark.png` (turunan `vetra_logo.webp` yang sudah
 * dipangkas & diberi padding — dibuat sekali dari file logo asli).
 * Output: `public/icon-192.png`, `public/icon-512.png`,
 * `public/apple-touch-icon.png`. Jalankan: `node scripts/make-pwa-assets.mjs`.
 *
 * `public/og-cover.png` TIDAK dibuat di sini: gambar itu butuh rasterisasi teks
 * (wordmark "Vetra") yang tidak tersedia di Node tanpa dependensi tambahan,
 * jadi di-commit sebagai aset yang sudah jadi.
 *
 * PNG dibaca/ditulis langsung lewat zlib bawaan Node (IHDR + IDAT, RGBA 8-bit),
 * supaya repo tidak menambah pustaka gambar hanya untuk tiga ikon.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const SOURCE = 'public/vetra-mark.png'
const TARGETS = [
  ['public/icon-192.png', 192, 0.13],
  ['public/icon-512.png', 512, 0.13],
  ['public/apple-touch-icon.png', 180, 0.12],
]
const BACKGROUND = '#FFFFFF'

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Dekode PNG RGBA 8-bit non-interlaced (cukup untuk aset di repo ini). */
function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('Bukan berkas PNG')
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat = []
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
      if (data[8] !== 8 || data[12] !== 0) throw new Error('Hanya PNG 8-bit non-interlaced')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  if (colorType !== 6) throw new Error(`Butuh PNG RGBA (colorType 6), dapat ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const out = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? out[x - 4] : 0
      const up = prev ? prev[x] : 0
      const upLeft = prev && x >= 4 ? prev[x - 4] : 0
      let value = row[x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += Math.floor((left + up) / 2)
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      } else if (filter !== 0) {
        throw new Error(`Filter PNG ${filter} tidak dikenal`)
      }
      out[x] = value & 0xff
    }
  }
  return { width, height, pixels }
}

/** Box-filter downscale — cukup untuk 512 → 192/180 dan tidak butuh gamma. */
function resize(source, targetWidth, targetHeight) {
  const out = Buffer.alloc(targetWidth * targetHeight * 4)
  const scaleX = source.width / targetWidth
  const scaleY = source.height / targetHeight
  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor(y * scaleY)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY))
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor(x * scaleX)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let count = 0
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const index = (sy * source.width + sx) * 4
          const alpha = source.pixels[index + 3]
          r += source.pixels[index] * alpha
          g += source.pixels[index + 1] * alpha
          b += source.pixels[index + 2] * alpha
          a += alpha
          count += 1
        }
      }
      const target = (y * targetWidth + x) * 4
      if (a > 0) {
        out[target] = Math.round(r / a)
        out[target + 1] = Math.round(g / a)
        out[target + 2] = Math.round(b / a)
      }
      out[target + 3] = Math.round(a / count)
    }
  }
  return out
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** Logo di atas kanvas persegi berwarna latar, dengan padding proporsional. */
function appIcon(source, size, padRatio) {
  const canvas = Buffer.alloc(size * size * 4)
  const [r, g, b] = hexToRgb(BACKGROUND)
  for (let i = 0; i < size * size; i += 1) {
    canvas[i * 4] = r
    canvas[i * 4 + 1] = g
    canvas[i * 4 + 2] = b
    canvas[i * 4 + 3] = 255
  }

  const inner = Math.round(size * (1 - padRatio * 2))
  const scale = Math.min(inner / source.width, inner / source.height)
  const logoW = Math.max(1, Math.round(source.width * scale))
  const logoH = Math.max(1, Math.round(source.height * scale))
  const logo = resize(source, logoW, logoH)
  const offsetX = Math.round((size - logoW) / 2)
  const offsetY = Math.round((size - logoH) / 2)

  for (let y = 0; y < logoH; y += 1) {
    for (let x = 0; x < logoW; x += 1) {
      const from = (y * logoW + x) * 4
      const alpha = logo[from + 3] / 255
      if (alpha === 0) continue
      const to = ((y + offsetY) * size + (x + offsetX)) * 4
      canvas[to] = Math.round(logo[from] * alpha + canvas[to] * (1 - alpha))
      canvas[to + 1] = Math.round(logo[from + 1] * alpha + canvas[to + 1] * (1 - alpha))
      canvas[to + 2] = Math.round(logo[from + 2] * alpha + canvas[to + 2] * (1 - alpha))
    }
  }
  return encodePng(size, size, canvas)
}

const source = decodePng(readFileSync(SOURCE))
for (const [path, size, pad] of TARGETS) {
  const bytes = appIcon(source, size, pad)
  writeFileSync(path, bytes)
  console.log(`${path}: ${size}×${size}, ${bytes.length} byte`)
}

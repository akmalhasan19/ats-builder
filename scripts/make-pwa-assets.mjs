/**
 * T8.8 (Opsi B) — generator aset PWA/SEO tanpa dependensi baru.
 * Menulis PNG murni lewat zlib bawaan Node: ikon 192/512 (BrandMark di atas
 * cyanotype) dan og-cover 1200×630 (lembar A4 + stabilo, tanpa teks).
 * Jalankan sekali: `node scripts/make-pwa-assets.mjs`. Output di-commit ke
 * `public/` karena jarang berubah dan dibutuhkan juga oleh dev server.
 */
import { writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'

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
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function canvas(width, height, fill) {
  const [r, g, b] = hexToRgb(fill)
  const buf = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    buf[i * 4] = r
    buf[i * 4 + 1] = g
    buf[i * 4 + 2] = b
    buf[i * 4 + 3] = 255
  }
  return buf
}

function rect(buf, width, x, y, w, h, fill) {
  const [r, g, b] = hexToRgb(fill)
  for (let j = Math.max(0, y); j < Math.min(y + h, buf.length / (width * 4)); j += 1) {
    for (let i = Math.max(0, x); i < Math.min(x + w, width); i += 1) {
      const o = (j * width + i) * 4
      buf[o] = r
      buf[o + 1] = g
      buf[o + 2] = b
    }
  }
}

/** Kertas A4 tiruan: badan putih + garis isi + satu goresan stabilo. */
function paper(buf, width, x, y, w, h) {
  rect(buf, width, x, y, w, h, '#FFFFFF')
  const lineH = Math.max(2, Math.round(h * 0.022))
  const gap = Math.round(h * 0.045)
  let cy = y + Math.round(h * 0.12)
  rect(buf, width, x + Math.round(w * 0.12), cy, Math.round(w * 0.5), lineH + 2, '#10161F')
  cy += lineH + gap + 2
  for (let l = 0; l < 3; l += 1) {
    rect(buf, width, x + Math.round(w * 0.12), cy, Math.round(w * 0.76), lineH, '#D3D9E0')
    cy += lineH + gap
  }
  rect(
    buf,
    width,
    x + Math.round(w * 0.12),
    cy,
    Math.round(w * 0.76),
    Math.round(h * 0.07),
    '#F2D600',
  )
}

function appIcon(size) {
  const buf = canvas(size, size, '#0F5A78')
  const m = Math.round(size * 0.2)
  paper(buf, size, m, Math.round(size * 0.14), size - m * 2, Math.round(size * 0.72))
  return encodePng(size, size, buf)
}

function ogCover() {
  const W = 1200
  const H = 630
  const buf = canvas(W, H, '#EDF0F4')
  rect(buf, W, 0, H - 26, W, 26, '#0F5A78')
  paper(buf, W, 96, 60, 330, 510)
  rect(buf, W, 500, 130, 560, 44, '#10161F')
  for (let l = 0; l < 4; l += 1) rect(buf, W, 500, 210 + l * 40, 560 - l * 60, 16, '#B4BCC6')
  rect(buf, W, 500, 390, 380, 34, '#F2D600')
  for (let l = 0; l < 2; l += 1) rect(buf, W, 500, 448 + l * 40, 500 - l * 80, 16, '#B4BCC6')
  return encodePng(W, H, buf)
}

const ASSETS = [
  ['public/icon-192.png', appIcon(192)],
  ['public/icon-512.png', appIcon(512)],
  ['public/og-cover.png', ogCover()],
]

for (const [path, bytes] of ASSETS) {
  writeFileSync(path, bytes)
  const sigOk = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
  // IDAT = satu chunk; kumpulkan semua chunk IDAT lalu inflate (tanpa IEND).
  let idat = Buffer.alloc(0)
  let off = 8
  while (off + 8 <= bytes.length) {
    const len = bytes.readUInt32BE(off)
    const type = bytes.subarray(off + 4, off + 8).toString('ascii')
    const data = bytes.subarray(off + 8, off + 8 + len)
    if (type === 'IDAT') idat = Buffer.concat([idat, data])
    off += 12 + len
  }
  const inflated = inflateSync(idat)
  console.log(
    `${path}: ${bytes.length} byte, signature PNG ${sigOk ? 'valid' : 'RUSAK'}, piksel utuh (${inflated.length} byte raw)`,
  )
}

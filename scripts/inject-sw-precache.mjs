/**
 * T8.8 (Opsi B) — menyuntik daftar precache + versi ke `dist/sw.js` setelah
 * `vite build`. Tanpa ini `public/sw.js` hanya berisi placeholder dan tidak
 * meng-cache apa pun. Gagal = build gagal supaya gate offline tidak lolos diam-diam.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const DIST = 'dist'
const swPath = join(DIST, 'sw.js')
let sw = readFileSync(swPath, 'utf8')

const urls = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    const rel = `/${full.replace(/\\/g, '/').replace(/^dist\//, '')}`
    if (rel.startsWith('/assets/') || rel.startsWith('/fonts/')) urls.push(rel)
  }
}
walk(join(DIST, 'assets'))
walk(join(DIST, 'fonts'))

const uniq = [...new Set(urls)].sort()
// Versi harus ikut berubah saat ISI berkas berubah, bukan hanya daftar URL —
// kalau tidak, SW byte-identik tidak pernah di-reinstall dan pengguna mendapat
// aset stale dari cache lama setelah deploy berikutnya.
const hash = createHash('sha256')
for (const rel of uniq) {
  hash.update(rel, 'utf8')
  const file = join(DIST, rel.replace(/^\//, ''))
  // '/' dan '/index.html' adalah URL yang dilayani dari berkas yang sama;
  // hanya berkas nyata yang ikut di-hash isinya.
  if (rel !== '/' && existsSync(file) && statSync(file).isFile()) hash.update(readFileSync(file))
}
const version = hash.digest('hex').slice(0, 12)

sw = sw.replace('__SW_VERSION__', version).replace('__PRECACHE_URLS__', JSON.stringify(uniq))
writeFileSync(swPath, sw)
console.log(`sw.js: precache ${uniq.length} URL, versi ${version}`)

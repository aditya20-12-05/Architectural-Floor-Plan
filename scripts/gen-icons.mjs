// Rasterize public/icon.svg into the PNG sizes the PWA manifest needs.
// Run once after changing the icon:  node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pub = join(import.meta.dirname, '..', 'public')
const svg = readFileSync(join(pub, 'icon.svg'))

const out = (size, name) =>
  sharp(svg, { density: 512 }).resize(size, size).png().toFile(join(pub, name))

await Promise.all([
  out(192, 'pwa-192x192.png'),
  out(512, 'pwa-512x512.png'),
  out(180, 'apple-touch-icon.png'),
  out(64, 'favicon.png'),
])

console.log('PWA icons generated in public/')

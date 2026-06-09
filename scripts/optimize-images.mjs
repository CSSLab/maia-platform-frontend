#!/usr/bin/env node
/**
 * Resize oversized homepage source images in place.
 *
 * These assets (team avatars, paper-card previews) are only rendered on the
 * homepage at small sizes via next/image, but the source files ship at up to
 * 2673px / 1.6MB. We downscale them to ~2x their largest display size so the
 * repo stays lean and the Next image optimizer has less work to do. Final
 * delivery format/size is still handled by next/image at request time.
 *
 * Usage: node scripts/optimize-images.mjs [--dry]
 */
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const DRY = process.argv.includes('--dry')
const ROOT = path.resolve(import.meta.dirname, '..')

// dir -> max edge (px). 2x the largest rendered size.
const TARGETS = [
  { dir: 'public/assets/team', maxEdge: 320 },
  { dir: 'public/assets/papers', maxEdge: 900 },
]

const EXEC = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png' }

const kb = (n) => `${(n / 1024).toFixed(0)}KB`

let beforeTotal = 0
let afterTotal = 0

for (const { dir, maxEdge } of TARGETS) {
  const abs = path.join(ROOT, dir)
  let files
  try {
    files = await readdir(abs)
  } catch {
    console.warn(`skip missing dir ${dir}`)
    continue
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    const fmt = EXEC[ext]
    if (!fmt) continue
    const fp = path.join(abs, file)
    const before = (await stat(fp)).size
    const img = sharp(fp)
    const meta = await img.metadata()
    const longest = Math.max(meta.width || 0, meta.height || 0)

    let pipeline = sharp(fp).rotate() // respect EXIF orientation
    if (longest > maxEdge) {
      pipeline = pipeline.resize({
        width: meta.width >= meta.height ? maxEdge : null,
        height: meta.height > meta.width ? maxEdge : null,
        withoutEnlargement: true,
      })
    }
    pipeline =
      fmt === 'jpeg'
        ? pipeline.jpeg({ quality: 82, mozjpeg: true })
        : pipeline.png({ compressionLevel: 9, palette: true })

    const buf = await pipeline.toBuffer()
    beforeTotal += before
    // Only rewrite if we actually save bytes.
    if (buf.length < before) {
      afterTotal += buf.length
      if (!DRY) await sharp(buf).toFile(fp)
      console.log(
        `${file.padEnd(16)} ${String(longest).padStart(4)}px ${kb(before).padStart(7)} -> ${kb(buf.length).padStart(7)} ${DRY ? '(dry)' : ''}`,
      )
    } else {
      afterTotal += before
      console.log(`${file.padEnd(16)} already optimal (${kb(before)})`)
    }
  }
}

console.log(
  `\nTotal: ${kb(beforeTotal)} -> ${kb(afterTotal)} (${(((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(0)}% smaller)`,
)

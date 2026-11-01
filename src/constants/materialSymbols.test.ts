import fs from 'fs'
import path from 'path'
import { MATERIAL_SYMBOLS } from './materialSymbols'

const NAME = /^[a-z][a-z0-9_]*$/

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [file]
      : []
  })

/** Where the opening tag that starts at `from` ends (its `>`), or -1. */
const openingTagEnd = (source: string, from: number) => {
  let depth = 0
  let quote: string | null = null
  for (let i = from; i < source.length; i++) {
    const c = source[i]
    if (quote) {
      if (c === quote && source[i - 1] !== '\\') quote = null
    } else if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0 && source[i - 1] !== '=') return i
  }
  return -1
}

/**
 * Icon names the code can show: the text and string literals inside elements
 * with the `material-symbols-outlined` class, and `icon="…"` props and
 * `icon: '…'` fields. Names computed elsewhere (e.g. helper functions that
 * return one) are not found, so check those by hand.
 */
const iconNamesInCode = () => {
  const names = new Map<string, string>()
  for (const file of sourceFiles(path.join(process.cwd(), 'src'))) {
    const source = fs.readFileSync(file, 'utf8')
    const add = (name: string) => {
      if (NAME.test(name)) names.set(name, path.relative(process.cwd(), file))
    }
    for (const match of source.matchAll(/material-symbols-outlined/g)) {
      const index = match.index ?? 0
      // Only a class in a JSX opening tag: the tag around it ends after it.
      const end = openingTagEnd(source, source.lastIndexOf('<', index))
      if (end < index) continue
      const children = source.slice(end + 1, source.indexOf('<', end + 1))
      const text = children.replace(/\{[^}]*\}/g, ' ').trim()
      if (text) add(text)
      // A literal on its own or as a ternary's result, not compared against.
      for (const literal of children.matchAll(/[{?:]\s*'([^']*)'/g))
        add(literal[1])
    }
    for (const prop of source.matchAll(/\b[iI]con(?:="([^"]*)"|: *'([^']*)')/g))
      add(prop[1] ?? prop[2])
  }
  return names
}

describe('Material Symbols subset', () => {
  it('includes every icon name found in the code', () => {
    const found = iconNamesInCode()
    expect(found.size).toBeGreaterThan(50)
    const missing = [...found].filter(
      ([name]) => !MATERIAL_SYMBOLS.includes(name),
    )
    expect(missing).toEqual([])
  })

  it('is sorted and has no duplicates, as Google Fonts expects', () => {
    expect([...new Set(MATERIAL_SYMBOLS)].sort()).toEqual(MATERIAL_SYMBOLS)
  })
})

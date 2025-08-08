import { EcoDatabase, EcoOpening, EcoOpeningVariation } from 'src/types'
// We will prefer TSV sources. If they fail at runtime, we can fall back to JSON.
import aTsvUrl from './data/a.tsv'
import bTsvUrl from './data/b.tsv'
import cTsvUrl from './data/c.tsv'
import dTsvUrl from './data/d.tsv'
import eTsvUrl from './data/e.tsv'
import ecoAJson from './data/ecoA.json'
import ecoBJson from './data/ecoB.json'
import ecoCJson from './data/ecoC.json'
import ecoDJson from './data/ecoD.json'
import ecoEJson from './data/ecoE.json'

type RawEcoEntry = {
  src?: string
  eco: string // e.g., "A00"
  moves: string // PGN-like string
  name: string // e.g., "English Opening: Symmetrical Variation"
  scid?: string
  aliases?: Record<string, string>
}

type RawEcoFile = Record<string, RawEcoEntry> // key is FEN

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Parse a raw opening name into base name and optional variation.
// Heuristics:
// - Prefer comma as section divider, else colon, else no divider
// - Strip trailing parenthetical acronyms from the base (e.g., "(BDG)")
// - Normalize whitespace and unicode dashes
function parseOpeningName(rawName: string): {
  base: string
  variation: string | null
} {
  const unifiedDashes = rawName.replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  const cleaned = normalizeWhitespace(unifiedDashes)

  // Per dataset convention, names are structured as
  // "Opening family: Variation, Subvariation, ...".
  // So we MUST split on the first colon to separate the base (family)
  // and only then interpret commas as subvariation separators.
  const colonIdx = cleaned.indexOf(':')

  let base = cleaned
  let variation: string | null = null

  if (colonIdx !== -1) {
    base = cleaned.slice(0, colonIdx)
    variation = cleaned.slice(colonIdx + 1)
  }

  base = normalizeWhitespace(base.replace(/\s*\([^)]*\)\s*$/, ''))
  if (variation) variation = normalizeWhitespace(variation)

  return { base, variation }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return await res.text()
}

interface TsvRow {
  eco: string
  name: string
  pgn: string
}

function parseTsv(tsv: string): TsvRow[] {
  const lines = tsv.split(/\r?\n/)
  if (lines.length === 0) return []
  const header = lines[0].split('\t').map((h) => h.trim().toLowerCase())
  const ecoIdx = header.indexOf('eco')
  const nameIdx = header.indexOf('name')
  const pgnIdx = header.indexOf('pgn')
  const rows: TsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split('\t')
    const eco = cols[ecoIdx]?.trim()
    const name = cols[nameIdx]?.trim()
    const pgn = cols[pgnIdx]?.trim()
    if (!eco || !name || !pgn) continue
    rows.push({ eco, name, pgn })
  }
  return rows
}

async function buildEcoDatabaseFromTsv(): Promise<EcoDatabase> {
  // Load all TSV files in parallel
  const [a, b, c, d, e] = await Promise.all([
    fetchText(aTsvUrl),
    fetchText(bTsvUrl),
    fetchText(cTsvUrl),
    fetchText(dTsvUrl),
    fetchText(eTsvUrl),
  ])
  const allRows = [a, b, c, d, e].flatMap(parseTsv)

  // Map of section letter to map of openingKey -> EcoOpening (with variations aggregated)
  const sectionToOpeningsMap = new Map<string, Map<string, EcoOpening>>()

  for (const entry of allRows) {
    const ecoCode = entry.eco
    if (!ecoCode || ecoCode.length < 1) continue
    const sectionLetter = ecoCode.charAt(0)
    if (!sectionToOpeningsMap.has(sectionLetter)) {
      sectionToOpeningsMap.set(sectionLetter, new Map<string, EcoOpening>())
    }

    const { base: baseName, variation: variationNameRaw } = parseOpeningName(
      entry.name,
    )

    // Build opening key stable within ECO decade (e.g., A0, A1) so bases appear under the correct decade group
    const decade = `${ecoCode.slice(0, 2)}`
    const openingKey = `${decade}-${slugifyId(baseName)}`

    const openingsMap = sectionToOpeningsMap.get(sectionLetter) as Map<
      string,
      EcoOpening
    >

    if (!openingsMap.has(openingKey)) {
      const openingId = openingKey
      openingsMap.set(openingKey, {
        eco: ecoCode,
        id: openingId,
        name: baseName,
        description: baseName,
        pgn: entry.pgn,
        fen: '',
        variations: [],
      })
    }

    const opening = openingsMap.get(openingKey) as EcoOpening
    // Keep the smallest ECO code seen for this opening for display/sort
    if (opening.eco.localeCompare(ecoCode) > 0) {
      opening.eco = ecoCode
    }

    if (variationNameRaw && variationNameRaw.length > 0) {
      // Treat as a variation under the base opening
      const variationId = `${ecoCode}-${slugifyId(variationNameRaw)}`
      // Avoid duplicates by id+fen
      const hasSame = opening.variations.some(
        (v) => v.id === variationId && v.pgn === entry.pgn,
      )
      if (!hasSame) {
        const variation: EcoOpeningVariation = {
          eco: ecoCode,
          id: variationId,
          name: variationNameRaw,
          pgn: entry.pgn,
          fen: '',
        }
        opening.variations.push(variation)
      }
    } else {
      // Base record without explicit variation: prefer using this as the opening's main line
      // If multiple base entries exist, keep the shortest PGN as the main line
      if (!opening.pgn || entry.pgn.length < opening.pgn.length) {
        opening.pgn = entry.pgn
        opening.fen = ''
      }
    }
  }

  // Convert maps to arrays and sort
  const openings: Record<string, EcoOpening[]> = {}
  const sectionLetters = ['A', 'B', 'C', 'D', 'E']
  sectionLetters.forEach((letter) => {
    const map =
      sectionToOpeningsMap.get(letter) || new Map<string, EcoOpening>()
    const arr = Array.from(map.values())

    // Deduplicate variations inside each opening (by id and by fen)
    arr.forEach((o) => {
      const seen = new Set<string>()
      o.variations = o.variations.filter((v) => {
        const key = `${v.id}|${v.fen}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    })

    // Sort by ECO code then name
    arr.sort((a, b) =>
      a.eco === b.eco
        ? a.name.localeCompare(b.name)
        : a.eco.localeCompare(b.eco),
    )

    // Sort variations by name for consistency
    arr.forEach((o) =>
      o.variations.sort((a, b) => a.name.localeCompare(b.name)),
    )

    openings[letter] = arr
  })

  const totalOpenings = Object.values(openings).reduce(
    (sum, list) => sum + list.length,
    0,
  )

  const ecoDatabase: EcoDatabase = {
    meta: {
      title: 'Comprehensive Chess ECO Opening Database (Full)',
      description:
        'Complete database of chess openings aggregated from ECO data files A–E',
      version: '2.0.0',
      totalOpenings,
      ecoSections: sectionLetters,
    },
    openings,
  }

  return ecoDatabase
}

let cachedDatabase: EcoDatabase | null = null

export const getComprehensiveOpenings = async (): Promise<EcoDatabase> => {
  if (cachedDatabase) return cachedDatabase
  try {
    cachedDatabase = await buildEcoDatabaseFromTsv()
    return cachedDatabase
  } catch (e) {
    // Fallback to JSON if TSV fetch fails (e.g., during tests or SSR without asset URLs)
    const fallback = buildEcoDatabaseFromJson()
    cachedDatabase = fallback
    return fallback
  }
}

function buildEcoDatabaseFromJson(): EcoDatabase {
  const rawFiles: RawEcoFile[] = [
    ecoAJson as RawEcoFile,
    ecoBJson as RawEcoFile,
    ecoCJson as RawEcoFile,
    ecoDJson as RawEcoFile,
    ecoEJson as RawEcoFile,
  ]
  // Reuse the original JSON path by simulating rows with moves/name
  const jsonRows: { eco: string; name: string; pgn: string }[] = []
  for (const raw of rawFiles) {
    for (const [fen, entry] of Object.entries(raw)) {
      jsonRows.push({ eco: entry.eco, name: entry.name, pgn: entry.moves })
    }
  }
  // Build using the TSV pipeline with synthesized rows
  // (Duped minimal logic to avoid refactor complexity)
  const sectionToOpeningsMap = new Map<string, Map<string, EcoOpening>>()
  for (const entry of jsonRows) {
    const ecoCode = entry.eco
    if (!ecoCode || ecoCode.length < 1) continue
    const sectionLetter = ecoCode.charAt(0)
    if (!sectionToOpeningsMap.has(sectionLetter)) {
      sectionToOpeningsMap.set(sectionLetter, new Map<string, EcoOpening>())
    }
    const { base: baseName, variation: variationNameRaw } = parseOpeningName(
      entry.name,
    )
    const openingKey = `${sectionLetter}-${slugifyId(baseName)}`
    const openingsMap = sectionToOpeningsMap.get(sectionLetter) as Map<
      string,
      EcoOpening
    >
    if (!openingsMap.has(openingKey)) {
      const openingId = slugifyId(baseName)
      openingsMap.set(openingKey, {
        eco: ecoCode,
        id: openingId,
        name: baseName,
        description: baseName,
        pgn: entry.pgn,
        fen: '',
        variations: [],
      })
    }
    const opening = openingsMap.get(openingKey) as EcoOpening
    if (variationNameRaw && variationNameRaw.length > 0) {
      const variationId = slugifyId(variationNameRaw)
      const hasSame = opening.variations.some(
        (v) => v.id === variationId && v.pgn === entry.pgn,
      )
      if (!hasSame) {
        opening.variations.push({
          eco: ecoCode,
          id: variationId,
          name: variationNameRaw,
          pgn: entry.pgn,
          fen: '',
        })
      }
    } else {
      if (!opening.pgn || entry.pgn.length < opening.pgn.length) {
        opening.pgn = entry.pgn
      }
    }
  }
  const openings: Record<string, EcoOpening[]> = {}
  const sectionLetters = ['A', 'B', 'C', 'D', 'E']
  sectionLetters.forEach((letter) => {
    const map =
      sectionToOpeningsMap.get(letter) || new Map<string, EcoOpening>()
    const arr = Array.from(map.values())
    arr.forEach((o) => {
      const seen = new Set<string>()
      o.variations = o.variations.filter((v) => {
        const key = `${v.id}|${v.pgn}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    })
    arr.sort((a, b) =>
      a.eco === b.eco
        ? a.name.localeCompare(b.name)
        : a.eco.localeCompare(b.eco),
    )
    arr.forEach((o) =>
      o.variations.sort((a, b) => a.name.localeCompare(b.name)),
    )
    openings[letter] = arr
  })
  const totalOpenings = Object.values(openings).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  return {
    meta: {
      title: 'Comprehensive Chess ECO Opening Database (JSON Fallback)',
      description:
        'Complete database of chess openings aggregated from ECO JSON files A–E',
      version: '2.0.0-json',
      totalOpenings,
      ecoSections: sectionLetters,
    },
    openings,
  }
}

export * from './ecoProcessor'

/**
 * The geometry of the Moves by Rating chart: which moves are drawn and how,
 * and where their names go. Pure, so it can be tested without rendering.
 *
 * Every rating in the data (600 to 2600 on the analysis page) is a point. A move that never reaches 5% at
 * any rating is left off. The moves that matter at the rating chosen in the
 * Maia menu (its three most played, and Stockfish's best) are drawn in their
 * colour over a soft wash of it; their line widths nest (the most played
 * widest, underneath, each next one thinner on top) so a move that runs along
 * another still shows. Every other move is a thin grey line.
 *
 * Names: each coloured move is named at the right end of its line, and also
 * beside its point at the chosen rating with its share, but only where that
 * fits in clear space (no line through the name, none between it and its
 * point, no other name); moves bunched together there are named at the right
 * only, with their share in the hover readout.
 */

export const MIN_SHARE = 5
export const RATINGS = Array.from({ length: 21 }, (_, i) => 600 + 100 * i)
/** Line widths, by share at the chosen rating (most played first). */
export const NESTED_WIDTHS = [4, 2.75, 1.75, 1.25]

export interface ChartLine {
  key: string
  san: string
  color: string
  /** Probability (%) at each of the chart's ratings. */
  values: number[]
}

export interface Box {
  l: number
  r: number
  t: number
  b: number
}

export interface MarkerLabel {
  key: string
  side: 1 | -1
  /** Where the text sits: its inner edge (x) and middle (y). */
  x: number
  y: number
  /** The point it names. */
  px: number
  py: number
}

export interface Layout {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
  domain: number
  index: number
  /** The chosen rating is at the right edge: shares go with the right names. */
  edge: boolean
  ratings: number[]
  /** The last point's index. */
  last: number
  x: (i: number) => number
  y: (v: number) => number
  kept: ChartLine[]
  /** The coloured moves, most played at the chosen rating first. */
  focus: ChartLine[]
  grey: ChartLine[]
  markerLabels: MarkerLabel[]
  rightLabels: { key: string; y: number; lineY: number }[]
  markerTitleLeft: boolean
  yTicks: number[]
  xTicks: number[]
}

const peak = (l: ChartLine) => Math.max(...l.values)

/** Spreads labels at least `gap` apart between `top` and `bottom`. */
export const spread = <T extends { y: number }>(
  items: T[],
  gap: number,
  top: number,
  bottom: number,
): (T & { ly: number })[] => {
  const s = [...items]
    .sort((a, b) => a.y - b.y)
    .map((it) => ({ ...it, ly: it.y }))
  s.forEach((it, k) => {
    it.ly = k === 0 ? Math.max(top, it.y) : Math.max(it.y, s[k - 1].ly + gap)
  })
  for (let k = s.length - 1; k >= 0; k--) {
    const lim = k === s.length - 1 ? bottom : s[k + 1].ly - gap
    if (s[k].ly > lim) s[k].ly = lim
  }
  return s
}

export const shareText = (v: number) =>
  (v < 0.05 ? '<0.1' : v >= 9.95 ? String(Math.round(v)) : v.toFixed(1)) + '%'

/** An estimate of a name-and-share label's width at 11px. */
const labelWidth = (text: string) => 6.6 * text.length + 4

export const buildLayout = (
  lines: ChartLine[],
  selectedRating: number,
  stockfishBest: string | undefined,
  width: number,
  height: number,
  ratings: number[] = RATINGS,
): Layout => {
  const last = ratings.length - 1
  let index = 0
  ratings.forEach((r, i) => {
    if (
      Math.abs(r - selectedRating) < Math.abs(ratings[index] - selectedRating)
    )
      index = i
  })
  // Near the right end there is no room beside the points: the shares go
  // with the names at the right.
  const edge = index >= last - 2
  const kept = lines.filter((l) => peak(l) >= MIN_SHARE)
  const ranked = [...kept].sort((a, b) => b.values[index] - a.values[index])
  const focusSet = new Set(ranked.slice(0, 3))
  for (const l of kept) if (l.key === stockfishBest) focusSet.add(l)
  const focus = ranked.filter((l) => focusSet.has(l))
  const grey = kept.filter((l) => !focusSet.has(l))

  const left = 40
  const right = edge ? 74 : 50
  const top = 14
  const bottom = 20
  const domain = Math.max(0, ...kept.flatMap((l) => l.values)) > 60 ? 100 : 60
  const x = (i: number) => left + (i / last) * (width - left - right)
  const y = (v: number) => top + (1 - v / domain) * (height - top - bottom)
  const lineAt = (l: ChartLine, px: number) => {
    const t = ((px - x(0)) / (x(last) - x(0))) * last
    const i = Math.max(0, Math.min(last - 1, Math.floor(t)))
    const f = Math.min(1, Math.max(0, t - i))
    return y(l.values[i] + f * (l.values[i + 1] - l.values[i]))
  }

  // The title of the marker sits on the side the labels don't prefer.
  const prefer: 1 | -1 = index <= last / 2 ? 1 : -1
  const markerTitleLeft = prefer > 0 || edge
  const placed: Box[] = [
    markerTitleLeft
      ? { l: x(index) - 67, r: x(index) - 5, t: top - 12, b: top - 1 }
      : { l: x(index) + 5, r: x(index) + 67, t: top - 12, b: top - 1 },
  ]
  const markerLabels: MarkerLabel[] = []
  if (!edge) {
    for (const l of focus) {
      const text = `${l.san} ${shareText(l.values[index])}`
      const tw = labelWidth(text)
      const th = 13
      const py = y(l.values[index])
      const spots: [1 | -1, number][] = [
        [prefer, 0],
        [-prefer as 1 | -1, 0],
        [prefer, -11],
        [-prefer as 1 | -1, -11],
        [prefer, -20],
        [-prefer as 1 | -1, -20],
      ]
      for (const [side, dy] of spots) {
        const cy = py + dy
        const bx = side > 0 ? x(index) + 8 : x(index) - 8 - tw
        const box = { l: bx, r: bx + tw, t: cy - th / 2, b: cy + th / 2 }
        if (box.l < left || box.r > width - right || box.t < 2) continue
        if (box.b > height - bottom) continue
        let ok = !placed.some(
          (p) =>
            p.l < box.r + 2 &&
            box.l < p.r + 2 &&
            p.t < box.b + 1 &&
            box.t < p.b + 1,
        )
        for (const o of kept) {
          for (let px = box.l; px <= box.r && ok; px += 2) {
            const oy = lineAt(o, px)
            if (oy > box.t - 1 && oy < box.b + 1) ok = false
          }
        }
        // Nothing between the name and its own line.
        for (const o of kept) {
          if (!ok || o === l) continue
          const cx = (box.l + box.r) / 2
          const oy = lineAt(o, cx)
          const own = lineAt(l, cx)
          if (oy > Math.min(box.b, own) - 1 && oy < Math.max(box.t, own) + 1) {
            ok = false
          }
        }
        if (!ok) continue
        placed.push(box)
        markerLabels.push({
          key: l.key,
          side,
          x: side > 0 ? box.l + 2 : box.r - 2,
          y: cy,
          px: x(index),
          py,
        })
        break
      }
    }
  }

  const rightLabels = spread(
    focus.map((l) => ({ key: l.key, y: y(l.values[last]) })),
    12,
    top,
    height - bottom,
  ).map((it) => ({ key: it.key, y: it.ly, lineY: it.y }))

  const short = height < 200
  const yTicks =
    domain === 100
      ? short
        ? [0, 50, 100]
        : [0, 25, 50, 75, 100]
      : short
        ? [0, 30, 60]
        : [0, 20, 40, 60]
  // Every 400 points from the first rating (every 1000 on a narrow chart), and
  // the last.
  const first = ratings[0]
  const step = width < 380 ? 1000 : 400
  const xTicks = ratings.filter(
    (r, i) => (r - first) % step === 0 || i === last,
  )

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    domain,
    index,
    edge,
    ratings,
    last,
    x,
    y,
    kept,
    focus,
    grey,
    markerLabels,
    rightLabels,
    markerTitleLeft,
    yTicks,
    xTicks,
  }
}

/** The move nearest a point of the plot, within 14px of its line. */
export const nearestMove = (layout: Layout, vx: number, vy: number) => {
  const { x, y, kept, last } = layout
  if (vx < x(0) - 4 || vx > x(last) + 4) return null
  const px = Math.min(x(last), Math.max(x(0), vx))
  const t = ((px - x(0)) / (x(last) - x(0))) * last
  const i = Math.max(0, Math.min(last - 1, Math.floor(t)))
  const f = Math.min(1, Math.max(0, t - i))
  let best: string | null = null
  let distance = 14
  for (const l of kept) {
    const d = Math.abs(
      y(l.values[i] + f * (l.values[i + 1] - l.values[i])) - vy,
    )
    if (d < distance) {
      distance = d
      best = l.key
    }
  }
  return best
}

// Colours: a move's name is written in its line's colour, lightened (same
// hue) until it reads on the dark panel at 4.5:1.
const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const fromLinear = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
const rgbOf = (hex: string) => {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
}
const luminance = (hex: string) => {
  const [r, g, b] = rgbOf(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}
const toOklab = (hex: string) => {
  const [r, g, b] = rgbOf(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const fromOklab = ([L, a, b]: number[]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, fromLinear(c))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
export const nameColor = (hex: string, panel: string) => {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return hex
  let lab = toOklab(hex)
  let c = hex
  for (let k = 0; k < 20 && contrast(c, panel) < 4.5; k++) {
    lab = [lab[0] + 0.03, lab[1] * 0.97, lab[2] * 0.97]
    c = fromOklab(lab)
  }
  return c
}

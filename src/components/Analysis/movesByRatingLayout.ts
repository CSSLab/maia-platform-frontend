/**
 * The geometry of the Moves by Rating chart: how each move is drawn and where
 * its names go. Pure, so it can be tested without rendering.
 *
 * The plot area is the same at every rating and in every position: labels fit
 * around the data, never the data around the labels. Every rating in the data
 * (600 to 2600 on the analysis page) is a point. Every move given is drawn
 * (which moves: chartMoves, in useMoveRecommendations) in its colour over a
 * soft wash of it, and named. Line widths nest by share at the rating chosen in
 * the Maia menu (the most played widest, underneath, each next one thinner on
 * top) so a move that runs along another still shows.
 *
 * Names, in the move's colour, at most twice:
 * - at the right end of every line;
 * - at a strong peak inside the range (a move most played at middle ratings),
 *   just above it, where that fits.
 * At the chosen rating, each move's share beside its point, in the move's
 * colour (no name: the point is on a named line), where that fits in clear
 * space (no line through
 * it, none between it and its point, no other label); bunched moves keep
 * their share in the hover readout.
 */

export const RATINGS = Array.from({ length: 21 }, (_, i) => 600 + 100 * i)
/** Line widths, by share at the chosen rating (most played first). */
export const NESTED_WIDTHS = [4, 3, 2.25, 1.75, 1.5, 1.25]

// The plot area's margins: fixed, whatever the rating or the moves.
const LEFT = 66
const RIGHT = 64
const TOP = 18
const BOTTOM = 28

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
  /** The point whose share it gives. */
  px: number
  py: number
}

export interface PeakLabel {
  key: string
  /** The text's centre. */
  x: number
  y: number
  /** The point of the line it names. */
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
  ratings: number[]
  /** The last point's index. */
  last: number
  x: (i: number) => number
  y: (v: number) => number
  /** The moves drawn, most played at the chosen rating first. */
  kept: ChartLine[]
  markerLabels: MarkerLabel[]
  peakLabels: PeakLabel[]
  rightLabels: { key: string; y: number; lineY: number; size: number }[]
  markerTitleLeft: boolean
  /** Font size of the moves' names and shares (px). */
  nameSize: number
  /** The y-axis title, as large as the axis is tall allows. */
  yTitle: { text: string; size: number; x: number; y: number }
  yTicks: number[]
  xTicks: number[]
}

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

/** An estimate of a semibold label's width (0.64 em a character). */
const labelWidth = (text: string, size: number) => 0.64 * size * text.length + 4

/**
 * The y axis's top: the smallest of these the moves fit under, so the axis
 * takes one of a few familiar scales rather than a new one each position.
 */
export const Y_TOPS = [20, 40, 60, 80, 100]
/** Each top's ticks: on a chart of normal height, and on a short one. */
const Y_TICKS: Record<number, [number[], number[]]> = {
  20: [
    [0, 5, 10, 15, 20],
    [0, 10, 20],
  ],
  40: [
    [0, 10, 20, 30, 40],
    [0, 20, 40],
  ],
  60: [
    [0, 20, 40, 60],
    [0, 30, 60],
  ],
  80: [
    [0, 20, 40, 60, 80],
    [0, 40, 80],
  ],
  100: [
    [0, 25, 50, 75, 100],
    [0, 50, 100],
  ],
}

const Y_TITLE = 'Maia Probability'
const Y_TITLE_SHORT = 'Maia %'
const Y_TITLE_MAX_PX = 13
const Y_TITLE_MIN_PX = 10

/**
 * The index of a strong peak inside the range, or -1: the move's largest
 * share, at least two ratings from either end, and well above both ends (by
 * 8 points and by a quarter of the peak).
 */
export const interiorPeak = (values: number[]) => {
  const last = values.length - 1
  const top = Math.max(...values)
  const i = values.indexOf(top)
  if (i < 2 || i > last - 2) return -1
  const rise = top - Math.max(values[0], values[last])
  return rise >= Math.max(8, 0.25 * top) ? i : -1
}

export const buildLayout = (
  lines: ChartLine[],
  selectedRating: number,
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
  const kept = [...lines].sort((a, b) => b.values[index] - a.values[index])

  const nameSize = width < 380 ? 12 : 13
  const left = LEFT
  const right = RIGHT
  const top = TOP
  const bottom = BOTTOM
  const most = Math.max(0, ...kept.flatMap((l) => l.values))
  const domain = Y_TOPS.find((t) => most <= t) ?? 100
  const x = (i: number) => left + (i / last) * (width - left - right)
  const y = (v: number) => top + (1 - v / domain) * (height - top - bottom)
  const lineAt = (l: ChartLine, px: number) => {
    const t = ((px - x(0)) / (x(last) - x(0))) * last
    const i = Math.max(0, Math.min(last - 1, Math.floor(t)))
    const f = Math.min(1, Math.max(0, t - i))
    return y(l.values[i] + f * (l.values[i + 1] - l.values[i]))
  }
  const th = nameSize + 3
  const placed: Box[] = []
  const overlaps = (box: Box) =>
    placed.some(
      (p) =>
        p.l < box.r + 2 &&
        box.l < p.r + 2 &&
        p.t < box.b + 1 &&
        box.t < p.b + 1,
    )
  /** No line through the box, and none between it and its own line. */
  const clear = (box: Box, own: ChartLine) => {
    for (const o of kept) {
      for (let px = box.l; px <= box.r; px += 2) {
        if (px < x(0) || px > x(last)) continue
        const oy = lineAt(o, px)
        if (oy > box.t - 1 && oy < box.b + 1) return false
      }
    }
    const cx = Math.min(x(last), Math.max(x(0), (box.l + box.r) / 2))
    const ownY = lineAt(own, cx)
    for (const o of kept) {
      if (o === own) continue
      const oy = lineAt(o, cx)
      if (oy > Math.min(box.b, ownY) - 1 && oy < Math.max(box.t, ownY) + 1) {
        return false
      }
    }
    return true
  }

  // Right-end names first: their places are fixed. A name too long for the
  // margin is set smaller.
  const rightLabels = spread(
    kept.map((l) => ({ key: l.key, y: y(l.values[last]), san: l.san })),
    nameSize + 2,
    top,
    height - bottom,
  ).map((it) => {
    const room = right - 14
    const size = Math.min(nameSize, room / (0.64 * it.san.length))
    placed.push({
      l: x(last) + 10,
      r: x(last) + 12 + labelWidth(it.san, size),
      t: it.ly - th / 2,
      b: it.ly + th / 2,
    })
    return { key: it.key, y: it.ly, lineY: it.y, size }
  })

  // The marker's title sits on the side the labels don't prefer. Labels may
  // use the strip above the plot, clear of it.
  const prefer: 1 | -1 = index <= last / 2 ? 1 : -1
  const markerTitleLeft = prefer > 0
  placed.push(
    markerTitleLeft
      ? { l: x(index) - 67, r: x(index) - 5, t: top - 14, b: top - 3 }
      : { l: x(index) + 5, r: x(index) + 67, t: top - 14, b: top - 3 },
  )

  // A strong peak inside the range is named just above it (never under a
  // line). Names go before the shares at the chosen rating.
  const peakLabels: PeakLabel[] = []
  for (const l of kept) {
    const p = interiorPeak(l.values)
    if (p < 0) continue
    const tw = labelWidth(l.san, nameSize)
    const tries = [0, -1, 1, -2, 2, -3, 3]
      .map((d) => p + d)
      .filter((i) => i > 0 && i < last && l.values[i] >= 0.8 * l.values[p])
    for (const i of tries) {
      const py = y(l.values[i])
      const cx = Math.min(Math.max(x(i), left + tw / 2), width - right - tw / 2)
      const cy = py - nameSize
      const box = {
        l: cx - tw / 2,
        r: cx + tw / 2,
        t: cy - th / 2,
        b: cy + th / 2,
      }
      if (box.t < 2 || overlaps(box) || !clear(box, l)) continue
      placed.push(box)
      peakLabels.push({ key: l.key, x: cx, y: cy, px: x(i), py })
      break
    }
  }

  // Each move's share at the chosen rating, beside its point. At the last
  // rating only to the left, where the right-end names aren't.
  const markerLabels: MarkerLabel[] = []
  for (const l of kept) {
    const tw = labelWidth(shareText(l.values[index]), nameSize)
    const py = y(l.values[index])
    const sides: (1 | -1)[] =
      index === last ? [-1] : [prefer, -prefer as 1 | -1]
    const spots: [1 | -1, number][] = [
      0,
      -(nameSize + 1),
      -2 * nameSize,
    ].flatMap((dy) => sides.map((side): [1 | -1, number] => [side, dy]))
    for (const [side, dy] of spots) {
      const cy = py + dy
      const bx = side > 0 ? x(index) + 8 : x(index) - 8 - tw
      const box = { l: bx, r: bx + tw, t: cy - th / 2, b: cy + th / 2 }
      if (box.l < left - 4 || box.r > width - 2 || box.t < 2) continue
      if (box.b > height - bottom) continue
      if (overlaps(box) || !clear(box, l)) continue
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

  // The axis title is centred on the axis, as large as it is tall allows,
  // shortened on a short chart, and kept well clear of the numbers.
  const axisHeight = height - top - bottom
  const fit = (text: string) =>
    Math.min(Y_TITLE_MAX_PX, axisHeight / (text.length * 0.6))
  const yTitleText = fit(Y_TITLE) >= Y_TITLE_MIN_PX ? Y_TITLE : Y_TITLE_SHORT
  const yTitle = {
    text: yTitleText,
    size: fit(yTitleText),
    x: 12,
    y: top + axisHeight / 2,
  }

  const yTicks = Y_TICKS[domain][height < 200 ? 1 : 0]
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
    ratings,
    last,
    x,
    y,
    kept,
    markerLabels,
    peakLabels,
    rightLabels,
    markerTitleLeft,
    nameSize,
    yTitle,
    yTicks,
    xTicks,
  }
}

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

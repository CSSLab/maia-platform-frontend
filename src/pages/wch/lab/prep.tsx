import Head from 'next/head'
import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.ts'

import {
  ANALYTICS,
  PLAYERS,
  PlayerId,
  TREE_GUKESH_WHITE,
  TREE_SINDAROV_WHITE,
  TreeNode,
  pct,
} from 'src/components/WCh/data'
import { LabBar, PlayerName, WchBoard } from 'src/components/WCh/ui'

type Assignment = 'gukesh' | 'sindarov'

const nodeAt = (roots: TreeNode[], path: number[]) => {
  let list = roots
  const nodes: TreeNode[] = []
  for (const i of path) {
    const node = list[i]
    if (!node) break
    nodes.push(node)
    list = node.children ?? []
  }
  return nodes
}

/** Follows the most likely child from a node until the tree ends. */
const likeliestPath = (roots: TreeNode[], start: number[] = []) => {
  const path = [...start]
  let list: TreeNode[] =
    path.length === 0
      ? roots
      : (nodeAt(roots, path).slice(-1)[0]?.children ?? [])
  while (list && list.length) {
    let best = 0
    list.forEach((n, i) => {
      if (n.p > list[best].p) best = i
    })
    path.push(best)
    list = list[best].children ?? []
  }
  return path
}

const ratio = (n: TreeNode) => n.p / Math.max(n.g, 0.005)
const isDeparture = (n: TreeNode) =>
  Math.abs(n.p - n.g) >= 0.06 && (ratio(n) >= 1.5 || ratio(n) <= 0.67)

const moveNo = (depth: number) =>
  `${Math.floor(depth / 2) + 1}${depth % 2 === 0 ? '.' : '...'}`

export default function PrepPage() {
  const [assignment, setAssignment] = useState<Assignment>('gukesh')
  const roots =
    assignment === 'gukesh' ? TREE_GUKESH_WHITE : TREE_SINDAROV_WHITE
  const white: PlayerId = assignment
  const black: PlayerId = assignment === 'gukesh' ? 'sindarov' : 'gukesh'
  const [path, setPath] = useState<number[]>(() =>
    likeliestPath(TREE_GUKESH_WHITE),
  )
  const [hovered, setHovered] = useState<number[] | null>(null)

  const switchTo = (a: Assignment) => {
    setAssignment(a)
    setPath(
      likeliestPath(a === 'gukesh' ? TREE_GUKESH_WHITE : TREE_SINDAROV_WHITE),
    )
  }

  const shownPath = hovered ?? path
  const nodes = nodeAt(roots, shownPath)
  const { fen, last } = useMemo(() => {
    const c = new Chess()
    let lastMove: string | null = null
    for (const n of nodes) {
      const m = c.move(n.san)
      if (m) lastMove = m.from + m.to
    }
    return { fen: c.fen(), last: lastMove }
  }, [nodes])

  const joint = nodes.reduce((s, n) => s * n.p, 1)
  const jointGeneric = nodes.reduce((s, n) => s * n.g, 1)
  const topLine = likeliestPath(roots)
  const topNodes = nodeAt(roots, topLine)
  const topJoint = topNodes.reduce((s, n) => s * n.p, 1)

  // Columns of the explorer.
  const columns: { depth: number; items: TreeNode[]; parentPath: number[] }[] =
    []
  {
    let list = roots
    for (let d = 0; d <= path.length; d++) {
      if (!list || list.length === 0) break
      columns.push({ depth: d, items: list, parentPath: path.slice(0, d) })
      const next = list[path[d]]
      if (!next) break
      list = next.children ?? []
    }
  }

  // All departures in this tree, for the side list.
  const departures = useMemo(() => {
    const out: {
      path: number[]
      node: TreeNode
      depth: number
      line: string
    }[] = []
    const walk = (list: TreeNode[], p: number[], sans: string[]) =>
      list.forEach((n, i) => {
        const np = [...p, i]
        const ns = [...sans, n.san]
        if (isDeparture(n) || n.note)
          out.push({
            path: np,
            node: n,
            depth: np.length - 1,
            line: ns
              .map((s, k) => (k % 2 === 0 ? `${k / 2 + 1}.${s}` : s))
              .join(' '),
          })
        if (n.children) walk(n.children, np, ns)
      })
    walk(roots, [], [])
    return out
      .filter((d) => isDeparture(d.node))
      .sort(
        (a, b) => Math.abs(b.node.p - b.node.g) - Math.abs(a.node.p - a.node.g),
      )
  }, [roots])

  return (
    <>
      <Head>
        <title>The Prep Room · WCh lab · Maia Chess</title>
        <meta name="robots" content="noindex" />
      </Head>
      <LabBar />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">
              The prep room · before Game 1
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              What will they play on move one?
            </h1>
          </div>
          <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
            {(['gukesh', 'sindarov'] as Assignment[]).map((a) => (
              <button
                key={a}
                onClick={() => switchTo(a)}
                className={`rounded-full px-4 py-1.5 transition ${
                  assignment === a
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:text-white/85'
                }`}
              >
                {PLAYERS[a].short} has White
              </button>
            ))}
          </div>
        </div>

        {/* The predicted opening */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(254,127,109,0.10),transparent_55%),rgba(255,255,255,0.02)] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-white/60">
              Maia&apos;s single most likely line, if{' '}
              <PlayerName player={PLAYERS[white]} piece="white" /> has White
              against <PlayerName player={PLAYERS[black]} piece="black" />
            </p>
            <p className="text-sm text-white/45">
              joint probability{' '}
              <span className="text-xl font-semibold text-human-1">
                {pct(topJoint)}
              </span>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {topNodes.map((n, d) => {
              const pl = PLAYERS[d % 2 === 0 ? white : black]
              return (
                <button
                  key={d}
                  onClick={() => setPath(topLine.slice(0, d + 1))}
                  className="group flex items-baseline gap-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 hover:border-white/30"
                >
                  <span className="text-xs text-white/35">{moveNo(d)}</span>
                  <span
                    className="font-mono text-lg font-semibold"
                    style={{ color: pl.color }}
                  >
                    {n.san}
                  </span>
                  <span className="text-[11px] tabular-nums text-white/45">
                    {pct(n.p)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <Icicle
          roots={roots}
          white={white}
          black={black}
          path={shownPath}
          onSelect={setPath}
          onHover={setHovered}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* Explorer */}
          <section className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
              <span>
                Bars: how often the player to move picks it. Tick: a generic
                2750.
              </span>
              <span>
                this line: <b className="text-white/80">{pct(joint, 1)}</b> for
                these two · {pct(jointGeneric, 1)} for two generic 2750s
              </span>
            </div>
            <div className="flex gap-2 pb-2">
              {columns.slice(-1).map((col) => {
                const pl = PLAYERS[col.depth % 2 === 0 ? white : black]
                return (
                  <div key={col.depth} className="w-full">
                    <p className="mb-3 text-lg font-semibold">
                      {col.depth >= path.length ? 'Next: ' : 'The choice at '}
                      <span className="font-mono text-white/60">
                        {moveNo(col.depth)}
                      </span>{' '}
                      what will{' '}
                      <span style={{ color: pl.color }}>{pl.short}</span>{' '}
                      choose?
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {col.items
                        .map((n, i) => ({ n, i }))
                        .sort((a, b) => b.n.p - a.n.p)
                        .map(({ n, i }) => {
                          const selected = path[col.depth] === i
                          const dep = isDeparture(n)
                          const np = [...col.parentPath, i]
                          return (
                            <button
                              key={n.san}
                              onClick={() => setPath(np)}
                              onMouseEnter={() => setHovered(np)}
                              onMouseLeave={() => setHovered(null)}
                              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                                selected
                                  ? 'border-white/30 bg-white/[0.09]'
                                  : 'border-transparent bg-white/[0.025] hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-baseline justify-between">
                                <span className="font-mono text-[15px] font-semibold">
                                  {n.san}
                                  {n.children ? (
                                    <span className="ml-1 text-white/25">
                                      ›
                                    </span>
                                  ) : null}
                                </span>
                                <span className="text-xs tabular-nums text-white/70">
                                  {pct(n.p)}
                                </span>
                              </div>
                              <div className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full"
                                  style={{
                                    width: `${n.p * 100}%`,
                                    background: pl.color,
                                  }}
                                />
                                <div
                                  className="absolute -inset-y-1 w-[2px] bg-white/80"
                                  style={{ left: `${n.g * 100}%` }}
                                />
                              </div>
                              {dep ? (
                                <p className="mt-1.5 text-[11px] font-medium text-human-1">
                                  {n.p > n.g
                                    ? `${(n.p / Math.max(n.g, 0.01)).toFixed(n.p / n.g > 9 ? 0 : 1)}× a generic 2750`
                                    : `${Math.round((1 - n.p / n.g) * 100)}% less than generic`}
                                </p>
                              ) : null}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )
              })}
            </div>
            {nodes.slice(-1)[0]?.note ? (
              <p className="mt-3 rounded-lg border border-human-2/30 bg-human-4/10 px-3 py-2 text-sm text-white/80">
                {nodes.slice(-1)[0].note}
              </p>
            ) : null}
          </section>

          {/* Board + departures */}
          <aside className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-md">
              <WchBoard fen={fen} lastMove={last} />
            </div>
            <p className="font-mono text-sm text-white/70">
              {nodes.length === 0
                ? 'Start position'
                : nodes
                    .map((n, k) =>
                      k % 2 === 0 ? `${k / 2 + 1}.${n.san}` : n.san,
                    )
                    .join(' ')}
            </p>
          </aside>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">
            Where they leave the generic path
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Moves the player picks much more (or less) often than a generic 2750
            would, from their own games.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {departures.map((d) => {
              const pl = PLAYERS[d.depth % 2 === 0 ? white : black]
              return (
                <button
                  key={d.line}
                  onClick={() => setPath(d.path)}
                  className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left hover:border-white/25"
                >
                  <p className="text-xs" style={{ color: pl.color }}>
                    {pl.short}
                  </p>
                  <p className="mt-1 font-mono text-sm text-white/55">
                    {d.line}
                  </p>
                  <div className="mt-3 flex items-end gap-4">
                    <div>
                      <p
                        className="text-2xl font-semibold"
                        style={{ color: pl.color }}
                      >
                        {pct(d.node.p)}
                      </p>
                      <p className="text-[11px] text-white/45">{pl.short}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-white/50">
                        {pct(d.node.g)}
                      </p>
                      <p className="text-[11px] text-white/45">generic 2750</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Stat
            big={`ply ${ANALYTICS.gukesh.novelty}`}
            label="Gukesh's median novelty"
            sub="60-66% of his games leave known theory by ply 16"
          />
          <Stat
            big="~650"
            label="positions scored per colour assignment"
            sub="each by both player models, at WCh clocks"
          />
          <Stat
            big="Novelty watch"
            label="during the game"
            sub="flags the move where the game leaves both players' earlier games"
          />
        </section>
        <p className="mt-8 text-xs text-white/40">
          Trees come from past games only, not knowledge of either player&apos;s
          preparation. Line probability is the product of both players&apos;
          moves.
        </p>
      </main>
    </>
  )
}

const Stat: React.FC<{ big: string; label: string; sub: string }> = ({
  big,
  label,
  sub,
}) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <p className="text-2xl font-semibold">{big}</p>
    <p className="mt-1 text-sm text-white/70">{label}</p>
    <p className="mt-1 text-xs text-white/45">{sub}</p>
  </div>
)

const ICICLE_ROW = 34

const Icicle: React.FC<{
  roots: TreeNode[]
  white: PlayerId
  black: PlayerId
  path: number[]
  onSelect: (p: number[]) => void
  onHover: (p: number[] | null) => void
}> = ({ roots, white, black, path, onSelect, onHover }) => {
  const rects: {
    key: string
    x: number
    w: number
    depth: number
    node: TreeNode
    p: number[]
  }[] = []
  let maxDepth = 0
  const lay = (
    list: TreeNode[],
    x0: number,
    w0: number,
    depth: number,
    pp: number[],
  ) => {
    let x = x0
    list
      .map((n, i) => ({ n, i }))
      .sort((a, b) => b.n.p - a.n.p)
      .forEach(({ n, i }) => {
        const w = w0 * n.p
        const np = [...pp, i]
        rects.push({ key: np.join('-'), x, w, depth, node: n, p: np })
        maxDepth = Math.max(maxDepth, depth)
        if (n.children) lay(n.children, x, w, depth + 1, np)
        x += w
      })
  }
  lay(roots, 0, 1, 0, [])
  const onPath = (p: number[]) =>
    p.length <= path.length && p.every((v, k) => path[k] === v)
  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">The whole tree at a glance</h2>
        <p className="text-xs text-white/45">
          Width = how likely the line is for these two. Coral outline: a
          departure from generic 2750 play. Click to explore.
        </p>
      </div>
      <div
        className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black/20"
        style={{ height: (maxDepth + 1) * ICICLE_ROW }}
      >
        {rects.map((r) => {
          const pl = PLAYERS[r.depth % 2 === 0 ? white : black]
          const dep = isDeparture(r.node)
          const active = onPath(r.p)
          return (
            <button
              key={r.key}
              onClick={() => onSelect(r.p)}
              onMouseEnter={() => onHover(r.p)}
              onMouseLeave={() => onHover(null)}
              title={`${r.node.san}: ${pct(r.node.p)} (generic ${pct(r.node.g)})`}
              className="absolute overflow-hidden px-1 text-left font-mono text-[12px] font-semibold text-black/80 transition-[filter] hover:brightness-125"
              style={{
                left: `${r.x * 100}%`,
                width: `calc(${r.w * 100}% - 1px)`,
                top: r.depth * ICICLE_ROW,
                height: ICICLE_ROW - 2,
                background: pl.color,
                opacity: active ? 1 : 0.32 + 0.5 * Math.min(1, r.node.p),
                boxShadow: dep
                  ? 'inset 0 0 0 2px rgb(254 127 109)'
                  : active
                    ? 'inset 0 0 0 2px rgba(255,255,255,0.9)'
                    : undefined,
              }}
            >
              <span className="leading-[32px]">
                {r.w > 0.025 ? r.node.san : ''}
              </span>
            </button>
          )
        })}
        {Array.from({ length: maxDepth + 1 }).map((_, d) => (
          <span
            key={d}
            className="pointer-events-none absolute right-1.5 text-[10px] text-white/35"
            style={{ top: d * ICICLE_ROW + 9 }}
          >
            {moveNo(d)}
          </span>
        ))}
      </div>
    </section>
  )
}

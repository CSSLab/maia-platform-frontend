import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

/*
 * GET /api/wch/card: a 1200x630 image for sharing a World Championship
 * moment on X or Reddit. The query is the whole card, so the image is cached
 * for good.
 *
 *   kicker     small top line ("World Championship 2026 · Game 3")
 *   title      the headline ("23…Nxe4", "Maia called 14 of 23")
 *   stat       a big number ("3%")
 *   statLabel  what it means ("the chance MaiaGukesh gave this move")
 *   sub        one more line of context
 *   fen        draw this position on the left (else a text-only card)
 *   flip=1     Black at the bottom
 *   from, to   the move's squares, tinted
 *   row        up to 4 "label|value" rows (text-only card)
 */
export const config = { runtime: 'edge' }

const W = 1200
const H = 630
const BOARD = 530
const SQ = BOARD / 8
const MAX_TEXT = 120
/** Room kept under the text for the footer. */
const FOOTER = 60

const MAIA = 'rgb(254, 127, 109)'
const LIGHT = '#ece0c8'
const DARK = '#c3ad87'

const PIECES: Record<string, string> = {
  K: 'white king',
  Q: 'white queen',
  R: 'white rook',
  B: 'white bishop',
  N: 'white knight',
  P: 'white pawn',
  k: 'black king',
  q: 'black queen',
  r: 'black rook',
  b: 'black bishop',
  n: 'black knight',
  p: 'black pawn',
}

// The assets as data URIs, fetched once per instance.
const assets = new Map<string, Promise<string | null>>()

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)))
  return btoa(bin)
}

const asset = (path: string, type: string, base: string) => {
  let got = assets.get(path)
  if (!got) {
    got = fetch(new URL(encodeURI(path), base))
      .then(async (r) =>
        r.ok ? `data:${type};base64,${toBase64(await r.arrayBuffer())}` : null,
      )
      .catch(() => null)
    // A failed fetch is tried again next time.
    got.then((v) => {
      if (v === null) assets.delete(path)
    })
    assets.set(path, got)
  }
  return got
}

const text = (q: URLSearchParams, key: string) => {
  const v = q.get(key)?.trim()
  return v ? v.slice(0, MAX_TEXT) : ''
}

/** The board field of a FEN as 8 ranks of 8 (piece letter or ''), or null. */
const parseBoard = (fen: string): string[][] | null => {
  const field = fen.trim().split(/\s+/)[0] ?? ''
  const ranks = field.split('/')
  if (ranks.length !== 8) return null
  const out: string[][] = []
  for (const rank of ranks) {
    if (!/^[pnbrqkPNBRQK1-8]+$/.test(rank)) return null
    const row: string[] = []
    for (const c of rank) {
      if (/\d/.test(c)) for (let i = 0; i < +c; i++) row.push('')
      else row.push(c)
    }
    if (row.length !== 8) return null
    out.push(row)
  }
  return out
}

const square = (v: string | null) => (v && /^[a-h][1-8]$/.test(v) ? v : null)

/** Shrink a headline that would run long. */
const titleSize = (s: string, wide: boolean) => {
  const n = s.length
  if (wide) return n <= 22 ? 72 : n <= 40 ? 56 : n <= 70 ? 44 : 36
  return n <= 14 ? 64 : n <= 26 ? 50 : n <= 50 ? 40 : 32
}

export default async function handler(req: NextRequest) {
  const q = new URL(req.url).searchParams
  const base = req.url

  const kicker = text(q, 'kicker').slice(0, 70)
  const title = text(q, 'title')
  const stat = text(q, 'stat').slice(0, 8)
  const statLabel = text(q, 'statLabel')
  const sub = text(q, 'sub')
  const flip = q.get('flip') === '1'
  const from = square(q.get('from'))
  const to = square(q.get('to'))
  const board = q.get('fen') ? parseBoard(q.get('fen') ?? '') : null
  const rows = q
    .getAll('row')
    .slice(0, 4)
    .map((r) => {
      const [label, ...rest] = r.slice(0, MAX_TEXT).split('|')
      return { label: label.trim(), value: rest.join('|').trim() }
    })
    .filter((r) => r.label || r.value)

  const used = board ? Array.from(new Set(board.flat().filter(Boolean))) : []
  const [logo, ...pieceUris] = await Promise.all([
    asset('/maia-no-bg.png', 'image/png', base),
    ...used.map((p) =>
      asset(`/assets/pieces/${PIECES[p]}.svg`, 'image/svg+xml', base),
    ),
  ])
  const pieceImg = Object.fromEntries(used.map((p, i) => [p, pieceUris[i]]))

  const tinted = new Set([from, to].filter(Boolean))
  const files = 'abcdefgh'

  const boardEl = board ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: BOARD,
        height: BOARD,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      }}
    >
      {Array.from({ length: 8 }, (_, r) => {
        const rank = flip ? r : 7 - r // 0 = rank 1
        return (
          <div key={r} style={{ display: 'flex', height: SQ }}>
            {Array.from({ length: 8 }, (_, c) => {
              const file = flip ? 7 - c : c
              const name = `${files[file]}${rank + 1}`
              const piece = board[7 - rank][file]
              const light = (file + rank) % 2 === 1
              const uri = piece ? pieceImg[piece] : null
              return (
                <div
                  key={c}
                  style={{
                    display: 'flex',
                    width: SQ,
                    height: SQ,
                    backgroundColor: light ? LIGHT : DARK,
                    position: 'relative',
                  }}
                >
                  {tinted.has(name) ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: SQ,
                        height: SQ,
                        backgroundColor: 'rgba(254, 127, 109, 0.5)',
                      }}
                    />
                  ) : null}
                  {uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uri}
                      width={SQ}
                      height={SQ}
                      alt=""
                      style={{ position: 'absolute', left: 0, top: 0 }}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  ) : null

  const wide = !boardEl

  const image = (
    <div
      style={{
        display: 'flex',
        width: W,
        height: H,
        padding: 50,
        position: 'relative',
        backgroundImage: 'linear-gradient(135deg, #171214 0%, #241c1f 100%)',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      {boardEl}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          marginLeft: boardEl ? 50 : 10,
          minWidth: 0,
          // Long text is cut here rather than pushing into the footer.
          height: BOARD - FOOTER,
          overflow: 'hidden',
        }}
      >
        {kicker ? (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              fontSize: 24,
              color: MAIA,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {kicker}
          </div>
        ) : null}
        {title ? (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              marginTop: 18,
              fontSize: titleSize(title, wide),
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
        ) : null}
        {stat ? (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              alignItems: 'baseline',
              marginTop: 28,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: (wide ? 110 : 96) * (stat.length > 5 ? 0.7 : 1),
                fontWeight: 700,
                color: MAIA,
                lineHeight: 1,
                marginRight: 20,
              }}
            >
              {stat}
            </div>
            {statLabel ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: 28,
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.25,
                  marginTop: 10,
                  maxWidth: wide ? 700 : 520,
                }}
              >
                {statLabel}
              </div>
            ) : null}
          </div>
        ) : null}
        {rows.length ? (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              flexDirection: 'column',
              marginTop: 30,
              borderTop: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '11px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                  fontSize: 30,
                }}
              >
                <div
                  style={{ display: 'flex', color: 'rgba(255,255,255,0.8)' }}
                >
                  {r.label}
                </div>
                <div
                  style={{ display: 'flex', fontWeight: 700, color: 'white' }}
                >
                  {r.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {sub ? (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              marginTop: 24,
              fontSize: 26,
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.3,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'absolute',
          left: boardEl ? 50 + BOARD + 50 : 60,
          bottom: 50,
          fontSize: 24,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            width={55}
            height={40}
            alt=""
            style={{ marginRight: 14 }}
          />
        ) : null}
        maiachess.com/wch
      </div>
    </div>
  )

  return new ImageResponse(image, {
    width: W,
    height: H,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
    },
  })
}

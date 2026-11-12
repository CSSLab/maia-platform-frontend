import type { NextApiRequest, NextApiResponse } from 'next'
import { lichessExpectedScore } from 'src/lib/humanBar'
import type { HumanBarPly, HumanBarRequest } from 'src/types/humanBar'

/**
 * Development mock of the human-bar server (POST /v1/bars). It checks the
 * request against the contract and answers with plausible, made-up numbers
 * in the real response shape. It is not a model: do not read anything into
 * its output. Disabled in production builds unless HUMAN_BAR_MOCK=1.
 * HUMAN_BAR_MOCK_DELAY_MS delays each answer (to see the client wait).
 */

export const config = {
  api: { bodyParser: { sizeLimit: '16mb' } },
}

const REPR_BYTES = 512 * 4

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

const validate = (body: HumanBarRequest): string | null => {
  if (!body || typeof body !== 'object') return 'body must be a JSON object'
  const { game, positions, clocks } = body
  if (!game || typeof game.white_elo !== 'number') return 'game header missing'
  if (!Array.isArray(positions) || positions.length === 0)
    return 'positions must be a non-empty array'
  if (!Array.isArray(clocks) || clocks.length === 0)
    return 'clocks must list the whole game (one per move)'
  const seen = new Set<number>()
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    if (
      !Number.isInteger(p.p) ||
      p.p < 0 ||
      p.p > clocks.length ||
      seen.has(p.p)
    )
      return `positions[${i}].p must be a distinct ply in 0..${clocks.length}`
    seen.add(p.p)
    if (typeof p.fen !== 'string') return `positions[${i}].fen missing`
    if (typeof p.cp !== 'number' || !Number.isFinite(p.cp))
      return `positions[${i}].cp must be a number`
    if (
      !Array.isArray(p.value) ||
      p.value.length !== 3 ||
      Math.abs(p.value[0] + p.value[1] + p.value[2] - 1) > 1e-3
    )
      return `positions[${i}].value must be 3 probabilities summing to 1`
    if (Buffer.from(p.repr ?? '', 'base64').length !== REPR_BYTES)
      return `positions[${i}].repr must be base64 of ${REPR_BYTES} bytes`
  }
  return null
}

const initialSeconds = (timeControl: string) => {
  const base = Number.parseInt(timeControl.split('+')[0] ?? '', 10)
  return Number.isFinite(base) ? base : 180
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.HUMAN_BAR_MOCK !== '1'
  ) {
    res.status(404).json({ detail: 'Not found' })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'POST only' })
    return
  }

  const body = req.body as HumanBarRequest
  const problem = validate(body)
  if (problem) {
    res.status(400).json({ detail: problem })
    return
  }

  const { game, positions, clocks } = body
  const start = initialSeconds(game.time_control)
  // Each side's clock after its last move before ply p (move k, 1-based, was
  // White's when k is odd; clocks[k - 1] is the mover's clock after it).
  const clockBefore = (p: number, white: boolean) => {
    for (let k = p; k >= 1; k--) {
      if ((k % 2 === 1) === white) return clocks[k - 1] ?? start
    }
    return start
  }

  const plies: HumanBarPly[] = positions.map((position) => {
    const p = position.p
    const whiteClock = clockBefore(p, true)
    const blackClock = clockBefore(p, false)
    const whiteToMove = position.fen.split(' ')[1] !== 'b'
    const cpw = whiteToMove ? position.cp : -position.cp
    const engW = lichessExpectedScore(cpw)

    const [loss, draw, win] = position.value
    const maiaW = whiteToMove ? win : loss
    const maiaL = whiteToMove ? loss : win
    const maiaScore = maiaW + draw / 2

    const clockEdge = Math.tanh((whiteClock - blackClock) / Math.max(30, start))
    const humanScore = clamp01(0.5 * engW + 0.5 * maiaScore + 0.08 * clockEdge)
    const Dr = clamp01(0.8 * draw + 0.02)
    const W = clamp01(humanScore - Dr / 2)
    const L = clamp01(1 - W - Dr)

    const complexity = 1 - Math.max(maiaW, draw, maiaL)
    const hazard = (clock: number) =>
      clamp01(0.03 + 0.2 * sigmoid((20 - clock) / 8) + 0.08 * complexity)
    const within = (h: number, k: number) => 1 - Math.pow(1 - h, k)
    const hW = hazard(whiteClock)
    const hB = hazard(blackClock)

    return {
      p,
      W,
      Dr,
      L,
      eng_w: engW,
      cpw,
      dW_K1_T15: hW,
      dB_K1_T15: hB,
      dW_K5_T15: within(hW, 5),
      dB_K5_T15: within(hB, 5),
      dW_K5_T30: within(hW / 2, 5),
      dB_K5_T30: within(hB / 2, 5),
      dW_K10_T15: within(hW, 10),
      dB_K10_T15: within(hB, 10),
      dW_flag5: 0.5 * sigmoid((8 - whiteClock) / 3),
      dB_flag5: 0.5 * sigmoid((8 - blackClock) / 3),
    }
  })

  const delayMs = Number(process.env.HUMAN_BAR_MOCK_DELAY_MS ?? 0)
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  res.status(200).json({ model: 'mock', form: 'mock', plies })
}

import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Development mock of POST /v1/prepare ({"game": {...}}): the real server
 * starts its slow lookups for the game; the mock just acknowledges.
 * Disabled in production builds unless HUMAN_BAR_MOCK=1.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
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
  if (!req.body?.game || typeof req.body.game.white_elo !== 'number') {
    res.status(400).json({ detail: 'game header missing' })
    return
  }
  res.status(200).json({ ok: true })
}

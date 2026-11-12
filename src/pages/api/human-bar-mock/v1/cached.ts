import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Development mock of POST /v1/cached: the real server answers with what
 * earlier visits computed for this game and these players' form; the mock
 * keeps nothing, so every visit starts from scratch.
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
  res.status(200).json({ model: 'mock', form: 'mock', plies: [] })
}

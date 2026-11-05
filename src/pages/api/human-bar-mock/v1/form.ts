import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Development mock of POST /v1/form ({"game": {...}}): the real server waits
 * until it has fetched the players' recent games; the mock never fetches any,
 * so its bars are final at once.
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
  res.status(200).json({ form: 'mock', pending: false })
}

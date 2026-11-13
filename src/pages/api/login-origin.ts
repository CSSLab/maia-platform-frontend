import type { NextApiRequest, NextApiResponse } from 'next'
import { signLoginOrigin } from 'src/lib/previewLoginProof'

/**
 * GET /api/login-origin, on Vercel preview deployments only: a signed proof
 * that this preview is ours, which the sign-in sends with the Lichess login
 * (src/lib/previewLogin.ts) so that the backend lets it come back here. A 404
 * everywhere else, and on a preview without PREVIEW_LOGIN_SIGNING_KEY (set in
 * the Vercel project's Preview environment only; never NEXT_PUBLIC_).
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const key = process.env.PREVIEW_LOGIN_SIGNING_KEY
  const proof =
    req.method === 'GET' && process.env.VERCEL_ENV === 'preview' && key
      ? signLoginOrigin(String(req.headers.host ?? ''), key, Date.now())
      : null
  if (!proof) {
    res.status(404).json({ detail: 'Not found' })
    return
  }
  res.status(200).json({ proof })
}

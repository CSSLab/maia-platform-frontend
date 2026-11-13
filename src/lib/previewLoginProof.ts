import { Buffer } from 'buffer'
import { createPrivateKey, sign } from 'crypto'

/**
 * Server-side only (src/pages/api/login-origin.ts). A Vercel preview's proof
 * that it is one of ours, for the backend's Lichess login
 * (maia-platform-backend maia_api/auth/lichess_oauth.py, proven_preview_origin):
 * a preview's address can't be trusted by its name, since anyone can create a
 * Vercel project with a matching .vercel.app name. The proof is
 * "<payload>.<signature>", both base64url: the payload is
 * {"origin", "expires" (Unix seconds)} as JSON, the signature Ed25519 over
 * PREVIEW_PROOF_CONTEXT + the payload's base64url text, with the private key
 * only the project's Preview environment has. It only ever names the preview
 * it was asked on, so handing it to anyone is harmless.
 */

export const PREVIEW_PROOF_CONTEXT = 'maia-preview-login-origin:'
export const PREVIEW_PROOF_SECONDS = 10 * 60
const PREVIEW_HOST = /^[a-z0-9-]+\.vercel\.app$/

const base64url = (data: Buffer) =>
  data
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/**
 * The proof for `host` (the request's own Host), or null when it isn't a
 * *.vercel.app host. `privateKey` is PREVIEW_LOGIN_SIGNING_KEY: base64 of the
 * key's PKCS #8 DER.
 */
export const signLoginOrigin = (
  host: string,
  privateKey: string,
  nowMs: number,
): string | null => {
  const name = host.toLowerCase()
  if (!PREVIEW_HOST.test(name)) return null
  const key = createPrivateKey({
    key: Buffer.from(privateKey.trim(), 'base64'),
    format: 'der',
    type: 'pkcs8',
  })
  const body = base64url(
    Buffer.from(
      JSON.stringify({
        origin: `https://${name}`,
        expires: Math.floor(nowMs / 1000) + PREVIEW_PROOF_SECONDS,
      }),
    ),
  )
  const signature = sign(
    null,
    new Uint8Array(Buffer.from(PREVIEW_PROOF_CONTEXT + body)),
    key,
  )
  return `${body}.${base64url(signature)}`
}

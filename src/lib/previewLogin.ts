/**
 * Lichess sign-in from Vercel preview deployments. The backend lets a login
 * come back only to the sites it trusts, which previews are not, so on a
 * preview the sign-in first asks this deployment's /api/login-origin for a
 * signed proof that it is ours (src/pages/api/login-origin.ts) and sends it
 * along. Elsewhere nothing changes.
 */

export const LOGIN_PROOF_TIMEOUT_MS = 5000

/** This build is a Vercel preview (Vercel sets NEXT_PUBLIC_VERCEL_ENV). */
export const isVercelPreview = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

/** This preview's proof, or null if there is none (the login then fails as before). */
export const fetchLoginOriginProof = async (): Promise<string | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOGIN_PROOF_TIMEOUT_MS)
  try {
    const res = await fetch('/api/login-origin', {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { proof?: unknown }
    return typeof data.proof === 'string' ? data.proof : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** The backend's login URL, back to `back`, with a preview's proof if any. */
export const lichessLoginUrl = (
  loginUrl: string,
  back: string,
  proof?: string | null,
) =>
  `${loginUrl}?redirect_url=${encodeURIComponent(back)}` +
  (proof ? `&origin_proof=${encodeURIComponent(proof)}` : '')

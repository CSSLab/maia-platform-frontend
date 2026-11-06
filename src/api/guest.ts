import { buildUrl } from './utils'

type AccountData = { [x: string]: string }

let accountRequest: Promise<AccountData> | null = null

/**
 * The account request, shared while in flight. A visitor without the guest
 * cookie gets one from it, so asking twice at once would make two accounts.
 * The first call takes the request the page's HTML started (_document.tsx).
 */
export const requestAccount = (): Promise<AccountData> => {
  if (accountRequest) return accountRequest
  const early = typeof window !== 'undefined' ? window.__account : undefined
  if (early && typeof window !== 'undefined') delete window.__account
  const fresh = () =>
    fetch(buildUrl('auth/account')).then(
      (res) => res.json() as Promise<AccountData>,
    )
  accountRequest = (early ? early.catch(fresh) : fresh()).finally(() => {
    accountRequest = null
  })
  return accountRequest
}

/**
 * fetch, but a 401 is retried once after the account request, which gives a
 * visitor the guest cookie the request needs. A first visit could otherwise
 * ask for a game before that cookie arrived and be sent to /401: 108 of the
 * 157 people sent there in a week arrived less than 10 minutes before.
 */
export const fetchAsGuest = async (
  input: string,
  init?: RequestInit,
): Promise<Response> => {
  const res = await fetch(input, init)
  if (res.status !== 401) return res
  try {
    await requestAccount()
  } catch {
    return res
  }
  return fetch(input, init)
}

declare global {
  interface Window {
    /** Started by the page's HTML (see _document.tsx). */
    __account?: Promise<AccountData>
  }
}

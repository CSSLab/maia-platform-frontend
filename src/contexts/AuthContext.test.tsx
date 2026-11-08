import { act, render } from '@testing-library/react'
import { useContext } from 'react'
import { AuthContext, AuthContextProvider } from './AuthContext'
import { fetchAccount, logoutAndFetchAccount } from 'src/api'
import {
  capture,
  identifyUser,
  registerProperties,
  resetUser,
} from 'src/lib/posthogClient'

jest.mock('src/api', () => ({
  fetchAccount: jest.fn(),
  logoutAndFetchAccount: jest.fn(),
  connectLichessUrl: '/api/v1/auth/lichess_login',
}))
jest.mock('src/lib/posthogClient', () => ({
  capture: jest.fn(),
  registerProperties: jest.fn(),
  identifyUser: jest.fn(),
  resetUser: jest.fn(),
}))

const api = {
  fetchAccount: fetchAccount as jest.Mock,
  logoutAndFetchAccount: logoutAndFetchAccount as jest.Mock,
}
const posthog = {
  capture: capture as jest.Mock,
  registerProperties: registerProperties as jest.Mock,
  identifyUser: identifyUser as jest.Mock,
  resetUser: resetUser as jest.Mock,
}

const signedOut = {
  clientId: 'c',
  displayName: '',
  cookieCreatedAt: 1700000000,
}
const signedIn = {
  clientId: 'c',
  displayName: 'alice',
  lichessId: 'alice',
  cookieCreatedAt: 1800000000,
}

const events = () =>
  posthog.capture.mock.calls.map(([name, props]) => [name, props])

let connect: ((source: 'header') => void) | undefined
let logout: (() => Promise<void>) | undefined
const Probe = () => {
  connect = useContext(AuthContext).connectLichess
  logout = useContext(AuthContext).logout
  return null
}

const load = async () => {
  await act(async () => {
    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    )
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  window.sessionStorage.clear()
})

describe('sign-in measurement', () => {
  it('records signed_in on every event', async () => {
    api.fetchAccount.mockResolvedValue(signedIn)
    await load()
    expect(posthog.registerProperties).toHaveBeenCalledWith({
      signed_in: true,
    })
    expect(events()).toEqual([])
  })

  it('records the button pressed, then whether the sign-in worked', async () => {
    api.fetchAccount.mockResolvedValue(signedOut)
    await load()
    // jsdom reports, rather than makes, the trip to Lichess.
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    connect?.('header')
    expect(
      JSON.parse(window.sessionStorage.getItem('maia.signInStarted') ?? '{}'),
    ).toMatchObject({ source: 'header' })
    expect(events()).toEqual([
      ['lichess_connection_initiated', { source: 'header' }],
    ])

    // Back from Lichess: the page loads again, signed in.
    jest.clearAllMocks()
    api.fetchAccount.mockResolvedValue(signedIn)
    await load()
    expect(events()).toEqual([
      ['lichess_sign_in_completed', { source: 'header', seconds: 0 }],
    ])

    // Only once.
    jest.clearAllMocks()
    await load()
    expect(events()).toEqual([])
  })

  it('records a return without signing in', async () => {
    window.sessionStorage.setItem(
      'maia.signInStarted',
      JSON.stringify({ source: 'homepage', at: Date.now() - 42_000 }),
    )
    api.fetchAccount.mockResolvedValue(signedOut)
    await load()
    expect(events()).toEqual([
      ['lichess_sign_in_not_completed', { source: 'homepage', seconds: 42 }],
    ])
  })

  it('ignores a sign-in started long ago', async () => {
    window.sessionStorage.setItem(
      'maia.signInStarted',
      JSON.stringify({ source: 'homepage', at: Date.now() - 2 * 3600_000 }),
    )
    api.fetchAccount.mockResolvedValue(signedIn)
    await load()
    expect(events()).toEqual([])
  })
})

describe('who the visitor is', () => {
  it('identifies a guest by client_id, with the account date set once', async () => {
    api.fetchAccount.mockResolvedValue(signedOut)
    await load()
    expect(posthog.identifyUser).toHaveBeenCalledTimes(1)
    expect(posthog.identifyUser).toHaveBeenCalledWith(
      'c',
      { is_lichess_linked: false },
      { account_created_at: new Date(1700000000 * 1000).toISOString() },
    )
  })

  it('identifies a Lichess account without a creation date', async () => {
    // Its cookie is from the sign-in, not from when the account was made.
    api.fetchAccount.mockResolvedValue(signedIn)
    await load()
    expect(posthog.identifyUser).toHaveBeenCalledWith(
      'c',
      { is_lichess_linked: true },
      undefined,
    )
  })

  it('resets on logout, then identifies the new guest', async () => {
    api.fetchAccount.mockResolvedValue(signedIn)
    await load()
    jest.clearAllMocks()
    api.logoutAndFetchAccount.mockResolvedValue({
      clientId: 'g2',
      displayName: '',
      cookieCreatedAt: 1900000000,
    })
    await act(async () => {
      await logout?.()
    })
    expect(posthog.resetUser).toHaveBeenCalledTimes(1)
    expect(posthog.resetUser.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.identifyUser.mock.invocationCallOrder[0],
    )
    expect(posthog.identifyUser).toHaveBeenCalledWith(
      'g2',
      { is_lichess_linked: false },
      { account_created_at: new Date(1900000000 * 1000).toISOString() },
    )
  })
})

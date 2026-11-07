import { act, render } from '@testing-library/react'
import { useContext } from 'react'
import { AuthContext, AuthContextProvider } from './AuthContext'
import { fetchAccount } from 'src/api'
import { capture, registerProperties } from 'src/lib/posthogClient'

jest.mock('src/api', () => ({
  fetchAccount: jest.fn(),
  logoutAndFetchAccount: jest.fn(),
  connectLichessUrl: '/api/v1/auth/lichess_login',
}))
jest.mock('src/lib/posthogClient', () => ({
  capture: jest.fn(),
  registerProperties: jest.fn(),
}))

const api = { fetchAccount: fetchAccount as jest.Mock }
const posthog = {
  capture: capture as jest.Mock,
  registerProperties: registerProperties as jest.Mock,
}

const signedOut = { clientId: 'c', displayName: '' }
const signedIn = { clientId: 'c', displayName: 'alice', lichessId: 'alice' }

const events = () =>
  posthog.capture.mock.calls.map(([name, props]) => [name, props])

let connect: ((source: 'header') => void) | undefined
const Probe = () => {
  connect = useContext(AuthContext).connectLichess
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

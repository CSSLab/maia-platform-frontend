import { fetchAccount } from './auth'

jest.mock('./guest', () => ({
  requestAccount: jest.fn(),
}))

const { requestAccount } = jest.requireMock('./guest')

describe('the account request', () => {
  it("says whether the player's games are held by the server", async () => {
    requestAccount.mockResolvedValue({
      client_id: 'c1',
      display_name: 'Guest',
      lichess_id: null,
      server_games: true,
    })
    expect(await fetchAccount()).toMatchObject({
      clientId: 'c1',
      serverGames: true,
    })
  })

  it('takes an older answer, without the field, as no', async () => {
    requestAccount.mockResolvedValue({ client_id: 'c1', display_name: 'Guest' })
    expect((await fetchAccount()).serverGames).toBe(false)
  })
})

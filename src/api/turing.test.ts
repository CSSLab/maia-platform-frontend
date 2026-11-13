import { fetchTuringPlayerStats, submitTuringGuess } from './turing'

const reply = (body: object) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch
}

// turing/game_guess's answer (GuessResult in the backend).
const GUESS_RESULT = {
  id: 'g1',
  white_is_bot: false,
  black_is_bot: true,
  guess_correct: true,
  white_name: 'alice',
  black_name: 'Maia',
  white_rating: 1700,
  black_rating: 1650,
  time_control: '180+2',
  game_type: 'blitz',
  comment: null,
  turing_elo: 1532,
}

describe('fetchTuringPlayerStats', () => {
  it('reads whether the rating is provisional', async () => {
    reply({
      correct_guesses: 2,
      wrong_guesses: 1,
      turing_elo: 1520,
      turing_provisional: true,
    })
    expect(await fetchTuringPlayerStats()).toEqual({
      correctGuesses: 2,
      wrongGuesses: 1,
      rating: 1520,
      provisional: true,
    })
  })

  it('takes the rating as settled when the backend does not say', async () => {
    reply({ correct_guesses: 80, wrong_guesses: 20, turing_elo: 1800 })
    expect((await fetchTuringPlayerStats()).provisional).toBe(false)
  })
})

describe('submitTuringGuess', () => {
  it('reads whether the new rating is provisional', async () => {
    reply({ ...GUESS_RESULT, turing_provisional: false })
    expect(await submitTuringGuess('g1', 'black')).toMatchObject({
      turingElo: 1532,
      turingProvisional: false,
    })
  })

  it("leaves the flag out when the backend doesn't say", async () => {
    // null keeps the flag the page loaded with (useStats).
    reply({ ...GUESS_RESULT, turing_provisional: null })
    expect(
      (await submitTuringGuess('g1', 'black')).turingProvisional,
    ).toBeUndefined()

    reply(GUESS_RESULT)
    expect(
      (await submitTuringGuess('g1', 'black')).turingProvisional,
    ).toBeUndefined()
  })
})

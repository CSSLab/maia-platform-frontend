import { describeTermination, resignTermination } from './resignation'

describe('a resignation', () => {
  it('is won by the side that did not resign, with the reason in the PGN', () => {
    expect(resignTermination('black', 'maia')).toEqual({
      result: '1-0',
      winner: 'white',
      type: 'resign',
      resignedBy: 'maia',
      condition: 'Black resigned',
    })
    expect(resignTermination('white', 'player')).toEqual({
      result: '0-1',
      winner: 'black',
      type: 'resign',
      resignedBy: 'player',
      condition: 'White resigned',
    })
  })

  it('says who resigned, as the player reads it', () => {
    expect(
      describeTermination(resignTermination('black', 'maia'), 'white'),
    ).toBe('Maia resigned. You win.')
    expect(
      describeTermination(resignTermination('white', 'maia'), 'black'),
    ).toBe('Maia resigned. You win.')
    expect(
      describeTermination(resignTermination('white', 'player'), 'white'),
    ).toBe('You resigned. Maia wins.')
  })

  it("tells who resigned from the winner when it isn't said", () => {
    const won = { result: '0-1', winner: 'black', type: 'resign' } as const
    expect(describeTermination(won, 'black')).toBe('Maia resigned. You win.')
    expect(describeTermination(won, 'white')).toBe('You resigned. Maia wins.')
  })

  it('says nothing more about other endings', () => {
    expect(describeTermination(undefined, 'white')).toBeUndefined()
    expect(
      describeTermination(
        { result: '1-0', winner: 'white', type: 'rules' },
        'white',
      ),
    ).toBeUndefined()
  })
})

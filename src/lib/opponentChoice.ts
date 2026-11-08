import type { OpponentChoice } from 'src/lib/analytics'

/**
 * How the opponent of the next game was picked, noted by whatever starts it
 * (the setup dialog) and taken by the game's tracking when it
 * starts. Kept in memory only: a game opened from a link or a reloaded page
 * has no note, and its choice is 'unknown'.
 */
let noted: { maiaName: string; choice: OpponentChoice } | null = null

export const noteOpponentChoice = (
  maiaName: string,
  choice: OpponentChoice,
) => {
  noted = { maiaName, choice }
}

export const takeOpponentChoice = (
  maiaName: string,
): { choice: OpponentChoice; wasDefault: boolean } => {
  const choice = noted && noted.maiaName === maiaName ? noted.choice : 'unknown'
  noted = null
  return {
    choice,
    wasDefault: choice === 'preselected',
  }
}

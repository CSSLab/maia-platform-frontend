import { Termination } from './analysis'
import { BaseGame, Color } from './common'

export const TimeControlOptions = ['3+0', '5+2', '10+0', '15+10', 'unlimited']
export const TimeControlOptionNames = [
  '3+0',
  '5+2',
  '10+0',
  '15+10',
  'Unlimited',
]

// To fix some weird inconsistency between vercel and local:
// eslint-disable-next-line prettier/prettier
export type TimeControl = (typeof TimeControlOptions)[number]

export type PlayType = 'againstMaia' | 'handAndBrain'

export interface PlayGameConfig {
  player: Color
  timeControl: TimeControl
  maiaVersion: string
  playType: PlayType
  isBrain: boolean
  sampleMoves: boolean
  simulateMaiaTime?: boolean
  startFen?: string
  maiaPartnerVersion?: string
}

export interface PlayedGame extends BaseGame {
  termination?: Termination
  turn: Color
}

export interface AvailableMove {
  from: string
  to: string
  promotion?: string
}

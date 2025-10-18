import React from 'react'
import { Chess } from 'chess.ts'
import { GameTree, BaseTreeControllerContext } from 'src/types'
import { usePlayController } from 'src/hooks/usePlayController'

export interface IPlayControllerContext extends BaseTreeControllerContext {
  game: ReturnType<typeof usePlayController>['game']
  playType: ReturnType<typeof usePlayController>['playType']
  timeControl: ReturnType<typeof usePlayController>['timeControl']
  player: ReturnType<typeof usePlayController>['player']
  maiaVersion: ReturnType<typeof usePlayController>['maiaVersion']
  playerActive: ReturnType<typeof usePlayController>['playerActive']
  toPlay: ReturnType<typeof usePlayController>['toPlay']
  moves: ReturnType<typeof usePlayController>['moves']
  availableMoves: ReturnType<typeof usePlayController>['availableMoves']
  pieces: ReturnType<typeof usePlayController>['pieces']
  moveList: ReturnType<typeof usePlayController>['moveList']
  whiteClock: ReturnType<typeof usePlayController>['whiteClock']
  blackClock: ReturnType<typeof usePlayController>['blackClock']
  lastMoveTime: ReturnType<typeof usePlayController>['lastMoveTime']
  stats: ReturnType<typeof usePlayController>['stats']
  setResigned: ReturnType<typeof usePlayController>['setResigned']
  reset: ReturnType<typeof usePlayController>['reset']
  makePlayerMove: ReturnType<typeof usePlayController>['makePlayerMove']
  updateClock: ReturnType<typeof usePlayController>['updateClock']
  setCurrentNode: ReturnType<typeof usePlayController>['setCurrentNode']
  addMoveWithTime: ReturnType<typeof usePlayController>['addMoveWithTime']
}

const fn = () => {
  throw new Error('PlayTreeControllerContext not provided')
}

const defaultGameTree = new GameTree(new Chess().fen())

export const PlayControllerContext =
  React.createContext<IPlayControllerContext>({
    game: { id: '', turn: 'black', tree: defaultGameTree },
    playType: 'againstMaia',
    timeControl: 'unlimited',
    player: 'white',
    maiaVersion: 'maia_kdd_1100',
    playerActive: false,
    toPlay: 'black',
    moves: [],
    availableMoves: [],
    pieces: {},
    moveList: [],
    whiteClock: 0,
    blackClock: 0,
    lastMoveTime: 0,
    plyCount: 0,
    orientation: 'white',
    setOrientation: fn,
    stats: {
      lifetime: undefined,
      session: { gamesWon: 0, gamesPlayed: 0 },
      lastRating: undefined,
      rating: 0,
    },
    setResigned: fn,
    reset: fn,
    makePlayerMove: fn,
    updateClock: fn,
    gameTree: defaultGameTree,
    currentNode: defaultGameTree.getRoot(),
    setCurrentNode: fn,
    goToNode: fn,
    goToNextNode: fn,
    goToPreviousNode: fn,
    goToRootNode: fn,
    addMoveWithTime: fn,
  })

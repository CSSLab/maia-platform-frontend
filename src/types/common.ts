import { GameNode } from './node'
import { GameTree } from './tree'
import { Dispatch, SetStateAction } from 'react'

export interface BaseGame {
  id: string
  tree: GameTree
}

export interface RawMove {
  board: string
  lastMove?: [string, string]
  movePlayed?: [string, string]
  check?: false | 'white' | 'black'
  san?: string
  uci?: string
}

export type Check = false | 'white' | 'black'

export type Color = 'white' | 'black'

export interface BaseTreeControllerContext {
  gameTree: GameTree
  currentNode: GameNode
  setCurrentNode: Dispatch<SetStateAction<GameNode>>
  goToNode: (node: GameNode) => void
  goToNextNode: () => void
  goToPreviousNode: () => void
  goToRootNode: () => void
  plyCount: number
  orientation: 'white' | 'black'
  setOrientation: (orientation: 'white' | 'black') => void
}

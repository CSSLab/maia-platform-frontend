import React from 'react'
import { Chess } from 'chess.ts'
import { GameTree, BaseTreeControllerContext } from 'src/types'

const defaultGameTree = new GameTree(new Chess().fen())

export const TreeControllerContext =
  React.createContext<BaseTreeControllerContext>({
    gameTree: defaultGameTree,
    currentNode: defaultGameTree.getRoot(),
    setCurrentNode: () => {
      throw new Error('TreeControllerContext not provided')
    },
    orientation: 'white',
    setOrientation: () => {
      throw new Error('TreeControllerContext not provided')
    },
    goToNode: () => {
      throw new Error('TreeControllerContext not provided')
    },
    goToNextNode: () => {
      throw new Error('TreeControllerContext not provided')
    },
    goToPreviousNode: () => {
      throw new Error('TreeControllerContext not provided')
    },
    goToRootNode: () => {
      throw new Error('TreeControllerContext not provided')
    },
    plyCount: 0,
  })

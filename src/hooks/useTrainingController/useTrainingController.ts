import { Chess } from 'chess.ts'
import { GameTree } from 'src/types'
import { PuzzleGame } from 'src/types/puzzle'
import { useMemo, useCallback, useEffect } from 'react'
import { useTreeController } from '../useTreeController'

export const useTrainingController = (game: PuzzleGame) => {
  // Orient the board for the side to move in the puzzle's starting position.
  // Not the main line's last node: a guess is added to the main line, so when
  // a past puzzle is reopened that node is one move later, with the other
  // side to move (Black's puzzles then showed from White's side).
  const initialOrientation = useMemo(() => {
    const mainLine = game.tree.getMainLine()
    const start = mainLine[Math.min(game.targetIndex, mainLine.length - 1)]
    const chess = new Chess(start.fen)
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [game.tree, game.targetIndex])
  const controller = useTreeController(game.tree, initialOrientation)

  const puzzleStartingNode = useMemo(() => {
    let node = controller.tree.getRoot()
    for (let i = 1; i <= game.targetIndex; i++) {
      if (node.mainChild) {
        node = node.mainChild
      } else {
        break
      }
    }
    return node
  }, [controller.tree, game.targetIndex])

  useEffect(() => {
    controller.goToNode(puzzleStartingNode)
  }, [game.id])

  const availableMovesMapped = useMemo(() => {
    const moveMap = new Map<string, string[]>()
    const currentFen = controller.currentNode.fen

    if (currentFen === puzzleStartingNode.fen) {
      const chess = new Chess(currentFen)
      const legalMoves = chess.moves({ verbose: true })

      legalMoves.forEach((move) => {
        const from = move.from
        const to = move.to
        moveMap.set(from, (moveMap.get(from) ?? []).concat([to]))
      })
    }

    return moveMap
  }, [controller.currentNode, puzzleStartingNode])

  const onPlayerGuess = useCallback(
    (moveUci: string) => {
      const newNode = controller.tree.addMoveToMainLine(moveUci)
      if (newNode) {
        controller.setCurrentNode(newNode)
      }
    },
    [controller],
  )

  const reset = useCallback(() => {
    puzzleStartingNode.removeAllChildren()
    controller.goToNode(puzzleStartingNode)
  }, [controller, puzzleStartingNode])

  return {
    reset,
    onPlayerGuess,
    availableMovesMapped,
    puzzleStartingNode,

    gameTree: controller.tree,
    currentNode: controller.currentNode,
    setCurrentNode: controller.setCurrentNode,
    goToNode: controller.goToNode,
    goToNextNode: controller.goToNextNode,
    goToPreviousNode: controller.goToPreviousNode,
    goToRootNode: controller.goToRootNode,
    plyCount: controller.plyCount,
    orientation: controller.orientation,
    setOrientation: controller.setOrientation,
  }
}

import { Color, GameTree, GameNode } from 'src/types'
import { useState, useMemo, useCallback, useEffect } from 'react'

export const useTreeController = (
  gameTree: GameTree,
  initialOrientation: Color = 'white',
) => {
  const [currentNode, setCurrentNode] = useState<GameNode>(
    gameTree?.getRoot() || null,
  )
  const [orientation, setOrientation] = useState<Color>(initialOrientation)

  const plyCount = useMemo(() => {
    if (!gameTree) return 0
    return gameTree.getMainLine().length
  }, [gameTree])

  const goToNode = useCallback(
    (node: GameNode) => {
      setCurrentNode(node)
    },
    [setCurrentNode],
  )

  const goToNextNode = useCallback(() => {
    if (currentNode?.mainChild) {
      setCurrentNode(currentNode.mainChild)
    }
  }, [currentNode, setCurrentNode])

  const goToPreviousNode = useCallback(() => {
    if (currentNode?.parent) {
      setCurrentNode(currentNode.parent)
    }
  }, [currentNode, setCurrentNode])

  const goToRootNode = useCallback(() => {
    if (gameTree) {
      setCurrentNode(gameTree.getRoot())
    }
  }, [gameTree, setCurrentNode])

  useEffect(() => {
    setOrientation(initialOrientation)
  }, [initialOrientation])

  return {
    gameTree,
    currentNode,
    setCurrentNode,
    orientation,
    setOrientation,
    goToNode,
    goToNextNode,
    goToPreviousNode,
    goToRootNode,
    plyCount,
  }
}

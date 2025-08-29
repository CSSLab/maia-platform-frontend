import { useWindowSize } from 'src/hooks'
import { GameNode, GameTree } from 'src/types'
import { FlipIcon } from 'src/components/Common/Icons'
import { useCallback, useEffect, useMemo } from 'react'

interface Props {
  orientation: 'white' | 'black'
  setOrientation: (orientation: 'white' | 'black') => void
  currentNode: GameNode | null
  plyCount: number
  goToNode: (node: GameNode) => void
  goToNextNode: () => void
  goToPreviousNode: () => void
  goToRootNode: () => void
  gameTree: GameTree | null
  setCurrentMove?: (move: [string, string] | null) => void
  disableFlip?: boolean
  disablePrevious?: boolean
  disableKeyboardNavigation?: boolean
  disableNavigation?: boolean
  embedded?: boolean
}

export const BoardController: React.FC<Props & { embedded?: boolean }> = ({
  orientation,
  setOrientation,
  currentNode,
  plyCount,
  goToNode,
  goToNextNode,
  goToPreviousNode,
  goToRootNode,
  gameTree,
  setCurrentMove,
  disableFlip = false,
  disablePrevious = false,
  disableKeyboardNavigation = false,
  disableNavigation = false,
  embedded = false,
}: Props) => {
  const { width } = useWindowSize()

  const toggleBoardOrientation = useCallback(() => {
    setOrientation(orientation === 'white' ? 'black' : 'white')
  }, [orientation, setOrientation])

  const hasPrevious = useMemo(() => {
    return !!currentNode?.parent
  }, [currentNode])

  const hasNext = useMemo(() => {
    return !!currentNode?.mainChild
  }, [currentNode])

  const getFirst = useCallback(() => {
    goToRootNode()
    setCurrentMove?.(null)
  }, [goToRootNode, setCurrentMove])

  const getPrevious = useCallback(() => {
    goToPreviousNode()
    setCurrentMove?.(null)
  }, [goToPreviousNode, setCurrentMove])

  const getNext = useCallback(() => {
    goToNextNode()
    setCurrentMove?.(null)
  }, [goToNextNode, setCurrentMove])

  const getLast = useCallback(() => {
    if (!currentNode) return

    let lastNode = currentNode
    while (lastNode?.mainChild) {
      lastNode = lastNode.mainChild
    }
    if (lastNode) {
      goToNode(lastNode)
    }

    setCurrentMove?.(null)
  }, [currentNode, goToNode, setCurrentMove])

  useEffect(() => {
    if (width <= 670 || disableKeyboardNavigation) return

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Left':
        case 'ArrowLeft':
          if (hasPrevious && !disablePrevious) getPrevious()
          break
        case 'Right':
        case 'ArrowRight':
          if (hasNext) getNext()
          break
        case 'Down':
        case 'ArrowDown':
          if (hasNext) getLast()
          break
        case 'Up':
        case 'ArrowUp':
          if (hasPrevious && !disablePrevious) getFirst()
          break
        case 'f':
          if (!disableFlip) toggleBoardOrientation()
          break
        default:
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    width,
    hasPrevious,
    hasNext,
    getPrevious,
    getNext,
    getFirst,
    getLast,
    toggleBoardOrientation,
    disablePrevious,
    disableKeyboardNavigation,
  ])

  return (
    <div
      className={`flex w-full flex-row items-center gap-[1px] ${
        embedded
          ? 'border-t border-glassBorder bg-transparent'
          : 'rounded-md border border-glassBorder bg-glass backdrop-blur-md'
      }`}
    >
      <button
        onClick={disableFlip ? undefined : toggleBoardOrientation}
        disabled={disableFlip}
        className="flex h-7 flex-1 items-center justify-center rounded-sm bg-glass transition duration-200 hover:bg-glass-hover disabled:bg-black/5"
      >
        {FlipIcon}
      </button>
      <button
        onClick={disableNavigation ? undefined : getFirst}
        disabled={!hasPrevious || disablePrevious || disableNavigation}
        className="flex h-7 flex-1 items-center justify-center rounded-sm bg-glass transition duration-200 hover:bg-glass-hover disabled:bg-black/5"
      >
        &#8249;&#8249;&#8249;
      </button>
      <button
        onClick={disableNavigation ? undefined : getPrevious}
        disabled={!hasPrevious || disablePrevious || disableNavigation}
        className="flex h-7 flex-1 items-center justify-center rounded-sm bg-glass transition duration-200 hover:bg-glass-hover disabled:bg-black/5"
      >
        &#8249;
      </button>
      <button
        onClick={disableNavigation ? undefined : getNext}
        disabled={!hasNext || disableNavigation}
        className="flex h-7 flex-1 items-center justify-center rounded-sm bg-glass transition duration-200 hover:bg-glass-hover disabled:bg-black/5"
      >
        &#8250;
      </button>
      <button
        onClick={disableNavigation ? undefined : getLast}
        disabled={!hasNext || disableNavigation}
        className="flex h-7 flex-1 items-center justify-center rounded-sm bg-glass transition duration-200 hover:bg-glass-hover disabled:bg-black/5"
      >
        &#8250;&#8250;&#8250;
      </button>
    </div>
  )
}

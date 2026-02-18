/* eslint-disable @typescript-eslint/no-explicit-any */
import { Chess } from 'chess.ts'
import { useSound } from 'src/hooks/useSound'
import { defaults } from 'chessground/state'
import type { Key } from 'chessground/types'
import Chessground from '@react-chess/chessground'
import { BaseGame, GameNode, Color } from 'src/types'
import { MoveClassificationIcon } from 'src/components/Common/MoveIcons'
import type { DrawBrushes, DrawShape } from 'chessground/draw'
import { useCallback, useMemo, Dispatch, SetStateAction } from 'react'

interface MoveClassification {
  blunder: boolean
  inaccuracy: boolean
  excellent: boolean
  bestMove: boolean
}

interface DestinationBadge {
  square: string
  classification: MoveClassification
}

interface Props {
  game?: BaseGame
  currentNode: GameNode
  orientation?: Color
  availableMoves?: Map<string, string[]>
  onSelectSquare?: (square: Key) => void
  onPlayerMakeMove?: (move: [string, string]) => void
  setCurrentSquare?: Dispatch<SetStateAction<Key | null>>
  shapes?: DrawShape[]
  brushes?: DrawBrushes
  goToNode?: (node: GameNode) => void
  gameTree?: any
  destinationBadges?: DestinationBadge[]
}

const getBoardSquarePosition = (square: string, orientation: Color) => {
  if (!/^[a-h][1-8]$/.test(square)) {
    return null
  }

  const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = parseInt(square[1], 10)

  if (Number.isNaN(rank)) {
    return null
  }

  return {
    left: orientation === 'white' ? file : 7 - file,
    top: orientation === 'white' ? 8 - rank : rank - 1,
  }
}

export const GameBoard: React.FC<Props> = ({
  game,
  shapes,
  brushes,
  goToNode,
  gameTree,
  currentNode,
  orientation = 'white',
  availableMoves,
  onPlayerMakeMove,
  setCurrentSquare,
  onSelectSquare,
  destinationBadges = [],
}: Props) => {
  const { playMoveSound } = useSound()

  const after = useCallback(
    (from: string, to: string) => {
      if (onPlayerMakeMove) onPlayerMakeMove([from, to])
      if (setCurrentSquare) setCurrentSquare(null)

      const currentFen = currentNode.fen
      if (currentFen) {
        const chess = new Chess(currentFen)
        const pieceAtDestination = chess.get(to)
        const isCapture = !!pieceAtDestination

        // Handle analysis board move creation (if gameTree and goToNode are provided)
        if (
          gameTree &&
          goToNode &&
          currentNode &&
          game &&
          'tree' in game &&
          game.tree
        ) {
          const moveAttempt = chess.move({ from: from, to: to })
          if (moveAttempt) {
            playMoveSound(isCapture)

            const newFen = chess.fen()
            const moveString = from + to
            const san = moveAttempt.san

            if (currentNode.mainChild?.move === moveString) {
              goToNode(currentNode.mainChild)
            } else {
              const newVariation = game.tree.addVariationNode(
                currentNode,
                newFen,
                moveString,
                san,
              )
              goToNode(newVariation)
            }
          }
        } else {
          playMoveSound(isCapture)
        }
      } else {
        playMoveSound(false)
      }
    },
    [
      game,
      gameTree,
      goToNode,
      currentNode,
      onPlayerMakeMove,
      setCurrentSquare,
      playMoveSound,
    ],
  )

  const boardConfig = useMemo(() => {
    const fen = currentNode.fen

    const lastMove = currentNode.move
      ? ([currentNode.move.slice(0, 2), currentNode.move.slice(2, 4)] as [
          Key,
          Key,
        ])
      : []

    return {
      fen,
      lastMove,
      check: currentNode.check,
      orientation: orientation as 'white' | 'black',
    }
  }, [currentNode, game, orientation])

  return (
    <div className="relative h-full w-full">
      <Chessground
        contained
        config={{
          movable: {
            free: false,
            dests: availableMoves as any,
            events: {
              after,
            },
          },
          events: {
            select: (key) => {
              onSelectSquare && onSelectSquare(key)
              setCurrentSquare && setCurrentSquare(key)
            },
          },
          drawable: {
            autoShapes: shapes || [],
            brushes: { ...defaults().drawable.brushes, ...brushes },
          },
          fen: boardConfig.fen,
          lastMove: boardConfig.lastMove as Key[],
          check: boardConfig.check,
          orientation: boardConfig.orientation,
        }}
      />
      {destinationBadges.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[40]">
          {destinationBadges.map((badge, index) => {
            const squarePosition = getBoardSquarePosition(
              badge.square,
              orientation,
            )
            if (!squarePosition) {
              return null
            }

            return (
              <div
                key={`${badge.square}-${index}`}
                className="absolute h-[12.5%] w-[12.5%] overflow-hidden"
                style={{
                  left: `${squarePosition.left * 12.5}%`,
                  top: `${squarePosition.top * 12.5}%`,
                }}
              >
                <div className="absolute right-0 top-0">
                  <MoveClassificationIcon
                    classification={badge.classification}
                    size="small"
                    className="!ml-0 !h-3.5 !w-3.5 !text-[9px] pointer-events-none"
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

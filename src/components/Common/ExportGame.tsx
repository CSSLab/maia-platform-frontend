/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Chess } from 'chess.ts'
import toast from 'react-hot-toast'
import { useContext, useEffect, useState } from 'react'

import { PlayedGame, AnalyzedGame, GameTree, GameNode } from 'src/types'
import { TreeControllerContext } from 'src/contexts'

interface AnalysisProps {
  game: AnalyzedGame
  whitePlayer: string
  blackPlayer: string
  event: string
  type: 'analysis'
  currentNode: GameNode
}

interface PlayProps {
  game: PlayedGame
  gameTree?: GameTree
  whitePlayer: string
  blackPlayer: string
  event: string
  type: 'play'
  currentNode: GameNode
}

interface TuringProps {
  game: PlayedGame
  whitePlayer: string
  blackPlayer: string
  event: string
  type: 'turing'
  currentNode: GameNode
}

type Props = AnalysisProps | PlayProps | TuringProps

export const ExportGame: React.FC<Props> = (props) => {
  const { game, whitePlayer, blackPlayer, event, type } = props
  const [fen, setFen] = useState('')
  const [pgn, setPgn] = useState('')

  const controller = useContext(TreeControllerContext)

  const { currentNode, gameTree } =
    type === 'analysis'
      ? {
          currentNode: props.currentNode,
          gameTree: (props.game as AnalyzedGame).tree,
        }
      : type === 'play'
        ? {
            currentNode: controller.currentNode,
            gameTree: (props as PlayProps).gameTree || controller.gameTree,
          }
        : {
            currentNode: controller.currentNode,
            gameTree: controller.gameTree,
          }

  useEffect(() => {
    const tree = new GameTree(gameTree.getRoot().fen)
    tree.setHeader('ID', game.id)
    tree.setHeader('Event', event)
    tree.setHeader('Site', 'https://maiachess.com/')
    tree.setHeader('White', whitePlayer)
    tree.setHeader('Black', blackPlayer)
    if (game.termination) {
      tree.setHeader('Result', game.termination.result)
      if (game.termination.condition) {
        tree.setHeader('Termination', game.termination.condition)
      }
    }

    const originalMoves = gameTree.toMoveArray()
    const originalTimes = gameTree.toTimeArray()
    tree.addMovesToMainLine(originalMoves, originalTimes)

    setPgn(tree.toPGN())
    setFen(currentNode.fen)
  }, [
    currentNode,
    game.id,
    game.termination,
    whitePlayer,
    blackPlayer,
    event,
    gameTree,
    type,
  ])

  const copy = (content: string) => {
    navigator.clipboard.writeText(content)
    if (type === 'analysis') {
      toast.success('Copied to clipboard')
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex w-full items-center justify-between">
          <p className="select-none text-xs font-semibold tracking-wider text-secondary">
            FEN
          </p>
          <i
            tabIndex={0}
            role="button"
            onClick={() => copy(fen)}
            className="material-symbols-outlined select-none !text-xs text-secondary hover:text-primary"
          >
            content_copy
          </i>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => copy(fen)}
          className="border-1 group flex w-full cursor-pointer overflow-x-hidden rounded border border-white/5 p-1"
        >
          <p className="whitespace-nowrap text-xxs text-secondary group-hover:text-secondary/80">
            {fen}
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center">
            <p className="select-none text-xs font-semibold tracking-wider text-secondary">
              PGN
            </p>
          </div>
          <i
            tabIndex={0}
            role="button"
            onClick={() => copy(pgn)}
            className="material-symbols-outlined select-none !text-xs text-secondary hover:text-primary"
          >
            content_copy
          </i>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => copy(pgn)}
          className="group flex w-full cursor-pointer overflow-x-hidden overflow-y-scroll rounded border border-white/5 p-1"
        >
          <p className="whitespace-pre-wrap text-xxs text-secondary group-hover:text-secondary/80">
            {pgn}
          </p>
        </div>
      </div>
    </div>
  )
}

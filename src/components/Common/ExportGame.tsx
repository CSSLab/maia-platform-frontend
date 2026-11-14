/* eslint-disable jsx-a11y/click-events-have-key-events */
import { noteAnalysisTool } from 'src/lib/analysisVisit'
import toast from 'react-hot-toast'
import { useContext, useEffect, useState } from 'react'

import { PlayedGame, AnalyzedGame, GameTree, GameNode } from 'src/types'
import { TreeControllerContext } from 'src/contexts'
import { gameTreeToPgn } from 'src/lib/pgn'

// What the PGN's headers say of the game when it's known.
interface GameDetails {
  /** PGN's form, "2026.11.06". */
  date?: string
  /** PGN's form, "300+3", or "-" without clocks. */
  timeControl?: string
  whiteElo?: number
  blackElo?: number
}

interface AnalysisProps extends GameDetails {
  game: AnalyzedGame
  whitePlayer: string
  blackPlayer: string
  event: string
  type: 'analysis'
  currentNode: GameNode
}

interface PlayProps extends GameDetails {
  game: PlayedGame
  gameTree?: GameTree
  whitePlayer: string
  blackPlayer: string
  event: string
  type: 'play'
  currentNode: GameNode
}

interface TuringProps extends GameDetails {
  game: PlayedGame
  whitePlayer: string
  blackPlayer: string
  event: string
  type: 'turing'
  currentNode: GameNode
}

type Props = AnalysisProps | PlayProps | TuringProps

export const ExportGame: React.FC<Props> = (props) => {
  const {
    game,
    whitePlayer,
    blackPlayer,
    event,
    type,
    date,
    timeControl,
    whiteElo,
    blackElo,
  } = props
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

  // Written from the tree itself, so the variations explored on the board are
  // in it too (chess.ts writes only the main line). It's written again as
  // the current move changes, which is also when a variation is added.
  useEffect(() => {
    const positiveElo = (elo?: number) =>
      elo && Number.isFinite(elo) && elo > 0 ? Math.round(elo) : undefined

    setPgn(
      gameTreeToPgn(gameTree, {
        Event: event,
        Site: 'https://maiachess.com/',
        Date: date,
        White: whitePlayer,
        Black: blackPlayer,
        Result: game.termination?.result,
        ID: game.id,
        WhiteElo: positiveElo(whiteElo),
        BlackElo: positiveElo(blackElo),
        TimeControl: timeControl,
        Termination: game.termination?.condition,
      }),
    )
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
    date,
    timeControl,
    whiteElo,
    blackElo,
  ])

  const copy = (content: string) => {
    noteAnalysisTool('export')
    navigator.clipboard.writeText(content)
    if (type === 'analysis') {
      toast.success('Copied to clipboard')
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 overflow-hidden">
      <div className="flex w-full min-w-0 flex-col gap-0.5">
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
          className="border-1 group flex w-full min-w-0 cursor-pointer overflow-x-hidden rounded border border-white/5 p-1"
        >
          <p className="min-w-0 overflow-hidden whitespace-nowrap text-xxs text-secondary group-hover:text-secondary/80">
            {fen}
          </p>
        </div>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-0.5">
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
          className="group flex h-40 max-h-40 min-h-40 w-full min-w-0 cursor-pointer overflow-x-hidden overflow-y-scroll rounded border border-white/5 p-1"
        >
          <p className="whitespace-pre-wrap text-xxs text-secondary group-hover:text-secondary/80">
            {pgn}
          </p>
        </div>
      </div>
    </div>
  )
}

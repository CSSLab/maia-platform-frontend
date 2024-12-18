import Head from 'next/head'
import type { DrawShape } from 'chessground/draw'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {
  AuthContext,
  ThemeContext,
  WindowSizeContext,
  GameControllerContext,
} from 'src/contexts'
import {
  GameInfo,
  GameClock,
  GameBoard,
  ExportGame,
  StatsDisplay,
  MovesContainer,
  BoardController,
  PromotionOverlay,
} from 'src/components'
import { useGameController } from 'src/hooks'
import { useUnload } from 'src/hooks/useUnload'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext/PlayControllerContext'

interface Props {
  boardShapes?: DrawShape[]
  resign?: () => void
  offerDraw?: () => void
  playAgain?: () => void
}

export const GameplayInterface: React.FC<Props> = (
  props: React.PropsWithChildren<Props>,
) => {
  const {
    game,
    playType,
    maiaVersion,
    availableMoves,
    makeMove,
    player,
    setCurrentSquare,
    timeControl,
    stats,
  } = useContext(PlayControllerContext)
  const { theme } = useContext(ThemeContext)
  const { isMobile } = useContext(WindowSizeContext)

  const controller = useGameController(game, 0, player)

  const { user } = useContext(AuthContext)

  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)

  const setCurrentIndex = controller.setCurrentIndex

  const setCurrentMove = useCallback(
    (move) => {
      if (move) {
        const matching = availableMoves.filter(
          (m) => m.from == move[0] && m.to == move[1],
        )

        if (matching.length > 1) {
          // Multiple matching moves (i.e. promotion)
          // Show promotion UI
          setPromotionFromTo(move)
        } else {
          const moveUci =
            matching[0].from + matching[0].to + (matching[0].promotion ?? '')
          makeMove(moveUci)
        }
      }
    },
    [availableMoves, makeMove, setPromotionFromTo],
  )

  const selectPromotion = useCallback(
    (piece) => {
      if (!promotionFromTo) {
        return
      }
      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece
      makeMove(moveUci)
    },
    [promotionFromTo, setPromotionFromTo, makeMove],
  )

  useEffect(() => {
    setCurrentIndex(game.moves.length - 1)
  }, [setCurrentIndex, game])

  useUnload((e) => {
    if (!game.termination) {
      e.preventDefault()
      return 'Are you sure you want to leave a game in progress?'
    }
  })

  const moveMap = useMemo(() => {
    const result = new Map()

    for (const move of availableMoves) {
      const from = move.from
      const to = move.to

      if (result.has(from)) {
        result.get(from).push(to)
      } else {
        result.set(from, [to])
      }
    }

    return result
  }, [availableMoves])

  const maiaTitle = maiaVersion.replace('maia_kdd_', 'Maia ')
  const blackPlayer = player == 'black' ? user?.displayName : maiaTitle
  const whitePlayer = player == 'white' ? user?.displayName : maiaTitle

  const Info = (
    <>
      <div className="flex w-full items-center justify-between text-secondary">
        <p>
          {theme == 'dark' ? '●' : '○'} {whitePlayer ?? 'Unknown'}
        </p>
        <p>
          {game.termination?.winner === 'white' ? (
            <span className="text-engine-3">1</span>
          ) : game.termination?.winner === 'black' ? (
            <span className="text-human-3">0</span>
          ) : game.termination ? (
            <span>1/2</span>
          ) : null}
        </p>
      </div>
      <div className="flex w-full items-center justify-between text-secondary">
        <p>
          {theme == 'light' ? '●' : '○'} {blackPlayer ?? 'Unknown'}
        </p>
        <p>
          {game.termination?.winner === 'black' ? (
            <span className="text-engine-3">1</span>
          ) : game.termination?.winner === 'white' ? (
            <span className="text-human-3">0</span>
          ) : game.termination ? (
            <span>1/2</span>
          ) : null}
        </p>
      </div>{' '}
      {game.termination ? (
        <p className="text-center capitalize text-secondary">
          {game.termination.winner !== 'none'
            ? `${game.termination.winner} wins`
            : 'draw'}
        </p>
      ) : null}
    </>
  )

  const desktopLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="flex w-full flex-row items-center justify-center gap-1">
          <div
            style={{
              maxWidth: 'min(20vw, 100vw - 75vh)',
            }}
            className="flex h-[75vh] w-[40vh] flex-col justify-between gap-1"
          >
            <GameInfo
              icon="swords"
              type={playType}
              title={
                playType === 'againstMaia'
                  ? 'Play vs. Maia'
                  : 'Play Hand and Brain'
              }
            >
              {Info}
            </GameInfo>
            <div className="flex w-full flex-col gap-2">
              <ExportGame
                game={game}
                whitePlayer={whitePlayer ?? 'Unknown'}
                blackPlayer={blackPlayer ?? 'Unknown'}
                maiaVersion={maiaTitle}
              />
              <StatsDisplay stats={stats} hideSession={true} />
            </div>
          </div>
          <div className="relative flex aspect-square w-full max-w-[75vh]">
            <GameBoard
              game={game}
              moves={moveMap}
              setCurrentMove={setCurrentMove}
              setCurrentSquare={setCurrentSquare}
              shapes={props.boardShapes}
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={player}
                file={promotionFromTo[1].slice(0)}
                selectPromotion={selectPromotion}
              />
            ) : null}
          </div>
          <div
            style={{
              maxWidth: 'min(20vw, 100vw - 75vh)',
            }}
            className="flex h-[75vh] w-[40vh] flex-col justify-center gap-1"
          >
            {timeControl != 'unlimited' ? (
              <GameClock
                player={controller.orientation == 'white' ? 'black' : 'white'}
                reversed={false}
              />
            ) : null}
            <div className="relative bottom-0 h-full min-h-[38px] flex-1">
              <MovesContainer game={game} termination={game.termination} />
            </div>
            <div>{props.children}</div>
            <div className="flex-none">
              <BoardController />
            </div>
            {timeControl != 'unlimited' ? (
              <GameClock player={controller.orientation} reversed={true} />
            ) : null}
          </div>
        </div>
      </div>
    </>
  )

  const mobileLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="mt-2 flex h-full flex-col items-start justify-start gap-2">
          <div className="flex h-auto w-full flex-col gap-1">
            {timeControl != 'unlimited' ? (
              <GameClock
                player={controller.orientation == 'white' ? 'black' : 'white'}
                reversed={false}
              />
            ) : null}
          </div>
          <div className="relative flex aspect-square h-[100vw] w-screen">
            <GameBoard
              game={game}
              moves={moveMap}
              setCurrentMove={setCurrentMove}
              setCurrentSquare={setCurrentSquare}
              shapes={props.boardShapes}
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={player}
                file={promotionFromTo[1].slice(0)}
                selectPromotion={selectPromotion}
              />
            ) : null}
          </div>
          <div className="flex h-auto w-full flex-col gap-1">
            {timeControl != 'unlimited' ? (
              <GameClock player={controller.orientation} reversed={true} />
            ) : null}
            <div className="flex-none">
              <BoardController />
            </div>
            <div className="w-screen">{props.children}</div>
            <StatsDisplay stats={stats} hideSession={true} />
            <ExportGame
              game={game}
              whitePlayer={whitePlayer ?? 'Unknown'}
              blackPlayer={blackPlayer ?? 'Unknown'}
              maiaVersion={maiaTitle}
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>Maia Chess - Play</title>
        <meta name="description" content="Turing survey" />
      </Head>
      <GameControllerContext.Provider value={{ ...controller }}>
        {isMobile ? mobileLayout : desktopLayout}
      </GameControllerContext.Provider>
    </>
  )
}

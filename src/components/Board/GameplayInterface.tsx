import {
  GameInfo,
  GameBoard,
  GameClock,
  ExportGame,
  StatsDisplay,
  PromotionOverlay,
  MovesContainer,
  BoardController,
} from 'src/components'
import Head from 'next/head'
import { useUnload } from 'src/hooks/useUnload'
import type { DrawShape } from 'chessground/draw'
import { useCallback, useContext, useMemo, useState } from 'react'
import { AuthContext, WindowSizeContext } from 'src/contexts'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext/PlayControllerContext'

interface Props {
  boardShapes?: DrawShape[]
  resign?: () => void
  offerDraw?: () => void
  playAgain?: () => void
}

export const GameplayInterface: React.FC<React.PropsWithChildren<Props>> = (
  props: React.PropsWithChildren<Props>,
) => {
  const {
    game,
    stats,
    player,
    playType,
    gameTree,
    goToNode,
    plyCount,
    orientation,
    timeControl,
    currentNode,
    maiaVersion,
    goToRootNode,
    goToNextNode,
    availableMoves,
    makePlayerMove,
    setOrientation,
    goToPreviousNode,
  } = useContext(PlayControllerContext)

  const { user } = useContext(AuthContext)
  const { isMobile } = useContext(WindowSizeContext)

  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)

  const onPlayerMakeMove = useCallback(
    (move: [string, string] | null) => {
      if (move) {
        const matching = availableMoves.filter((m) => {
          return m.from == move[0] && m.to == move[1]
        })

        if (matching.length > 1) {
          // Multiple matching moves (i.e. promotion)
          setPromotionFromTo(move)
        } else {
          const moveUci =
            matching[0].from + matching[0].to + (matching[0].promotion ?? '')
          makePlayerMove(moveUci)
        }
      }
    },
    [availableMoves, makePlayerMove, setPromotionFromTo],
  )

  const onPlayerSelectPromotion = useCallback(
    (piece: string) => {
      if (!promotionFromTo) {
        return
      }
      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece
      makePlayerMove(moveUci)
    },
    [promotionFromTo, setPromotionFromTo, makePlayerMove],
  )

  useUnload((e) => {
    if (!game.termination) {
      e.preventDefault()
      return 'Are you sure you want to leave a game in progress?'
    }
  })

  const availableMovesMapped = useMemo(() => {
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
        <p>● {whitePlayer ?? 'Unknown'}</p>
        <p>
          {game.termination?.winner === 'white' ? (
            <span className="text-engine-3">1</span>
          ) : game.termination?.winner === 'black' ? (
            <span className="text-human-3">0</span>
          ) : game.termination ? (
            <span className="text-secondary">½</span>
          ) : null}
        </p>
      </div>
      <div className="flex w-full items-center justify-between text-secondary">
        <p>○ {blackPlayer ?? 'Unknown'}</p>
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
      <div className="flex h-full flex-1 flex-col justify-center gap-1 py-5 md:py-10">
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
                gameTree={gameTree}
                currentNode={currentNode}
                whitePlayer={whitePlayer ?? 'Unknown'}
                blackPlayer={blackPlayer ?? 'Unknown'}
                event={`Play vs. ${maiaTitle}`}
                type="play"
              />
              <StatsDisplay stats={stats} hideSession={true} />
            </div>
          </div>
          <div
            id="play-page"
            className="relative flex aspect-square w-full max-w-[75vh]"
          >
            <GameBoard
              game={game}
              availableMoves={availableMovesMapped}
              onPlayerMakeMove={onPlayerMakeMove}
              shapes={props.boardShapes}
              currentNode={currentNode}
              orientation={orientation}
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={player}
                file={promotionFromTo[1].slice(0)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
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
                player={orientation == 'white' ? 'black' : 'white'}
                reversed={false}
              />
            ) : null}
            <div className="relative bottom-0 h-full min-h-[38px] flex-1">
              <MovesContainer
                game={game}
                termination={game.termination}
                type="play"
              />
            </div>
            <div>{props.children}</div>
            <div className="flex-none">
              <BoardController
                orientation={orientation}
                setOrientation={setOrientation}
                currentNode={currentNode}
                plyCount={plyCount}
                goToNode={goToNode}
                goToNextNode={goToNextNode}
                goToPreviousNode={goToPreviousNode}
                goToRootNode={goToRootNode}
                gameTree={gameTree}
              />
            </div>
            {timeControl != 'unlimited' ? (
              <GameClock player={orientation} reversed={true} />
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
                player={orientation == 'white' ? 'black' : 'white'}
                reversed={false}
              />
            ) : null}
          </div>
          <div
            id="play-page"
            className="relative flex aspect-square h-[100vw] w-screen"
          >
            <GameBoard
              game={game}
              availableMoves={availableMovesMapped}
              onPlayerMakeMove={onPlayerMakeMove}
              shapes={props.boardShapes}
              currentNode={currentNode}
              orientation={orientation}
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={player}
                file={promotionFromTo[1].slice(0)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
              />
            ) : null}
          </div>
          <div className="flex h-auto w-full flex-col gap-1">
            {timeControl != 'unlimited' ? (
              <GameClock player={orientation} reversed={true} />
            ) : null}
            <div className="flex-none">
              <BoardController
                orientation={orientation}
                setOrientation={setOrientation}
                currentNode={currentNode}
                plyCount={plyCount}
                goToNode={goToNode}
                goToNextNode={goToNextNode}
                goToPreviousNode={goToPreviousNode}
                goToRootNode={goToRootNode}
                gameTree={gameTree}
              />
            </div>
            <div className="w-full overflow-x-auto">
              <div className="flex flex-row whitespace-nowrap py-2">
                <MovesContainer
                  game={game}
                  termination={game.termination}
                  type="play"
                />
              </div>
            </div>
            <div className="w-screen">{props.children}</div>
            <StatsDisplay stats={stats} hideSession={true} />
            <div className="px-2">
              <ExportGame
                game={game}
                gameTree={gameTree}
                currentNode={currentNode}
                whitePlayer={whitePlayer ?? 'Unknown'}
                blackPlayer={blackPlayer ?? 'Unknown'}
                event={`Play vs. ${maiaTitle}`}
                type="play"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  const layouts = isMobile ? mobileLayout : desktopLayout

  return (
    <>
      <Head>
        <title>Maia Chess - Play</title>
        <meta name="description" content="Turing survey" />
      </Head>
      {layouts}
    </>
  )
}

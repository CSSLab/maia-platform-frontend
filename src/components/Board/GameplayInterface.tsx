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
import {
  AuthContext,
  WindowSizeContext,
  TreeControllerContext,
} from 'src/contexts'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'

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
    setCurrentNode,
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
            <span>½</span>
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
      <div className="flex h-full flex-1 flex-col justify-center gap-1 py-2 md:py-4">
        <div className="mx-auto mt-2 flex w-[90%] flex-row items-start justify-between gap-3">
          <div className="flex h-[75vh] min-w-[16rem] max-w-[22rem] flex-shrink-0 flex-col">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
              <GameInfo
                icon="swords"
                type={playType}
                title={
                  playType === 'againstMaia'
                    ? 'Play vs. Maia'
                    : 'Play Hand and Brain'
                }
                embedded
              >
                {Info}
              </GameInfo>
              <div className="mt-auto flex flex-col">
                <div className="px-3 pb-4">
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
                <div className="h-3 border-y border-glass-border" />
                <StatsDisplay
                  stats={stats}
                  hideSession={true}
                  isGame={true}
                  embedded
                  hideEmbeddedBorder
                />
              </div>
            </div>
          </div>
          <div
            id="play-page"
            className="relative flex aspect-square w-full max-w-[75vh] flex-shrink-0"
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
          <div className="flex h-[75vh] min-w-[18rem] flex-grow flex-col gap-2">
            {timeControl != 'unlimited' ? (
              <GameClock
                player={orientation == 'white' ? 'black' : 'white'}
                reversed={false}
              />
            ) : null}
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md">
              <div className="flex-1 overflow-hidden border-b border-glass-border">
                <MovesContainer
                  game={game}
                  termination={game.termination}
                  embedded
                  heightClass="h-full"
                />
              </div>
              <div className="border-b border-glass-border">
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
                  embedded
                />
              </div>
              <div className="px-4 py-3">{props.children}</div>
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
            className="relative mx-auto flex aspect-square w-full max-w-3xl"
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
            <div className="w-full">
              <div className="flex flex-col overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md">
                <div className="border-b border-glass-border">
                  <MovesContainer
                    game={game}
                    termination={game.termination}
                    embedded
                  />
                </div>
                <div className="border-b border-glass-border">
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
                    embedded
                  />
                </div>
                <div className="px-4 py-3">{props.children}</div>
              </div>
            </div>
            <StatsDisplay stats={stats} hideSession={true} isGame={true} />
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
      <TreeControllerContext.Provider
        value={{
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
        }}
      >
        {layouts}
      </TreeControllerContext.Provider>
    </>
  )
}

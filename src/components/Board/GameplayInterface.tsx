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
import { useUnload } from 'src/hooks/useUnload'
import { LEAVE_GAME_ABORT } from 'src/lib/leaveGame'
import { useRouter } from 'next/router'
import type { DrawShape } from 'chessground/draw'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  AuthContext,
  WindowSizeContext,
  TreeControllerContext,
} from 'src/contexts'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'
import { formatPgnDate, pgnPlayerName } from 'src/lib/pgn'
import { pgnTimeControl } from 'src/lib/timeControl'

const LEAVE_GAME_QUESTION =
  'You have a game in progress. Leave it? (Its clock keeps running; you can come back to it from Play.)'

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
    playerActive,
    goToRootNode,
    goToNextNode,
    availableMoves,
    makePlayerMove,
    setOrientation,
    goToPreviousNode,
    premovesEnabled,
    setPremove,
    clearPremove,
    premoveResetKey,
  } = useContext(PlayControllerContext)

  const { user } = useContext(AuthContext)
  const { isMobile } = useContext(WindowSizeContext)

  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)

  useEffect(() => {
    setPromotionFromTo(null)
  }, [game.id])

  const onPlayerMakeMove = useCallback(
    (move: [string, string] | null) => {
      if (move) {
        const matching = availableMoves.filter((m) => {
          return m.from == move[0] && m.to == move[1]
        })

        if (matching.length > 1) {
          // Multiple matching moves (i.e. promotion)
          clearPremove()
          setPromotionFromTo(move)
        } else if (matching[0]) {
          const moveUci =
            matching[0].from + matching[0].to + (matching[0].promotion ?? '')
          makePlayerMove(moveUci)
        }
      }
    },
    [availableMoves, clearPremove, makePlayerMove, setPromotionFromTo],
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

  // Clicking away to another page of the site, mid-game, asks first. (The
  // browser's own prompt, above, covers closing the tab and reloading.)
  const router = useRouter()
  const gameInProgress = !!game.id && !game.termination && plyCount > 0
  useEffect(() => {
    if (!gameInProgress) return
    const onRouteChangeStart = (url: string) => {
      // The game's own page changing its address (a new game's id) isn't
      // leaving.
      if (url.split('?')[0] === router.pathname) return
      if (window.confirm(LEAVE_GAME_QUESTION)) return
      // How a route change is called off in the pages router: the event that
      // ends it, then an error that stops it (swallowed below).
      router.events.emit('routeChangeError', LEAVE_GAME_ABORT, url)
      throw LEAVE_GAME_ABORT
    }
    const ignoreAbort = (event: PromiseRejectionEvent) => {
      if (event.reason === LEAVE_GAME_ABORT) event.preventDefault()
    }
    router.events.on('routeChangeStart', onRouteChangeStart)
    window.addEventListener('unhandledrejection', ignoreAbort)
    return () => {
      router.events.off('routeChangeStart', onRouteChangeStart)
      window.removeEventListener('unhandledrejection', ignoreAbort)
    }
  }, [gameInProgress, router])

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

  const maiaTitle = maiaVersion.replace('maia_kdd_', 'Maia-3 ')
  // A visitor who isn't signed in is "Guest": their account has no name, and
  // an exported game named them as missing.
  const humanName = pgnPlayerName(user)
  const blackPlayer = player == 'black' ? humanName : maiaTitle
  const whitePlayer = player == 'white' ? humanName : maiaTitle

  // The date and the player's rating as the game started, for its PGN: the
  // rating shown changes once a rated game ends. Only a game against Maia
  // has a rating for each side (Hand and Brain pairs the player with Maia).
  const [gameStart, setGameStart] = useState<{
    gameId: string
    date: string
    rating?: number
  } | null>(null)
  useEffect(() => {
    const rating = stats.rating || undefined
    setGameStart((previous) => {
      if (previous?.gameId !== game.id) {
        return { gameId: game.id, date: formatPgnDate(new Date()), rating }
      }
      // Stats load after the game may have started; once it's over, the
      // rating is the one after it.
      if (previous.rating || game.termination || !rating) return previous
      return { ...previous, rating }
    })
  }, [game.id, game.termination, stats.rating])

  const maiaRating = parseInt(maiaVersion.replace('maia_kdd_', ''), 10)
  const playerRating =
    playType === 'againstMaia' && gameStart?.gameId === game.id
      ? gameStart.rating
      : undefined
  const pgnDetails = {
    date: gameStart?.gameId === game.id ? gameStart.date : undefined,
    timeControl: pgnTimeControl(timeControl),
    whiteElo:
      playType !== 'againstMaia'
        ? undefined
        : player === 'white'
          ? playerRating
          : maiaRating,
    blackElo:
      playType !== 'againstMaia'
        ? undefined
        : player === 'black'
          ? playerRating
          : maiaRating,
  }

  const Info = (
    <>
      <div className="flex w-full items-center justify-between text-secondary">
        <p>● {whitePlayer}</p>
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
        <p>○ {blackPlayer}</p>
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
      {/* From the top, as on the analysis page: centred, the game sat under
          a band of empty space (about 100px in a 900px-tall window). */}
      <div className="flex h-full flex-1 flex-col justify-start gap-1 py-2 md:py-4">
        <div className="mx-auto mt-2 flex w-[90%] flex-row items-start justify-between gap-3">
          <div className="flex h-[75vh] max-h-[75vh] min-h-[75vh] w-[22rem] min-w-[22rem] max-w-[22rem] flex-shrink-0 flex-col overflow-hidden">
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
                    whitePlayer={whitePlayer}
                    blackPlayer={blackPlayer}
                    event={`Play vs. ${maiaTitle}`}
                    type="play"
                    {...pgnDetails}
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
              key={game.id}
              game={game}
              availableMoves={availableMovesMapped}
              onPlayerMakeMove={onPlayerMakeMove}
              onSetPremove={([from, to]) => setPremove(from, to)}
              onUnsetPremove={clearPremove}
              shapes={props.boardShapes}
              currentNode={currentNode}
              orientation={orientation}
              movableColor={player}
              premovesEnabled={
                premovesEnabled && !game.termination && !playerActive
              }
              premoveResetKey={premoveResetKey}
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={player}
                file={promotionFromTo[1].slice(0)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
              />
            ) : null}
          </div>
          <div className="flex h-[75vh] min-w-0 flex-grow basis-[18rem] flex-col gap-2 overflow-hidden">
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
              key={game.id}
              game={game}
              availableMoves={availableMovesMapped}
              onPlayerMakeMove={onPlayerMakeMove}
              onSetPremove={([from, to]) => setPremove(from, to)}
              onUnsetPremove={clearPremove}
              shapes={props.boardShapes}
              currentNode={currentNode}
              orientation={orientation}
              movableColor={player}
              premovesEnabled={
                premovesEnabled && !game.termination && !playerActive
              }
              premoveResetKey={premoveResetKey}
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
                whitePlayer={whitePlayer}
                blackPlayer={blackPlayer}
                event={`Play vs. ${maiaTitle}`}
                type="play"
                {...pgnDetails}
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

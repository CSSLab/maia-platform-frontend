import React, {
  useRef,
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useContext,
  useCallback,
  SetStateAction,
} from 'react'
import {
  getLichessGamePGN,
  getAnalyzedUserGame,
  getAnalyzedLichessGame,
  getAnalyzedTournamentGame,
  getAnalyzedCustomPGN,
  getAnalyzedCustomFEN,
  getAnalyzedCustomGame,
} from 'src/api'
import {
  AnalyzedGame,
  MaiaEvaluation,
  StockfishEvaluation,
  GameNode,
} from 'src/types'
import {
  ModalContext,
  WindowSizeContext,
  TreeControllerContext,
  useTour,
} from 'src/contexts'
import { Loading } from 'src/components/Core/Loading'
import { AuthenticatedWrapper } from 'src/components/Core/AuthenticatedWrapper'
import { PlayerInfo } from 'src/components/Core/PlayerInfo'
import { MoveMap } from 'src/components/Analysis/MoveMap'
import { Highlight } from 'src/components/Analysis/Highlight'
import { BlunderMeter } from 'src/components/Analysis/BlunderMeter'
import { MovesByRating } from 'src/components/Analysis/MovesByRating'
import { AnalysisGameList } from 'src/components/Analysis/AnalysisGameList'
import { DownloadModelModal } from 'src/components/Analysis/DownloadModelModal'
import { CustomAnalysisModal } from 'src/components/Analysis/CustomAnalysisModal'
import { ConfigurableScreens } from 'src/components/Analysis/ConfigurableScreens'
import { GameBoard } from 'src/components/Board/GameBoard'
import { MovesContainer } from 'src/components/Board/MovesContainer'
import { BoardController } from 'src/components/Board/BoardController'
import { PromotionOverlay } from 'src/components/Board/PromotionOverlay'
import { GameInfo } from 'src/components/Misc/GameInfo'
import Head from 'next/head'
import toast from 'react-hot-toast'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import type { Key } from 'chessground/types'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence } from 'framer-motion'
import { useAnalysisController } from 'src/hooks'
import { tourConfigs } from 'src/config/tours'
import type { DrawBrushes, DrawShape } from 'chessground/draw'

const MAIA_MODELS = [
  'maia_kdd_1100',
  'maia_kdd_1200',
  'maia_kdd_1300',
  'maia_kdd_1400',
  'maia_kdd_1500',
  'maia_kdd_1600',
  'maia_kdd_1700',
  'maia_kdd_1800',
  'maia_kdd_1900',
]

const AnalysisPage: NextPage = () => {
  const { startTour, tourState } = useTour()

  const router = useRouter()
  const { id } = router.query

  const [analyzedGame, setAnalyzedGame] = useState<AnalyzedGame | undefined>(
    undefined,
  )
  const [initialTourCheck, setInitialTourCheck] = useState(false)

  useEffect(() => {
    // Wait for tour system to be ready before starting tour
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      // Always attempt to start the tour - the tour context will handle completion checking
      startTour(tourConfigs.analysis.id, tourConfigs.analysis.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])
  const [currentId, setCurrentId] = useState<string[]>(id as string[])

  const getAndSetTournamentGame = useCallback(
    async (
      newId: string[],
      setCurrentMove?: Dispatch<SetStateAction<number>>,
    ) => {
      let game
      try {
        game = await getAnalyzedTournamentGame(newId)
      } catch (e) {
        router.push('/401')
        return
      }
      if (setCurrentMove) setCurrentMove(0)

      setAnalyzedGame({ ...game, type: 'tournament' })
      setCurrentId(newId)

      router.push(`/analysis/${newId.join('/')}`, undefined, {
        shallow: true,
      })
    },
    [router],
  )

  const getAndSetLichessGame = useCallback(
    async (
      id: string,
      pgn: string,
      setCurrentMove?: Dispatch<SetStateAction<number>>,
    ) => {
      let game
      try {
        game = await getAnalyzedLichessGame(id, pgn)
      } catch (e) {
        router.push('/401')
        return
      }
      if (setCurrentMove) setCurrentMove(0)

      setAnalyzedGame({
        ...game,
        type: 'pgn',
      })
      setCurrentId([id, 'pgn'])

      router.push(`/analysis/${id}/pgn`, undefined, { shallow: true })
    },
    [router],
  )

  const getAndSetUserGame = useCallback(
    async (
      id: string,
      type: 'play' | 'hand' | 'brain',
      setCurrentMove?: Dispatch<SetStateAction<number>>,
    ) => {
      let game
      try {
        game = await getAnalyzedUserGame(id, type)
      } catch (e) {
        router.push('/401')
        return
      }
      if (setCurrentMove) setCurrentMove(0)

      setAnalyzedGame({ ...game, type })
      setCurrentId([id, type])

      router.push(`/analysis/${id}/${type}`, undefined, {
        shallow: true,
      })
    },
    [],
  )

  const getAndSetCustomGame = useCallback(
    async (id: string, setCurrentMove?: Dispatch<SetStateAction<number>>) => {
      let game
      try {
        game = await getAnalyzedCustomGame(id)
      } catch (e) {
        toast.error((e as Error).message)
        return
      }
      if (setCurrentMove) setCurrentMove(0)

      setAnalyzedGame(game)
      setCurrentId([id])

      router.push(`/analysis/${id}`, undefined, {
        shallow: true,
      })
    },
    [router],
  )

  const getAndSetCustomAnalysis = useCallback(
    async (type: 'pgn' | 'fen', data: string, name?: string) => {
      let game: AnalyzedGame
      try {
        if (type === 'pgn') {
          game = await getAnalyzedCustomPGN(data, name)
        } else {
          game = await getAnalyzedCustomFEN(data, name)
        }
      } catch (e) {
        toast.error((e as Error).message)
        return
      }

      setAnalyzedGame(game)
      setCurrentId([game.id])

      router.push(`/analysis/${game.id}`, undefined, {
        shallow: true,
      })
    },
    [router],
  )

  useEffect(() => {
    ;(async () => {
      if (analyzedGame == undefined) {
        const queryId = id as string[]
        if (queryId[0]?.startsWith('custom-')) {
          try {
            const game = await getAnalyzedCustomGame(queryId[0])
            setAnalyzedGame(game)
            setCurrentId(queryId)
          } catch (e) {
            console.error('Failed to load custom analysis:', e)
            toast.error('Custom analysis not found')
          }
        } else if (queryId[1] === 'pgn') {
          const pgn = await getLichessGamePGN(queryId[0])
          getAndSetLichessGame(queryId[0], pgn, undefined)
        } else if (['play', 'hand', 'brain'].includes(queryId[1])) {
          getAndSetUserGame(queryId[0], queryId[1] as 'play' | 'hand' | 'brain')
        } else {
          getAndSetTournamentGame(queryId)
        }
      }
    })()
  }, [
    id,
    analyzedGame,
    getAndSetTournamentGame,
    getAndSetLichessGame,
    getAndSetUserGame,
  ])

  return (
    <>
      {analyzedGame ? (
        <Analysis
          currentId={currentId}
          analyzedGame={analyzedGame}
          getAndSetTournamentGame={getAndSetTournamentGame}
          getAndSetLichessGame={getAndSetLichessGame}
          getAndSetUserGame={getAndSetUserGame}
          getAndSetCustomGame={getAndSetCustomGame}
          getAndSetCustomAnalysis={getAndSetCustomAnalysis}
          router={router}
        />
      ) : (
        <Loading />
      )}
    </>
  )
}

interface Props {
  currentId: string[]
  analyzedGame: AnalyzedGame

  getAndSetTournamentGame: (
    newId: string[],
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  getAndSetLichessGame: (
    id: string,
    pgn: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  getAndSetUserGame: (
    id: string,
    type: 'play' | 'hand' | 'brain',
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  getAndSetCustomGame: (
    id: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  getAndSetCustomAnalysis: (
    type: 'pgn' | 'fen',
    data: string,
    name?: string,
  ) => Promise<void>
  router: ReturnType<typeof useRouter>
}

const Analysis: React.FC<Props> = ({
  currentId,
  analyzedGame,
  getAndSetTournamentGame,
  getAndSetLichessGame,
  getAndSetUserGame,
  getAndSetCustomGame,
  getAndSetCustomAnalysis,
  router,
}: Props) => {
  const screens = [
    {
      id: 'configure',
      name: 'Configure',
    },
    {
      id: 'export',
      name: 'Export',
    },
  ]

  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const [arrows, setArrows] = useState<DrawShape[]>([])
  const [brushes, setBrushes] = useState<DrawBrushes>({} as DrawBrushes)
  const [screen, setScreen] = useState(screens[0])
  const toastId = useRef<string>(null)
  const stockfishToastId = useRef<string>(null)
  const [currentSquare, setCurrentSquare] = useState<Key | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const controller = useAnalysisController(analyzedGame)

  useEffect(() => {
    if (analyzedGame.tree) {
      controller.setCurrentNode(analyzedGame.tree.getRoot())
    }
  }, [analyzedGame])

  useEffect(() => {
    setHoverArrow(null)
  }, [controller.currentNode])

  useEffect(() => {
    return () => {
      toast.dismiss()
    }
  }, [])

  useEffect(() => {
    if (controller.maiaStatus === 'loading' && !toastId.current) {
      toastId.current = toast.loading('Loading Maia Model...')
    } else if (controller.maiaStatus === 'ready') {
      if (toastId.current) {
        toast.success('Loaded Maia! Analysis is ready', {
          id: toastId.current,
        })
      } else {
        toast.success('Loaded Maia! Analysis is ready')
      }
    }
  }, [controller.maiaStatus])

  useEffect(() => {
    if (controller.stockfishStatus === 'loading' && !stockfishToastId.current) {
      stockfishToastId.current = toast.loading('Loading Stockfish Engine...')
    } else if (controller.stockfishStatus === 'ready') {
      if (stockfishToastId.current) {
        toast.success('Loaded Stockfish! Engine is ready', {
          id: stockfishToastId.current,
        })
        stockfishToastId.current = null
      } else {
        toast.success('Loaded Stockfish! Engine is ready')
      }
    } else if (controller.stockfishStatus === 'error') {
      if (stockfishToastId.current) {
        toast.error('Failed to load Stockfish engine', {
          id: stockfishToastId.current,
        })
        stockfishToastId.current = null
      } else {
        toast.error('Failed to load Stockfish engine')
      }
    }
  }, [controller.stockfishStatus])

  const launchContinue = useCallback(() => {
    const fen = controller.currentNode?.fen as string
    const url = '/play' + '?fen=' + encodeURIComponent(fen)

    window.open(url)
  }, [controller.currentNode])

  const handleCustomAnalysis = useCallback(
    async (type: 'pgn' | 'fen', data: string, name?: string) => {
      setShowCustomModal(false)
      await getAndSetCustomAnalysis(type, data, name)
      setRefreshTrigger((prev) => prev + 1)
    },
    [getAndSetCustomAnalysis],
  )

  const handleDeleteCustomGame = useCallback(async () => {
    if (
      analyzedGame.type === 'custom-pgn' ||
      analyzedGame.type === 'custom-fen'
    ) {
      const { deleteCustomAnalysis } = await import('src/utils/customAnalysis')
      deleteCustomAnalysis(analyzedGame.id)
      toast.success('Custom analysis deleted')
      router.push('/analysis')
    }
  }, [analyzedGame, router])

  useEffect(() => {
    const arr = []

    if (controller.moveEvaluation?.maia) {
      const maia = Object.entries(controller.moveEvaluation?.maia?.policy)[0]
      if (maia) {
        arr.push({
          brush: 'red',
          orig: maia[0].slice(0, 2) as Key,
          dest: maia[0].slice(2, 4) as Key,
        } as DrawShape)
      }
    }

    if (controller.moveEvaluation?.stockfish) {
      const stockfish = Object.entries(
        controller.moveEvaluation?.stockfish.cp_vec,
      )[0]
      if (stockfish) {
        arr.push({
          brush: 'blue',
          orig: stockfish[0].slice(0, 2) as Key,
          dest: stockfish[0].slice(2, 4) as Key,
          modifiers: { lineWidth: 8 },
        })
      }
    }

    setArrows(arr)
  }, [
    controller.moveEvaluation,
    controller.currentNode,
    controller.orientation,
  ])

  const hover = (move?: string) => {
    if (move) {
      setHoverArrow({
        orig: move.slice(0, 2) as Key,
        dest: move.slice(2, 4) as Key,
        brush: 'green',
        modifiers: {
          lineWidth: 10,
        },
      })
    } else {
      setHoverArrow(null)
    }
  }

  const makeMove = (move: string) => {
    if (!controller.currentNode || !analyzedGame.tree) return

    const chess = new Chess(controller.currentNode.fen)
    const moveAttempt = chess.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] ? (move[4] as PieceSymbol) : undefined,
    })

    if (moveAttempt) {
      const newFen = chess.fen()

      const moveString =
        moveAttempt.from +
        moveAttempt.to +
        (moveAttempt.promotion ? moveAttempt.promotion : '')
      const san = moveAttempt.san

      if (controller.currentNode.mainChild?.move === moveString) {
        controller.goToNode(controller.currentNode.mainChild)
      } else {
        const newVariation = analyzedGame.tree.addVariation(
          controller.currentNode,
          newFen,
          moveString,
          san,
          controller.currentMaiaModel,
        )
        controller.goToNode(newVariation)
      }
    }
  }

  const onPlayerMakeMove = useCallback(
    (playedMove: [string, string] | null) => {
      if (!playedMove) return

      // Check for promotions in available moves
      const availableMoves = Array.from(controller.moves.entries()).flatMap(
        ([from, tos]) => tos.map((to) => ({ from, to })),
      )

      const matching = availableMoves.filter((m) => {
        return m.from === playedMove[0] && m.to === playedMove[1]
      })

      if (matching.length > 1) {
        // Multiple matching moves (i.e. promotion)
        setPromotionFromTo(playedMove)
        return
      }

      // Single move
      const moveUci = playedMove[0] + playedMove[1]
      makeMove(moveUci)
    },
    [controller.moves, makeMove],
  )

  const onPlayerSelectPromotion = useCallback(
    (piece: string) => {
      if (!promotionFromTo) {
        return
      }
      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece
      makeMove(moveUci)
    },
    [promotionFromTo, setPromotionFromTo, makeMove],
  )

  // Determine current player for promotion overlay
  const currentPlayer = useMemo(() => {
    if (!controller.currentNode) return 'white'
    const chess = new Chess(controller.currentNode.fen)
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [controller.currentNode])

  const NestedGameInfo = () => (
    <div className="flex w-full flex-col">
      <div className="hidden md:block">
        {[analyzedGame.whitePlayer, analyzedGame.blackPlayer].map(
          (player, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-white' : 'border-[0.5px] bg-black'}`}
                />
                <p className="text-sm">{player.name}</p>
                <span className="text-xs">
                  {player.rating ? <>({player.rating})</> : null}
                </span>
              </div>
              {analyzedGame.termination.winner ===
              (index == 0 ? 'white' : 'black') ? (
                <p className="text-xs text-engine-3">1</p>
              ) : analyzedGame.termination.winner !== 'none' ? (
                <p className="text-xs text-human-3">0</p>
              ) : analyzedGame.termination === undefined ? (
                <></>
              ) : (
                <p className="text-xs text-secondary">½</p>
              )}
            </div>
          ),
        )}
      </div>
      <div className="flex w-full items-center justify-between text-xs md:hidden">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="font-medium">{analyzedGame.whitePlayer.name}</span>
          {analyzedGame.whitePlayer.rating && (
            <span className="text-primary/60">
              ({analyzedGame.whitePlayer.rating})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {analyzedGame.termination.winner === 'none' ? (
            <span className="font-medium text-primary/80">½-½</span>
          ) : (
            <span className="font-medium">
              <span className="text-primary/70">
                {analyzedGame.termination.winner === 'white' ? '1' : '0'}
              </span>
              <span className="text-primary/70">-</span>
              <span className="text-primary/70">
                {analyzedGame.termination.winner === 'black' ? '1' : '0'}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full border-[0.5px] bg-black" />
          <span className="font-medium">{analyzedGame.blackPlayer.name}</span>
          {analyzedGame.blackPlayer.rating && (
            <span className="text-primary/60">
              ({analyzedGame.blackPlayer.rating})
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const desktopLayout = (
    <div className="flex h-full w-full flex-col items-center py-4 md:py-10">
      <div className="flex h-full w-[90%] flex-row gap-4">
        <div
          id="navigation"
          className="flex h-[85vh] w-72 min-w-60 max-w-72 flex-col gap-2 overflow-hidden 2xl:min-w-72"
        >
          <GameInfo title="Analysis" icon="bar_chart" type="analysis">
            <NestedGameInfo />
          </GameInfo>
          <div className="flex max-h-[25vh] min-h-[25vh] flex-col bg-backdrop/30">
            <AnalysisGameList
              currentId={currentId}
              loadNewTournamentGame={(newId, setCurrentMove) =>
                getAndSetTournamentGame(newId, setCurrentMove)
              }
              loadNewLichessGames={(id, pgn, setCurrentMove) =>
                getAndSetLichessGame(id, pgn, setCurrentMove)
              }
              loadNewUserGames={(id, type, setCurrentMove) =>
                getAndSetUserGame(id, type, setCurrentMove)
              }
              loadNewCustomGame={(id, setCurrentMove) =>
                getAndSetCustomGame(id, setCurrentMove)
              }
              onCustomAnalysis={() => setShowCustomModal(true)}
              refreshTrigger={refreshTrigger}
            />
          </div>
          <div className="flex h-1/2 w-full flex-1 flex-col gap-2">
            <div className="flex h-full flex-col overflow-y-scroll">
              <MovesContainer
                game={analyzedGame}
                termination={analyzedGame.termination}
                type="analysis"
              />
              <BoardController
                gameTree={controller.gameTree}
                orientation={controller.orientation}
                setOrientation={controller.setOrientation}
                currentNode={controller.currentNode}
                plyCount={controller.plyCount}
                goToNode={controller.goToNode}
                goToNextNode={controller.goToNextNode}
                goToPreviousNode={controller.goToPreviousNode}
                goToRootNode={controller.goToRootNode}
              />
            </div>
          </div>
        </div>
        <div className="flex h-[85vh] w-[45vh] flex-col gap-2 2xl:w-[55vh]">
          <div className="flex w-full flex-col overflow-hidden rounded">
            <PlayerInfo
              name={
                controller.orientation === 'white'
                  ? analyzedGame.blackPlayer.name
                  : analyzedGame.whitePlayer.name
              }
              rating={
                controller.orientation === 'white'
                  ? analyzedGame.blackPlayer.rating
                  : analyzedGame.whitePlayer.rating
              }
              color={controller.orientation === 'white' ? 'black' : 'white'}
              termination={analyzedGame.termination.winner}
            />
            <div className="relative flex aspect-square w-[45vh] 2xl:w-[55vh]">
              <GameBoard
                game={analyzedGame}
                availableMoves={controller.moves}
                setCurrentSquare={setCurrentSquare}
                shapes={hoverArrow ? [...arrows, hoverArrow] : [...arrows]}
                currentNode={controller.currentNode as GameNode}
                orientation={controller.orientation}
                onPlayerMakeMove={onPlayerMakeMove}
                goToNode={controller.goToNode}
                gameTree={analyzedGame.tree}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
            <PlayerInfo
              name={
                controller.orientation === 'white'
                  ? analyzedGame.whitePlayer.name
                  : analyzedGame.blackPlayer.name
              }
              rating={
                controller.orientation === 'white'
                  ? analyzedGame.whitePlayer.rating
                  : analyzedGame.blackPlayer.rating
              }
              color={controller.orientation === 'white' ? 'white' : 'black'}
              termination={analyzedGame.termination.winner}
              showArrowLegend={true}
            />
          </div>
          <ConfigurableScreens
            currentMaiaModel={controller.currentMaiaModel}
            setCurrentMaiaModel={controller.setCurrentMaiaModel}
            launchContinue={launchContinue}
            MAIA_MODELS={MAIA_MODELS}
            game={analyzedGame}
            currentNode={controller.currentNode as GameNode}
            onDeleteCustomGame={handleDeleteCustomGame}
          />
        </div>
        <div
          id="analysis"
          className="flex h-[calc(85vh)] w-full flex-col gap-2 xl:h-[calc(55vh+5rem)]"
        >
          {/* Large screens (xl+): Side by side layout */}
          <div className="hidden xl:flex xl:h-full xl:flex-col xl:gap-2">
            <div className="flex h-[calc((55vh+4.5rem)/2)] gap-2">
              {/* Combined Highlight + MovesByRating container */}
              <div className="flex h-full w-full overflow-hidden rounded border-[0.5px] border-white/40">
                <div className="flex h-full w-auto min-w-[40%] max-w-[40%] border-r-[0.5px] border-white/40">
                  <Highlight
                    hover={hover}
                    makeMove={makeMove}
                    currentMaiaModel={controller.currentMaiaModel}
                    setCurrentMaiaModel={controller.setCurrentMaiaModel}
                    recommendations={controller.moveRecommendations}
                    moveEvaluation={
                      controller.moveEvaluation as {
                        maia?: MaiaEvaluation
                        stockfish?: StockfishEvaluation
                      }
                    }
                    colorSanMapping={controller.colorSanMapping}
                    boardDescription={controller.boardDescription}
                    currentNode={controller.currentNode}
                  />
                </div>
                <div className="flex h-full w-full bg-background-1">
                  <MovesByRating
                    moves={controller.movesByRating}
                    colorSanMapping={controller.colorSanMapping}
                  />
                </div>
              </div>
            </div>
            <div className="flex h-[calc((55vh+4.5rem)/2)] flex-row gap-2">
              <div className="flex h-full w-full flex-col">
                <MoveMap
                  moveMap={controller.moveMap}
                  colorSanMapping={controller.colorSanMapping}
                  setHoverArrow={setHoverArrow}
                  makeMove={makeMove}
                />
              </div>
              <BlunderMeter
                hover={hover}
                makeMove={makeMove}
                data={controller.blunderMeter}
                colorSanMapping={controller.colorSanMapping}
                moveEvaluation={controller.moveEvaluation}
              />
            </div>
          </div>

          {/* Smaller screens (below xl): 3-row stacked layout */}
          <div className="flex h-full flex-col gap-2 xl:hidden">
            {/* Row 1: Combined Highlight + BlunderMeter container */}
            <div className="flex h-[calc((85vh)*0.4)] overflow-hidden rounded border-[0.5px] border-white/40 bg-background-1">
              <div className="flex h-full w-full border-r-[0.5px] border-white/40">
                <Highlight
                  hover={hover}
                  makeMove={makeMove}
                  currentMaiaModel={controller.currentMaiaModel}
                  setCurrentMaiaModel={controller.setCurrentMaiaModel}
                  recommendations={controller.moveRecommendations}
                  moveEvaluation={
                    controller.moveEvaluation as {
                      maia?: MaiaEvaluation
                      stockfish?: StockfishEvaluation
                    }
                  }
                  colorSanMapping={controller.colorSanMapping}
                  boardDescription={controller.boardDescription}
                  currentNode={controller.currentNode}
                />
              </div>
              <div className="flex h-full w-auto min-w-[40%] max-w-[40%] bg-background-1 p-3">
                <div className="h-full w-full">
                  <BlunderMeter
                    hover={hover}
                    makeMove={makeMove}
                    data={controller.blunderMeter}
                    colorSanMapping={controller.colorSanMapping}
                    moveEvaluation={controller.moveEvaluation}
                    showContainer={false}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: MoveMap */}
            <div className="flex h-[calc((85vh)*0.3)] w-full">
              <div className="h-full w-full">
                <MoveMap
                  moveMap={controller.moveMap}
                  colorSanMapping={controller.colorSanMapping}
                  setHoverArrow={setHoverArrow}
                  makeMove={makeMove}
                />
              </div>
            </div>

            {/* Row 3: MovesByRating */}
            <div className="flex h-[calc((85vh)*0.3)] w-full rounded bg-background-1/60">
              <div className="h-full w-full">
                <MovesByRating
                  moves={controller.movesByRating}
                  colorSanMapping={controller.colorSanMapping}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const [showGameListMobile, setShowGameListMobile] = useState(false)

  const mobileLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        {showGameListMobile ? (
          <div className="flex w-full flex-col items-start justify-start gap-1">
            <div className="flex w-full flex-col items-start justify-start overflow-hidden bg-background-1 p-3">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center justify-start gap-1.5">
                  <span className="material-symbols-outlined text-xl">
                    format_list_bulleted
                  </span>
                  <h2 className="text-xl font-semibold">Switch Game</h2>
                </div>
                <button
                  className="flex items-center gap-1 rounded bg-background-2 px-2 py-1 text-sm duration-200 hover:bg-background-3"
                  onClick={() => setShowGameListMobile(false)}
                >
                  <span className="material-symbols-outlined text-sm">
                    arrow_back
                  </span>
                  <span>Back to Analysis</span>
                </button>
              </div>
              <p className="mt-1 text-sm text-secondary">
                Select a game to analyze
              </p>
            </div>
            <div className="flex h-[calc(100vh-10rem)] w-full flex-col overflow-hidden rounded bg-backdrop/30">
              <AnalysisGameList
                currentId={currentId}
                loadNewTournamentGame={(newId, setCurrentMove) =>
                  loadGameAndCloseList(
                    getAndSetTournamentGame(newId, setCurrentMove),
                  )
                }
                loadNewLichessGames={(id, pgn, setCurrentMove) =>
                  loadGameAndCloseList(
                    getAndSetLichessGame(id, pgn, setCurrentMove),
                  )
                }
                loadNewUserGames={(id, type, setCurrentMove) =>
                  loadGameAndCloseList(
                    getAndSetUserGame(id, type, setCurrentMove),
                  )
                }
                loadNewCustomGame={(id, setCurrentMove) =>
                  loadGameAndCloseList(getAndSetCustomGame(id, setCurrentMove))
                }
                onCustomAnalysis={() => {
                  setShowCustomModal(true)
                  setShowGameListMobile(false)
                }}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-start justify-start gap-1">
            <GameInfo
              title="Analysis"
              icon="bar_chart"
              type="analysis"
              currentMaiaModel={controller.currentMaiaModel}
              setCurrentMaiaModel={controller.setCurrentMaiaModel}
              MAIA_MODELS={MAIA_MODELS}
              onGameListClick={() => setShowGameListMobile(true)}
              showGameListButton={true}
            >
              <NestedGameInfo />
            </GameInfo>
            <div id="analysis" className="relative flex h-[100vw] w-screen">
              <GameBoard
                game={analyzedGame}
                availableMoves={controller.moves}
                setCurrentSquare={setCurrentSquare}
                shapes={hoverArrow ? [...arrows, hoverArrow] : [...arrows]}
                currentNode={controller.currentNode as GameNode}
                orientation={controller.orientation}
                onPlayerMakeMove={onPlayerMakeMove}
                goToNode={controller.goToNode}
                gameTree={analyzedGame.tree}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-0">
              <div className="w-full !flex-grow-0">
                <BoardController
                  gameTree={controller.gameTree}
                  orientation={controller.orientation}
                  setOrientation={controller.setOrientation}
                  currentNode={controller.currentNode}
                  plyCount={controller.plyCount}
                  goToNode={controller.goToNode}
                  goToNextNode={controller.goToNextNode}
                  goToPreviousNode={controller.goToPreviousNode}
                  goToRootNode={controller.goToRootNode}
                />
              </div>
              <div className="relative bottom-0 h-48 max-h-48 flex-1 overflow-auto overflow-y-hidden">
                <MovesContainer
                  game={analyzedGame}
                  termination={analyzedGame.termination}
                  type="analysis"
                />
              </div>
            </div>
            <div className="flex w-full flex-col gap-1 overflow-hidden">
              <BlunderMeter
                hover={hover}
                makeMove={makeMove}
                data={controller.blunderMeter}
                colorSanMapping={controller.colorSanMapping}
              />
              <Highlight
                hover={hover}
                makeMove={makeMove}
                currentMaiaModel={controller.currentMaiaModel}
                setCurrentMaiaModel={controller.setCurrentMaiaModel}
                recommendations={controller.moveRecommendations}
                moveEvaluation={
                  controller.moveEvaluation as {
                    maia?: MaiaEvaluation
                    stockfish?: StockfishEvaluation
                  }
                }
                colorSanMapping={controller.colorSanMapping}
                boardDescription={controller.boardDescription}
                currentNode={controller.currentNode}
              />
              <MovesByRating
                moves={controller.movesByRating}
                colorSanMapping={controller.colorSanMapping}
              />
              <MoveMap
                moveMap={controller.moveMap}
                colorSanMapping={controller.colorSanMapping}
                setHoverArrow={setHoverArrow}
                makeMove={makeMove}
              />
            </div>
            <ConfigurableScreens
              currentMaiaModel={controller.currentMaiaModel}
              setCurrentMaiaModel={controller.setCurrentMaiaModel}
              launchContinue={launchContinue}
              MAIA_MODELS={MAIA_MODELS}
              game={analyzedGame}
              onDeleteCustomGame={handleDeleteCustomGame}
              currentNode={controller.currentNode as GameNode}
            />
          </div>
        )}
      </div>
    </>
  )

  // Helper function to load a game and close the game list
  const loadGameAndCloseList = async (loadFunction: Promise<void>) => {
    await loadFunction
    setShowGameListMobile(false)
  }

  return (
    <>
      <Head>
        <title>Maia Chess - Analyze</title>
        <meta
          name="description"
          content="Collection of chess training and analysis tools centered around Maia."
        />
      </Head>
      <AnimatePresence>
        {controller.maiaStatus === 'no-cache' ||
        controller.maiaStatus === 'downloading' ? (
          <DownloadModelModal
            progress={controller.maiaProgress}
            download={controller.downloadMaia}
          />
        ) : null}
      </AnimatePresence>
      <TreeControllerContext.Provider value={controller}>
        {analyzedGame && (isMobile ? mobileLayout : desktopLayout)}
      </TreeControllerContext.Provider>
      <AnimatePresence>
        {showCustomModal && (
          <CustomAnalysisModal
            onSubmit={handleCustomAnalysis}
            onClose={() => setShowCustomModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function AuthenticatedAnalysisPage() {
  return (
    <AuthenticatedWrapper>
      <AnalysisPage />
    </AuthenticatedWrapper>
  )
}

import React, {
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useContext,
  useCallback,
  SetStateAction,
} from 'react'
import Head from 'next/head'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'

import {
  getLichessGamePGN,
  getAnalyzedUserGame,
  getAnalyzedLichessGame,
  getAnalyzedTournamentGame,
} from 'src/api'
import {
  Loading,
  MovePlot,
  GameInfo,
  GameBoard,
  BlunderMeter,
  MovesContainer,
  BoardController,
  AnalysisGameList,
  ContinueAgainstMaia,
  AuthenticatedWrapper,
  VerticalEvaluationBar,
  HorizontalEvaluationBar,
} from 'src/components'
import { Color } from 'src/types'
import { useAnalysisController } from 'src/hooks'
import { AnalyzedGame, MoveMap } from 'src/types/analysis'
import { ThemeContext, ModalContext, WindowSizeContext } from 'src/contexts'
import { GameControllerContext } from 'src/contexts/GameControllerContext/GameControllerContext'

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
  const { openedModals, setInstructionsModalProps: setInstructionsModalProps } =
    useContext(ModalContext)

  useEffect(() => {
    if (!openedModals.analysis) {
      setInstructionsModalProps({ instructionsType: 'analysis' })
    }
    return () => setInstructionsModalProps(undefined)
  }, [setInstructionsModalProps, openedModals.analysis])

  const router = useRouter()
  const { id, index, orientation } = router.query

  const [analyzedGame, setAnalyzedGame] = useState<AnalyzedGame | undefined>(
    undefined,
  )
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
      router.push(`/analysis/${newId.join('/')}`, undefined, { shallow: true })
    },
    [router],
  )

  const getAndSetLichessGames = useCallback(
    async (
      id: string,
      pgn: string,
      setCurrentMove?: Dispatch<SetStateAction<number>>,
      currentMaiaModel = 'maia_kdd_1500',
    ) => {
      let game
      try {
        game = await getAnalyzedLichessGame(id, pgn, currentMaiaModel)
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
      currentMaiaModel = 'maia_kdd_1500',
    ) => {
      let game
      try {
        game = await getAnalyzedUserGame(id, type, currentMaiaModel)
      } catch (e) {
        router.push('/401')
        return
      }
      if (setCurrentMove) setCurrentMove(0)
      setAnalyzedGame({ ...game, type })
      setCurrentId([id, type])
      router.push(`/analysis/${id}/${type}`, undefined, { shallow: true })
    },
    [],
  )

  useEffect(() => {
    ;(async () => {
      if (analyzedGame == undefined) {
        const queryId = id as string[]
        if (queryId[1] === 'licpgnhess') {
          const pgn = await getLichessGamePGN(queryId[0])
          getAndSetLichessGames(queryId[0], pgn, undefined)
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
    getAndSetLichessGames,
    getAndSetUserGame,
  ])

  return (
    <>
      {analyzedGame ? (
        <Analysis
          currentId={currentId}
          analyzedGame={analyzedGame}
          setAnalyzedGame={setAnalyzedGame}
          initialIndex={index ? Number(index) : 0}
          initialOrientation={orientation == 'black' ? 'black' : 'white'}
          getAndSetTournamentGame={getAndSetTournamentGame}
          getAndSetLichessGames={getAndSetLichessGames}
          getAndSetUserGames={getAndSetUserGame}
        />
      ) : (
        <Loading />
      )}
    </>
  )
}

interface Props {
  currentId: string[]
  getAndSetTournamentGame: (
    newId: string[],
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  getAndSetLichessGames: (
    id: string,
    pgn: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
    currentMaiaModel?: string,
  ) => Promise<void>
  getAndSetUserGames: (
    id: string,
    type: 'play' | 'hand' | 'brain',
    setCurrentMove: Dispatch<SetStateAction<number>>,
    currentMaiaModel: string,
  ) => Promise<void>
  analyzedGame: AnalyzedGame
  initialIndex: number
  initialOrientation: Color
  setAnalyzedGame: Dispatch<SetStateAction<AnalyzedGame | undefined>>
}

const Analysis: React.FC<Props> = ({
  currentId,
  analyzedGame,
  initialIndex,
  initialOrientation,
  getAndSetTournamentGame,
  getAndSetLichessGames,
  getAndSetUserGames,
  setAnalyzedGame,
}: Props) => {
  const router = useRouter()
  const { theme } = useContext(ThemeContext)
  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const [movePlotHover, setMovePlotHover] = useState<DrawShape | null>(null)
  const [topArrows, setTopArrows] = useState<DrawShape[]>([])

  const {
    move,
    moves,
    data,
    controller,
    setCurrentMaiaModel,
    currentMaiaModel,
    moveEvaluation,
    setCurrentMove,
    stockfishEvaluations,
    blunderMeter,
  } = useAnalysisController(analyzedGame, initialIndex, initialOrientation)

  useEffect(() => {
    setMovePlotHover(null)
  }, [controller.currentIndex])

  const launchContinue = useCallback(() => {
    const fen = analyzedGame.moves[controller.currentIndex].board
    const url = '/play' + '?fen=' + encodeURIComponent(fen)

    window.open(url)
  }, [analyzedGame.moves, controller])

  const showArrow = (node: { data: { move: string } }) => {
    const move = node.data.move
    const orig = move.slice(0, 2)
    const dest = move.slice(2, 4)
    setMovePlotHover({
      brush: 'green',
      orig: orig as Key,
      dest: dest as Key,
    })
  }

  const updateMaiaModel = async (model: string) => {
    if (analyzedGame.type === 'tournament') {
      setCurrentMaiaModel(model)
    } else {
      if (analyzedGame.maiaEvaluations[model]) {
        setCurrentMaiaModel(model)
        return
      }

      let game
      if (analyzedGame.type === 'pgn') {
        try {
          game = await getAnalyzedLichessGame(
            analyzedGame.id,
            analyzedGame.pgn as string,
            model,
          )
        } catch (e) {
          router.push('/401')
          return
        }
      } else {
        try {
          game = await getAnalyzedUserGame(
            analyzedGame.id,
            analyzedGame.type,
            model,
          )
        } catch (e) {
          router.push('/401')
          return
        }
      }

      const newAnalyzedGame = { ...analyzedGame }
      newAnalyzedGame.maiaEvaluations = {
        ...newAnalyzedGame.maiaEvaluations,
        ...game.maiaEvaluations,
      }

      for (let i = 0; i < analyzedGame.moves.length; i++) {
        const maiaValues = newAnalyzedGame.moves[i].maia_values
        if (maiaValues) {
          const newMaiaValues = game.moves[i].maia_values as {
            [key: string]: number
          }
          maiaValues[model] = newMaiaValues[model]
        }
      }

      setAnalyzedGame(newAnalyzedGame)
      setCurrentMaiaModel(model)
    }
  }

  useEffect(() => {
    let topStockfishMove, topMaiaMove
    const maia =
      analyzedGame.maiaEvaluations[currentMaiaModel][controller.currentIndex]

    if (maia) {
      topMaiaMove = Object.keys(maia).reduce(
        (max, key) => (maia[key] > maia[max] ? key : max),
        Object.keys(maia)[0],
      )
    }

    if (analyzedGame.type === 'tournament') {
      const stockfish = analyzedGame.stockfishEvaluations[
        controller.currentIndex
      ] as MoveMap
      if (stockfish) {
        topStockfishMove = Object.keys(stockfish).reduce(
          (max, key) => (stockfish[key] > stockfish[max] ? key : max),
          Object.keys(stockfish)[0],
        )
      }
    } else {
      const stockfish = stockfishEvaluations[controller.currentIndex]?.cp_vec
      if (stockfish) {
        topStockfishMove = Object.keys(stockfish).reduce(
          (max, key) => (stockfish[key] > stockfish[max] ? key : max),
          Object.keys(stockfish)[0],
        )
      }
    }

    const arrows = []
    if (topStockfishMove && topStockfishMove === topMaiaMove) {
      arrows.push({
        brush: 'yellow',
        orig: topMaiaMove.slice(0, 2) as Key,
        dest: topMaiaMove.slice(2, 4) as Key,
      })
    } else {
      if (topStockfishMove) {
        arrows.push({
          brush: 'blue',
          orig: topStockfishMove.slice(0, 2) as Key,
          dest: topStockfishMove.slice(2, 4) as Key,
        })
      }
      if (topMaiaMove) {
        arrows.push({
          brush: 'red',
          orig: topMaiaMove.slice(0, 2) as Key,
          dest: topMaiaMove.slice(2, 4) as Key,
        })
      }
    }

    setTopArrows(arrows)
  }, [
    controller.currentIndex,
    stockfishEvaluations,
    analyzedGame.maiaEvaluations,
    analyzedGame.stockfishEvaluations,
  ])

  const Info = (
    <>
      <div className="flex w-full items-center justify-between text-secondary">
        <p>
          {theme == 'dark' ? '●' : '○'}{' '}
          {analyzedGame.whitePlayer?.name ?? 'Unknown'}{' '}
          {analyzedGame.whitePlayer?.rating
            ? `(${analyzedGame.whitePlayer.rating})`
            : null}
        </p>
        <p>
          {analyzedGame.termination.winner === 'white' ? (
            <span className="text-engine-3">1</span>
          ) : analyzedGame.termination.winner === 'black' ? (
            <span className="text-human-3">0</span>
          ) : (
            <span>1/2</span>
          )}
        </p>
      </div>
      <div className="flex w-full items-center justify-between text-secondary">
        <p>
          {theme == 'light' ? '●' : '○'}{' '}
          {analyzedGame.blackPlayer?.name ?? 'Unknown'}{' '}
          {analyzedGame.blackPlayer?.rating
            ? `(${analyzedGame.blackPlayer.rating})`
            : null}
        </p>
        <p>
          {analyzedGame.termination.winner === 'black' ? (
            <span className="text-engine-3">1</span>
          ) : analyzedGame.termination.winner === 'white' ? (
            <span className="text-human-3">0</span>
          ) : (
            <span>1/2</span>
          )}
        </p>
      </div>{' '}
      {analyzedGame.termination ? (
        <p className="text-center capitalize text-secondary">
          {analyzedGame.termination.winner !== 'none'
            ? `${analyzedGame.termination.winner} wins`
            : 'draw'}
        </p>
      ) : null}
    </>
  )

  const desktopLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-2">
        <div className="flex w-full flex-row items-center justify-center gap-2">
          <div
            style={{ maxWidth: 'min(20vw, 100vw - 75vh)' }}
            className="flex h-[75vh] max-h-[70vw] w-[40vh] flex-col justify-start gap-2 overflow-hidden"
          >
            <div className="flex w-screen flex-col md:w-auto">
              <GameInfo title="Analysis" icon="bar_chart" type="analysis">
                {Info}
              </GameInfo>
            </div>
            <div className="flex flex-col">
              <p>Analyze using:</p>
              <select
                value={currentMaiaModel}
                className="cursor-pointer rounded border-none bg-human-4 p-2 outline-none"
                onChange={(e) => updateMaiaModel(e.target.value)}
              >
                {MAIA_MODELS.map((model) => (
                  <option value={model} key={model}>
                    {model.replace('maia_kdd_', 'Maia ')}
                  </option>
                ))}
              </select>
            </div>
            <ContinueAgainstMaia launchContinue={launchContinue} />
            <AnalysisGameList
              currentId={currentId}
              currentMaiaModel={currentMaiaModel}
              loadNewTournamentGame={getAndSetTournamentGame}
              loadNewLichessGames={getAndSetLichessGames}
              loadNewUserGames={getAndSetUserGames}
            />
          </div>
          <div className="relative flex aspect-square w-full max-w-[75vh]">
            <GameBoard
              game={analyzedGame}
              moves={moves}
              setCurrentMove={setCurrentMove}
              move={move}
              shapes={
                movePlotHover ? [movePlotHover, ...topArrows] : [...topArrows]
              }
            />
          </div>
          <div>
            <VerticalEvaluationBar
              value={moveEvaluation?.maiaWr}
              label="Maia White Win %"
            />
          </div>
          <div
            style={{
              maxWidth: 'min(20vw, 100vw - 75vh)',
            }}
            className="flex h-[75vh] w-[40vh] flex-col gap-1"
          >
            <div className="flex">
              <div
                style={{
                  maxHeight: 'min(20vw, 100vw - 75vh)',
                  maxWidth: 'min(20vw, 100vw - 75vh)',
                }}
                className="flex h-[40vh] w-[40vh] [&>div]:h-[inherit] [&>div]:max-h-[inherit] [&>div]:max-w-[inherit]"
              >
                <MovePlot
                  data={data}
                  onMove={setCurrentMove}
                  onMouseEnter={showArrow}
                  onMouseLeave={() => setMovePlotHover(null)}
                />
              </div>
              <div
                style={{
                  background:
                    'linear-gradient(0deg, rgb(36, 36, 36) 0%, rgb(255, 137, 70) 100%)',
                }}
                className="-mr-1 h-full w-1"
              />
            </div>
            <div
              style={{
                background:
                  'linear-gradient(90deg, rgb(36, 36, 36) 0%, rgb(83, 167, 162) 100%)',
              }}
              className="-mt-1 h-1 w-full"
            />
            <div className="flex-none">
              <div className="flex w-full flex-col overflow-hidden rounded">
                <div className="flex items-center justify-center bg-background-1 py-2">
                  <p className="text-sm text-secondary">Current Position</p>
                </div>
                <div className="grid grid-cols-2">
                  <div className="relative flex flex-col items-center py-4">
                    <div className="absolute left-0 top-0 z-0 h-full w-full bg-human-2 opacity-5" />
                    <p className="z-10 text-sm text-primary">
                      Maia White Win %
                    </p>
                    <p className="z-10 text-2xl font-bold text-human-2">
                      {moveEvaluation?.maiaWr && moveEvaluation.maiaWr > 0
                        ? `${Math.round(moveEvaluation.maiaWr * 1000) / 10}%`
                        : '-'}
                    </p>
                  </div>
                  <div className="relative flex flex-col items-center py-4">
                    <div className="absolute left-0 top-0 z-0 h-full w-full bg-engine-1 opacity-5" />
                    <p className="text-sm text-primary">
                      SF Eval{' '}
                      {stockfishEvaluations?.[controller.currentIndex]?.depth
                        ? `(Depth ${stockfishEvaluations?.[controller.currentIndex]?.depth})`
                        : ''}
                    </p>
                    <p className="text-2xl font-bold text-engine-2">
                      {moveEvaluation?.stockfish !== undefined &&
                      Number.isNaN(moveEvaluation.stockfish) === false
                        ? `${moveEvaluation.stockfish >= 0 ? '+' : ''}${(Math.round(moveEvaluation.stockfish) / 100).toFixed(2)}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
              <BlunderMeter {...blunderMeter} />
            </div>
            <div className="relative bottom-0 h-full min-h-[38px] flex-1 overflow-auto">
              <MovesContainer
                game={analyzedGame}
                setCurrentMove={setCurrentMove}
                termination={analyzedGame.termination}
                currentMaiaModel={currentMaiaModel}
              />
            </div>
            <div className="flex-none">
              <BoardController setCurrentMove={setCurrentMove} />
            </div>
          </div>
        </div>
        <div className="mr-8 flex items-center justify-center">
          <HorizontalEvaluationBar
            min={0}
            max={800}
            value={moveEvaluation ? 400 + moveEvaluation.stockfish : void 0}
            label="Stockfish Evaluation"
          />
        </div>
      </div>
    </>
  )

  const mobileLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="flex w-full flex-col items-start justify-start gap-1">
          <GameInfo title="Analysis" icon="bar_chart" type="analysis">
            {Info}
          </GameInfo>
          <div className="relative flex h-[100vw] w-screen">
            <GameBoard
              game={analyzedGame}
              moves={moves}
              setCurrentMove={setCurrentMove}
              move={move}
              shapes={
                movePlotHover ? [movePlotHover, ...topArrows] : [...topArrows]
              }
            />
          </div>
          <div className="flex h-auto w-full flex-col gap-1">
            <div className="w-screen !flex-grow-0">
              <BoardController setCurrentMove={setCurrentMove} />
            </div>
            <div className="flex-none">
              <div className="flex w-full flex-col overflow-hidden rounded">
                <div className="flex items-center justify-center bg-background-1 py-2">
                  <p className="text-sm text-secondary">Current Position</p>
                </div>
                <div className="grid grid-cols-2">
                  <div className="relative flex flex-col items-center py-4">
                    <div className="absolute left-0 top-0 z-0 h-full w-full bg-human-2 opacity-5" />
                    <p className="z-10 text-sm text-primary">
                      Maia White Win %
                    </p>
                    <p className="z-10 text-2xl font-bold text-human-2">
                      {moveEvaluation?.maiaWr && moveEvaluation.maiaWr > 0
                        ? `${Math.round(moveEvaluation.maiaWr * 1000) / 10}%`
                        : '-'}
                    </p>
                  </div>
                  <div className="relative flex flex-col items-center py-4">
                    <div className="absolute left-0 top-0 z-0 h-full w-full bg-engine-1 opacity-5" />
                    <p className="text-sm text-primary">Stockfish Eval</p>
                    <p className="text-2xl font-bold text-engine-2">
                      {moveEvaluation?.stockfish !== undefined &&
                      Number.isNaN(moveEvaluation.stockfish) === false
                        ? `${moveEvaluation.stockfish >= 0 ? '+' : ''}${(Math.round(moveEvaluation.stockfish) / 100).toFixed(2)}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
              <BlunderMeter {...blunderMeter} />
            </div>
            <div className="flex">
              <div className="h-[20vh] max-h-[200px] w-screen !flex-none">
                <MovePlot
                  data={data}
                  onMove={setCurrentMove}
                  onMouseEnter={showArrow}
                  onMouseLeave={() => setMovePlotHover(null)}
                />
              </div>
              <div
                style={{
                  background:
                    'linear-gradient(0deg, rgb(36, 36, 36) 0%, rgb(255, 137, 70) 100%)',
                }}
                className="-mt-1 h-full w-1"
              />
            </div>
            <div
              style={{
                background:
                  'linear-gradient(90deg, rgb(36, 36, 36) 0%, rgb(83, 167, 162) 100%)',
              }}
              className="-mt-1 h-1 w-full"
            />
            <div className="relative bottom-0 h-full flex-1 overflow-auto">
              <MovesContainer
                game={analyzedGame}
                setCurrentMove={setCurrentMove}
                termination={analyzedGame.termination}
                currentMaiaModel={currentMaiaModel}
              />
            </div>
            <div>
              <p>Analyze using:</p>
              <select
                className="w-full cursor-pointer rounded border-none bg-human-4 p-2 outline-none"
                value={currentMaiaModel}
                onChange={(e) => updateMaiaModel(e.target.value)}
              >
                {MAIA_MODELS.map((model) => (
                  <option value={model} key={model}>
                    {model.replace('maia_kdd_', 'Maia ')}
                  </option>
                ))}
              </select>
            </div>
            <ContinueAgainstMaia launchContinue={launchContinue} />
            <AnalysisGameList
              currentId={currentId}
              currentMaiaModel={currentMaiaModel}
              loadNewTournamentGame={getAndSetTournamentGame}
              loadNewLichessGames={getAndSetLichessGames}
              loadNewUserGames={getAndSetUserGames}
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>Maia Chess - Analyze</title>
        <meta
          name="description"
          content="Collection of chess training and analysis tools centered around Maia."
        />
      </Head>
      <GameControllerContext.Provider value={{ ...controller }}>
        {analyzedGame && (isMobile ? mobileLayout : desktopLayout)}
      </GameControllerContext.Provider>
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

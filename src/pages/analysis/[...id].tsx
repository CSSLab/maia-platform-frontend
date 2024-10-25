import React, {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  Dispatch,
  SetStateAction,
} from 'react'
import {
  GameInfo,
  Loading,
  MovePlot,
  BoardController,
  AuthenticatedWrapper,
  VerticalEvaluationBar,
  BlunderMeter,
} from 'src/components'
import Head from 'next/head'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'

import {
  getLichessGamePGN,
  getAnalyzedLichessGame,
  getAnalyzedTournamentGame,
} from 'src/api'
import { Color } from 'src/types'
import styles from 'src/styles/App.module.scss'
import { useAnalysisController } from 'src/hooks'
import { AnalyzedGame, MoveMap } from 'src/types/analysis'
import { MovesContainer } from 'src/components/MovesContainer'
import { GameBoard } from 'src/components/GameBoard/GameBoard'
import { ModalContext, WindowSizeContext } from 'src/contexts'
import AnalysisGameList from 'src/components/AnalysisGameList/AnalysisGameList'
import { HorizontalEvaluationBar } from 'src/components/HorizontalEvaluationBar'
import { GameControllerContext } from 'src/contexts/GameControllerContext/GameControllerContext'

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
      setCurrentId([id, 'lichess'])
      router.push(`/analysis/${id}/lichess`, undefined, { shallow: true })
    },
    [router],
  )

  useEffect(() => {
    ;(async () => {
      if (analyzedGame == undefined) {
        const queryId = id as string[]
        if (queryId[1] == 'lichess') {
          const pgn = await getLichessGamePGN(queryId[0])

          getAndSetLichessGames(queryId[0], pgn)
        } else {
          getAndSetTournamentGame(queryId)
        }
      }
    })()
  }, [id, analyzedGame, getAndSetTournamentGame, getAndSetLichessGames])

  return (
    <>
      {analyzedGame ? (
        <Analysis
          analyzedGame={analyzedGame}
          initialIndex={index ? Number(index) : 0}
          initialOrientation={orientation == 'black' ? 'black' : 'white'}
          listController={
            <AnalysisGameList
              currentId={currentId}
              loadNewTournamentGame={getAndSetTournamentGame}
              loadNewLichessGames={getAndSetLichessGames}
            />
          }
        />
      ) : (
        <Loading />
      )}
    </>
  )
}

interface Props {
  analyzedGame: AnalyzedGame
  initialIndex: number
  initialOrientation: Color
  listController: React.ReactNode
}

const Analysis: React.FC<Props> = ({
  analyzedGame,
  initialIndex,
  initialOrientation,
  listController,
}: Props) => {
  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const [movePlotHover, setMovePlotHover] = useState<DrawShape | null>(null)
  const [topArrows, setTopArrows] = useState<DrawShape[]>([])

  const {
    move,
    moves,
    data,
    controller,
    maiaModels,
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

  const desktopLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-2">
        <div className="flex w-full flex-row items-center justify-center gap-2">
          <div
            style={{ maxWidth: 'min(20vw, 100vw - 75vh)' }}
            className="flex h-[75vh] max-h-[70vw] w-[40vh] flex-col justify-start gap-2 overflow-hidden"
          >
            <div className="flex w-screen flex-col md:w-auto">
              <GameInfo
                {...analyzedGame}
                type={analyzedGame.gameType}
                showId={false}
                instructionsType="analysis"
              />
            </div>
            <div className="flex flex-col">
              <p>Analyze using:</p>
              <select
                disabled={maiaModels.length === 1}
                className={`cursor-pointer rounded border-none bg-human-4 p-2 outline-none ${maiaModels.length === 1 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                value={currentMaiaModel}
                onChange={(e) => {
                  setCurrentMaiaModel(e.target.value)
                }}
              >
                {maiaModels.map((model) => (
                  <option value={model} key={model}>
                    {model.replace('maia_kdd_', 'Maia ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-full">
              <button
                onClick={launchContinue}
                className="flex w-full cursor-pointer items-center justify-start rounded bg-human-4 p-2 transition duration-300 hover:bg-human-3"
              >
                Continue Against Maia
              </button>
            </div>
            {listController}
          </div>
          <div className={styles.board}>
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
              label="Maia Probability"
            />
          </div>
          <div className={styles.side}>
            <div className={styles.map}>
              <div className={styles.scatter}>
                <MovePlot
                  data={data}
                  onMove={setCurrentMove}
                  onMouseEnter={showArrow}
                  onMouseLeave={() => setMovePlotHover(null)}
                />
              </div>
              <div className={styles.human}></div>
            </div>
            <div className={styles.ai} />
            <div className={styles.analysis}>
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
            <div className={styles.moves}>
              <MovesContainer
                game={analyzedGame}
                setCurrentMove={setCurrentMove}
                termination={analyzedGame.termination}
              />
            </div>
            <div className={styles.controls}>
              <BoardController setCurrentMove={setCurrentMove} />
            </div>
          </div>
        </div>
        <div className={styles.sf}>
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
        <div className="mt-16 flex w-full flex-col items-start justify-start gap-1">
          <div className="flex h-auto w-full flex-col gap-1">
            <div className="w-screen">
              <GameInfo
                {...analyzedGame}
                type={analyzedGame.gameType}
                showId={true}
                instructionsType="analysis"
              />
            </div>
          </div>
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
            <div className="!h-[50px] w-screen !flex-grow-0">
              <BoardController setCurrentMove={setCurrentMove} />
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
              <div className={styles.human}></div>
            </div>
            <div className={styles.ai} />
            <div className={styles.analysis}>
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
            <div className="relative bottom-0 h-full flex-1 overflow-auto">
              <MovesContainer
                game={analyzedGame}
                setCurrentMove={setCurrentMove}
                termination={analyzedGame.termination}
              />
            </div>
            <div>
              <p>Analyze using:</p>
              <select
                className="w-full cursor-pointer rounded border-none bg-human-4 p-2 outline-none"
                value={currentMaiaModel}
                onChange={(e) => {
                  setCurrentMaiaModel(e.target.value)
                }}
              >
                {maiaModels.map((model) => (
                  <option value={model} key={model}>
                    {model.replace('maia_kdd_', 'Maia ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-full">
              <button
                onClick={launchContinue}
                className="flex w-full cursor-pointer items-center justify-start rounded bg-human-4 p-2 transition duration-300 hover:bg-human-3"
              >
                Continue Against Maia
              </button>
            </div>
            {listController}
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

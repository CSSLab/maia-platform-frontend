import Head from 'next/head'
import { NextPage } from 'next/types'
import { useCallback, useContext, useEffect, useState } from 'react'
import { trackTuringGameStarted } from 'src/lib/analytics'
import {
  WindowSizeContext,
  TuringControllerContext,
  useTour,
} from 'src/contexts'
import {
  Loading,
  GameInfo,
  GameBoard,
  TuringLog,
  StatsDisplay,
  MovesContainer,
  BoardController,
  TuringSubmission,
  ContinueAgainstMaia,
} from 'src/components'
import { AllStats } from 'src/hooks/useStats'
import { TuringGame } from 'src/types/turing'
import { useTuringController } from 'src/hooks/useTuringController/useTuringController'
import { tourConfigs } from 'src/constants/tours'

const TuringPage: NextPage = () => {
  const { startTour, tourState } = useTour()
  const [initialTourCheck, setInitialTourCheck] = useState(false)

  const controller = useTuringController()

  useEffect(() => {
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      // Always attempt to start the tour - the tour context will handle completion checking
      startTour(tourConfigs.turing.id, tourConfigs.turing.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])

  // Track when a Turing game is loaded
  useEffect(() => {
    if (controller.game && controller.stats?.rating) {
      trackTuringGameStarted(controller.game.id, controller.stats.rating)
    }
  }, [controller.game, controller.stats?.rating])

  return (
    <TuringControllerContext.Provider value={controller}>
      {controller.game ? (
        <Turing game={controller.game} stats={controller.stats} />
      ) : (
        <Loading />
      )}
    </TuringControllerContext.Provider>
  )
}

interface Props {
  game: TuringGame
  stats: AllStats
}

const Turing: React.FC<Props> = (props: Props) => {
  const { game, stats } = props

  const { isMobile } = useContext(WindowSizeContext)

  const controller = useContext(TuringControllerContext)

  const launchContinue = useCallback(() => {
    const fen = controller.currentNode?.fen

    if (fen) {
      const url = '/play' + '?fen=' + encodeURIComponent(fen)
      window.open(url)
    }
  }, [controller])

  const Info = (
    <>
      <div className="flex w-full items-center justify-between text-secondary">
        <div className="flex items-center gap-2">
          <span>● Unknown</span>
          <span>
            {game.termination.winner === 'white' ? (
              <span className="text-engine-3">1</span>
            ) : game.termination.winner === 'black' ? (
              <span className="text-human-3">0</span>
            ) : (
              <span className="text-secondary">½</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>○ Unknown</span>
          <span>
            {game.termination.winner === 'black' ? (
              <span className="text-engine-3">1</span>
            ) : game.termination.winner === 'white' ? (
              <span className="text-human-3">0</span>
            ) : (
              <span className="text-secondary">½</span>
            )}
          </span>
        </div>
      </div>
      {game.termination && (
        <div className="text-center text-secondary">
          <span className="capitalize">
            {game.termination.winner !== 'none'
              ? `${game.termination.winner} wins`
              : 'draw'}
          </span>
        </div>
      )}
    </>
  )

  const desktopLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1 py-10">
        <div className="mx-auto mt-2 flex w-[90%] flex-row items-center justify-between gap-4">
          <div className="flex h-[75vh] min-w-64 flex-grow flex-col justify-between">
            <div className="flex w-full flex-col gap-2">
              <GameInfo title="Bot or Not" icon="smart_toy" type="turing">
                {Info}
              </GameInfo>
              <ContinueAgainstMaia
                launchContinue={launchContinue}
                sourcePage="openings"
                currentFen={controller.currentNode?.fen || ''}
              />
              <div className="relative bottom-0 flex h-full min-h-[38px] flex-1 flex-col justify-end overflow-auto">
                <TuringLog />
              </div>
            </div>
            <StatsDisplay stats={stats} />
          </div>
          <div
            id="turing-page"
            className="relative flex aspect-square w-full max-w-[75vh] flex-shrink-0"
          >
            <GameBoard game={game} currentNode={controller.currentNode} />
          </div>
          <div className="flex h-[75vh] min-w-64 flex-grow flex-col gap-1">
            <div className="relative bottom-0 h-full min-h-[38px] flex-1">
              <MovesContainer
                game={game}
                termination={game.termination}
                type="turing"
              />
            </div>
            <div id="turing-submission">
              <TuringSubmission rating={stats.rating ?? 0} />
            </div>
            <div className="flex-none">
              <BoardController
                orientation={controller.orientation}
                setOrientation={controller.setOrientation}
                currentNode={controller.currentNode}
                plyCount={controller.plyCount}
                goToNode={controller.goToNode}
                goToNextNode={controller.goToNextNode}
                goToPreviousNode={controller.goToPreviousNode}
                goToRootNode={controller.goToRootNode}
                gameTree={controller.gameTree}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  const mobileLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="mt-2 flex h-full flex-col items-start justify-start">
          <div className="flex h-auto w-full flex-col gap-2">
            <div className="w-screen">
              <GameInfo title="Bot or Not" icon="smart_toy" type="turing">
                {Info}
              </GameInfo>
            </div>
          </div>
          <div
            id="turing-page"
            className="relative flex aspect-square h-[100vw] w-screen"
          >
            <GameBoard game={game} currentNode={controller.currentNode} />
          </div>
          <div className="flex h-auto w-full flex-col gap-1">
            <div className="relative bottom-0 h-full flex-1 overflow-auto">
              <MovesContainer
                game={game}
                termination={game.termination}
                type="turing"
              />
            </div>
            <div className="flex-none">
              <BoardController
                orientation={controller.orientation}
                setOrientation={controller.setOrientation}
                currentNode={controller.currentNode}
                plyCount={controller.plyCount}
                goToNode={controller.goToNode}
                goToNextNode={controller.goToNextNode}
                goToPreviousNode={controller.goToPreviousNode}
                goToRootNode={controller.goToRootNode}
                gameTree={controller.gameTree}
              />
            </div>
            <div id="turing-submission" className="w-screen">
              <TuringSubmission rating={stats.rating ?? 0} />
            </div>
            <div className="flex w-full">
              <ContinueAgainstMaia
                launchContinue={launchContinue}
                sourcePage="openings"
                currentFen={controller.currentNode?.fen || ''}
              />
            </div>
          </div>
        </div>
        <StatsDisplay stats={stats} />
        <div className="relative bottom-0 flex h-full min-h-[38px] flex-1 flex-col justify-end overflow-auto">
          <TuringLog />
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>Bot or Not – Maia Chess</title>
        <meta
          name="description"
          content="Test your ability to distinguish between human and AI chess play. This Turing Test for chess is a fun way to see if you understand the differences between human and engine moves."
        />
      </Head>
      <TuringControllerContext.Provider value={controller}>
        {isMobile ? mobileLayout : desktopLayout}
      </TuringControllerContext.Provider>
    </>
  )
}

export default TuringPage

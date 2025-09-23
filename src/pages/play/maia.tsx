import Head from 'next/head'
import { startGame } from 'src/api'
import { NextPage } from 'next/types'
import { useRouter } from 'next/router'
import { tourConfigs } from 'src/constants/tours'
import { ModalContext, useTour } from 'src/contexts'
import { Loading, PlayControls } from 'src/components'
import { Color, TimeControl, PlayGameConfig } from 'src/types'
import { useContext, useEffect, useMemo, useState } from 'react'
import { GameplayInterface } from 'src/components/Board/GameplayInterface'
import { useVsMaiaPlayController } from 'src/hooks/usePlayController/useVsMaiaController'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'

interface Props {
  id: string
  playGameConfig: PlayGameConfig
  playAgain: () => void
  simulateMaiaTime: boolean
  setSimulateMaiaTime: (value: boolean) => void
}

const PlayMaia: React.FC<Props> = ({
  id,
  playGameConfig,
  playAgain,
  simulateMaiaTime,
  setSimulateMaiaTime,
}: Props) => {
  const controller = useVsMaiaPlayController(
    id,
    playGameConfig,
    simulateMaiaTime,
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!controller.playerActive || controller.game.termination) return

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          break
        case 'ArrowLeft':
          event.preventDefault()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controller.playerActive, controller.game.termination])

  return (
    <PlayControllerContext.Provider value={controller}>
      <GameplayInterface>
        <div id="play-controls">
          <PlayControls
            game={controller.game}
            playerActive={controller.playerActive}
            gameOver={!!controller.game.termination}
            resign={() => {
              controller.updateClock()
              controller.setResigned(true)
            }}
            playAgain={playAgain}
            simulateMaiaTime={simulateMaiaTime}
            setSimulateMaiaTime={setSimulateMaiaTime}
            embedded
          />
        </div>
      </GameplayInterface>
    </PlayControllerContext.Provider>
  )
}

const PlayMaiaPage: NextPage = () => {
  const { startTour, tourState } = useTour()
  const [initialTourCheck, setInitialTourCheck] = useState(false)

  useEffect(() => {
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      startTour(tourConfigs.play.id, tourConfigs.play.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])

  const router = useRouter()

  const { setPlaySetupModalProps } = useContext(ModalContext)

  const {
    id,
    player,
    maiaVersion,
    timeControl,
    isBrain,
    sampleMoves,
    simulateMaiaTime: simulateMaiaTimeQuery,
    startFen,
  } = router.query

  const [simulateMaiaTime, setSimulateMaiaTime] = useState<boolean>(
    simulateMaiaTimeQuery === 'true' || simulateMaiaTimeQuery === undefined
      ? true
      : false,
  )

  const playGameConfig: PlayGameConfig = useMemo(
    () => ({
      playType: 'againstMaia',
      player: (player || 'white') as Color,
      maiaVersion: (maiaVersion || 'maia_kdd_1100') as string,
      timeControl: (timeControl || 'unlimited') as TimeControl,
      isBrain: isBrain == 'true',
      sampleMoves: sampleMoves == 'true',
      simulateMaiaTime: simulateMaiaTime,
      startFen: typeof startFen == 'string' ? startFen : undefined,
    }),
    [
      startFen,
      isBrain,
      maiaVersion,
      player,
      sampleMoves,
      timeControl,
      simulateMaiaTime,
    ],
  )

  useEffect(() => {
    if (!initialTourCheck) {
      setInitialTourCheck(true)
      startTour(tourConfigs.play.id, tourConfigs.play.steps, false)
    }
  }, [initialTourCheck, startTour])

  useEffect(() => {
    let canceled = false

    async function fetchGameId() {
      let response
      try {
        response = await startGame(
          playGameConfig.player,
          playGameConfig.maiaVersion,
          'play',
          playGameConfig.sampleMoves,
          playGameConfig.timeControl,
          undefined,
        )
      } catch (e) {
        router.push('/401')
        return
      }
      const newGameId = response.gameId

      if (!canceled) {
        router.replace(
          {
            pathname: '/play/maia',
            query: {
              id: newGameId,
              ...playGameConfig,
            },
          },
          {
            pathname: '/play/maia',
            query: {
              // We don't show the game ID in the address bar
              // so that if the page is manually refreshed
              // the old game ID is not persisted
              ...playGameConfig,
            },
          },
        )
      }
    }

    if (!id) {
      fetchGameId()

      return () => {
        canceled = true
      }
    }
  }, [id, playGameConfig, router])

  return (
    <>
      <Head>
        <title>Play vs Maia – Maia Chess</title>
        <meta
          name="description"
          content="Challenge the most human-like chess AI. Unlike traditional engines that play robotically, Maia naturally plays moves a person would make, trained on millions of human games with real chess intuition."
        />
      </Head>
      <Loading isLoading={!router.isReady || !id}>
        {router.isReady && id && (
          <PlayMaia
            id={id as string}
            playGameConfig={playGameConfig}
            playAgain={() => setPlaySetupModalProps({ ...playGameConfig })}
            simulateMaiaTime={simulateMaiaTime}
            setSimulateMaiaTime={setSimulateMaiaTime}
          />
        )}
      </Loading>
    </>
  )
}

export default PlayMaiaPage

import Head from 'next/head'
import { NextPage } from 'next/types'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { startGame } from 'src/api'
import { Loading } from 'src/components/Common'
import { GameplayInterface } from 'src/components/Board'
import { HandBrainPlayControls } from 'src/components/Play'
import { ModalContext, useTour } from 'src/contexts'
import { Color, PlayGameConfig, TimeControl } from 'src/types'
import { useHandBrainController } from 'src/hooks/usePlayController/useHandBrainController'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'
import { tourConfigs } from 'src/constants/tours'

interface Props {
  id: string
  playGameConfig: PlayGameConfig
  playAgain: () => void
  simulateMaiaTime: boolean
  setSimulateMaiaTime: (value: boolean) => void
}

const PlayHandBrain: React.FC<Props> = ({
  id,
  playGameConfig,
  playAgain,
  simulateMaiaTime,
  setSimulateMaiaTime,
}: Props) => {
  const controller = useHandBrainController(
    id,
    playGameConfig,
    simulateMaiaTime,
  )

  return (
    <PlayControllerContext.Provider value={controller}>
      <GameplayInterface boardShapes={controller.boardShapes}>
        <HandBrainPlayControls
          game={controller.game}
          playerActive={controller.playerActive}
          gameOver={!!controller.game.termination}
          isBrain={playGameConfig.isBrain}
          color={playGameConfig.player}
          movablePieceTypes={Array.from(controller.movablePieceTypes)}
          selectedPiece={controller.selectedPiece}
          selectPiece={controller.selectPiece}
          resign={() => controller.setResigned(true)}
          playAgain={playAgain}
          simulateMaiaTime={simulateMaiaTime}
          setSimulateMaiaTime={setSimulateMaiaTime}
        />
      </GameplayInterface>
    </PlayControllerContext.Provider>
  )
}

const PlayHandBrainPage: NextPage = () => {
  const { startTour, tourState } = useTour()
  const [initialTourCheck, setInitialTourCheck] = useState(false)

  useEffect(() => {
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      // Always attempt to start the tour - the tour context will handle completion checking
      startTour(tourConfigs.handBrain.id, tourConfigs.handBrain.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])

  const router = useRouter()

  const { setPlaySetupModalProps } = useContext(ModalContext)

  const {
    id,
    player,
    maiaVersion,
    maiaPartnerVersion,
    timeControl,
    isBrain,
    sampleMoves,
    simulateMaiaTime: simulateMaiaTimeQuery,
    startFen,
  } = router.query

  // simulateMaiaTime can be configured in setup modal, default to true if not specified
  const [simulateMaiaTime, setSimulateMaiaTime] = useState<boolean>(
    simulateMaiaTimeQuery === 'true' || simulateMaiaTimeQuery === undefined
      ? true
      : false,
  )

  const playGameConfig: PlayGameConfig = useMemo(
    () => ({
      playType: 'handAndBrain',
      player: (player || 'white') as Color,
      maiaPartnerVersion: (maiaPartnerVersion || 'maia_kdd_1100') as string,
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
      maiaPartnerVersion,
      player,
      sampleMoves,
      timeControl,
      simulateMaiaTime,
    ],
  )

  const playAgain = useCallback(() => {
    setPlaySetupModalProps({ playType: 'handAndBrain' })
  }, [setPlaySetupModalProps])

  useEffect(() => {
    let canceled = false

    async function fetchGameId() {
      let response
      try {
        response = await startGame(
          playGameConfig.player,
          playGameConfig.maiaVersion,
          playGameConfig.isBrain ? 'brain' : 'hand',
          playGameConfig.sampleMoves,
          playGameConfig.timeControl,
          playGameConfig.maiaPartnerVersion,
        )
      } catch (e) {
        router.push('/401')
        return
      }
      const newGameId = response.gameId

      if (!canceled) {
        router.replace(
          {
            pathname: '/play/hb',
            query: {
              id: newGameId,
              ...playGameConfig,
            },
          },
          {
            pathname: '/play/hb',
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
        <title>Hand & Brain Chess – Maia Chess</title>
        <meta
          name="description"
          content="Team up with Maia in this collaborative chess variant. You can be the 'Hand' making moves while Maia is the 'Brain' selecting pieces, or vice versa."
        />
      </Head>
      <Loading isLoading={!router.isReady || !id}>
        {router.isReady && id && (
          <PlayHandBrain
            id={id as string}
            playGameConfig={playGameConfig}
            playAgain={playAgain}
            simulateMaiaTime={simulateMaiaTime}
            setSimulateMaiaTime={setSimulateMaiaTime}
          />
        )}
      </Loading>
    </>
  )
}

export default PlayHandBrainPage

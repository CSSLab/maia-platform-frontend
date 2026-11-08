import Head from 'next/head'
import { NextPage } from 'next/types'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { MoveRequestError, startGameWithRetry } from 'src/api/play'
import { trackGameStartFailed } from 'src/lib/analytics'
import { Loading } from 'src/components/Common'
import { GameplayInterface } from 'src/components/Board'
import { HandBrainPlayControls } from 'src/components/Play'
import { ModalContext, useTour } from 'src/contexts'
import { Color, PlayGameConfig, TimeControl } from 'src/types'
import toast from 'react-hot-toast'
import { normalizeTimeControl } from 'src/lib/timeControl'
import { checkStartPosition } from 'src/lib/startPosition'
import { noteOpponentChoice } from 'src/lib/opponentChoice'
import { useHandBrainController } from 'src/hooks/usePlayController/useHandBrainController'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'
import { tourConfigs } from 'src/constants/tours'

interface Props {
  id: string
  playGameConfig: PlayGameConfig
  playAgain: () => void
  changeSettings: () => void
  simulateMaiaTime: boolean
  setSimulateMaiaTime: (value: boolean) => void
}

const PlayHandBrain: React.FC<Props> = ({
  id,
  playGameConfig,
  playAgain,
  changeSettings,
  simulateMaiaTime,
  setSimulateMaiaTime,
}: Props) => {
  const controller = useHandBrainController(
    id,
    playGameConfig,
    simulateMaiaTime,
  )

  return (
    <PlayControllerContext.Provider key={id} value={controller}>
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
          changeSettings={changeSettings}
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

  // A position from the address is checked as the setup dialog checks one.
  const startFenCheck = useMemo(
    () =>
      typeof startFen === 'string' && startFen.trim()
        ? checkStartPosition(startFen)
        : undefined,
    [startFen],
  )

  const playGameConfig: PlayGameConfig = useMemo(
    () => ({
      playType: 'handAndBrain',
      player: (player || 'white') as Color,
      maiaPartnerVersion: (maiaPartnerVersion || 'maia_kdd_1100') as string,
      maiaVersion: (maiaVersion || 'maia_kdd_1100') as string,
      timeControl: normalizeTimeControl(
        typeof timeControl === 'string' ? timeControl : undefined,
      ),
      isBrain: isBrain == 'true',
      sampleMoves: sampleMoves == 'true',
      simulateMaiaTime: simulateMaiaTime,
      startFen: startFenCheck?.ok ? startFenCheck.fen : undefined,
    }),
    [
      startFenCheck,
      isBrain,
      maiaVersion,
      maiaPartnerVersion,
      player,
      sampleMoves,
      timeControl,
      simulateMaiaTime,
    ],
  )

  // The next game's setup, from this game's settings (partner, opponent,
  // role, time control), as against Maia.
  const changeSettings = useCallback(() => {
    setPlaySetupModalProps({ ...playGameConfig })
  }, [setPlaySetupModalProps, playGameConfig])

  // A rematch: the same settings, at once. Without an id, the page starts a
  // new game.
  const playAgain = useCallback(() => {
    noteOpponentChoice(playGameConfig.maiaVersion, 'rematch')
    router.push({ pathname: '/play/hb', query: { ...playGameConfig } })
  }, [router, playGameConfig])

  useEffect(() => {
    // The game's settings come from the URL's query, which Next fills in
    // after the first render. Starting before then also started a game, with
    // the default settings, that was then abandoned.
    if (!router.isReady) return
    if (startFenCheck && !startFenCheck.ok) {
      // No game: the setup dialog again, showing what's wrong.
      toast.error(startFenCheck.error)
      setPlaySetupModalProps({
        ...playGameConfig,
        startFen: typeof startFen === 'string' ? startFen : undefined,
      })
      return
    }

    let canceled = false

    async function fetchGameId() {
      let response
      try {
        response = await startGameWithRetry(
          playGameConfig.player,
          playGameConfig.maiaVersion,
          playGameConfig.isBrain ? 'brain' : 'hand',
          playGameConfig.sampleMoves,
          playGameConfig.timeControl,
          playGameConfig.maiaPartnerVersion,
        )
      } catch (e) {
        console.error(e)
        trackGameStartFailed(
          playGameConfig.isBrain ? 'brain' : 'hand',
          e,
          e instanceof MoveRequestError ? e.status : undefined,
        )
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
  }, [
    id,
    playGameConfig,
    router,
    setPlaySetupModalProps,
    startFen,
    startFenCheck,
  ])

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
            changeSettings={changeSettings}
            simulateMaiaTime={simulateMaiaTime}
            setSimulateMaiaTime={setSimulateMaiaTime}
          />
        )}
      </Loading>
    </>
  )
}

export default PlayHandBrainPage

import Head from 'next/head'
import { NextPage } from 'next/types'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { MoveRequestError, startGameWithRetry } from 'src/api/play'
import { trackGameStartFailed } from 'src/lib/analytics'
// From 'src/components' itself, not its folders: GameplayInterface takes the
// components it renders from there, and in development that file must start
// loading before 'src/components/Board' does, or it is left without the
// board components that come after GameplayInterface (MovesContainer,
// BoardController) and the page fails to render.
import {
  Loading,
  GameplayInterface,
  HandBrainPlayControls,
  StartGameConfirmModal,
} from 'src/components'
import { ModalContext, useTour } from 'src/contexts'
import { Color, PlayGameConfig, TimeControl } from 'src/types'
import toast from 'react-hot-toast'
import { normalizeTimeControl } from 'src/lib/timeControl'
import { checkStartPosition } from 'src/lib/startPosition'
import { useHandBrainController } from 'src/hooks/usePlayController/useHandBrainController'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'
import { tourConfigs } from 'src/constants/tours'
import { createServerGame, fetchServerGame } from 'src/api/serverGames'
import {
  ServerGame,
  serverGameConfig,
  serverGamePage,
  serverGameStart,
} from 'src/lib/serverGames'
import { useServerGames } from 'src/hooks/useServerGames'
import { useStartConfirmation } from 'src/hooks/useStartConfirmation'
import { UnfinishedGame } from 'src/lib/unfinishedGame'

interface Props {
  id: string
  playGameConfig: PlayGameConfig
  playAgain: () => void
  simulateMaiaTime: boolean
  setSimulateMaiaTime: (value: boolean) => void
  // A game the server holds (src/lib/serverGames.ts): the moves to show at
  // once, and its state.
  resume?: UnfinishedGame
  serverGame?: ServerGame
  onServerResync?: (game: ServerGame) => void
}

const PlayHandBrain: React.FC<Props> = ({
  id,
  playGameConfig,
  playAgain,
  simulateMaiaTime,
  setSimulateMaiaTime,
  resume,
  serverGame,
  onServerResync,
}: Props) => {
  const controller = useHandBrainController(
    id,
    playGameConfig,
    simulateMaiaTime,
    resume,
    serverGame,
    onServerResync,
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
          resign={controller.resign}
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

  // Start the next game's setup from this game's settings (partner,
  // opponent, role, time control), as "Play again" does against Maia.
  const playAgain = useCallback(() => {
    setPlaySetupModalProps({ ...playGameConfig })
  }, [setPlaySetupModalProps, playGameConfig])

  // The game as the server holds it, when it does: started here, or the
  // player's game in progress, picked up again. Each new state from the
  // server redraws the board from it.
  // undefined until the account request has said (see useServerGames).
  const serverHeld = useServerGames()
  // Opened by a link, a bookmark or a refresh: start_game resigns the game in
  // progress, so the visitor is asked before a new game is started.
  const { mustConfirm, confirm } = useStartConfirmation()
  const [askingToStart, setAskingToStart] = useState(false)
  const [serverGame, setServerGame] = useState<ServerGame>()
  const [resumeGame, setResumeGame] = useState<UnfinishedGame>()
  const [serverGameVersion, setServerGameVersion] = useState(0)

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

    // No game is started until it is known who runs this player's games.
    if (serverHeld === undefined) return

    let canceled = false

    const takeServerGame = (game: ServerGame) => {
      const config = serverGameConfig(game, playGameConfig)
      setResumeGame(serverGameStart(game, config))
      setServerGame(game)
      return config
    }

    // The address has a game the server holds but this page doesn't have its
    // state (back or forward in the browser): ask for it.
    if (serverHeld && typeof id === 'string' && serverGame?.game_id !== id) {
      fetchServerGame(id)
        .then((game) => {
          if (!canceled) takeServerGame(game)
        })
        .catch(() => router.replace('/play'))
      return () => {
        canceled = true
      }
    }

    // A game the server holds is created there. If the player already has a
    // game in progress the server answers with that one, which is picked up
    // where it was (on the play page, if it is a game against Maia alone).
    async function startServerGame() {
      let created
      try {
        created = await createServerGame({
          gameType: playGameConfig.isBrain ? 'brain' : 'hand',
          playerColor: playGameConfig.player,
          maiaVersion: playGameConfig.maiaVersion,
          maiaPartnerVersion: playGameConfig.maiaPartnerVersion,
          timeControl: playGameConfig.timeControl,
          sampleMoves: playGameConfig.sampleMoves,
          startFen: playGameConfig.startFen,
          instant: !simulateMaiaTime,
        })
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
      if (canceled) return
      const { game, inProgress } = created
      if (inProgress) toast('Continuing your game in progress')
      if (game.ended_while_away) {
        toast('Your last game ran out of time while you were away', {
          duration: 8000,
        })
      }
      if (game.game_type === 'play') {
        router.replace(serverGamePage(game))
        return
      }
      const config = takeServerGame(game)
      router.replace(
        { pathname: '/play/hb', query: { id: game.game_id, ...config } },
        { pathname: '/play/hb', query: { ...config } },
      )
    }

    if (!id && serverHeld) {
      setServerGame(undefined)
      setResumeGame(undefined)
      startServerGame()
      return () => {
        canceled = true
      }
    }

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
      if (mustConfirm) {
        setAskingToStart(true)
        return
      }
      fetchGameId()

      return () => {
        canceled = true
      }
    }
  }, [
    id,
    mustConfirm,
    playGameConfig,
    router,
    setPlaySetupModalProps,
    startFen,
    startFenCheck,
    serverHeld,
  ])

  // A game the server holds is shown once its state is here.
  const ready =
    router.isReady &&
    !!id &&
    (serverHeld === false ||
      (serverGame !== undefined && serverGame.game_id === id))

  return (
    <>
      <Head>
        <title>Hand & Brain Chess – Maia Chess</title>
        <meta
          name="description"
          content="Team up with Maia in this collaborative chess variant. You can be the 'Hand' making moves while Maia is the 'Brain' selecting pieces, or vice versa."
        />
      </Head>
      <Loading isLoading={!ready}>
        {ready && (
          <PlayHandBrain
            key={`${id}-${serverGameVersion}`}
            id={id as string}
            playGameConfig={playGameConfig}
            playAgain={playAgain}
            simulateMaiaTime={simulateMaiaTime}
            setSimulateMaiaTime={setSimulateMaiaTime}
            resume={serverHeld ? resumeGame : undefined}
            serverGame={serverHeld ? serverGame : undefined}
            onServerResync={(game) => {
              const config = serverGameConfig(game, playGameConfig)
              setResumeGame(serverGameStart(game, config))
              setServerGame(game)
              setServerGameVersion((version) => version + 1)
            }}
          />
        )}
      </Loading>
      <StartGameConfirmModal
        isOpen={askingToStart}
        onStart={() => {
          setAskingToStart(false)
          confirm()
        }}
        onCancel={() => router.push('/play')}
      />
    </>
  )
}

export default PlayHandBrainPage

import Head from 'next/head'
import {
  MoveRequestError,
  startGameWithRetry,
  takeEarlyGame,
} from 'src/api/play'
import { trackGameStartFailed } from 'src/lib/analytics'
import { NextPage } from 'next/types'
import { useRouter } from 'next/router'
import { tourConfigs } from 'src/constants/tours'
import { ModalContext, useTour } from 'src/contexts'
import { Loading, PlayControls } from 'src/components'
import { Color, TimeControl, PlayGameConfig } from 'src/types'
import toast from 'react-hot-toast'
import { normalizeTimeControl } from 'src/lib/timeControl'
import { checkStartPosition } from 'src/lib/startPosition'
import {
  UnfinishedGame,
  loadUnfinishedGame,
  sameGameSettings,
} from 'src/lib/unfinishedGame'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { GameplayInterface } from 'src/components/Board/GameplayInterface'
import { createServerGame, fetchServerGame } from 'src/api/serverGames'
import {
  ServerGame,
  serverGameConfig,
  serverGamePage,
  serverGameStart,
  usesServerGame,
} from 'src/lib/serverGames'
import { useVsMaiaPlayController } from 'src/hooks/usePlayController/useVsMaiaController'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'

// What "More time" adds to the player's clock in a practice game.
const PRACTICE_EXTRA_TIME_MS = 15_000

interface Props {
  id: string
  playGameConfig: PlayGameConfig
  playAgain: () => void
  returnToPath?: string
  returnToLabel?: string
  challengeId?: string
  simulateMaiaTime: boolean
  setSimulateMaiaTime: (value: boolean) => void
  resume?: UnfinishedGame
  // The game as the server holds it, when it does (src/lib/serverGames.ts).
  serverGame?: ServerGame
  onServerResync?: (game: ServerGame) => void
}

const PlayMaia: React.FC<Props> = ({
  id,
  playGameConfig,
  playAgain,
  returnToPath,
  returnToLabel,
  challengeId,
  simulateMaiaTime,
  setSimulateMaiaTime,
  resume,
  serverGame,
  onServerResync,
}: Props) => {
  const router = useRouter()
  const controller = useVsMaiaPlayController(
    id,
    playGameConfig,
    simulateMaiaTime,
    resume,
    serverGame,
    onServerResync,
  )
  const returnTo = useMemo(() => {
    if (!returnToPath) return undefined

    return () => {
      const completedChallenge =
        returnToPath.startsWith('/candidates') &&
        challengeId &&
        controller.game.termination?.winner === playGameConfig.player
          ? challengeId
          : undefined

      if (returnToPath.startsWith('/candidates')) {
        router.push({
          pathname: '/candidates',
          query: completedChallenge ? { completedChallenge } : undefined,
        })
        return
      }

      router.push(returnToPath)
    }
  }, [
    challengeId,
    controller.game.termination?.winner,
    playGameConfig.player,
    returnToPath,
    router,
  ])

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
            resign={controller.resign}
            playAgain={playAgain}
            returnTo={returnTo}
            returnToLabel={returnToLabel}
            simulateMaiaTime={simulateMaiaTime}
            setSimulateMaiaTime={setSimulateMaiaTime}
            practice={controller.practice}
            takeBack={controller.canTakeBack ? controller.takeBack : undefined}
            addTime={
              controller.canAddTime
                ? () => controller.addTime(PRACTICE_EXTRA_TIME_MS)
                : undefined
            }
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
    practice,
    returnTo,
    challengeId,
    forcedColor,
    modalTitle,
    modalSubtitle,
  } = router.query

  const [simulateMaiaTime, setSimulateMaiaTime] = useState<boolean>(
    simulateMaiaTimeQuery === 'true' || simulateMaiaTimeQuery === undefined
      ? true
      : false,
  )
  const returnToLabel = useMemo(() => {
    if (typeof returnTo !== 'string') return undefined
    if (returnTo.startsWith('/candidates')) return 'Back to Candidates'
    return 'Back to Previous Page'
  }, [returnTo])

  // A position from the address (a link, or one edited by hand) is checked
  // as the setup dialog checks one: the game can't start from an impossible
  // position, such as a board with no black king.
  const startFenCheck = useMemo(
    () =>
      typeof startFen === 'string' && startFen.trim()
        ? checkStartPosition(startFen)
        : undefined,
    [startFen],
  )

  const playGameConfig: PlayGameConfig = useMemo(
    () => ({
      playType: 'againstMaia',
      player: (player || 'white') as Color,
      maiaVersion: (maiaVersion || 'maia_kdd_1100') as string,
      timeControl: normalizeTimeControl(
        typeof timeControl === 'string' ? timeControl : undefined,
      ),
      isBrain: isBrain == 'true',
      sampleMoves: sampleMoves == 'true',
      simulateMaiaTime: simulateMaiaTime,
      startFen: startFenCheck?.ok ? startFenCheck.fen : undefined,
      practice: practice === 'true',
    }),
    [
      startFenCheck,
      practice,
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

  // The game is shown from the moment it is asked for, its board at the
  // starting position, and takes moves once start_game has answered with its
  // id. A new game (Play again) starts with a new PlayMaia.
  const [gameKey, setGameKey] = useState(0)
  const hadGame = useRef(false)

  // A game with these settings left unfinished in this browser (closed tab,
  // refresh, or Continue in the setup dialog) is continued rather than a new
  // one started, which would resign it. Decided each time a game is needed;
  // the board is drawn again with its moves (PlayMaia's key).
  const [resumeGame, setResumeGame] = useState<UnfinishedGame>()
  // The game as the server holds it, in a game it holds: started here, or
  // the player's game in progress, picked up again (a refresh, another
  // device). Each new state from the server redraws the board from it.
  const [serverGame, setServerGame] = useState<ServerGame>()
  const [serverGameVersion, setServerGameVersion] = useState(0)
  const serverHeld = usesServerGame(playGameConfig)

  useEffect(() => {
    // The game's settings come from the URL's query, which Next fills in
    // after the first render. Starting before then also started a game, with
    // the default settings, that was then abandoned.
    if (!router.isReady) return
    if (startFenCheck && !startFenCheck.ok) {
      // Back to the setup dialog, which shows what's wrong with the position.
      toast.error(startFenCheck.error)
      const query = Object.fromEntries(
        Object.entries({
          fen: startFen,
          maiaVersion: playGameConfig.maiaVersion,
          timeControl: playGameConfig.timeControl,
          returnTo,
          challengeId,
          forcedColor,
          modalTitle,
          modalSubtitle,
        }).filter(([, value]) => value),
      )
      router.replace({ pathname: '/play', query })
      return
    }
    if (id) {
      hadGame.current = true
      // The address has a game the server holds but this page doesn't have
      // its state (back or forward in the browser): ask for it.
      if (serverHeld && typeof id === 'string' && serverGame?.game_id !== id) {
        let stale = false
        fetchServerGame(id)
          .then((game) => {
            if (stale) return
            const config = serverGameConfig(game, playGameConfig)
            setResumeGame(serverGameStart(game, config))
            setServerGame(game)
          })
          .catch(() => router.replace('/play'))
        return () => {
          stale = true
        }
      }
      return
    }
    if (hadGame.current) setGameKey((key) => key + 1)

    let canceled = false

    const showGame = (
      gameId: string,
      config: PlayGameConfig = playGameConfig,
    ) =>
      router.replace(
        {
          pathname: '/play/maia',
          query: {
            id: gameId,
            ...config,
            returnTo,
            challengeId,
            forcedColor,
            modalTitle,
            modalSubtitle,
          },
        },
        {
          pathname: '/play/maia',
          query: {
            // We don't show the game ID in the address bar
            // so that if the page is manually refreshed
            // the old game ID is not persisted
            ...config,
            returnTo,
            challengeId,
            forcedColor,
            modalTitle,
            modalSubtitle,
          },
        },
      )

    async function fetchGameId() {
      let response
      try {
        const start = () =>
          startGameWithRetry(
            playGameConfig.player,
            playGameConfig.maiaVersion,
            'play',
            playGameConfig.sampleMoves,
            playGameConfig.timeControl,
            undefined,
          )
        // The game the setup dialog started as the visitor chose, if it was
        // this one (src/api/play.ts); if that failed, one more try here.
        const early = takeEarlyGame(
          playGameConfig.player,
          playGameConfig.maiaVersion,
          playGameConfig.sampleMoves,
          playGameConfig.timeControl,
        )
        response = await (early ? early.catch(start) : start())
      } catch (e) {
        console.error(e)
        trackGameStartFailed(
          'play',
          e,
          e instanceof MoveRequestError ? e.status : undefined,
        )
        router.push('/401')
        return
      }
      const newGameId = response.gameId

      if (!canceled) showGame(newGameId)
    }

    // A game the server holds: it is created there, with Maia's first move
    // if Maia moves first. If the player already has a game in progress the
    // server answers with that one, which is picked up where it was.
    async function startServerGame() {
      let created
      try {
        created = await createServerGame({
          playerColor: playGameConfig.player,
          maiaVersion: playGameConfig.maiaVersion,
          timeControl: playGameConfig.timeControl,
          sampleMoves: playGameConfig.sampleMoves,
          startFen: playGameConfig.startFen,
          practice: !!playGameConfig.practice,
          instant: !simulateMaiaTime,
        })
      } catch (e) {
        console.error(e)
        trackGameStartFailed(
          'play',
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
      // A hand or brain game in progress is picked up on its own page.
      if (game.game_type !== 'play') {
        router.replace(serverGamePage(game))
        return
      }
      const config = serverGameConfig(game, playGameConfig)
      setResumeGame(serverGameStart(game, config))
      setServerGame(game)
      showGame(game.game_id, config)
    }

    if (!id && serverHeld) {
      setServerGame(undefined)
      setResumeGame(undefined)
      startServerGame()

      return () => {
        canceled = true
      }
    }

    if (!id) {
      const unfinished = loadUnfinishedGame()
      if (unfinished && sameGameSettings(unfinished.config, playGameConfig)) {
        setResumeGame(unfinished)
        showGame(unfinished.id)
        return
      }
      setResumeGame(undefined)
      fetchGameId()

      return () => {
        canceled = true
      }
    }
  }, [
    challengeId,
    forcedColor,
    id,
    modalSubtitle,
    modalTitle,
    playGameConfig,
    returnTo,
    router,
    startFen,
    startFenCheck,
    serverHeld,
  ])

  return (
    <>
      <Head>
        <title>Play vs Maia – Maia Chess</title>
        <meta
          name="description"
          content="Challenge the most human-like chess AI. Unlike traditional engines that play robotically, Maia naturally plays moves a person would make, trained on millions of human games with real chess intuition."
        />
      </Head>
      {/* The game appears at once, without Loading's fade-in. */}
      {router.isReady ? (
        <PlayMaia
          // Drawn afresh when the server's game is attached (its id reaches
          // the address a moment after its state arrives): the controller
          // must have the game from its first render, to play Maia's first
          // move when Maia moves first.
          key={`${gameKey}-${resumeGame?.id ?? ''}-${serverGameVersion}-${
            serverHeld && serverGame?.game_id === id ? 'held' : ''
          }`}
          // A game the server holds takes no moves until its state is here.
          id={
            typeof id === 'string' &&
            (!serverHeld || serverGame?.game_id === id)
              ? id
              : ''
          }
          playGameConfig={playGameConfig}
          resume={resumeGame}
          serverGame={
            serverHeld && serverGame?.game_id === id ? serverGame : undefined
          }
          onServerResync={(game) => {
            const config = serverGameConfig(game, playGameConfig)
            setResumeGame(serverGameStart(game, config))
            setServerGame(game)
            setServerGameVersion((version) => version + 1)
          }}
          playAgain={() =>
            setPlaySetupModalProps({
              ...playGameConfig,
              returnTo: typeof returnTo === 'string' ? returnTo : undefined,
              challengeId:
                typeof challengeId === 'string' ? challengeId : undefined,
              forcedPlayerColor:
                forcedColor === 'white' || forcedColor === 'black'
                  ? forcedColor
                  : undefined,
              modalTitle:
                typeof modalTitle === 'string' ? modalTitle : undefined,
              modalSubtitle:
                typeof modalSubtitle === 'string' ? modalSubtitle : undefined,
            })
          }
          returnToPath={typeof returnTo === 'string' ? returnTo : undefined}
          returnToLabel={returnToLabel}
          challengeId={
            typeof challengeId === 'string' ? challengeId : undefined
          }
          simulateMaiaTime={simulateMaiaTime}
          setSimulateMaiaTime={setSimulateMaiaTime}
        />
      ) : (
        <Loading isLoading />
      )}
    </>
  )
}

export default PlayMaiaPage

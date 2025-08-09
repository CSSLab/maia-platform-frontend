import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Chess } from 'chess.ts'
import { GameTree } from 'src/types/base/tree'
import { AvailableMoves } from 'src/types/training'
import {
  Broadcast,
  BroadcastRound,
  BroadcastGame,
  BroadcastRoundData,
  BroadcastState,
  BroadcastStreamController,
  BroadcastSection,
  LiveGame,
} from 'src/types'
import {
  getLichessBroadcasts,
  getLichessBroadcastById,
  getLichessTopBroadcasts,
  convertTopBroadcastToBroadcast,
  getBroadcastRoundPGN,
  streamBroadcastRound,
  parsePGNData,
} from 'src/api/lichess/broadcasts'

export const useBroadcastController = (): BroadcastStreamController => {
  const [broadcastSections, setBroadcastSections] = useState<
    BroadcastSection[]
  >([])
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(
    null,
  )
  const [currentRound, setCurrentRound] = useState<BroadcastRound | null>(null)
  const [currentGame, setCurrentGame] = useState<BroadcastGame | null>(null)
  const [roundData, setRoundData] = useState<BroadcastRoundData | null>(null)
  const [broadcastState, setBroadcastState] = useState<BroadcastState>({
    isConnected: false,
    isConnecting: false,
    isLive: false,
    error: null,
    roundStarted: false,
    roundEnded: false,
    gameEnded: false,
  })

  const abortController = useRef<AbortController | null>(null)
  const currentRoundId = useRef<string | null>(null)
  const gameStates = useRef<Map<string, LiveGame>>(new Map())
  const lastPGNData = useRef<string>('')
  const currentGameRef = useRef<BroadcastGame | null>(null)

  // Keep ref in sync with state
  useEffect(() => {
    currentGameRef.current = currentGame
  }, [currentGame])

  const loadBroadcasts = useCallback(async () => {
    try {
      setBroadcastState((prev) => ({
        ...prev,
        isConnecting: true,
        error: null,
      }))

      // Load both official and top broadcasts concurrently
      const [officialBroadcasts, topBroadcasts] = await Promise.all([
        getLichessBroadcasts(),
        getLichessTopBroadcasts(),
      ])

      // Organize broadcasts into sections
      const sections: BroadcastSection[] = []

      // 1. Official active broadcasts (Lichess official live tournaments)
      const officialActive = officialBroadcasts.filter((b) =>
        b.rounds.some((r) => r.ongoing),
      )
      if (officialActive.length > 0) {
        sections.push({
          title: 'Official Live Tournaments',
          broadcasts: officialActive,
          type: 'official-active',
        })
      }

      // 2. Official upcoming broadcasts (Lichess official upcoming tournaments) - max 4
      const officialUpcoming = officialBroadcasts
        .filter(
          (b) =>
            b.rounds.every((r) => !r.ongoing) &&
            b.rounds.some((r) => r.startsAt > Date.now()),
        )
        .slice(0, 4) // Limit to 4
      if (officialUpcoming.length > 0) {
        sections.push({
          title: 'Upcoming Official Tournaments',
          broadcasts: officialUpcoming,
          type: 'official-upcoming',
        })
      }

      // 3. Community live broadcasts (all live community broadcasts)
      const unofficialActive = topBroadcasts.active
        .map(convertTopBroadcastToBroadcast)
        .filter(
          (b) =>
            !officialActive.some((official) => official.tour.id === b.tour.id),
        )
      if (unofficialActive.length > 0) {
        sections.push({
          title: 'Community Live Broadcasts',
          broadcasts: unofficialActive,
          type: 'unofficial-active',
        })
      }

      // 4. Community upcoming broadcasts - max 5
      const unofficialUpcoming = topBroadcasts.upcoming
        .map(convertTopBroadcastToBroadcast)
        .slice(0, 5) // Limit to 5
      if (unofficialUpcoming.length > 0) {
        sections.push({
          title: 'Upcoming Community Broadcasts',
          broadcasts: unofficialUpcoming,
          type: 'unofficial-upcoming',
        })
      }

      // 5. Past tournaments (separate section) - max 8
      const officialPast = officialBroadcasts.filter(
        (b) =>
          b.rounds.every((r) => !r.ongoing) &&
          b.rounds.every((r) => r.startsAt <= Date.now()),
      )
      const pastBroadcasts = [
        ...officialPast,
        ...topBroadcasts.past.currentPageResults.map(
          convertTopBroadcastToBroadcast,
        ),
      ].slice(0, 8) // Limit to 8
      if (pastBroadcasts.length > 0) {
        sections.push({
          title: 'Past Tournaments',
          broadcasts: pastBroadcasts,
          type: 'past',
        })
      }

      setBroadcastSections(sections)
      console.log(
        'Loaded broadcasts:',
        sections.map((s) => ({
          title: s.title,
          broadcasts: s.broadcasts.map((b) => ({
            name: b.tour.name,
            rounds: b.rounds.length,
            roundNames: b.rounds.map((r) => r.name),
          })),
        })),
      )
      setBroadcastState((prev) => ({ ...prev, isConnecting: false }))
    } catch (error) {
      console.error('Error loading broadcasts:', error)
      setBroadcastState((prev) => ({
        ...prev,
        isConnecting: false,
        error:
          error instanceof Error ? error.message : 'Failed to load broadcasts',
      }))
    }
  }, [])

  const selectBroadcast = useCallback(
    async (broadcastId: string) => {
      console.log('Selecting broadcast:', broadcastId)

      // Always fetch complete broadcast data directly from API to ensure we get ALL rounds
      // The /api/broadcast endpoint often only returns currently ongoing rounds
      let broadcast: Broadcast | undefined
      try {
        console.log('Fetching complete broadcast data from API...')
        const fetchedBroadcast = await getLichessBroadcastById(broadcastId)
        if (fetchedBroadcast) {
          broadcast = fetchedBroadcast
          console.log('✓ Got complete broadcast data with all rounds')
        }
      } catch (error) {
        console.error('Failed to get broadcast by ID:', error)
      }

      // Fallback: use data from sections if API call failed
      if (!broadcast) {
        console.log('API call failed, falling back to section data...')
        for (const section of broadcastSections) {
          broadcast = section.broadcasts.find((b) => b.tour.id === broadcastId)
          if (broadcast) {
            console.log('⚠ Found in sections but may have incomplete rounds')
            break
          }
        }
      }

      if (broadcast) {
        console.log(
          'Selected broadcast:',
          broadcast.tour.name,
          'with',
          broadcast.rounds.length,
          'rounds:',
          broadcast.rounds.map((r) => r.name),
        )
        setCurrentBroadcast(broadcast)
        // Auto-select default round if available
        const defaultRound =
          broadcast.rounds.find((r) => r.id === broadcast.defaultRoundId) ||
          broadcast.rounds.find((r) => r.ongoing) ||
          broadcast.rounds[0]
        if (defaultRound) {
          setCurrentRound(defaultRound)
        }
      } else {
        console.error('Broadcast not found:', broadcastId)
      }
    },
    [broadcastSections],
  )

  const selectRound = useCallback(
    (roundId: string) => {
      if (currentBroadcast) {
        const round = currentBroadcast.rounds.find((r) => r.id === roundId)
        if (round) {
          console.log('Selecting round:', round.name, `(${roundId})`)

          // Stop current stream if different round
          if (currentRoundId.current !== roundId) {
            console.log('Switching to different round, stopping current stream')
            // Stop the current stream
            if (abortController.current) {
              abortController.current.abort()
              abortController.current = null
            }
            setBroadcastState((prev) => ({
              ...prev,
              isConnected: false,
              isLive: false,
            }))
            currentRoundId.current = null
            gameStates.current.clear()
            lastPGNData.current = ''

            // Clear current game selection when switching rounds
            setCurrentGame(null)
            // Clear round data so games list shows loading state
            setRoundData(null)
          }

          setCurrentRound(round)
          // The useEffect will automatically start streaming the new round
        }
      }
    },
    [currentBroadcast],
  )

  const selectGame = useCallback(
    (gameId: string) => {
      if (roundData) {
        const game = roundData.games.get(gameId)
        if (game) {
          console.log(
            'Manual game selection:',
            game.white + ' vs ' + game.black,
          )
          setCurrentGame(game)
        }
      }
    },
    [roundData],
  )

  const stopRoundStream = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort()
      abortController.current = null
    }

    setBroadcastState({
      isConnected: false,
      isConnecting: false,
      isLive: false,
      error: null,
      roundStarted: false,
      roundEnded: false,
      gameEnded: false,
    })

    currentRoundId.current = null
    setCurrentGame(null)
    gameStates.current.clear()
    lastPGNData.current = ''
  }, [])

  const createLiveGameFromBroadcastGame = useCallback(
    (broadcastGame: BroadcastGame): LiveGame => {
      const startingFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      // Check if we have an existing game state to build upon
      const existingLiveGame = gameStates.current.get(broadcastGame.id)

      let tree: GameTree
      let movesList: any[]
      let existingMoveCount = 0

      if (existingLiveGame && existingLiveGame.tree) {
        // Reuse existing tree and states - preserve all analysis and variations
        tree = existingLiveGame.tree
        movesList = [...existingLiveGame.moves]
        existingMoveCount = movesList.length - 1 // Subtract 1 for initial position
        console.log(
          `Reusing existing tree with ${existingMoveCount} moves, adding ${broadcastGame.moves.length - existingMoveCount} new moves`,
        )
      } else {
        // Create new tree only for new games
        tree = new GameTree(startingFen)
        movesList = [
          {
            board: startingFen,
            lastMove: undefined as [string, string] | undefined,
            san: undefined as string | undefined,
            check: false,
            maia_values: {},
          },
        ]
        console.log(
          `Creating new tree for ${broadcastGame.white} vs ${broadcastGame.black}`,
        )
      }

      // Only process new moves that we don't already have
      if (broadcastGame.moves.length > existingMoveCount) {
        const chess = new Chess(startingFen)
        let currentNode = tree.getRoot()

        // Replay existing moves to get to the current position
        for (let i = 0; i < existingMoveCount; i++) {
          try {
            const move = chess.move(broadcastGame.moves[i])
            if (move && currentNode.mainChild) {
              currentNode = currentNode.mainChild
            }
          } catch (error) {
            console.warn(
              `Error replaying existing move ${broadcastGame.moves[i]}:`,
              error,
            )
            break
          }
        }

        // Add only the new moves
        for (let i = existingMoveCount; i < broadcastGame.moves.length; i++) {
          try {
            const moveStr = broadcastGame.moves[i]
            const move = chess.move(moveStr)
            if (move) {
              const newFen = chess.fen()
              const uci =
                move.from + move.to + (move.promotion ? move.promotion : '')

              movesList.push({
                board: newFen,
                lastMove: [move.from, move.to],
                san: move.san,
                check: chess.inCheck(),
                maia_values: {},
              })

              currentNode = tree.addMainMove(currentNode, newFen, uci, move.san)
              console.log(`Added new move: ${move.san}`)
            }
          } catch (error) {
            console.warn(
              `Error processing new move ${broadcastGame.moves[i]}:`,
              error,
            )
            break
          }
        }
      }

      // Preserve existing availableMoves array (legacy) and extend if needed
      const availableMoves =
        existingLiveGame?.availableMoves || new Array(movesList.length).fill({})

      // Extend availableMoves array if we have new moves
      while (availableMoves.length < movesList.length) {
        availableMoves.push({})
      }

      return {
        id: broadcastGame.id,
        blackPlayer: {
          name: broadcastGame.black,
          rating: broadcastGame.blackElo,
        },
        whitePlayer: {
          name: broadcastGame.white,
          rating: broadcastGame.whiteElo,
        },
        gameType: 'broadcast',
        type: 'stream' as const,
        moves: movesList,
        availableMoves: availableMoves as AvailableMoves[],
        termination:
          broadcastGame.result === '*'
            ? undefined
            : {
                result: broadcastGame.result,
                winner:
                  broadcastGame.result === '1-0'
                    ? 'white'
                    : broadcastGame.result === '0-1'
                      ? 'black'
                      : 'none',
              },
        maiaEvaluations: existingLiveGame?.maiaEvaluations || [],
        stockfishEvaluations: existingLiveGame?.stockfishEvaluations || [],
        loadedFen: broadcastGame.fen,
        loaded: true,
        tree,
      } as LiveGame
    },
    [],
  )

  const handlePGNUpdate = useCallback(
    (pgnData: string) => {
      // Skip if it's the same data we already processed
      if (pgnData === lastPGNData.current) {
        return
      }

      lastPGNData.current = pgnData

      const parseResult = parsePGNData(pgnData)

      if (parseResult.errors.length > 0) {
        console.warn('PGN parsing errors:', parseResult.errors)
      }

      if (parseResult.games.length === 0) {
        return
      }

      // Store the current game ID to preserve selection
      const currentGameId = currentGameRef.current?.id
      console.log(
        'handlePGNUpdate - currentGameId:',
        currentGameId,
        'currentGame:',
        currentGameRef.current?.white + ' vs ' + currentGameRef.current?.black,
      )

      let allGamesAfterUpdate: BroadcastGame[] = []

      setRoundData((prevRoundData) => {
        // Start with existing games
        const existingGames =
          prevRoundData?.games || new Map<string, BroadcastGame>()
        const updatedGames = new Map(existingGames)

        // Process new/updated games
        for (const game of parseResult.games) {
          updatedGames.set(game.id, game)

          // Update game states
          const existingGameState = gameStates.current.get(game.id)
          const newLiveGame = createLiveGameFromBroadcastGame(game)

          // Play sound for new moves only if this is the currently selected game
          if (
            currentGameId &&
            game.id === currentGameId &&
            existingGameState &&
            newLiveGame.moves.length > existingGameState.moves.length
          ) {
            try {
              const audio = new Audio('/assets/sound/move.mp3')
              audio
                .play()
                .catch((e) => console.log('Could not play move sound:', e))
            } catch (e) {}
          }

          gameStates.current.set(game.id, newLiveGame)
        }

        // Store all games for auto-selection logic
        allGamesAfterUpdate = Array.from(updatedGames.values())

        const newRoundData: BroadcastRoundData = {
          roundId: currentRoundId.current || '',
          broadcastId: currentBroadcast?.tour.id || '',
          games: updatedGames,
          lastUpdate: Date.now(),
        }
        return newRoundData
      })

      // Preserve game selection - only update current game if it was already selected
      if (currentGameId) {
        console.log(
          'Current game selected:',
          currentGameRef.current?.white +
            ' vs ' +
            currentGameRef.current?.black,
        )
        const updatedCurrentGame = parseResult.games.find(
          (g) => g.id === currentGameId,
        )
        if (updatedCurrentGame) {
          console.log('Updating current game with new data')
          // Update the currently selected game with new data (including clocks)
          setCurrentGame(updatedCurrentGame)
        } else {
          console.log(
            'Current game not in update - keeping selection unchanged',
          )
          // Keep the current game selection even if it's not in this update
          // This prevents auto-switching to the first game
        }
      } else if (!currentGameRef.current && allGamesAfterUpdate.length > 0) {
        // Auto-select first game only if no game is currently selected at all
        console.log('No game selected - auto-selecting first game')
        console.log(
          'Auto-selecting:',
          allGamesAfterUpdate[0].white + ' vs ' + allGamesAfterUpdate[0].black,
        )
        setCurrentGame(allGamesAfterUpdate[0])
      } else {
        console.log(
          'No action taken - currentGameId:',
          currentGameId,
          'currentGame exists:',
          !!currentGameRef.current,
          'allGamesAfterUpdate.length:',
          allGamesAfterUpdate.length,
        )
      }

      // Update broadcast state
      setBroadcastState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        isLive: true,
        roundStarted: true,
        error: null,
      }))
    },
    [currentBroadcast, createLiveGameFromBroadcastGame],
  )

  const handleStreamComplete = useCallback(() => {
    setBroadcastState((prev) => ({
      ...prev,
      isConnected: false,
      isLive: false,
      roundEnded: true,
      gameEnded: true,
    }))
  }, [])

  const startRoundStream = useCallback(
    async (roundId: string) => {
      if (abortController.current) {
        abortController.current.abort()
      }

      abortController.current = new AbortController()
      currentRoundId.current = roundId

      setBroadcastState((prev) => ({
        ...prev,
        isConnecting: true,
        error: null,
      }))

      // Set up a timeout to handle rounds with no data (future rounds)
      const timeoutId = setTimeout(() => {
        console.log(
          'Stream timeout - no data received, likely future/empty round',
        )
        if (abortController.current && currentRoundId.current === roundId) {
          // Set empty round data instead of staying in connecting state
          setRoundData({
            roundId: roundId,
            broadcastId: currentBroadcast?.tour.id || '',
            games: new Map(),
            lastUpdate: Date.now(),
          })

          setBroadcastState({
            isConnected: true,
            isConnecting: false,
            isLive: false,
            error: null,
            roundStarted: true,
            roundEnded: false,
            gameEnded: false,
          })
        }
      }, 5000) // 5 second timeout

      try {
        // Start streaming - this will send all games initially, then updates
        await streamBroadcastRound(
          roundId,
          (pgnData) => {
            // Clear timeout if we receive data
            clearTimeout(timeoutId)
            handlePGNUpdate(pgnData)
          },
          () => {
            clearTimeout(timeoutId)
            handleStreamComplete()
          },
          abortController.current.signal,
        )
      } catch (error) {
        clearTimeout(timeoutId)
        console.error('Round stream error:', error)

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown streaming error'

        setBroadcastState({
          isConnected: false,
          isConnecting: false,
          isLive: false,
          error: errorMessage,
          roundStarted: false,
          roundEnded: false,
          gameEnded: false,
        })

        abortController.current = null
      }
    },
    [handlePGNUpdate, handleStreamComplete, currentBroadcast],
  )

  const reconnect = useCallback(() => {
    if (currentRoundId.current) {
      startRoundStream(currentRoundId.current)
    }
  }, [startRoundStream])

  // Auto-start stream when any round is selected
  useEffect(() => {
    if (
      currentRound &&
      !broadcastState.isConnecting &&
      !broadcastState.isConnected
    ) {
      console.log(
        'Starting stream for selected round:',
        currentRound.name,
        currentRound.ongoing ? '(Live)' : '(Past/Future)',
      )
      startRoundStream(currentRound.id)
    }
  }, [
    currentRound,
    broadcastState.isConnecting,
    broadcastState.isConnected,
    startRoundStream,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRoundStream()
    }
  }, [stopRoundStream])

  // Get current live game state for the selected game
  const currentLiveGame = useMemo(() => {
    if (currentGame && gameStates.current.has(currentGame.id)) {
      return gameStates.current.get(currentGame.id) || null
    }
    return null
  }, [currentGame, roundData?.lastUpdate])

  return {
    broadcastSections,
    currentBroadcast,
    currentRound,
    currentGame,
    roundData,
    broadcastState,
    loadBroadcasts,
    selectBroadcast,
    selectRound,
    selectGame,
    startRoundStream,
    stopRoundStream,
    reconnect,
    currentLiveGame,
  } as BroadcastStreamController & { currentLiveGame: LiveGame | null }
}

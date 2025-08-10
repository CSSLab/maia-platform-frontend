import React, { useEffect, useState, useMemo, useRef } from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { AnimatePresence } from 'framer-motion'

import { DelayedLoading } from 'src/components'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { DownloadModelModal } from 'src/components/Common/DownloadModelModal'
import { useBroadcastController } from 'src/hooks/useBroadcastController'
import { useAnalysisController } from 'src/hooks'
import { TreeControllerContext } from 'src/contexts'
import { BroadcastAnalysis } from 'src/components/Analysis/BroadcastAnalysis'
import {
  AnalyzedGame,
  Broadcast,
  BroadcastStreamController,
  LiveGame,
} from 'src/types'
import { GameTree } from 'src/types/base/tree'

const BroadcastAnalysisPage: NextPage = () => {
  const router = useRouter()
  const { broadcastId, roundId } = router.query as {
    broadcastId: string
    roundId: string
  }

  const broadcastController = useBroadcastController()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeBroadcast = async () => {
      if (!broadcastId || !roundId) return

      try {
        setLoading(true)
        setError(null)

        // Load broadcasts if not already loaded
        if (broadcastController.broadcastSections.length === 0) {
          await broadcastController.loadBroadcasts()
        }

        // Find and select the broadcast across all sections
        let broadcast: Broadcast | undefined
        for (const section of broadcastController.broadcastSections) {
          broadcast = section.broadcasts.find((b) => b.tour.id === broadcastId)
          if (broadcast) break
        }

        if (!broadcast) {
          // throw new Error('Broadcast not found')
          return
        }

        // Find the round
        const round = broadcast.rounds.find(
          (r: { id: string }) => r.id === roundId,
        )
        if (!round) {
          throw new Error('Round not found')
        }

        // Select broadcast and round
        await broadcastController.selectBroadcast(broadcastId)
        broadcastController.selectRound(roundId)

        setLoading(false)
      } catch (err) {
        console.error('Error initializing broadcast:', err)
        setError(
          err instanceof Error ? err.message : 'Failed to load broadcast',
        )
        setLoading(false)
      }
    }

    initializeBroadcast()
  }, [broadcastId, roundId, broadcastController.broadcastSections.length])

  // Create a dummy game for analysis controller when no game is selected
  const dummyGame: AnalyzedGame = useMemo(() => {
    const startingFen =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const dummyTree = new GameTree(startingFen)

    return {
      id: '',
      blackPlayer: { name: 'Black' },
      whitePlayer: { name: 'White' },
      moves: [
        {
          board: startingFen,
          lastMove: undefined,
          san: undefined,
          check: false,
          maia_values: {},
        },
      ],
      availableMoves: [{}],
      gameType: 'broadcast',
      termination: { result: '*', winner: undefined },
      maiaEvaluations: [{}],
      stockfishEvaluations: [undefined],
      tree: dummyTree,
      type: 'stream' as const,
    }
  }, [])

  const currentGame = (broadcastController as any).currentLiveGame || dummyGame
  const analysisController = useAnalysisController(
    currentGame,
    undefined,
    false,
  )

  // Auto-follow live moves for the selected game
  const lastGameMoveCount = useRef(0)

  useEffect(() => {
    const currentLiveGame = (broadcastController as any).currentLiveGame
    if (
      currentLiveGame?.tree &&
      analysisController &&
      analysisController.currentNode
    ) {
      try {
        const mainLine = currentLiveGame.tree.getMainLine()
        const currentMoveCount = mainLine.length

        // If new moves have been added to the game
        if (currentMoveCount > lastGameMoveCount.current) {
          console.log(
            `New move detected: ${lastGameMoveCount.current} -> ${currentMoveCount}`,
          )

          // Find the last node in the main line
          const lastNode = mainLine[mainLine.length - 1]

          // Only auto-follow if user is currently at the previous last node (or close to it)
          const isAtLatestPosition =
            lastNode.parent === analysisController.currentNode ||
            lastNode === analysisController.currentNode

          if (isAtLatestPosition) {
            console.log('Auto-following to new move')
            analysisController.setCurrentNode(lastNode)
          }

          lastGameMoveCount.current = currentMoveCount
        }
      } catch (error) {
        console.error('Error in auto-follow logic:', error)
      }
    }
  }, [(broadcastController as any).currentLiveGame, analysisController])

  // When we select a new game, set the current node to the last move
  useEffect(() => {
    const currentLiveGame = (broadcastController as any).currentLiveGame
    if (currentLiveGame?.loaded) {
      const mainLine = currentLiveGame.tree.getMainLine()
      if (mainLine.length > 0) {
        analysisController.setCurrentNode(mainLine[mainLine.length - 1])
        // Update the move count tracker for the new game
        lastGameMoveCount.current = mainLine.length
      } else {
        // Reset move count for games with no moves
        lastGameMoveCount.current = 0
      }
    }
  }, [broadcastController.currentGame?.id])

  const pageTitle = useMemo(() => {
    if (
      broadcastController.currentBroadcast &&
      broadcastController.currentRound
    ) {
      return `${broadcastController.currentBroadcast.tour.name} • ${broadcastController.currentRound.name} – Maia Chess`
    }
    return 'Live Broadcast – Maia Chess'
  }, [broadcastController.currentBroadcast, broadcastController.currentRound])

  const pageDescription = useMemo(() => {
    if (broadcastController.currentBroadcast) {
      return `Watch ${broadcastController.currentBroadcast.tour.name} live with real-time Maia AI analysis.`
    }
    return 'Watch live chess broadcasts with real-time Maia AI analysis.'
  }, [broadcastController.currentBroadcast])

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Broadcast – Maia Chess</title>
        </Head>
        <DelayedLoading isLoading={true}>
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold">Loading Broadcast</h2>
              <p className="text-secondary">Connecting to live tournament...</p>
            </div>
          </div>
        </DelayedLoading>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Broadcast Error – Maia Chess</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center bg-background-1">
          <div className="text-center">
            <h2 className="mb-4 text-xl font-semibold text-red-400">
              Error Loading Broadcast
            </h2>
            <p className="mb-4 text-secondary">{error}</p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => router.push('/broadcast')}
                className="rounded bg-background-3 px-4 py-2 text-primary transition hover:bg-background-3/80"
              >
                Back to Broadcasts
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded bg-human-4 px-4 py-2 text-white transition hover:bg-human-4/80"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </Head>

      <AnimatePresence>
        {analysisController &&
        (analysisController.maia.status === 'no-cache' ||
          analysisController.maia.status === 'downloading') ? (
          <DownloadModelModal
            progress={analysisController.maia.progress}
            download={analysisController.maia.downloadModel}
          />
        ) : null}
      </AnimatePresence>

      <TreeControllerContext.Provider value={analysisController}>
        {!(broadcastController as any).currentLiveGame?.loaded &&
        broadcastController.currentGame &&
        !broadcastController.broadcastState.roundEnded ? (
          <div className="absolute left-0 top-0 z-50">
            <DelayedLoading transparent isLoading={true}>
              <p>Loading game...</p>
            </DelayedLoading>
          </div>
        ) : null}
        {analysisController && (
          <BroadcastAnalysis
            game={currentGame}
            broadcastController={
              broadcastController as BroadcastStreamController & {
                currentLiveGame: LiveGame | null
              }
            }
            analysisController={analysisController}
          />
        )}
      </TreeControllerContext.Provider>
    </>
  )
}

export default function AuthenticatedBroadcastAnalysisPage() {
  return (
    <AuthenticatedWrapper>
      <BroadcastAnalysisPage />
    </AuthenticatedWrapper>
  )
}

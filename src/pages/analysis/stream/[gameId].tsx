import React, { useEffect, useState, useMemo, useRef } from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { AnimatePresence } from 'framer-motion'

import { Loading } from 'src/components'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { DownloadModelModal } from 'src/components/Common/DownloadModelModal'
import { useLichessStreamController } from 'src/hooks/useLichessStreamController'
import { useAnalysisController } from 'src/hooks'
import { TreeControllerContext } from 'src/contexts'
import { StreamAnalysis } from 'src/components/Analysis/StreamAnalysis'
import { AnalyzedGame } from 'src/types'
import { GameTree } from 'src/types/tree'

const StreamAnalysisPage: NextPage = () => {
  const router = useRouter()
  const { gameId } = router.query as { gameId: string }

  const streamController = useLichessStreamController()

  useEffect(() => {
    if (gameId && typeof gameId === 'string') {
      console.log('Starting stream for game:', gameId)
      streamController.startStream(gameId)
    }
  }, [gameId])

  const streamControllerRef = useRef(streamController)
  streamControllerRef.current = streamController

  useEffect(() => {
    return () => {
      streamControllerRef.current.stopStream()
    }
  }, [])

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
      gameType: 'blitz',
      termination: { result: '*', winner: undefined },
      maiaEvaluations: [{}],
      stockfishEvaluations: [undefined],
      tree: dummyTree,
      type: 'stream' as const,
    }
  }, [])

  const currentGame = streamController.game || dummyGame
  const analysisController = useAnalysisController(
    currentGame,
    undefined,
    false,
  )

  // Auto-follow live moves only when user is at the last node
  const lastGameMoveCount = useRef(0)

  useEffect(() => {
    if (streamController.game?.tree && analysisController) {
      try {
        const mainLine = streamController.game.tree.getMainLine()
        const currentMoveCount = mainLine.length

        // If new moves have been added to the game
        if (currentMoveCount > lastGameMoveCount.current) {
          lastGameMoveCount.current = currentMoveCount

          // Find the last node in the main line
          let lastNode = streamController.game.tree.getRoot()
          while (lastNode.mainChild) {
            lastNode = lastNode.mainChild
          }

          // Only auto-follow if user is currently at the previous last node
          // This means they're following the live game
          if (
            analysisController.currentNode &&
            lastNode.parent === analysisController.currentNode
          ) {
            analysisController.setCurrentNode(lastNode)
          }
        }
      } catch (error) {
        console.error('Error setting current node:', error)
      }
    }
  }, [streamController.game, analysisController])

  // When we finish streaming and load the game, we want to set the current node to the last move
  useEffect(() => {
    if (streamController.game?.loaded) {
      analysisController.setCurrentNode(
        streamController.game.tree.getMainLine()[
          streamController.game.tree.getMainLine().length - 1
        ],
      )
    }
  }, [streamController.game?.loaded])

  // if (
  //   streamController.streamState.isConnecting &&
  //   !streamController.streamState.gameStarted
  // ) {
  //   return (
  //     <>
  //       <Head>
  //         <title>Connecting to Live Game – Maia Chess</title>
  //         <meta
  //           name="description"
  //           content="Connecting to live chess game stream for real-time analysis with Maia AI."
  //         />
  //       </Head>
  //       <DelayedLoading isLoading={true}>
  //         <div className="flex flex-col items-center justify-center gap-4">
  //           <div className="text-center">
  //             <h2 className="mb-2 text-xl font-semibold">
  //               {streamController.streamState.error
  //                 ? 'Connection Error'
  //                 : 'Connecting to Live Game'}
  //             </h2>
  //             {streamController.streamState.error ? (
  //               <div className="mb-4 text-red-400">
  //                 <p>{streamController.streamState.error}</p>
  //                 <button
  //                   onClick={streamController.reconnect}
  //                   className="mt-2 rounded bg-human-4 px-4 py-2 text-white transition hover:bg-human-4/80"
  //                 >
  //                   Try Again
  //                 </button>
  //               </div>
  //             ) : (
  //               <p className="text-secondary">
  //                 Establishing connection to Lichess game {gameId}...
  //               </p>
  //             )}
  //           </div>
  //         </div>
  //       </DelayedLoading>
  //     </>
  //   )
  // }

  return (
    <>
      <Head>
        <title>
          Live Analysis: {streamController.game?.whitePlayer.name || 'Unknown'}{' '}
          vs {streamController.game?.blackPlayer.name || 'Unknown'} – Maia Chess
        </title>
        <meta
          name="description"
          content={`Watch live analysis of ${streamController.game?.whitePlayer.name || 'Unknown'} vs ${streamController.game?.blackPlayer.name || 'Unknown'} with real-time Maia AI insights.`}
        />
      </Head>

      {/* Radial gradient backdrop to match new design language */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at center top, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
        }}
      />

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
        {!streamController.game?.loaded &&
        streamController.game &&
        !streamController.streamState.gameEnded ? (
          <div className="absolute left-0 top-0 z-50">
            <Loading
              transparent
              isLoading={true}
              message={
                <>
                  Connecting to Lichess game {gameId}...
                  <br />
                  Lichess intentionally adds a short delay to live move data to
                  reduce engine-assisted cheating. The stream will start soon.
                </>
              }
            >
              <></>
            </Loading>
          </div>
        ) : null}
        {analysisController && (
          <StreamAnalysis
            game={streamController.game || dummyGame}
            streamState={streamController.streamState}
            clockState={streamController.clockState}
            onReconnect={streamController.reconnect}
            onStopStream={streamController.stopStream}
            analysisController={analysisController}
          />
        )}
      </TreeControllerContext.Provider>
    </>
  )
}

export default function AuthenticatedStreamAnalysisPage() {
  return (
    <AuthenticatedWrapper>
      <StreamAnalysisPage />
    </AuthenticatedWrapper>
  )
}

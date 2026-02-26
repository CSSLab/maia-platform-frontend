import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useContext,
} from 'react'
import { motion } from 'framer-motion'
import type { Key } from 'chessground/types'
import { Chess, PieceSymbol } from 'chess.ts'
import type { DrawShape } from 'chessground/draw'

import { TABLET_BREAKPOINT_PX, WindowSizeContext } from 'src/contexts'
import { MAIA_MODELS } from 'src/constants/common'
import { GameInfo } from 'src/components/Common/GameInfo'
import { GameBoard } from 'src/components/Board/GameBoard'
import { PlayerInfo } from 'src/components/Common/PlayerInfo'
import { MovesContainer } from 'src/components/Board/MovesContainer'
import { AnalyzedGame, GameNode, StreamState, ClockState } from 'src/types'
import { BoardController } from 'src/components/Board/BoardController'
import { PromotionOverlay } from 'src/components/Board/PromotionOverlay'
import { AnalysisSidebar } from 'src/components/Analysis'
import { ConfigurableScreens } from 'src/components/Analysis/ConfigurableScreens'
import { useAnalysisController } from 'src/hooks/useAnalysisController'

interface Props {
  game: AnalyzedGame
  streamState: StreamState
  clockState: ClockState
  onReconnect: () => void
  onStopStream: () => void
  analysisController: ReturnType<typeof useAnalysisController>
}

export const StreamAnalysis: React.FC<Props> = ({
  game,
  streamState,
  clockState,
  onReconnect,
  onStopStream,
  analysisController,
}) => {
  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(
    () => width > 0 && width <= TABLET_BREAKPOINT_PX,
    [width],
  )

  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const [currentSquare, setCurrentSquare] = useState<Key | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const destinationBadges = useMemo(() => {
    if (
      !analysisController.showTopMoveBadges ||
      !analysisController.topHumanMoveBadge
    ) {
      return []
    }

    return [
      {
        square: analysisController.topHumanMoveBadge.square,
        classification: analysisController.topHumanMoveBadge.classification,
      },
    ]
  }, [
    analysisController.showTopMoveBadges,
    analysisController.topHumanMoveBadge,
  ])

  useEffect(() => {
    setHoverArrow(null)
  }, [analysisController.currentNode])

  const hover = (move?: string) => {
    if (move) {
      setHoverArrow({
        orig: move.slice(0, 2) as Key,
        dest: move.slice(2, 4) as Key,
        brush: 'green',
        modifiers: {
          lineWidth: 10,
        },
      })
    } else {
      setHoverArrow(null)
    }
  }

  const makeMove = (move: string) => {
    if (!analysisController.currentNode || !game.tree) return

    const chess = new Chess(analysisController.currentNode.fen)
    const moveAttempt = chess.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] ? (move[4] as PieceSymbol) : undefined,
    })

    if (moveAttempt) {
      const newFen = chess.fen()
      const moveString =
        moveAttempt.from +
        moveAttempt.to +
        (moveAttempt.promotion ? moveAttempt.promotion : '')
      const san = moveAttempt.san

      if (analysisController.currentNode.mainChild?.move === moveString) {
        // Existing main line move - navigate to it
        analysisController.goToNode(analysisController.currentNode.mainChild)
      } else {
        // For stream analysis, ALWAYS create variations for player moves
        // This preserves the live game mainline and allows exploration
        const newVariation = game.tree.addVariationNode(
          analysisController.currentNode,
          newFen,
          moveString,
          san,
          analysisController.currentMaiaModel,
        )
        analysisController.goToNode(newVariation)
      }
    }
  }

  const onPlayerMakeMove = useCallback(
    (playedMove: [string, string] | null) => {
      if (!playedMove) return

      // Check for promotions in available moves
      const availableMoves: { from: string; to: string }[] = []
      for (const [from, tos] of analysisController.availableMoves.entries()) {
        for (const to of tos as string[]) {
          availableMoves.push({ from, to })
        }
      }

      const matching = availableMoves.filter((m) => {
        return m.from === playedMove[0] && m.to === playedMove[1]
      })

      if (matching.length > 1) {
        // Multiple matching moves (i.e. promotion)
        setPromotionFromTo(playedMove)
        return
      }

      // Single move
      const moveUci = playedMove[0] + playedMove[1]
      makeMove(moveUci)
    },
    [analysisController.availableMoves],
  )

  const onPlayerSelectPromotion = useCallback(
    (piece: string) => {
      if (!promotionFromTo) {
        return
      }
      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece
      makeMove(moveUci)
    },
    [promotionFromTo, setPromotionFromTo],
  )

  const launchContinue = useCallback(() => {
    const fen = analysisController.currentNode?.fen as string
    const url = '/play' + '?fen=' + encodeURIComponent(fen)
    window.open(url)
  }, [analysisController.currentNode])

  // Determine current player for promotion overlay
  const currentPlayer = useMemo(() => {
    if (!analysisController.currentNode) return 'white'
    const chess = new Chess(analysisController.currentNode.fen)
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [analysisController.currentNode])

  const NestedGameInfo = () => (
    <div className="flex w-full flex-col">
      <div className="hidden md:block">
        {[game.whitePlayer, game.blackPlayer].map((player, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-white' : 'border-[0.5px] bg-black'}`}
              />
              <p className="text-sm">{player.name}</p>
              <span className="text-xs">
                {player.rating ? <>({player.rating})</> : null}
              </span>
            </div>
            {game.termination?.winner === (index == 0 ? 'white' : 'black') ? (
              <p className="text-xs text-engine-3">1</p>
            ) : game.termination?.winner !== 'none' ? (
              <p className="text-xs text-human-3">0</p>
            ) : game.termination === undefined ? (
              <></>
            ) : (
              <p className="text-xs text-secondary">½</p>
            )}
          </div>
        ))}
        <div className="mt-1 flex items-center justify-center gap-1">
          <span className="text-xxs text-secondary">
            Watch on{' '}
            <a
              href={`https://lichess.org/${game.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/60 underline hover:text-primary"
            >
              Lichess
            </a>
          </span>
        </div>
      </div>
      <div className="flex w-full items-center justify-between text-xs md:hidden">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="font-medium">{game.whitePlayer.name}</span>
          {game.whitePlayer.rating && (
            <span className="text-primary/60">({game.whitePlayer.rating})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {streamState.isLive ? (
            <span className="font-medium text-red-400">LIVE</span>
          ) : game.termination?.winner === 'none' ? (
            <span className="font-medium text-primary/80">½-½</span>
          ) : (
            <span className="font-medium">
              <span className="text-primary/70">
                {game.termination?.winner === 'white' ? '1' : '0'}
              </span>
              <span className="text-primary/70">-</span>
              <span className="text-primary/70">
                {game.termination?.winner === 'black' ? '1' : '0'}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full border-[0.5px] bg-black" />
          <span className="font-medium">{game.blackPlayer.name}</span>
          {game.blackPlayer.rating && (
            <span className="text-primary/60">({game.blackPlayer.rating})</span>
          )}
        </div>
      </div>
    </div>
  )

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2,
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 4,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
  }

  const desktopLayout = (
    <motion.div
      className="flex h-full w-full flex-col items-center py-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="flex h-full w-[90%] flex-row gap-3">
        <motion.div
          id="navigation"
          className="desktop-left-column-container flex flex-col overflow-hidden"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            {/* Header */}
            <GameInfo
              title="Analysis"
              icon="live_tv"
              type="analysis"
              streamState={streamState}
              embedded
            >
              <NestedGameInfo />
            </GameInfo>
            {/* Moves + controller */}
            <div className="red-scrollbar flex h-full flex-1 flex-col overflow-y-auto">
              <div className="h-3 border-b border-glass-border" />
              <MovesContainer
                game={game}
                termination={game.termination}
                showAnnotations={true}
                disableKeyboardNavigation={false}
                disableMoveClicking={false}
                embedded
                heightClass="h-40"
              />
              <BoardController
                gameTree={analysisController.gameTree}
                orientation={analysisController.orientation}
                setOrientation={analysisController.setOrientation}
                currentNode={analysisController.currentNode}
                plyCount={analysisController.plyCount}
                goToNode={analysisController.goToNode}
                goToNextNode={analysisController.goToNextNode}
                goToPreviousNode={analysisController.goToPreviousNode}
                goToRootNode={analysisController.goToRootNode}
                disableKeyboardNavigation={false}
                disableNavigation={false}
                embedded
              />
            </div>
          </div>
        </motion.div>
        <motion.div
          className="desktop-middle-column-container flex flex-col gap-2"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="flex w-full flex-col overflow-hidden rounded">
            <PlayerInfo
              name={
                analysisController.orientation === 'white'
                  ? game.blackPlayer.name
                  : game.whitePlayer.name
              }
              rating={
                analysisController.orientation === 'white'
                  ? game.blackPlayer.rating
                  : game.whitePlayer.rating
              }
              color={
                analysisController.orientation === 'white' ? 'black' : 'white'
              }
              termination={game.termination?.winner}
              currentFen={analysisController.currentNode?.fen}
              orientation={analysisController.orientation}
              clock={
                clockState
                  ? analysisController.orientation === 'white'
                    ? {
                        timeInSeconds: clockState.blackTime,
                        isActive: clockState.activeColor === 'black',
                        lastUpdateTime: clockState.lastUpdateTime,
                      }
                    : {
                        timeInSeconds: clockState.whiteTime,
                        isActive: clockState.activeColor === 'white',
                        lastUpdateTime: clockState.lastUpdateTime,
                      }
                  : undefined
              }
            />
            <div className="desktop-board-container relative flex aspect-square">
              <GameBoard
                game={game}
                availableMoves={analysisController.availableMoves}
                setCurrentSquare={setCurrentSquare}
                shapes={(() => {
                  const baseShapes = [...analysisController.arrows]
                  if (hoverArrow) {
                    baseShapes.push(hoverArrow)
                  }
                  return baseShapes
                })()}
                currentNode={analysisController.currentNode as GameNode}
                orientation={analysisController.orientation}
                onPlayerMakeMove={onPlayerMakeMove}
                goToNode={analysisController.goToNode}
                gameTree={game.tree}
                destinationBadges={destinationBadges}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
            <PlayerInfo
              name={
                analysisController.orientation === 'white'
                  ? game.whitePlayer.name
                  : game.blackPlayer.name
              }
              rating={
                analysisController.orientation === 'white'
                  ? game.whitePlayer.rating
                  : game.blackPlayer.rating
              }
              color={
                analysisController.orientation === 'white' ? 'white' : 'black'
              }
              termination={game.termination?.winner}
              showArrowLegend={true}
              currentFen={analysisController.currentNode?.fen}
              orientation={analysisController.orientation}
              clock={
                clockState
                  ? analysisController.orientation === 'white'
                    ? {
                        timeInSeconds: clockState.whiteTime,
                        isActive: clockState.activeColor === 'white',
                        lastUpdateTime: clockState.lastUpdateTime,
                      }
                    : {
                        timeInSeconds: clockState.blackTime,
                        isActive: clockState.activeColor === 'black',
                        lastUpdateTime: clockState.lastUpdateTime,
                      }
                  : undefined
              }
            />
          </div>
          <ConfigurableScreens
            currentMaiaModel={analysisController.currentMaiaModel}
            setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
            showTopMoveBadges={analysisController.showTopMoveBadges}
            setShowTopMoveBadges={analysisController.setShowTopMoveBadges}
            launchContinue={launchContinue}
            MAIA_MODELS={MAIA_MODELS}
            game={game}
            currentNode={analysisController.currentNode as GameNode}
          />
        </motion.div>
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={analysisController}
          setHoverArrow={setHoverArrow}
          analysisEnabled={true}
          handleToggleAnalysis={() => {
            // Analysis toggle not needed for stream - always enabled
          }}
          itemVariants={itemVariants}
        />
      </div>
    </motion.div>
  )

  const mobileLayout = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <motion.div
          className="flex w-full flex-col items-start justify-start gap-1"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <GameInfo
            title="Analysis"
            icon="live_tv"
            type="analysis"
            currentMaiaModel={analysisController.currentMaiaModel}
            setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
            MAIA_MODELS={MAIA_MODELS}
            streamState={streamState}
          >
            <NestedGameInfo />
          </GameInfo>
          <div id="analysis" className="relative flex h-[100vw] w-screen">
            <GameBoard
              game={game}
              availableMoves={analysisController.availableMoves}
              setCurrentSquare={setCurrentSquare}
              shapes={(() => {
                const baseShapes = [...analysisController.arrows]
                if (hoverArrow) {
                  baseShapes.push(hoverArrow)
                }
                return baseShapes
              })()}
              currentNode={analysisController.currentNode as GameNode}
              orientation={analysisController.orientation}
              onPlayerMakeMove={onPlayerMakeMove}
              goToNode={analysisController.goToNode}
              gameTree={game.tree}
              destinationBadges={destinationBadges}
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={currentPlayer}
                file={promotionFromTo[1].slice(0, 1)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
              />
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-0">
            <div className="w-full !flex-grow-0">
              <BoardController
                gameTree={analysisController.gameTree}
                orientation={analysisController.orientation}
                setOrientation={analysisController.setOrientation}
                currentNode={analysisController.currentNode}
                plyCount={analysisController.plyCount}
                goToNode={analysisController.goToNode}
                goToNextNode={analysisController.goToNextNode}
                goToPreviousNode={analysisController.goToPreviousNode}
                goToRootNode={analysisController.goToRootNode}
                disableKeyboardNavigation={false}
                disableNavigation={false}
                embedded
              />
            </div>
            <div className="relative bottom-0 h-48 max-h-48 flex-1 overflow-auto overflow-y-hidden">
              <MovesContainer
                game={game}
                termination={game.termination}
                showAnnotations={true}
                disableKeyboardNavigation={false}
                disableMoveClicking={false}
              />
            </div>
          </div>
          <ConfigurableScreens
            currentMaiaModel={analysisController.currentMaiaModel}
            setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
            showTopMoveBadges={analysisController.showTopMoveBadges}
            setShowTopMoveBadges={analysisController.setShowTopMoveBadges}
            launchContinue={launchContinue}
            MAIA_MODELS={MAIA_MODELS}
            game={game}
            currentNode={analysisController.currentNode as GameNode}
          />
        </motion.div>
      </div>
    </motion.div>
  )

  return <div>{isMobile ? mobileLayout : desktopLayout}</div>
}

import React, { useMemo, useCallback, useContext } from 'react'
import { Highlight, MoveMap, BlunderMeter, MovesByRating } from '../Analysis'
import { GameNode } from 'src/types'
import { GameTree } from 'src/types/base/tree'
import type { DrawShape } from 'chessground/draw'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import { WindowSizeContext } from 'src/contexts'

interface Props {
  currentNode: GameNode | null
  gameTree: GameTree | null
  analysisEnabled: boolean
  onToggleAnalysis: () => void
  playerColor: 'white' | 'black'
  maiaVersion: string
  analysisController: ReturnType<typeof useAnalysisController>
  hover: (move?: string) => void
  setHoverArrow: React.Dispatch<React.SetStateAction<DrawShape | null>>
  makeMove: (move: string) => void
}

export const OpeningDrillAnalysis: React.FC<Props> = ({
  currentNode,
  gameTree,
  analysisEnabled,
  onToggleAnalysis,
  playerColor,
  maiaVersion,
  analysisController,
  hover: parentHover,
  setHoverArrow: parentSetHoverArrow,
  makeMove: parentMakeMove,
}) => {
  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])

  const hover = useCallback(
    (move?: string) => {
      if (move && analysisEnabled) {
        parentHover(move)
      } else {
        parentHover()
      }
    },
    [analysisEnabled, parentHover],
  )

  const makeMove = useCallback(
    (move: string) => {
      parentMakeMove(move)
    },
    [parentMakeMove],
  )

  // No-op handlers for blurred analysis components when disabled
  const mockHover = useCallback(() => {
    // Intentionally empty - no interaction allowed when analysis disabled
  }, [])

  const mockMakeMove = useCallback(() => {
    // Intentionally empty - no moves allowed when analysis disabled
  }, [])

  const mockSetHoverArrow = useCallback(() => {
    // Intentionally empty - no hover arrows when analysis disabled
  }, [])

  // Create empty data structures that match expected types
  const emptyBlunderMeterData = useMemo(
    () => ({
      goodMoves: { moves: [], probability: 0 },
      okMoves: { moves: [], probability: 0 },
      blunderMoves: { moves: [], probability: 0 },
    }),
    [],
  )

  const emptyRecommendations = useMemo(
    () => ({
      maia: undefined,
      stockfish: undefined,
    }),
    [],
  )

  // Mobile layout (completely separate)
  const mobileLayout = (
    <div className="flex h-full w-full flex-col gap-2">
      {/* Analysis Toggle */}
      <div className="flex items-center justify-between rounded bg-background-1 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">analytics</span>
          <h3 className="font-semibold">Analysis</h3>
        </div>
        <button
          onClick={onToggleAnalysis}
          className={`flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors ${
            analysisEnabled
              ? 'bg-human-4 text-white hover:bg-human-4/80'
              : 'bg-background-2 text-secondary hover:bg-background-3'
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {analysisEnabled ? 'visibility' : 'visibility_off'}
          </span>
          {analysisEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Mobile: Full-width stacked components */}
      <div className="flex w-full flex-col gap-1 overflow-hidden">
        <div className="relative">
          <Highlight
            setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
            hover={analysisEnabled ? hover : mockHover}
            makeMove={analysisEnabled ? makeMove : mockMakeMove}
            currentMaiaModel={analysisController.currentMaiaModel}
            recommendations={
              analysisEnabled
                ? analysisController.moveRecommendations
                : emptyRecommendations
            }
            moveEvaluation={
              analysisEnabled && analysisController.moveEvaluation
                ? analysisController.moveEvaluation
                : {
                    maia: undefined,
                    stockfish: undefined,
                  }
            }
            colorSanMapping={
              analysisEnabled ? analysisController.colorSanMapping : {}
            }
            boardDescription={
              analysisEnabled
                ? analysisController.boardDescription || {
                    segments: [
                      { type: 'text', content: 'Analyzing position...' },
                    ],
                  }
                : {
                    segments: [
                      {
                        type: 'text',
                        content:
                          'Analysis is disabled. Enable analysis to see detailed move evaluations and recommendations.',
                      },
                    ],
                  }
            }
          />
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                  lock
                </span>
                <p className="text-xs font-medium text-primary">
                  Analysis Disabled
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <BlunderMeter
            hover={analysisEnabled ? hover : mockHover}
            makeMove={analysisEnabled ? makeMove : mockMakeMove}
            data={
              analysisEnabled
                ? analysisController.blunderMeter
                : emptyBlunderMeterData
            }
            colorSanMapping={
              analysisEnabled ? analysisController.colorSanMapping : {}
            }
            moveEvaluation={
              analysisEnabled && analysisController.moveEvaluation
                ? analysisController.moveEvaluation
                : undefined
            }
          />
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                  lock
                </span>
                <p className="text-xs font-medium text-primary">
                  Analysis Disabled
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <MovesByRating
            moves={
              analysisEnabled ? analysisController.movesByRating : undefined
            }
            colorSanMapping={
              analysisEnabled ? analysisController.colorSanMapping : {}
            }
          />
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                  lock
                </span>
                <p className="text-xs font-medium text-primary">
                  Analysis Disabled
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <MoveMap
            moveMap={analysisEnabled ? analysisController.moveMap : undefined}
            colorSanMapping={
              analysisEnabled ? analysisController.colorSanMapping : {}
            }
            setHoverArrow={
              analysisEnabled ? parentSetHoverArrow : mockSetHoverArrow
            }
            makeMove={analysisEnabled ? makeMove : mockMakeMove}
          />
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                  lock
                </span>
                <p className="text-xs font-medium text-primary">
                  Analysis Disabled
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Desktop layout (for big and small screens)
  const desktopLayout = (
    <div className="flex h-full w-full flex-col gap-2">
      {/* Analysis Toggle */}
      <div className="flex items-center justify-between rounded bg-background-1 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">analytics</span>
          <h3 className="font-semibold">Analysis</h3>
        </div>
        <button
          onClick={onToggleAnalysis}
          className={`flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors ${
            analysisEnabled
              ? 'bg-human-4 text-white hover:bg-human-4/80'
              : 'bg-background-2 text-secondary hover:bg-background-3'
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {analysisEnabled ? 'visibility' : 'visibility_off'}
          </span>
          {analysisEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Large screens (xl+): Side by side layout */}
      <div className="hidden xl:flex xl:h-full xl:flex-col xl:gap-2">
        <div className="flex h-[calc((55vh+4.5rem)/2)] gap-2">
          {/* Combined Highlight + MovesByRating container */}
          <div className="relative flex h-full w-full overflow-hidden rounded border-[0.5px] border-white/40">
            <div className="flex h-full w-auto min-w-[40%] max-w-[40%] border-r-[0.5px] border-white/40">
              <div className="relative w-full">
                <Highlight
                  setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
                  hover={analysisEnabled ? hover : mockHover}
                  makeMove={analysisEnabled ? makeMove : mockMakeMove}
                  currentMaiaModel={analysisController.currentMaiaModel}
                  recommendations={
                    analysisEnabled
                      ? analysisController.moveRecommendations
                      : emptyRecommendations
                  }
                  moveEvaluation={
                    analysisEnabled && analysisController.moveEvaluation
                      ? analysisController.moveEvaluation
                      : {
                          maia: undefined,
                          stockfish: undefined,
                        }
                  }
                  colorSanMapping={
                    analysisEnabled ? analysisController.colorSanMapping : {}
                  }
                  boardDescription={
                    analysisEnabled
                      ? analysisController.boardDescription || {
                          segments: [
                            { type: 'text', content: 'Analyzing position...' },
                          ],
                        }
                      : {
                          segments: [
                            {
                              type: 'text',
                              content:
                                'Analysis is disabled. Enable analysis to see detailed move evaluations and recommendations.',
                            },
                          ],
                        }
                  }
                />
              </div>
            </div>
            <div className="flex h-full w-full bg-background-1">
              <MovesByRating
                moves={
                  analysisEnabled ? analysisController.movesByRating : undefined
                }
                colorSanMapping={
                  analysisEnabled ? analysisController.colorSanMapping : {}
                }
              />
            </div>
            {!analysisEnabled && (
              <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
                <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                  <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                    lock
                  </span>
                  <p className="font-medium text-primary">Analysis Disabled</p>
                  <p className="text-sm text-secondary">
                    Enable analysis to see move evaluations
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="relative flex h-[calc((55vh+4.5rem)/2)] flex-row gap-2">
          <div className="flex h-full w-full flex-col">
            <MoveMap
              moveMap={analysisEnabled ? analysisController.moveMap : undefined}
              colorSanMapping={
                analysisEnabled ? analysisController.colorSanMapping : {}
              }
              setHoverArrow={
                analysisEnabled ? parentSetHoverArrow : mockSetHoverArrow
              }
              makeMove={analysisEnabled ? makeMove : mockMakeMove}
            />
          </div>
          <BlunderMeter
            hover={analysisEnabled ? hover : mockHover}
            makeMove={analysisEnabled ? makeMove : mockMakeMove}
            data={
              analysisEnabled
                ? analysisController.blunderMeter
                : emptyBlunderMeterData
            }
            colorSanMapping={
              analysisEnabled ? analysisController.colorSanMapping : {}
            }
            moveEvaluation={
              analysisEnabled && analysisController.moveEvaluation
                ? analysisController.moveEvaluation
                : undefined
            }
          />
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                  lock
                </span>
                <p className="font-medium text-primary">Analysis Disabled</p>
                <p className="text-sm text-secondary">
                  Enable analysis to see position evaluation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Small screens (below xl, above mobile): 3-row stacked layout */}
      <div className="flex h-[calc(85vh-4.5rem)] flex-col gap-2 xl:hidden">
        {/* Row 1: Combined Highlight + BlunderMeter container */}
        <div className="relative flex h-[calc((85vh-4.5rem)*0.4)] overflow-hidden rounded border-[0.5px] border-white/40 bg-background-1">
          <div className="flex h-full w-full border-r-[0.5px] border-white/40">
            <Highlight
              setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
              hover={analysisEnabled ? hover : mockHover}
              makeMove={analysisEnabled ? makeMove : mockMakeMove}
              currentMaiaModel={analysisController.currentMaiaModel}
              recommendations={
                analysisEnabled
                  ? analysisController.moveRecommendations
                  : emptyRecommendations
              }
              moveEvaluation={
                analysisEnabled && analysisController.moveEvaluation
                  ? analysisController.moveEvaluation
                  : {
                      maia: undefined,
                      stockfish: undefined,
                    }
              }
              colorSanMapping={
                analysisEnabled ? analysisController.colorSanMapping : {}
              }
              boardDescription={
                analysisEnabled
                  ? analysisController.boardDescription || {
                      segments: [
                        { type: 'text', content: 'Analyzing position...' },
                      ],
                    }
                  : {
                      segments: [
                        {
                          type: 'text',
                          content:
                            'Analysis is disabled. Enable analysis to see detailed move evaluations and recommendations.',
                        },
                      ],
                    }
              }
            />
          </div>
          <div className="flex h-full w-auto min-w-[40%] max-w-[40%] bg-background-1 p-3">
            <div className="h-full w-full">
              <BlunderMeter
                hover={analysisEnabled ? hover : mockHover}
                makeMove={analysisEnabled ? makeMove : mockMakeMove}
                data={
                  analysisEnabled
                    ? analysisController.blunderMeter
                    : emptyBlunderMeterData
                }
                colorSanMapping={
                  analysisEnabled ? analysisController.colorSanMapping : {}
                }
                moveEvaluation={
                  analysisEnabled && analysisController.moveEvaluation
                    ? analysisController.moveEvaluation
                    : undefined
                }
                showContainer={false}
              />
            </div>
          </div>
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                  lock
                </span>
                <p className="font-medium text-primary">Analysis Disabled</p>
                <p className="text-sm text-secondary">
                  Enable analysis to see move evaluations
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: MoveMap */}
        <div className="relative flex h-[calc((85vh-4.5rem)*0.3)] w-full">
          <div className="h-full w-full">
            <MoveMap
              moveMap={analysisEnabled ? analysisController.moveMap : undefined}
              colorSanMapping={
                analysisEnabled ? analysisController.colorSanMapping : {}
              }
              setHoverArrow={
                analysisEnabled ? parentSetHoverArrow : mockSetHoverArrow
              }
              makeMove={analysisEnabled ? makeMove : mockMakeMove}
            />
          </div>
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                  lock
                </span>
                <p className="font-medium text-primary">Analysis Disabled</p>
                <p className="text-sm text-secondary">
                  Enable analysis to see position evaluation
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: MovesByRating */}
        <div className="relative flex h-[calc((85vh-4.5rem)*0.3)] w-full rounded bg-background-1/60">
          <div className="h-full w-full">
            <MovesByRating
              moves={
                analysisEnabled ? analysisController.movesByRating : undefined
              }
              colorSanMapping={
                analysisEnabled ? analysisController.colorSanMapping : {}
              }
            />
          </div>
          {!analysisEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
              <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                  lock
                </span>
                <p className="font-medium text-primary">Analysis Disabled</p>
                <p className="text-sm text-secondary">
                  Enable analysis to see move evaluations
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return isMobile ? mobileLayout : desktopLayout
}

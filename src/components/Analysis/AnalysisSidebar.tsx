import {
  MoveMap,
  Highlight,
  BlunderMeter,
  MovesByRating,
} from 'src/components/Analysis'
import { motion } from 'framer-motion'
import type { DrawShape } from 'chessground/draw'
import { Dispatch, SetStateAction, useCallback, useMemo } from 'react'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import type { MaiaEvaluation, StockfishEvaluation } from 'src/types'

interface Props {
  hover: (move?: string) => void
  makeMove: (move: string) => void
  setHoverArrow: Dispatch<SetStateAction<DrawShape | null>>
  analysisEnabled: boolean
  controller: ReturnType<typeof useAnalysisController>
  handleToggleAnalysis: () => void
  itemVariants?: {
    hidden: {
      opacity: number
      y: number
    }
    visible: {
      opacity: number
      y: number
      transition: {
        duration: number
        ease: number[]
        type: string
      }
    }
    exit: {
      opacity: number
      y: number
      transition: {
        duration: number
        ease: number[]
        type: string
      }
    }
  }
}

export const AnalysisSidebar: React.FC<Props> = ({
  hover,
  makeMove,
  controller,
  setHoverArrow,
  analysisEnabled,
  handleToggleAnalysis,
  itemVariants,
}) => {
  // Mock handlers for when analysis is disabled
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
  const mockHover = useCallback(() => void 0, [])
  const mockSetHoverArrow = useCallback(() => void 0, [])
  const mockMakeMove = useCallback(() => void 0, [])

  return (
    <motion.div
      id="analysis"
      variants={itemVariants ?? {}}
      className="desktop-right-column-container flex flex-col gap-3"
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Large screens : 2-row layout */}
      <div className="hidden xl:flex xl:h-full xl:flex-col xl:gap-3">
        {/* Combined Highlight + MovesByRating container */}
        <div className="desktop-analysis-big-row-1-container relative flex gap-3">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glassBorder bg-glass-strong backdrop-blur-md">
            {/* Merged header with toggle */}
            <div className="flex h-10 min-h-10 items-center justify-between border-b border-glassBorder bg-transparent px-4 text-white/90">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-white/80">
                  analytics
                </span>
                <h3 className="font-semibold text-white">Analysis</h3>
              </div>
              <button
                onClick={handleToggleAnalysis}
                className={`flex items-center gap-1 rounded-md border border-glassBorder bg-glass px-2 py-1 text-xs transition-colors ${
                  analysisEnabled ? 'text-white' : 'text-white/80'
                } hover:bg-glass-hover`}
              >
                <span className="material-symbols-outlined !text-xs text-white/80">
                  {analysisEnabled ? 'visibility' : 'visibility_off'}
                </span>
                <span className="text-white/90">
                  {analysisEnabled ? 'Visible' : 'Hidden'}
                </span>
              </button>
            </div>
            <div className="flex h-full w-full flex-1">
              <div className="flex h-full w-auto min-w-[40%] max-w-[40%] border-r border-white/10">
                <Highlight
                  hover={analysisEnabled ? hover : mockHover}
                  makeMove={analysisEnabled ? makeMove : mockMakeMove}
                  currentMaiaModel={controller.currentMaiaModel}
                  setCurrentMaiaModel={controller.setCurrentMaiaModel}
                  recommendations={
                    analysisEnabled
                      ? controller.moveRecommendations
                      : emptyRecommendations
                  }
                  moveEvaluation={
                    analysisEnabled
                      ? (controller.moveEvaluation as {
                          maia?: MaiaEvaluation
                          stockfish?: StockfishEvaluation
                        })
                      : {
                          maia: undefined,
                          stockfish: undefined,
                        }
                  }
                  colorSanMapping={
                    analysisEnabled ? controller.colorSanMapping : {}
                  }
                  boardDescription={
                    analysisEnabled
                      ? controller.boardDescription
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
                  currentNode={controller.currentNode ?? undefined}
                />
              </div>
              <div className="flex h-full w-full">
                <MovesByRating
                  moves={analysisEnabled ? controller.movesByRating : undefined}
                  colorSanMapping={
                    analysisEnabled ? controller.colorSanMapping : {}
                  }
                />
              </div>
            </div>
          </div>
          {!analysisEnabled && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 top-10 z-10 flex items-center justify-center overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), rgba(23, 18, 20, 0.9)',
              }}
            >
              <div className="rounded-md border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-center">
                <span className="material-symbols-outlined mb-2 text-3xl text-white/80">
                  lock
                </span>
                <p className="font-medium text-white">Analysis Disabled</p>
                <p className="text-sm text-white/80">
                  Enable analysis to see move evaluations
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MoveMap + BlunderMeter container */}
        <div className="desktop-analysis-big-row-2-container relative flex flex-row gap-3">
          <div className="flex h-full w-full flex-col">
            <MoveMap
              moveMap={analysisEnabled ? controller.moveMap : undefined}
              colorSanMapping={
                analysisEnabled ? controller.colorSanMapping : {}
              }
              setHoverArrow={
                analysisEnabled ? setHoverArrow : mockSetHoverArrow
              }
              makeMove={analysisEnabled ? makeMove : mockMakeMove}
            />
          </div>
          <BlunderMeter
            hover={analysisEnabled ? hover : mockHover}
            makeMove={analysisEnabled ? makeMove : mockMakeMove}
            data={
              analysisEnabled ? controller.blunderMeter : emptyBlunderMeterData
            }
            colorSanMapping={analysisEnabled ? controller.colorSanMapping : {}}
            moveEvaluation={
              analysisEnabled ? controller.moveEvaluation : undefined
            }
          />
          {!analysisEnabled && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), rgba(23, 18, 20, 0.9)',
              }}
            >
              <div className="rounded-md border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-center">
                <span className="material-symbols-outlined mb-2 text-3xl text-white/80">
                  lock
                </span>
                <p className="font-medium text-white">Analysis Disabled</p>
                <p className="text-sm text-white/80">
                  Enable analysis to see position evaluation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Smaller screens: 3-row layout */}
      <div className="flex h-full flex-col gap-3 xl:hidden">
        {/* Row 1: Combined Highlight + BlunderMeter container */}
        <div className="desktop-analysis-small-row-1-container relative flex overflow-hidden rounded-md border border-glassBorder bg-glass-strong pt-10 backdrop-blur-md">
          {/* Merged header with toggle (mobile/smaller screens) */}
          <div className="absolute left-0 top-0 z-10 flex h-10 w-full items-center justify-between border-b border-glassBorder bg-transparent px-3 text-white/90 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-white/80">
                analytics
              </span>
              <h3 className="text-sm font-semibold text-white">Analysis</h3>
            </div>
            <button
              onClick={handleToggleAnalysis}
              className={`flex items-center gap-1 rounded-md border bg-[rgb(var(--color-surface-2))] px-2 py-1 text-xs transition-colors ${
                analysisEnabled
                  ? 'border-white/10 text-white'
                  : 'border-white/10 text-white/80'
              }`}
            >
              <span className="material-symbols-outlined !text-xs text-white/80">
                {analysisEnabled ? 'visibility' : 'visibility_off'}
              </span>
              <span className="text-white/90">
                {analysisEnabled ? 'Visible' : 'Hidden'}
              </span>
            </button>
          </div>
          <div className="flex h-full w-full border-r border-white/10">
            <Highlight
              hover={analysisEnabled ? hover : mockHover}
              makeMove={analysisEnabled ? makeMove : mockMakeMove}
              currentMaiaModel={controller.currentMaiaModel}
              setCurrentMaiaModel={controller.setCurrentMaiaModel}
              recommendations={
                analysisEnabled
                  ? controller.moveRecommendations
                  : emptyRecommendations
              }
              moveEvaluation={
                analysisEnabled
                  ? (controller.moveEvaluation as {
                      maia?: MaiaEvaluation
                      stockfish?: StockfishEvaluation
                    })
                  : {
                      maia: undefined,
                      stockfish: undefined,
                    }
              }
              colorSanMapping={
                analysisEnabled ? controller.colorSanMapping : {}
              }
              boardDescription={
                analysisEnabled
                  ? controller.boardDescription
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
              currentNode={controller.currentNode ?? undefined}
            />
          </div>
          <div className="flex h-full w-auto min-w-[40%] max-w-[40%] p-3">
            <div className="h-full w-full">
              <BlunderMeter
                hover={analysisEnabled ? hover : mockHover}
                makeMove={analysisEnabled ? makeMove : mockMakeMove}
                data={
                  analysisEnabled
                    ? controller.blunderMeter
                    : emptyBlunderMeterData
                }
                colorSanMapping={
                  analysisEnabled ? controller.colorSanMapping : {}
                }
                moveEvaluation={
                  analysisEnabled ? controller.moveEvaluation : undefined
                }
                showContainer={false}
              />
            </div>
          </div>
          {!analysisEnabled && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 top-10 z-10 flex items-center justify-center overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), rgba(23, 18, 20, 0.9)',
              }}
            >
              <div className="rounded-md border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-center">
                <span className="material-symbols-outlined mb-2 text-3xl text-white/80">
                  lock
                </span>
                <p className="font-medium text-white">Analysis Disabled</p>
                <p className="text-sm text-white/80">
                  Enable analysis to see move evaluations
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: MoveMap */}
        <div className="desktop-analysis-small-row-2-container relative flex w-full">
          <div className="h-full w-full">
            <MoveMap
              moveMap={analysisEnabled ? controller.moveMap : undefined}
              colorSanMapping={
                analysisEnabled ? controller.colorSanMapping : {}
              }
              setHoverArrow={
                analysisEnabled ? setHoverArrow : mockSetHoverArrow
              }
              makeMove={analysisEnabled ? makeMove : mockMakeMove}
            />
          </div>
          {!analysisEnabled && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), rgba(23, 18, 20, 0.9)',
              }}
            >
              <div className="rounded-md border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-center">
                <span className="material-symbols-outlined mb-2 text-3xl text-white/80">
                  lock
                </span>
                <p className="font-medium text-white">Analysis Disabled</p>
                <p className="text-sm text-white/80">
                  Enable analysis to see position evaluation
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: MovesByRating */}
        <div className="desktop-analysis-small-row-3-container relative flex w-full">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-glassBorder bg-glass backdrop-blur-md">
            <MovesByRating
              moves={analysisEnabled ? controller.movesByRating : undefined}
              colorSanMapping={
                analysisEnabled ? controller.colorSanMapping : {}
              }
            />
            {!analysisEnabled && (
              <div
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-md"
                style={{
                  background:
                    'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), rgba(23, 18, 20, 0.9)',
                }}
              >
                <div className="rounded-md border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-center">
                  <span className="material-symbols-outlined mb-2 text-3xl text-white/80">
                    lock
                  </span>
                  <p className="font-medium text-white">Analysis Disabled</p>
                  <p className="text-sm text-white/80">
                    Enable analysis to see move evaluations
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

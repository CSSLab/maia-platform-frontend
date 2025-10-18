import { useState, useRef, useCallback, useContext } from 'react'
import { Chess } from 'chess.ts'

import { GameTree } from 'src/types'
import { DeepAnalysisConfig, DeepAnalysisProgress } from 'src/types/analysis'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import { MaiaEngineContext } from 'src/contexts/MaiaEngineContext'

interface UseDeepAnalysisProps {
  gameTree: GameTree
  setCurrentNode: (node: any) => void
}

export const useDeepAnalysis = ({
  gameTree,
  setCurrentNode,
}: UseDeepAnalysisProps) => {
  const stockfish = useContext(StockfishEngineContext)
  const maia = useContext(MaiaEngineContext)

  const [deepAnalysisConfiguration, setDeepAnalysisConfig] =
    useState<DeepAnalysisConfig>({
      targetDepth: 18,
    })

  const [deepAnalysisProgress, setDeepAnalysisProgress] =
    useState<DeepAnalysisProgress>({
      currentMoveIndex: 0,
      totalMoves: 0,
      currentMove: '',
      isAnalyzing: false,
      isComplete: false,
      isCancelled: false,
    })

  const deepAnalysisStatus = useRef<{
    cancelled: boolean
    currentNode: any | null
  }>({
    cancelled: false,
    currentNode: null,
  })

  const startDeepAnalysis = useCallback(
    async (targetDepth: number) => {
      if (deepAnalysisProgress.isAnalyzing) {
        deepAnalysisStatus.current.cancelled = true
        stockfish.stopEvaluation()
      }

      deepAnalysisStatus.current.cancelled = false
      deepAnalysisStatus.current.currentNode = null

      const mainLine = gameTree.getMainLine()

      setDeepAnalysisConfig({ targetDepth })
      setDeepAnalysisProgress({
        currentMoveIndex: 0,
        totalMoves: mainLine.length,
        currentMove: '',
        isAnalyzing: true,
        isComplete: false,
        isCancelled: false,
      })

      let retries = 0
      const maxRetries = 50

      while (
        retries < maxRetries &&
        (!stockfish.isReady() || maia.status !== 'ready') &&
        !deepAnalysisStatus.current.cancelled
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (deepAnalysisStatus.current.cancelled) {
        setDeepAnalysisProgress((prev) => ({
          ...prev,
          isAnalyzing: false,
          isCancelled: true,
        }))
        return
      }

      for (let i = 0; i < mainLine.length; i++) {
        if (deepAnalysisStatus.current.cancelled) break

        const node = mainLine[i]
        deepAnalysisStatus.current.currentNode = node
        setCurrentNode(node)

        const moveDisplay = node.san || node.move || `Position ${i + 1}`

        setDeepAnalysisProgress((prev) => ({
          ...prev,
          currentMoveIndex: i + 1,
          currentMove: moveDisplay,
        }))

        const chess = new Chess(node.fen)
        const isTerminalPosition = chess.gameOver()

        if (!isTerminalPosition) {
          let analysisRetries = 0
          const maxAnalysisRetries = 600

          while (
            analysisRetries < maxAnalysisRetries &&
            !deepAnalysisStatus.current.cancelled &&
            (!node.analysis.stockfish ||
              (node.analysis.stockfish.depth < targetDepth &&
                node.analysis.stockfish.model_optimal_cp !== 10000 &&
                node.analysis.stockfish.model_optimal_cp !== -10000))
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            analysisRetries++
          }
        }
      }

      setDeepAnalysisProgress((prev) => ({
        ...prev,
        isAnalyzing: false,
        isComplete: !deepAnalysisStatus.current.cancelled,
        isCancelled: deepAnalysisStatus.current.cancelled,
      }))

      deepAnalysisStatus.current.currentNode = null
    },
    [
      stockfish,
      maia.status,
      gameTree,
      deepAnalysisProgress.isAnalyzing,
      setCurrentNode,
    ],
  )

  const cancelDeepAnalysis = useCallback(() => {
    deepAnalysisStatus.current.cancelled = true
    stockfish.stopEvaluation()

    setDeepAnalysisProgress((prev) => ({
      ...prev,
      isAnalyzing: false,
      isCancelled: true,
    }))
  }, [stockfish])

  const resetDeepAnalysisProgress = useCallback(() => {
    setDeepAnalysisProgress({
      currentMoveIndex: 0,
      totalMoves: 0,
      currentMove: '',
      isAnalyzing: false,
      isComplete: false,
      isCancelled: false,
    })
  }, [])

  const isEnginesReady = useCallback(() => {
    return stockfish.isReady() && maia.status === 'ready'
  }, [stockfish, maia.status])

  return {
    progress: deepAnalysisProgress,
    config: deepAnalysisConfiguration,
    setConfig: setDeepAnalysisConfig,
    startAnalysis: startDeepAnalysis,
    cancelAnalysis: cancelDeepAnalysis,
    resetProgress: resetDeepAnalysisProgress,
    isEnginesReady: isEnginesReady(),
  }
}

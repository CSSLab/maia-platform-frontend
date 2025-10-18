import { useState, useRef, useCallback, useEffect } from 'react'

import { AnalyzedGame, GameTree } from 'src/types'
import { storeGameAnalysisCache } from 'src/api/analysis'
import {
  collectEngineAnalysisData,
  generateAnalysisCacheKey,
} from 'src/lib/analysis'

interface UseAutoSaveProps {
  game: AnalyzedGame
  gameTree: GameTree
  enableAutoSave: boolean
  analysisState: number
}

export const useAutoSave = ({
  game,
  gameTree,
  enableAutoSave,
  analysisState,
}: UseAutoSaveProps) => {
  const [lastSavedCacheKey, setLastSavedCacheKey] = useState<string>('')
  const [hasUnsavedAnalysis, setHasUnsavedAnalysis] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const saveAnalysisToBackend = useCallback(async () => {
    if (
      !game.id ||
      !enableAutoSave ||
      !hasUnsavedAnalysis ||
      game.type === 'tournament'
    ) {
      return
    }

    try {
      setIsAutoSaving(true)
      const analysisData = collectEngineAnalysisData(gameTree)

      if (analysisData.length === 0) {
        setIsAutoSaving(false)
        return
      }

      const hasMeaningfulAnalysis = analysisData.some((pos) => {
        const hasDeepStockfish = pos.stockfish && pos.stockfish.depth >= 12
        const hasMateData =
          (pos.stockfish?.mate_vec &&
            Object.keys(pos.stockfish.mate_vec).length > 0) ||
          false
        return hasDeepStockfish || hasMateData || !!pos.maia
      })

      if (!hasMeaningfulAnalysis) {
        setIsAutoSaving(false)
        return
      }

      const cacheKey = generateAnalysisCacheKey(analysisData)
      if (cacheKey === lastSavedCacheKey) {
        setIsAutoSaving(false)
        return
      }

      await storeGameAnalysisCache(game.id, analysisData)
      setLastSavedCacheKey(cacheKey)
      setHasUnsavedAnalysis(false)
    } catch (error) {
      console.warn('Failed to save analysis to backend:', error)
    } finally {
      setIsAutoSaving(false)
    }
  }, [
    enableAutoSave,
    game.id,
    game.type,
    gameTree,
    lastSavedCacheKey,
    hasUnsavedAnalysis,
  ])

  const saveAnalysisToBackendRef = useRef(saveAnalysisToBackend)
  saveAnalysisToBackendRef.current = saveAnalysisToBackend

  useEffect(() => {
    setHasUnsavedAnalysis(false)
    setIsAutoSaving(false)
    setLastSavedCacheKey('')
  }, [game.id, game.type])

  useEffect(() => {
    if (analysisState > 0) {
      setHasUnsavedAnalysis(true)
    }
  }, [analysisState])

  useEffect(() => {
    if (!enableAutoSave) {
      return
    }

    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setInterval(() => {
      saveAnalysisToBackendRef.current()
    }, 10000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
      saveAnalysisToBackendRef.current()
    }
  }, [game.id, enableAutoSave])

  const getAutoSaveStatus = useCallback(() => {
    return {
      hasUnsavedChanges: hasUnsavedAnalysis,
      isSaving: isAutoSaving,
      status: isAutoSaving
        ? ('saving' as const)
        : hasUnsavedAnalysis
          ? ('unsaved' as const)
          : ('saved' as const),
    }
  }, [hasUnsavedAnalysis, isAutoSaving])

  return {
    saveAnalysis: saveAnalysisToBackend,
    autoSave: getAutoSaveStatus(),
  }
}

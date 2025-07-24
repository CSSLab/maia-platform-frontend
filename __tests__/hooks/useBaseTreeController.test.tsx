import React from 'react'
import { renderHook } from '@testing-library/react'
import { useBaseTreeController } from '../../src/hooks/useBaseTreeController'

jest.mock('../../src/contexts/BaseTreeControllerContext', () => ({
  BaseTreeControllerContext: React.createContext(null),
}))

jest.mock(
  '../../src/contexts/TreeControllerContext/TreeControllerContext',
  () => {
    const mockAnalysisContext = {
      tree: null,
      currentNode: null,
      orientation: 'white' as const,
    }
    return {
      TreeControllerContext: React.createContext(mockAnalysisContext),
    }
  },
)

jest.mock(
  '../../src/contexts/PlayControllerContext/PlayControllerContext',
  () => {
    const mockPlayContext = {
      tree: null,
      currentNode: null,
      orientation: 'white' as const,
    }
    return {
      PlayControllerContext: React.createContext(mockPlayContext),
    }
  },
)

jest.mock(
  '../../src/contexts/TuringTreeControllerContext/TuringTreeControllerContext',
  () => {
    const mockTuringContext = {
      tree: null,
      currentNode: null,
      orientation: 'white' as const,
    }
    return {
      TuringControllerContext: React.createContext(mockTuringContext),
    }
  },
)

jest.mock(
  '../../src/contexts/TrainingControllerContext/TrainingControllerContext',
  () => {
    const mockTrainingContext = {
      tree: null,
      currentNode: null,
      orientation: 'white' as const,
    }
    return {
      TrainingControllerContext: React.createContext(mockTrainingContext),
    }
  },
)

describe('useBaseTreeController Hook', () => {
  it('should return analysis context when type is analysis', () => {
    const { result } = renderHook(() => useBaseTreeController('analysis'))

    expect(result.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
  })

  it('should return play context when type is play', () => {
    const { result } = renderHook(() => useBaseTreeController('play'))

    expect(result.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
  })

  it('should return turing context when type is turing', () => {
    const { result } = renderHook(() => useBaseTreeController('turing'))

    expect(result.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
  })

  it('should return training context when type is training', () => {
    const { result } = renderHook(() => useBaseTreeController('training'))

    expect(result.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
  })

  it('should throw error for unknown context type', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = jest.fn()

    expect(() => {
      renderHook(() => useBaseTreeController('unknown' as any))
    }).toThrow('Unknown context type: unknown')

    console.error = originalError
  })

  it('should maintain type safety for valid context types', () => {
    // This test ensures TypeScript compilation works correctly
    const validTypes: Array<'analysis' | 'play' | 'turing' | 'training'> = [
      'analysis',
      'play',
      'turing',
      'training',
    ]

    validTypes.forEach((type) => {
      const { result } = renderHook(() => useBaseTreeController(type))
      expect(result.current).toBeDefined()
    })
  })

  it('should use the correct context for each type', () => {
    // Test that each type uses the expected context
    const { result: analysisResult } = renderHook(() =>
      useBaseTreeController('analysis'),
    )
    const { result: playResult } = renderHook(() =>
      useBaseTreeController('play'),
    )
    const { result: turingResult } = renderHook(() =>
      useBaseTreeController('turing'),
    )
    const { result: trainingResult } = renderHook(() =>
      useBaseTreeController('training'),
    )

    // Each should return the correct context structure
    expect(analysisResult.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
    expect(playResult.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
    expect(turingResult.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
    expect(trainingResult.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })

    // Verify they're all different instances (should be different context objects)
    expect(analysisResult.current).not.toBe(playResult.current)
    expect(playResult.current).not.toBe(turingResult.current)
    expect(turingResult.current).not.toBe(trainingResult.current)
  })

  it('should handle context switching correctly', () => {
    let contextType: 'analysis' | 'play' = 'analysis'

    const { result, rerender } = renderHook(() =>
      useBaseTreeController(contextType),
    )

    expect(result.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })

    // Change context type
    contextType = 'play'
    rerender()

    expect(result.current).toEqual({
      tree: null,
      currentNode: null,
      orientation: 'white',
    })
  })
})

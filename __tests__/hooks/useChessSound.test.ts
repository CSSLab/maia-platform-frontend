import { renderHook } from '@testing-library/react'
import { useChessSound } from '../../src/hooks/useChessSound'

// Mock the chessSoundManager
jest.mock('../../src/lib/chessSoundManager', () => ({
  useChessSoundManager: jest.fn(() => ({
    playMoveSound: jest.fn(),
    isMuted: false,
    toggleMute: jest.fn(),
  })),
}))

describe('useChessSound Hook', () => {
  it('should return playSound function', () => {
    const { result } = renderHook(() => useChessSound())

    expect(result.current).toHaveProperty('playSound')
    expect(typeof result.current.playSound).toBe('function')
  })

  it('should call playMoveSound from useChessSoundManager', () => {
    const mockPlayMoveSound = jest.fn()
    const { useChessSoundManager } = jest.requireMock(
      '../../src/lib/chessSoundManager',
    )

    useChessSoundManager.mockReturnValue({
      playMoveSound: mockPlayMoveSound,
      isMuted: false,
      toggleMute: jest.fn(),
    })

    const { result } = renderHook(() => useChessSound())

    result.current.playSound()

    expect(mockPlayMoveSound).toHaveBeenCalled()
  })

  it('should be backwards compatible with old API', () => {
    const { result } = renderHook(() => useChessSound())

    // The old API expected a playSound function
    expect(result.current.playSound).toBeDefined()
    expect(typeof result.current.playSound).toBe('function')
  })

  it('should maintain consistency across re-renders', () => {
    const { result, rerender } = renderHook(() => useChessSound())

    const firstPlaySound = result.current.playSound

    rerender()

    // Should maintain the same function reference
    expect(result.current.playSound).toBe(firstPlaySound)
  })
})

import { renderHook, act } from '@testing-library/react'
import { useTreeController } from '../../src/hooks/useTreeController'

// Mock GameTree and GameNode
const mockRootNode = {
  id: 'root',
  parent: null,
  mainChild: {
    id: 'child1',
    parent: null,
    mainChild: {
      id: 'child2',
      parent: null,
      mainChild: null,
    },
  },
}

const mockGameTree = {
  getRoot: jest.fn(() => mockRootNode),
  getMainLine: jest.fn(() => [
    mockRootNode,
    mockRootNode.mainChild,
    mockRootNode.mainChild.mainChild,
  ]),
}

// Set up parent references
mockRootNode.mainChild.parent = mockRootNode
mockRootNode.mainChild.mainChild.parent = mockRootNode.mainChild

describe('useTreeController Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with root node and default orientation', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    expect(result.current.currentNode).toBe(mockRootNode)
    expect(result.current.orientation).toBe('white')
    expect(result.current.gameTree).toBe(mockGameTree)
  })

  it('should initialize with custom orientation', () => {
    const { result } = renderHook(() =>
      useTreeController(mockGameTree as any, 'black'),
    )

    expect(result.current.orientation).toBe('black')
  })

  it('should calculate ply count correctly', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    expect(result.current.plyCount).toBe(3)
  })

  it('should handle empty game tree', () => {
    const emptyGameTree = {
      getRoot: jest.fn(() => null),
      getMainLine: jest.fn(() => []),
    }

    const { result } = renderHook(() => useTreeController(emptyGameTree as any))

    expect(result.current.plyCount).toBe(0)
  })

  it('should go to specific node', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    const targetNode = mockRootNode.mainChild

    act(() => {
      result.current.goToNode(targetNode)
    })

    expect(result.current.currentNode).toBe(targetNode)
  })

  it('should go to next node when available', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    // Start at root, go to next
    act(() => {
      result.current.goToNextNode()
    })

    expect(result.current.currentNode).toBe(mockRootNode.mainChild)
  })

  it('should not go to next node when none available', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    // Go to the last node
    act(() => {
      result.current.goToNode(mockRootNode.mainChild.mainChild)
    })

    const currentNode = result.current.currentNode

    // Try to go to next (should not change)
    act(() => {
      result.current.goToNextNode()
    })

    expect(result.current.currentNode).toBe(currentNode)
  })

  it('should go to previous node when available', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    // Start at a child node
    act(() => {
      result.current.goToNode(mockRootNode.mainChild)
    })

    // Go to previous
    act(() => {
      result.current.goToPreviousNode()
    })

    expect(result.current.currentNode).toBe(mockRootNode)
  })

  it('should not go to previous node when at root', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    // Already at root, try to go to previous
    act(() => {
      result.current.goToPreviousNode()
    })

    expect(result.current.currentNode).toBe(mockRootNode)
  })

  it('should go to root node', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    // Start at a child node
    act(() => {
      result.current.goToNode(mockRootNode.mainChild.mainChild)
    })

    // Go to root
    act(() => {
      result.current.goToRootNode()
    })

    expect(result.current.currentNode).toBe(mockRootNode)
  })

  it('should set orientation', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    act(() => {
      result.current.setOrientation('black')
    })

    expect(result.current.orientation).toBe('black')
  })

  it('should set current node directly', () => {
    const { result } = renderHook(() => useTreeController(mockGameTree as any))

    const targetNode = mockRootNode.mainChild

    act(() => {
      result.current.setCurrentNode(targetNode)
    })

    expect(result.current.currentNode).toBe(targetNode)
  })

  it('should update orientation when initialOrientation changes', () => {
    let initialOrientation: 'white' | 'black' = 'white'

    const { result, rerender } = renderHook(() =>
      useTreeController(mockGameTree as any, initialOrientation),
    )

    expect(result.current.orientation).toBe('white')

    // Change initial orientation
    initialOrientation = 'black'
    rerender()

    expect(result.current.orientation).toBe('black')
  })

  it('should handle game tree changes', () => {
    const newMockTree = {
      getRoot: jest.fn(() => ({
        id: 'new-root',
        parent: null,
        mainChild: null,
      })),
      getMainLine: jest.fn(() => [
        { id: 'new-root', parent: null, mainChild: null },
      ]),
    }

    const { result, rerender } = renderHook(
      ({ tree }) => useTreeController(tree as any),
      { initialProps: { tree: mockGameTree } },
    )

    expect(result.current.gameTree).toBe(mockGameTree)

    // Change the game tree
    rerender({ tree: newMockTree })

    expect(result.current.gameTree).toBe(newMockTree)
  })

  it('should maintain function stability across re-renders', () => {
    const { result, rerender } = renderHook(() =>
      useTreeController(mockGameTree as any),
    )

    const initialCallbacks = {
      goToNode: result.current.goToNode,
      goToNextNode: result.current.goToNextNode,
      goToPreviousNode: result.current.goToPreviousNode,
      goToRootNode: result.current.goToRootNode,
    }

    rerender()

    expect(result.current.goToNode).toBe(initialCallbacks.goToNode)
    expect(result.current.goToNextNode).toBe(initialCallbacks.goToNextNode)
    expect(result.current.goToPreviousNode).toBe(
      initialCallbacks.goToPreviousNode,
    )
    expect(result.current.goToRootNode).toBe(initialCallbacks.goToRootNode)
  })

  it('should handle null game tree gracefully', () => {
    const nullGameTree = null

    const { result } = renderHook(() => useTreeController(nullGameTree as any))

    // Should not crash
    act(() => {
      result.current.goToRootNode()
    })

    expect(result.current.gameTree).toBe(nullGameTree)
  })
})

import {
  saveCustomAnalysis,
  getStoredCustomAnalyses,
  deleteCustomAnalysis,
  getCustomAnalysisById,
  convertStoredAnalysisToWebGame,
  getCustomAnalysesAsWebGames,
  StoredCustomAnalysis,
} from '../../src/lib/customAnalysis'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock Date.now for consistent testing
const mockDateNow = jest.spyOn(Date, 'now')
const mockToISOString = jest.spyOn(Date.prototype, 'toISOString')

describe('customAnalysis utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDateNow.mockReturnValue(1234567890000)
    mockToISOString.mockReturnValue('2023-01-01T00:00:00.000Z')
  })

  describe('saveCustomAnalysis', () => {
    it('should save PGN analysis with extracted player names', () => {
      const pgn =
        '[White "Magnus Carlsen"]\n[Black "Hikaru Nakamura"]\n\n1. e4 e5'
      mockLocalStorage.getItem.mockReturnValue('[]')

      const result = saveCustomAnalysis('pgn', pgn)

      expect(result).toEqual({
        id: 'pgn-1234567890000',
        name: 'Magnus Carlsen vs Hikaru Nakamura',
        type: 'custom-pgn',
        data: pgn,
        createdAt: '2023-01-01T00:00:00.000Z',
        preview: 'Magnus Carlsen vs Hikaru Nakamura',
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'maia_custom_analyses',
        JSON.stringify([result]),
      )
    })

    it('should save PGN analysis with default preview when no player names', () => {
      const pgn = '1. e4 e5 2. Nf3'
      mockLocalStorage.getItem.mockReturnValue('[]')

      const result = saveCustomAnalysis('pgn', pgn)

      expect(result.preview).toBe('PGN Game')
      expect(result.name).toBe('PGN Game')
    })

    it('should save FEN analysis with correct type and preview', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      mockLocalStorage.getItem.mockReturnValue('[]')

      const result = saveCustomAnalysis('fen', fen)

      expect(result).toEqual({
        id: 'fen-1234567890000',
        name: 'FEN Position',
        type: 'custom-fen',
        data: fen,
        createdAt: '2023-01-01T00:00:00.000Z',
        preview: 'FEN Position',
      })
    })

    it('should save analysis with custom name', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const customName = 'My Custom Position'
      mockLocalStorage.getItem.mockReturnValue('[]')

      const result = saveCustomAnalysis('fen', fen, customName)

      expect(result.name).toBe(customName)
    })

    it('should add new analysis to the beginning of the list', () => {
      const existingAnalysis = {
        id: 'existing-1',
        name: 'Existing',
        type: 'custom-pgn' as const,
        data: 'existing data',
        createdAt: '2022-01-01T00:00:00.000Z',
        preview: 'Existing Preview',
      }
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify([existingAnalysis]),
      )

      const newAnalysis = saveCustomAnalysis('fen', 'new fen')

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'maia_custom_analyses',
        JSON.stringify([newAnalysis, existingAnalysis]),
      )
    })

    it('should limit stored analyses to 50 items', () => {
      const existingAnalyses = Array.from({ length: 50 }, (_, i) => ({
        id: `analysis-${i}`,
        name: `Analysis ${i}`,
        type: 'custom-pgn' as const,
        data: `data ${i}`,
        createdAt: '2022-01-01T00:00:00.000Z',
        preview: `Preview ${i}`,
      }))
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingAnalyses))

      const newAnalysis = saveCustomAnalysis('fen', 'new fen')

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1])
      expect(savedData).toHaveLength(50)
      expect(savedData[0]).toEqual(newAnalysis)
      expect(savedData[49]).toEqual(existingAnalyses[48]) // Last item should be dropped
    })
  })

  describe('getStoredCustomAnalyses', () => {
    it('should return parsed analyses from localStorage', () => {
      const analyses = [
        {
          id: 'test-1',
          name: 'Test Analysis',
          type: 'custom-pgn' as const,
          data: 'test data',
          createdAt: '2023-01-01T00:00:00.000Z',
          preview: 'Test Preview',
        },
      ]
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(analyses))

      const result = getStoredCustomAnalyses()

      expect(result).toEqual(analyses)
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        'maia_custom_analyses',
      )
    })

    it('should return empty array when no data in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const result = getStoredCustomAnalyses()

      expect(result).toEqual([])
    })

    it('should return empty array and warn on parse error', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = getStoredCustomAnalyses()

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse stored custom analyses:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('deleteCustomAnalysis', () => {
    it('should remove analysis with matching id', () => {
      const analyses = [
        { id: 'keep-1', name: 'Keep 1' },
        { id: 'delete-me', name: 'Delete Me' },
        { id: 'keep-2', name: 'Keep 2' },
      ]
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(analyses))

      deleteCustomAnalysis('delete-me')

      const expectedFiltered = [
        { id: 'keep-1', name: 'Keep 1' },
        { id: 'keep-2', name: 'Keep 2' },
      ]
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'maia_custom_analyses',
        JSON.stringify(expectedFiltered),
      )
    })

    it('should handle deleting non-existent id', () => {
      const analyses = [{ id: 'existing', name: 'Existing' }]
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(analyses))

      deleteCustomAnalysis('non-existent')

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'maia_custom_analyses',
        JSON.stringify(analyses), // Should remain unchanged
      )
    })
  })

  describe('getCustomAnalysisById', () => {
    it('should return analysis with matching id', () => {
      const analyses = [
        { id: 'target', name: 'Target Analysis' },
        { id: 'other', name: 'Other Analysis' },
      ]
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(analyses))

      const result = getCustomAnalysisById('target')

      expect(result).toEqual({ id: 'target', name: 'Target Analysis' })
    })

    it('should return undefined for non-existent id', () => {
      const analyses = [{ id: 'existing', name: 'Existing' }]
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(analyses))

      const result = getCustomAnalysisById('non-existent')

      expect(result).toBeUndefined()
    })
  })

  describe('convertStoredAnalysisToWebGame', () => {
    it('should convert PGN analysis to web game', () => {
      const analysis: StoredCustomAnalysis = {
        id: 'test-pgn',
        name: 'Test PGN',
        type: 'custom-pgn',
        data: '1. e4 e5',
        createdAt: '2023-01-01T00:00:00.000Z',
        preview: 'Test vs Test',
      }

      const result = convertStoredAnalysisToWebGame(analysis)

      expect(result).toEqual({
        id: 'test-pgn',
        type: 'custom-pgn',
        label: 'Test PGN',
        result: '*',
        pgn: '1. e4 e5',
      })
    })

    it('should convert FEN analysis to web game', () => {
      const analysis: StoredCustomAnalysis = {
        id: 'test-fen',
        name: 'Test FEN',
        type: 'custom-fen',
        data: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        createdAt: '2023-01-01T00:00:00.000Z',
        preview: 'FEN Position',
      }

      const result = convertStoredAnalysisToWebGame(analysis)

      expect(result).toEqual({
        id: 'test-fen',
        type: 'custom-fen',
        label: 'Test FEN',
        result: '*',
        pgn: undefined,
      })
    })
  })

  describe('getCustomAnalysesAsWebGames', () => {
    it('should convert all stored analyses to web games', () => {
      const analyses = [
        {
          id: 'pgn-1',
          name: 'PGN Game',
          type: 'custom-pgn' as const,
          data: '1. e4 e5',
          createdAt: '2023-01-01T00:00:00.000Z',
          preview: 'Test vs Test',
        },
        {
          id: 'fen-1',
          name: 'FEN Position',
          type: 'custom-fen' as const,
          data: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          createdAt: '2023-01-01T00:00:00.000Z',
          preview: 'Starting Position',
        },
      ]
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(analyses))

      const result = getCustomAnalysesAsWebGames()

      expect(result).toEqual([
        {
          id: 'pgn-1',
          type: 'custom-pgn',
          label: 'PGN Game',
          result: '*',
          pgn: '1. e4 e5',
        },
        {
          id: 'fen-1',
          type: 'custom-fen',
          label: 'FEN Position',
          result: '*',
          pgn: undefined,
        },
      ])
    })

    it('should return empty array when no stored analyses', () => {
      mockLocalStorage.getItem.mockReturnValue('[]')

      const result = getCustomAnalysesAsWebGames()

      expect(result).toEqual([])
    })
  })
})

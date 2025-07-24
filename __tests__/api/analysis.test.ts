import {
  getAnalysisList,
  getAnalysisGameList,
  getLichessGames,
  getLichessGamePGN,
  getAnalyzedTournamentGame,
  getAnalyzedLichessGame,
  getAnalyzedCustomPGN,
  getAnalyzedCustomFEN,
  getAnalyzedCustomGame,
  getAnalyzedUserGame,
} from '../../src/api/analysis/analysis'

// Mock dependencies
jest.mock('../../src/api/utils', () => ({
  buildUrl: jest.fn((path: string) => `/api/v1/${path}`),
}))

jest.mock('../../src/lib/stockfish', () => ({
  cpToWinrate: jest.fn((cp: number) => 0.5 + cp / 2000),
}))

jest.mock('../../src/lib/customAnalysis', () => ({
  saveCustomAnalysis: jest.fn((type: string, data: string, name?: string) => ({
    id: `${type}-test-id`,
    name: name || 'Test Analysis',
    type: `custom-${type}`,
    data,
    createdAt: '2023-01-01T00:00:00Z',
  })),
  getCustomAnalysisById: jest.fn((id: string) => ({
    id,
    name: 'Test Analysis',
    type: 'custom-pgn',
    data: '1. e4 e5 2. Nf3',
    createdAt: '2023-01-01T00:00:00Z',
  })),
}))

jest.mock('chess.ts', () => ({
  Chess: jest.fn().mockImplementation(() => ({
    loadPgn: jest.fn(),
    load: jest.fn(),
    history: jest.fn().mockReturnValue([
      { from: 'e2', to: 'e4', san: 'e4' },
      { from: 'e7', to: 'e5', san: 'e5' },
    ]),
    header: jest.fn().mockReturnValue({
      White: 'Test White',
      Black: 'Test Black',
      Result: '1-0',
    }),
    fen: jest
      .fn()
      .mockReturnValue(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      ),
    inCheck: jest.fn().mockReturnValue(false),
    move: jest.fn(),
  })),
}))

jest.mock('../../src/types', () => ({
  GameTree: jest.fn().mockImplementation((fen: string) => ({
    getRoot: jest.fn().mockReturnValue({
      addStockfishAnalysis: jest.fn(),
      mainChild: null,
    }),
    addMainMove: jest.fn().mockReturnValue({
      addStockfishAnalysis: jest.fn(),
      mainChild: null,
    }),
  })),
}))

// Mock fetch
global.fetch = jest.fn()

// Polyfill TextEncoder for Node.js test environment
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

describe('Analysis API', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAnalysisList', () => {
    it('should fetch analysis list successfully', async () => {
      const mockData = new Map([
        ['tournament1', [{ id: 'game1', name: 'Test Game' }]],
      ])

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      } as any)

      const result = await getAnalysisList()

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/analysis/list')
      expect(result).toEqual(mockData)
    })

    it('should throw unauthorized error for 401 status', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      } as any)

      await expect(getAnalysisList()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getAnalysisGameList', () => {
    it('should fetch game list with default parameters', async () => {
      const mockData = { games: [], totalPages: 1 }

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      } as any)

      const result = await getAnalysisGameList()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/analysis/user/list/play/1',
      )
      expect(result).toEqual(mockData)
    })

    it('should fetch game list with custom parameters', async () => {
      const mockData = { games: [], totalPages: 1 }

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      } as any)

      await getAnalysisGameList('brain', 2, 'testuser')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/analysis/user/list/brain/2?lichess_id=testuser',
      )
    })

    it('should handle unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      } as any)

      await expect(getAnalysisGameList()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getLichessGames', () => {
    it('should stream lichess games', async () => {
      const mockOnMessage = jest.fn()
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('{"id":"game1"}\n'),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
      }

      mockFetch.mockResolvedValueOnce({
        body: { getReader: () => mockReader },
      } as any)

      await getLichessGames('testuser', mockOnMessage)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lichess.org/api/games/user/testuser?max=100&pgnInJson=true',
        {
          headers: {
            Accept: 'application/x-ndjson',
          },
        },
      )
    })
  })

  describe('getLichessGamePGN', () => {
    it('should fetch lichess game PGN', async () => {
      const mockPGN = '1. e4 e5 2. Nf3'

      mockFetch.mockResolvedValueOnce({
        text: jest.fn().mockResolvedValue(mockPGN),
      } as any)

      const result = await getLichessGamePGN('test-game-id')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lichess.org/game/export/test-game-id',
        {
          headers: {
            Accept: 'application/x-chess-pgn',
          },
        },
      )
      expect(result).toBe(mockPGN)
    })
  })

  describe('getAnalyzedTournamentGame', () => {
    it('should fetch and process tournament game', async () => {
      const mockData = {
        id: 'tournament-game-1',
        black_player: { name: 'Black Player', rating: 1500 },
        white_player: { name: 'White Player', rating: 1600 },
        termination: { result: '1-0', winner: 'white' },
        maia_versions: ['maia-1500'],
        maia_evals: { 'maia-1500': [{ e2e4: 0.5 }] },
        stockfish_evals: [{ e2e4: 50 }],
        move_maps: [
          [
            {
              move: ['e2', 'e4'],
              move_san: 'e4',
              check: false,
              fen: 'test-fen',
            },
          ],
        ],
        game_states: [
          {
            last_move: ['e2', 'e4'],
            fen: 'test-fen',
            check: false,
            last_move_san: 'e4',
            evaluations: {},
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      } as any)

      const result = await getAnalyzedTournamentGame(['test-game'])

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/analysis/analysis_list/test-game',
      )
      expect(result.id).toBe('tournament-game-1')
      expect(result.blackPlayer).toEqual({ name: 'Black Player', rating: 1500 })
    })

    it('should handle unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      } as any)

      await expect(getAnalyzedTournamentGame()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getAnalyzedLichessGame', () => {
    it('should analyze lichess game', async () => {
      const mockPGN = '1. e4 e5'
      const mockData = {
        black_player: { name: 'Black Player', rating: 1500 },
        white_player: { name: 'White Player', rating: 1600 },
        termination: { result: '1-0', winner: 'white' },
        maia_versions: ['maia-1500'],
        maia_evals: { 'maia-1500': [{ e2e4: 0.5 }] },
        move_maps: [
          [
            {
              move: ['e2', 'e4'],
              move_san: 'e4',
              check: false,
              fen: 'test-fen',
            },
          ],
        ],
        game_states: [
          {
            last_move: ['e2', 'e4'],
            fen: 'test-fen',
            check: false,
            last_move_san: 'e4',
            evaluations: {},
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      } as any)

      const result = await getAnalyzedLichessGame('test-id', mockPGN)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/analysis/analyze_user_game',
        {
          method: 'POST',
          body: mockPGN,
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      )
      expect(result.type).toBe('brain')
      expect(result.pgn).toBe(mockPGN)
    })
  })

  describe('getAnalyzedCustomPGN', () => {
    it('should create analyzed game from custom PGN', async () => {
      const mockPGN = '1. e4 e5'
      const { saveCustomAnalysis: mockSaveCustomAnalysis } = jest.requireMock(
        '../../src/lib/customAnalysis',
      )

      const result = await getAnalyzedCustomPGN(mockPGN, 'Test Game')

      expect(mockSaveCustomAnalysis).toHaveBeenCalledWith(
        'pgn',
        mockPGN,
        'Test Game',
      )
      expect(result.type).toBe('custom-pgn')
      expect(result.pgn).toBe(mockPGN)
    })
  })

  describe('getAnalyzedCustomFEN', () => {
    it('should create analyzed game from custom FEN', async () => {
      const mockFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const { saveCustomAnalysis: mockSaveCustomAnalysis } = jest.requireMock(
        '../../src/lib/customAnalysis',
      )

      const result = await getAnalyzedCustomFEN(mockFEN, 'Test Position')

      expect(mockSaveCustomAnalysis).toHaveBeenCalledWith(
        'fen',
        mockFEN,
        'Test Position',
      )
      expect(result.type).toBe('custom-fen')
    })
  })

  describe('getAnalyzedCustomGame', () => {
    it('should retrieve stored custom game', async () => {
      const { getCustomAnalysisById: mockGetCustomAnalysisById } =
        jest.requireMock('../../src/lib/customAnalysis')

      const result = await getAnalyzedCustomGame('test-id')

      expect(mockGetCustomAnalysisById).toHaveBeenCalledWith('test-id')
      expect(result.type).toBe('custom-pgn')
    })

    it('should throw error if custom analysis not found', async () => {
      const { getCustomAnalysisById: mockGetCustomAnalysisById } =
        jest.requireMock('../../src/lib/customAnalysis')
      mockGetCustomAnalysisById.mockReturnValueOnce(null)

      await expect(getAnalyzedCustomGame('non-existent')).rejects.toThrow(
        'Custom analysis not found',
      )
    })

    it('should handle FEN type custom analysis', async () => {
      const { getCustomAnalysisById: mockGetCustomAnalysisById } =
        jest.requireMock('../../src/lib/customAnalysis')
      mockGetCustomAnalysisById.mockReturnValueOnce({
        id: 'test-id',
        type: 'custom-fen',
        data: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      })

      const result = await getAnalyzedCustomGame('test-id')

      expect(result.type).toBe('custom-fen')
    })
  })

  describe('getAnalyzedUserGame', () => {
    it('should fetch and process user game', async () => {
      const mockData = {
        black_player: { name: 'maia_kdd_1500', rating: 1500 },
        white_player: { name: 'Test Player', rating: 1600 },
        termination: { result: '1-0', winner: 'white' },
        maia_versions: ['maia-1500'],
        maia_evals: { 'maia-1500': [{ e2e4: 0.5 }] },
        move_maps: [
          [
            {
              move: ['e2', 'e4'],
              move_san: 'e4',
              check: false,
              fen: 'test-fen',
            },
          ],
        ],
        game_states: [
          {
            last_move: ['e2', 'e4'],
            fen: 'test-fen',
            check: false,
            last_move_san: 'e4',
            evaluations: {},
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      } as any)

      const result = await getAnalyzedUserGame('test-id', 'play')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/analysis/user/analyze_user_maia_game/test-id?game_type=play',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      )
      expect(result.blackPlayer.name).toBe('Maia 1500')
      expect(result.type).toBe('brain')
    })

    it('should handle unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      } as any)

      await expect(getAnalyzedUserGame('test-id', 'play')).rejects.toThrow(
        'Unauthorized',
      )
    })
  })

  describe('Error handling', () => {
    it('should handle invalid PGN format', async () => {
      const { Chess: mockChess } = jest.requireMock('chess.ts')
      const mockInstance = {
        loadPgn: jest.fn().mockImplementation(() => {
          throw new Error('Invalid PGN')
        }),
      }
      mockChess.mockImplementation(() => mockInstance)

      await expect(getAnalyzedCustomPGN('invalid pgn')).rejects.toThrow(
        'Invalid PGN format',
      )
    })

    it('should handle invalid FEN format', async () => {
      const { Chess: mockChess } = jest.requireMock('chess.ts')
      const mockInstance = {
        load: jest.fn().mockImplementation(() => {
          throw new Error('Invalid FEN')
        }),
      }
      mockChess.mockImplementation(() => mockInstance)

      await expect(getAnalyzedCustomFEN('invalid fen')).rejects.toThrow(
        'Invalid FEN format',
      )
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(getAnalysisList()).rejects.toThrow('Network error')
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any)

      await expect(getAnalysisList()).rejects.toThrow('Invalid JSON')
    })
  })
})

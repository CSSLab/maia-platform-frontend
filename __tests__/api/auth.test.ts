import {
  getAccount,
  logoutAndGetAccount,
  getLeaderboard,
  getGlobalStats,
} from '../../src/api/auth/auth'

// Mock the buildUrl function
jest.mock('../../src/api', () => ({
  buildUrl: jest.fn((path: string) => `/api/v1/${path}`),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Auth API', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAccount', () => {
    it('should fetch and parse account information', async () => {
      const mockResponse = {
        client_id: 'test-client-123',
        display_name: 'Test User',
        lichess_id: 'testuser',
        extra_field: 'ignored',
      }

      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any)

      const result = await getAccount()

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/account')
      expect(result).toEqual({
        clientId: 'test-client-123',
        displayName: 'Test User',
        lichessId: 'testuser',
      })
    })

    it('should handle missing fields gracefully', async () => {
      const mockResponse = {
        client_id: 'test-client-123',
        // missing display_name and lichess_id
      }

      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any)

      const result = await getAccount()

      expect(result).toEqual({
        clientId: 'test-client-123',
        displayName: undefined,
        lichessId: undefined,
      })
    })

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({}),
      } as any)

      const result = await getAccount()

      expect(result).toEqual({
        clientId: undefined,
        displayName: undefined,
        lichessId: undefined,
      })
    })

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(getAccount()).rejects.toThrow('Network error')
    })

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any)

      await expect(getAccount()).rejects.toThrow('Invalid JSON')
    })
  })

  describe('logoutAndGetAccount', () => {
    it('should call logout endpoint then get account', async () => {
      const mockAccountResponse = {
        client_id: 'test-client-123',
        display_name: 'Test User',
        lichess_id: 'testuser',
      }

      // Mock logout call
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn(),
        } as any)
        // Mock getAccount call
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue(mockAccountResponse),
        } as any)

      const result = await logoutAndGetAccount()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/v1/auth/logout')
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/v1/auth/account')
      expect(result).toEqual({
        clientId: 'test-client-123',
        displayName: 'Test User',
        lichessId: 'testuser',
      })
    })

    it('should handle logout endpoint errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Logout failed'))

      await expect(logoutAndGetAccount()).rejects.toThrow('Logout failed')
    })

    it('should handle account fetch errors after successful logout', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn(),
        } as any)
        .mockRejectedValueOnce(new Error('Account fetch failed'))

      await expect(logoutAndGetAccount()).rejects.toThrow(
        'Account fetch failed',
      )
    })
  })

  describe('getLeaderboard', () => {
    it('should fetch leaderboard data', async () => {
      const mockLeaderboard = [
        { rank: 1, username: 'player1', rating: 2000 },
        { rank: 2, username: 'player2', rating: 1950 },
      ]

      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockLeaderboard),
      } as any)

      const result = await getLeaderboard()

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/leaderboard')
      expect(result).toEqual(mockLeaderboard)
    })

    it('should handle empty leaderboard', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue([]),
      } as any)

      const result = await getLeaderboard()

      expect(result).toEqual([])
    })

    it('should handle leaderboard fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Leaderboard unavailable'))

      await expect(getLeaderboard()).rejects.toThrow('Leaderboard unavailable')
    })
  })

  describe('getGlobalStats', () => {
    it('should fetch global statistics', async () => {
      const mockStats = {
        totalUsers: 50000,
        totalGames: 1000000,
        averageRating: 1500,
        activeUsers: 5000,
      }

      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockStats),
      } as any)

      const result = await getGlobalStats()

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/global_stats')
      expect(result).toEqual(mockStats)
    })

    it('should handle empty stats response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({}),
      } as any)

      const result = await getGlobalStats()

      expect(result).toEqual({})
    })

    it('should handle global stats fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Stats unavailable'))

      await expect(getGlobalStats()).rejects.toThrow('Stats unavailable')
    })

    it('should handle malformed stats response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(null),
      } as any)

      const result = await getGlobalStats()

      expect(result).toBeNull()
    })
  })
})

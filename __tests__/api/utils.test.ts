import { buildUrl, connectLichessUrl } from '../../src/api/utils'

describe('API Utils', () => {
  describe('buildUrl', () => {
    it('should build URL with base path', () => {
      const result = buildUrl('games/123')
      expect(result).toBe('/api/v1/games/123')
    })

    it('should handle empty path', () => {
      const result = buildUrl('')
      expect(result).toBe('/api/v1/')
    })

    it('should handle path with leading slash', () => {
      const result = buildUrl('/users/profile')
      expect(result).toBe('/api/v1//users/profile')
    })

    it('should handle complex paths', () => {
      const result = buildUrl('analysis/game/456/moves')
      expect(result).toBe('/api/v1/analysis/game/456/moves')
    })

    it('should handle paths with query parameters', () => {
      const result = buildUrl('games?limit=10&offset=0')
      expect(result).toBe('/api/v1/games?limit=10&offset=0')
    })

    it('should handle paths with special characters', () => {
      const result = buildUrl('search/players/test%20user')
      expect(result).toBe('/api/v1/search/players/test%20user')
    })
  })

  describe('connectLichessUrl', () => {
    it('should return correct lichess connection URL', () => {
      expect(connectLichessUrl).toBe('/api/v1/auth/lichess_login')
    })

    it('should be a string', () => {
      expect(typeof connectLichessUrl).toBe('string')
    })
  })
})
